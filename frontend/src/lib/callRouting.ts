/**
 * Модуль настроек маршрутизации звонков, сообщений и WebRTC для корпоративного инстанса Vondic.
 * 
 * Уровни конфигурации:
 * 1. Основные операции (Сообщения, Звонки, Сигналинг, Сокеты, API):
 *    - 'vondic_cloud': Все операции обслуживаются на https://vondic.ru
 *    - 'self_hosted': Все операции выполняются на собственном корпоративном сервере
 *    - 'hybrid': Приоритет своему серверу с авто-fallback на Vondic Cloud
 * 
 * 2. WebRTC STUN / TURN серверы (ICE-инфраструктура NAT Traversal):
 *    - 'vondic': Использовать стандартные надежные серверы Vondic (stun:vondic.ru:3478, turn:vondic.ru:3478).
 *      Позволяет работать даже на своих ресурсах без развертывания собственного тяжелого coturn!
 *    - 'custom': Использовать собственный STUN / TURN сервер компании с произвольными адресами и учетными данными.
 */

export type CallRoutingMode = 'vondic_cloud' | 'self_hosted' | 'hybrid'
export type IceSourceMode = 'vondic' | 'custom'

export interface CustomIceConfig {
	stun_urls: string[]
	turn_urls: string[]
	turn_username?: string
	turn_password?: string
}

export interface CallRoutingSettings {
	mode: CallRoutingMode
	ice_source: IceSourceMode
	vondic_cloud: {
		backend_url: string
		signaling_url: string
		webrtc_url: string
		stun_urls: string[]
		turn_urls: string[]
		turn_username?: string
		turn_password?: string
	}
	self_hosted: {
		backend_url: string
		signaling_url: string
		webrtc_url: string
		stun_urls: string[]
		turn_urls: string[]
		turn_username?: string
		turn_password?: string
	}
	custom_ice: CustomIceConfig
	force_relay: boolean
	enable_fallback: boolean
	fallback_timeout_ms: number
}

export const DEFAULT_VONDIC_ICE_SERVERS: RTCIceServer[] = [
	{
		urls: [
			'stun:vondic.ru:3478',
			'stun:webrtc.vondic.ru:3478',
			'stun:stun.l.google.com:19302',
		],
	},
	{
		urls: [
			'turn:vondic.ru:3478?transport=udp',
			'turn:vondic.ru:3478?transport=tcp',
			'turn:webrtc.vondic.ru:3478?transport=udp',
			'turn:webrtc.vondic.ru:3478?transport=tcp',
		],
		username: 'vondic',
		credential: 'Dim4566212Len',
	},
]

export const DEFAULT_CALL_ROUTING: CallRoutingSettings = {
	mode: 'vondic_cloud',
	ice_source: 'vondic',
	vondic_cloud: {
		backend_url: 'https://vondic.ru',
		signaling_url: 'https://vondic.ru',
		webrtc_url: 'https://webrtc.vondic.ru',
		stun_urls: [
			'stun:vondic.ru:3478',
			'stun:webrtc.vondic.ru:3478',
			'stun:stun.l.google.com:19302',
		],
		turn_urls: [
			'turn:vondic.ru:3478?transport=udp',
			'turn:vondic.ru:3478?transport=tcp',
			'turn:webrtc.vondic.ru:3478?transport=udp',
			'turn:webrtc.vondic.ru:3478?transport=tcp',
		],
		turn_username: 'vondic',
		turn_password: 'Dim4566212Len',
	},
	self_hosted: {
		backend_url: 'http://localhost:5050',
		signaling_url: 'http://localhost:5000',
		webrtc_url: 'http://localhost:5000',
		stun_urls: [
			'stun:192.168.140.11:3478',
			'stun:stun.l.google.com:19302',
		],
		turn_urls: [
			'turn:192.168.140.11:3478?transport=udp',
			'turn:192.168.140.11:3478?transport=tcp',
		],
		turn_username: 'vondic',
		turn_password: 'Dim4566212Len',
	},
	custom_ice: {
		stun_urls: [
			'stun:stun.l.google.com:19302',
		],
		turn_urls: [],
		turn_username: '',
		turn_password: '',
	},
	force_relay: false,
	enable_fallback: true,
	fallback_timeout_ms: 3500,
}

const STORAGE_KEY = 'vondic_call_routing_settings_v2'
const LEGACY_STORAGE_KEY = 'vondic_call_routing_settings_v1'

export function getStoredCallRoutingSettings(): CallRoutingSettings {
	if (typeof window === 'undefined') return DEFAULT_CALL_ROUTING
	try {
		const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY)
		if (!raw) return DEFAULT_CALL_ROUTING
		const parsed = JSON.parse(raw)
		return {
			...DEFAULT_CALL_ROUTING,
			...parsed,
			ice_source: parsed.ice_source || (parsed.mode === 'self_hosted' && parsed.self_hosted?.turn_urls?.length ? 'custom' : 'vondic'),
			vondic_cloud: { ...DEFAULT_CALL_ROUTING.vondic_cloud, ...(parsed.vondic_cloud || {}) },
			self_hosted: { ...DEFAULT_CALL_ROUTING.self_hosted, ...(parsed.self_hosted || {}) },
			custom_ice: { ...DEFAULT_CALL_ROUTING.custom_ice, ...(parsed.custom_ice || {}) },
		}
	} catch {
		return DEFAULT_CALL_ROUTING
	}
}

export function cacheCallRoutingSettings(settings: CallRoutingSettings): void {
	if (typeof window === 'undefined') return
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
		// Also update cookies for Next.js SSR and API route proxy awareness
		document.cookie = `vondic_routing_mode=${settings.mode}; path=/; max-age=31536000; SameSite=Lax`
		document.cookie = `vondic_ice_source=${settings.ice_source}; path=/; max-age=31536000; SameSite=Lax`
	} catch {}
}

export async function fetchCallRoutingSettings(): Promise<CallRoutingSettings> {
	try {
		const res = await fetch('/api/v1/call-routing')
		if (!res.ok) return getStoredCallRoutingSettings()
		const data = await res.json()
		if (data?.ok && data.settings) {
			const s = data.settings
			const merged: CallRoutingSettings = {
				...DEFAULT_CALL_ROUTING,
				...s,
				ice_source: s.ice_source || 'vondic',
				vondic_cloud: { ...DEFAULT_CALL_ROUTING.vondic_cloud, ...(s.vondic_cloud || {}) },
				self_hosted: { ...DEFAULT_CALL_ROUTING.self_hosted, ...(s.self_hosted || {}) },
				custom_ice: { ...DEFAULT_CALL_ROUTING.custom_ice, ...(s.custom_ice || {}) },
			}
			cacheCallRoutingSettings(merged)
			return merged
		}
	} catch {}
	return getStoredCallRoutingSettings()
}

export async function saveCallRoutingAdmin(settings: CallRoutingSettings): Promise<boolean> {
	try {
		const meRes = await fetch('/api/auth/me')
		const meData = await meRes.json().catch(() => ({}))
		const token = meData?.user?.access_token || meData?.access_token

		const headers: Record<string, string> = { 'Content-Type': 'application/json' }
		if (token) headers['Authorization'] = `Bearer ${token}`

		const res = await fetch('/api/v1/call-routing/admin', {
			method: 'PUT',
			headers,
			body: JSON.stringify({ settings }),
		})
		if (res.ok) {
			cacheCallRoutingSettings(settings)
			return true
		}
	} catch (e) {
		console.error('[CallRouting] save error:', e)
	}
	return false
}

export async function testCallRoutingEndpoint(url: string): Promise<{ ok: boolean; message: string; status_code?: number }> {
	try {
		const meRes = await fetch('/api/auth/me')
		const meData = await meRes.json().catch(() => ({}))
		const token = meData?.user?.access_token || meData?.access_token

		const headers: Record<string, string> = { 'Content-Type': 'application/json' }
		if (token) headers['Authorization'] = `Bearer ${token}`

		const res = await fetch('/api/v1/call-routing/admin/test', {
			method: 'POST',
			headers,
			body: JSON.stringify({ url }),
		})
		return await res.json()
	} catch (e: any) {
		return { ok: false, message: e?.message || 'Ошибка сети при проверке' }
	}
}

/**
 * Получение активного URL сигнального сервера (Socket.IO / WebRTC signaling)
 */
export function getActiveSignalingUrl(settings?: CallRoutingSettings): string {
	const cfg = settings || getStoredCallRoutingSettings()
	if (cfg.mode === 'self_hosted') {
		return cfg.self_hosted.signaling_url || cfg.self_hosted.webrtc_url || 'http://localhost:5000'
	}
	// 'vondic_cloud' или 'hybrid'
	return cfg.vondic_cloud.signaling_url || 'https://vondic.ru'
}

/**
 * Получение активного URL бэкенда (API)
 */
export function getActiveBackendUrl(settings?: CallRoutingSettings): string {
	const cfg = settings || getStoredCallRoutingSettings()
	if (cfg.mode === 'self_hosted') {
		return cfg.self_hosted.backend_url || 'http://localhost:5050'
	}
	return cfg.vondic_cloud.backend_url || 'https://vondic.ru'
}

/**
 * Получение активных ICE серверов (STUN/TURN).
 * Реализует требование:
 * - При 'vondic': Всегда используются стандартные STUN & TURN серверы Vondic (даже если операции на своем сервере!)
 * - При 'custom': Используются указанные администратором собственные STUN & TURN серверы
 */
export function getActiveIceServers(settings?: CallRoutingSettings): RTCIceServer[] {
	const cfg = settings || getStoredCallRoutingSettings()

	// 1. Пользовательский STUN/TURN сервер
	if (cfg.ice_source === 'custom') {
		const custom = cfg.custom_ice || {}
		const stuns = (custom.stun_urls || []).filter(Boolean)
		const turns = (custom.turn_urls || []).filter(Boolean)

		const servers: RTCIceServer[] = []
		if (stuns.length > 0) {
			servers.push({ urls: stuns })
		}
		if (turns.length > 0) {
			servers.push({
				urls: turns,
				username: custom.turn_username || '',
				credential: custom.turn_password || '',
			})
		}
		// Если ничего не заполнено, мягкий fallback на дефолтные серверы
		return servers.length ? servers : DEFAULT_VONDIC_ICE_SERVERS
	}

	// 2. Стандартные STUN/TURN серверы Vondic (для Vondic Cloud, Self-Hosted или Hybrid)
	const vc = cfg.vondic_cloud
	return [
		{
			urls: vc.stun_urls?.length ? vc.stun_urls : (DEFAULT_VONDIC_ICE_SERVERS[0].urls as string[]),
		},
		{
			urls: vc.turn_urls?.length ? vc.turn_urls : (DEFAULT_VONDIC_ICE_SERVERS[1].urls as string[]),
			username: vc.turn_username || 'vondic',
			credential: vc.turn_password || 'Dim4566212Len',
		},
	]
}
