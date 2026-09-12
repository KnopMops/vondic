/**
 * Vondic Traffic & Storage Optimizer (Telegram-Style Data & Storage).
 * 
 * Provides network-aware media auto-download policies, data-saver modes,
 * debounced event batching, and cache retention rules.
 */

import { evictOldMedia } from '../cache/indexedDbStorage'

export type NetworkType = 'wifi' | 'cellular' | '2g' | '3g' | '4g' | 'unknown'
export type DataSaverLevel = 'off' | 'low' | 'medium' | 'aggressive'

export interface AutoDownloadRules {
	photos: boolean
	audio: boolean
	video: boolean
	files: boolean
	maxPhotoBytes: number
	maxVideoBytes: number
	maxFileBytes: number
}

export interface DataStorageSettings {
	dataSaverLevel: DataSaverLevel
	cellularRules: AutoDownloadRules
	wifiRules: AutoDownloadRules
	roamingRules: AutoDownloadRules
	mediaRetentionDays: number // 0 = keep forever, 3, 7, 30
	compressAudioMessages: boolean
	debounceNetworkEvents: boolean
}

export const DEFAULT_DATA_STORAGE_SETTINGS: DataStorageSettings = {
	dataSaverLevel: 'off',
	cellularRules: {
		photos: true,
		audio: true,
		video: false,
		files: false,
		maxPhotoBytes: 2 * 1024 * 1024, // 2 MB
		maxVideoBytes: 5 * 1024 * 1024, // 5 MB
		maxFileBytes: 2 * 1024 * 1024, // 2 MB
	},
	wifiRules: {
		photos: true,
		audio: true,
		video: true,
		files: true,
		maxPhotoBytes: 15 * 1024 * 1024, // 15 MB
		maxVideoBytes: 25 * 1024 * 1024, // 25 MB
		maxFileBytes: 20 * 1024 * 1024, // 20 MB
	},
	roamingRules: {
		photos: false,
		audio: false,
		video: false,
		files: false,
		maxPhotoBytes: 512 * 1024,
		maxVideoBytes: 0,
		maxFileBytes: 0,
	},
	mediaRetentionDays: 30, // Default 30 days like Telegram
	compressAudioMessages: true,
	debounceNetworkEvents: true,
}

const STORAGE_KEY = 'vondic_data_storage_settings_v1'

export function loadDataStorageSettings(): DataStorageSettings {
	if (typeof window === 'undefined') return DEFAULT_DATA_STORAGE_SETTINGS
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		if (!raw) return DEFAULT_DATA_STORAGE_SETTINGS
		return {
			...DEFAULT_DATA_STORAGE_SETTINGS,
			...JSON.parse(raw),
		}
	} catch {
		return DEFAULT_DATA_STORAGE_SETTINGS
	}
}

export function saveDataStorageSettings(settings: DataStorageSettings): void {
	if (typeof window === 'undefined') return
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
		window.dispatchEvent(new CustomEvent('vondic-traffic-settings-changed', { detail: settings }))
	} catch (e) {
		console.warn('[TrafficManager] Failed to save settings:', e)
	}
}

// ==============================================================================
// Network Detection API
// ==============================================================================

export function getCurrentNetworkType(): NetworkType {
	if (typeof navigator === 'undefined') return 'unknown'
	const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection
	if (!conn) return 'wifi' // Default to wifi if API unsupported

	if (conn.type === 'cellular' || conn.type === 'bluetooth') return 'cellular'
	if (conn.type === 'wifi' || conn.type === 'ethernet') return 'wifi'

	const eff = conn.effectiveType
	if (eff === '2g' || eff === 'slow-2g') return '2g'
	if (eff === '3g') return '3g'
	if (eff === '4g') return '4g'

	return 'wifi'
}

export function isSaveDataActive(): boolean {
	if (typeof navigator === 'undefined') return false
	const conn = (navigator as any).connection
	if (conn?.saveData) return true
	const settings = loadDataStorageSettings()
	return settings.dataSaverLevel !== 'off'
}

// ==============================================================================
// Media Auto-Download Policy Checker
// ==============================================================================

export function shouldAutoDownloadMedia(
	mediaType: 'photo' | 'video' | 'audio' | 'file',
	sizeBytes?: number,
): boolean {
	const settings = loadDataStorageSettings()
	const netType = getCurrentNetworkType()

	// In aggressive data saver, never auto-download
	if (settings.dataSaverLevel === 'aggressive') return false

	let rules: AutoDownloadRules = settings.wifiRules
	if (netType === 'cellular' || netType === '2g' || netType === '3g') {
		rules = settings.cellularRules
	}

	const sz = sizeBytes || 0

	switch (mediaType) {
		case 'photo':
			if (!rules.photos) return false
			return sz === 0 || sz <= rules.maxPhotoBytes

		case 'audio':
			return rules.audio

		case 'video':
			if (!rules.video) return false
			return sz === 0 || sz <= rules.maxVideoBytes

		case 'file':
			if (!rules.files) return false
			return sz === 0 || sz <= rules.maxFileBytes

		default:
			return true
	}
}

// ==============================================================================
// Network Event Pulse Batcher (Debouncing read receipts and typing)
// ==============================================================================

class NetworkPulseBatcher {
	private pendingReadReceipts = new Map<string, Set<string>>()
	private readFlushTimer: ReturnType<typeof setTimeout> | null = null
	private typingCooldowns = new Map<string, number>()

	queueReadReceipt(
		chatId: string,
		messageId: string,
		flushCallback: (chatId: string, messageIds: string[]) => void,
	): void {
		let set = this.pendingReadReceipts.get(chatId)
		if (!set) {
			set = new Set()
			this.pendingReadReceipts.set(chatId, set)
		}
		set.add(messageId)

		if (!this.readFlushTimer) {
			this.readFlushTimer = setTimeout(() => {
				this.flushReadReceipts(flushCallback)
				this.readFlushTimer = null
			}, 600) // 600ms pulse batching
		}
	}

	private flushReadReceipts(flushCallback: (chatId: string, messageIds: string[]) => void): void {
		for (const [chatId, set] of this.pendingReadReceipts.entries()) {
			if (set.size > 0) {
				flushCallback(chatId, Array.from(set))
			}
		}
		this.pendingReadReceipts.clear()
	}

	canSendTyping(chatId: string): boolean {
		const now = Date.now()
		const last = this.typingCooldowns.get(chatId) || 0
		if (now - last > 2500) {
			this.typingCooldowns.set(chatId, now)
			return true
		}
		return false
	}
}

export const networkBatcher = new NetworkPulseBatcher()

// ==============================================================================
// Automatic Cache Retention Enforcer
// ==============================================================================

export function enforceMediaRetentionPolicy(): void {
	if (typeof window === 'undefined') return
	const settings = loadDataStorageSettings()
	if (settings.mediaRetentionDays > 0) {
		void evictOldMedia(settings.mediaRetentionDays).then(evicted => {
			if (evicted > 0) {
				console.log(`[TrafficManager] Evicted ${evicted} old media items per retention policy (${settings.mediaRetentionDays} days).`)
			}
		})
	}
}
