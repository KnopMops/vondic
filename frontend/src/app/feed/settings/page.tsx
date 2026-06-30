'use client'

import FeedPageShell from '@/components/social/FeedPageShell'
import DeveloperSettings from '@/components/settings/DeveloperSettings'
import MailApiSettings from '@/components/settings/MailApiSettings'
import PasswordInput from '@/components/ui/PasswordInput'
import { useAuth } from '@/lib/AuthContext'
import { setUser } from '@/lib/features/authSlice'
import { useAppDispatch } from '@/lib/hooks'
import { useToast } from '@/lib/ToastContext'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { FiBell, FiCode, FiLock, FiMail, FiMonitor, FiMessageCircle, FiMusic, FiPhoneCall, FiSettings, FiShield, FiVolume2 } from 'react-icons/fi'
import { HiOutlineColorSwatch } from 'react-icons/hi'
import { useEffect, useState } from 'react'
import { COLOR_SCHEMES, saveColorScheme, initColorScheme, type ColorSchemeId } from '@/lib/theme/colorSchemes'
import { getEncProxyUrl, setEncProxyUrl as saveEncProxyUrl, isEncProxyEnabled, getEncProxyClient, type EncProxyStatus } from '@/lib/encproxy'

const CHAT_THEMES = [
	{ id: 'default', name: 'Стандартный' },
	{ id: 'blue', name: 'Синий' },
	{ id: 'purple', name: 'Фиолетовый' },
	{ id: 'emerald', name: 'Изумрудный' },
	{ id: 'rose', name: 'Розовый' },
] as const

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

type SessionItem = {
	session_id: string
	ip?: string
	user_agent?: string
	device?: string
	platform?: string
	browser?: string
	created_at?: string
	last_seen?: string
	is_current?: boolean
}

export default function SettingsPage() {
	const { user, logout } = useAuth()
	const { showToast } = useToast()
	const [twoFAEnabled, setTwoFAEnabled] = useState(false)
	const [twoFAMethod, setTwoFAMethod] = useState<'email' | 'totp'>('email')
	const [secretKey, setSecretKey] = useState<string | null>(null)
	const [emailCode, setEmailCode] = useState('')
	const [loginAlertEnabled, setLoginAlertEnabled] = useState(false)
	const [developerEnabled, setDeveloperEnabled] = useState(false)
	const [apiKey, setApiKey] = useState<string | null>(null)
	const [apiKeyLoading, setApiKeyLoading] = useState(false)
	const [notifAlerts, setNotifAlerts] = useState(true)
	const [notifSounds, setNotifSounds] = useState(true)
	const [notifIncomingCall, setNotifIncomingCall] = useState(true)
	const [theme, setTheme] = useState<'system' | 'dark' | 'light'>('system')
	const [fontSize, setFontSize] = useState<number>(14)
	const [borderRadius, setBorderRadius] = useState<number>(12)
	const [fontFamily, setFontFamily] = useState<string>(
		"var(--font-geist-sans), system-ui, -apple-system, 'Segoe UI', Roboto, Arial, 'Noto Sans', 'Liberation Sans', sans-serif",
	)
	const [colorSchemeId, setColorSchemeId] = useState<ColorSchemeId>('purple')
	const [chatThemeId, setChatThemeId] = useState<string>('default')
	const [messageThemeId, setMessageThemeId] = useState<string>('default')
	const [chatBackgroundImage, setChatBackgroundImage] = useState<string>('')
	const [chatBgOpacity, setChatBgOpacity] = useState<number>(70)
	const [chatBgBlur, setChatBgBlur] = useState<number>(6)
	const [chatBgGrid, setChatBgGrid] = useState<boolean>(false)
	const [deleteConfirmText, setDeleteConfirmText] = useState('')
	const [deleteLoading, setDeleteLoading] = useState(false)
	const [sessions, setSessions] = useState<SessionItem[]>([])
	const [sessionsLoading, setSessionsLoading] = useState(false)
	const [terminatingSessionIds, setTerminatingSessionIds] = useState<string[]>(
		[],
	)
	const [changePasswordOpen, setChangePasswordOpen] = useState(false)
	const [currentPassword, setCurrentPassword] = useState('')
	const [newPassword, setNewPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [changePasswordLoading, setChangePasswordLoading] = useState(false)
	const [activeTab, setActiveTab] = useState<
		'system' | 'mail' | 'interface' | 'sounds'
	>('system')
	const [ringtoneVolume, setRingtoneVolume] = useState<number>(70)
	const [messageVolume, setMessageVolume] = useState<number>(50)
	const [isOauthModalOpen, setIsOauthModalOpen] = useState(false)
	const [encProxyUrl, setEncProxyUrlState] = useState('')
	const [encProxyStatus, setEncProxyStatusState] = useState<EncProxyStatus>('disconnected')
	const [encProxyConnected, setEncProxyConnected] = useState(false)

	const dispatch = useAppDispatch()

	useEffect(() => {
		if (user) {
			setTwoFAEnabled(!!user.two_factor_enabled)
			const method =
				user.two_factor_method === 'totp' || user.two_factor_secret
					? 'totp'
					: 'email'
			setTwoFAMethod(method)
			setSecretKey(user.two_factor_secret || null)
			setLoginAlertEnabled(!!user.login_alert_enabled)
			setDeveloperEnabled(!!user.is_developer)
		}
	}, [user?.id])

	const loadSessions = async () => {
		setSessionsLoading(true)
		try {
			const res = await fetch('/api/auth/sessions')
			const data = await res.json()
			if (!res.ok) {
				throw new Error(data.error || 'Не удалось получить сессии')
			}
			const items = (Array.isArray(data.sessions) ? data.sessions : []).map((s: any) => ({
				session_id: s.id,
				device: s.device_type || 'web',
				browser: s.device_name || s.device_type || 'web',
				ip: s.ip_address || '—',
				user_agent: s.device_name || s.device_type || 'web',
				last_seen: s.last_active,
				created_at: s.created_at,
				is_current: false,
			}))
			setSessions(items)
		} catch (e: any) {
			showToast(e.message || 'Не удалось получить сессии', 'error')
		} finally {
			setSessionsLoading(false)
		}
	}

	useEffect(() => {
		if (user?.id) {
			loadSessions()
		}
	}, [user?.id])

	const applyTheme = (nextTheme: 'system' | 'dark' | 'light') => {
		const root = document.documentElement
		if (nextTheme === 'system') {
			root.removeAttribute('data-theme')
			root.style.colorScheme = ''
			return
		}
		root.setAttribute('data-theme', nextTheme)
		root.style.colorScheme = nextTheme
	}

	useEffect(() => {
		const savedTheme = localStorage.getItem('app_theme')
		if (
			savedTheme === 'system' ||
			savedTheme === 'dark' ||
			savedTheme === 'light'
		) {
			setTheme(savedTheme)
			applyTheme(savedTheme)
		} else {
			applyTheme('system')
		}
		initColorScheme()
	}, [])

	useEffect(() => {
		const savedFontSize = localStorage.getItem('app_font_size')
		const savedBorderRadius = localStorage.getItem('app_border_radius')
		const savedFontFamily = localStorage.getItem('app_font_family')
		const savedChatThemeId = localStorage.getItem('chat_theme')
		const savedMessageThemeId = localStorage.getItem('message_theme')
		const savedChatBgImage = localStorage.getItem('chat_background_image')
		const savedOpacity = localStorage.getItem('chat_bg_opacity')
		const savedBlur = localStorage.getItem('chat_bg_blur')
		const savedGrid = localStorage.getItem('chat_bg_grid')
		if (savedFontSize) {
			const val = Number(savedFontSize)
			setFontSize(val)
			document.documentElement.style.fontSize = `${val}px`
		}
		if (savedBorderRadius) {
			const val = Number(savedBorderRadius)
			setBorderRadius(val)
			document.documentElement.style.setProperty('--app-radius', `${val}px`)
		}
		if (savedFontFamily) {
			setFontFamily(savedFontFamily)
			document.documentElement.style.setProperty('--app-font-family', savedFontFamily)
		}
		const savedColorScheme = localStorage.getItem('app_color_scheme')
		if (savedColorScheme) setColorSchemeId(savedColorScheme)
		if (savedChatThemeId) setChatThemeId(savedChatThemeId)
		if (savedMessageThemeId) setMessageThemeId(savedMessageThemeId)
		if (savedChatBgImage) setChatBackgroundImage(savedChatBgImage)
		if (savedOpacity) {
			const n = Number(savedOpacity)
			if (!Number.isNaN(n)) setChatBgOpacity(clamp(n, 0, 100))
		}
		if (savedBlur) {
			const n = Number(savedBlur)
			if (!Number.isNaN(n)) setChatBgBlur(clamp(n, 0, 30))
		}
		if (savedGrid) setChatBgGrid(savedGrid === 'true')
	}, [])

	useEffect(() => {
		document.documentElement.style.fontSize = `${fontSize}px`
		localStorage.setItem('app_font_size', fontSize.toString())
	}, [fontSize])

	useEffect(() => {
		document.documentElement.style.setProperty(
			'--app-radius',
			`${borderRadius}px`,
		)
		localStorage.setItem('app_border_radius', borderRadius.toString())
	}, [borderRadius])

	useEffect(() => {
		document.documentElement.style.setProperty('--app-font-family', fontFamily)
		localStorage.setItem('app_font_family', fontFamily)
	}, [fontFamily])

	useEffect(() => {
		localStorage.setItem('chat_bg_opacity', String(chatBgOpacity))
	}, [chatBgOpacity])

	useEffect(() => {
		localStorage.setItem('chat_bg_blur', String(chatBgBlur))
	}, [chatBgBlur])

	useEffect(() => {
		localStorage.setItem('chat_bg_grid', chatBgGrid ? 'true' : 'false')
	}, [chatBgGrid])

	useEffect(() => {
		applyTheme(theme)
		localStorage.setItem('app_theme', theme)
	}, [theme])

	const isYandexAccount = !!user?.email?.endsWith('@yandex.ru')

	useEffect(() => {
		const saved = getEncProxyUrl()
		if (saved) setEncProxyUrlState(saved)
		const client = getEncProxyClient()
		setEncProxyConnected(client.isConnected)
		const unsub = client.on('statusChange', (s) => {
			setEncProxyStatusState(s)
			setEncProxyConnected(s === 'connected')
		})
		return unsub
	}, [])

	const toggleEncProxy = () => {
		const current = getEncProxyUrl()
		if (current) {
			saveEncProxyUrl(null)
			setEncProxyUrlState('')
			setEncProxyConnected(false)
			const client = getEncProxyClient()
			client.disconnect()
			showToast('EncProxy отключён', 'success')
		} else {
			const url = encProxyUrl.trim()
			if (!url) {
				showToast('Введите URL EncProxy сервера', 'error')
				return
			}
			saveEncProxyUrl(url)
			showToast('EncProxy подключён', 'success')
		}
	}

	const connectEncProxy = () => {
		const url = encProxyUrl.trim()
		if (!url) {
			showToast('Введите URL EncProxy сервера', 'error')
			return
		}
		saveEncProxyUrl(url)
		const client = getEncProxyClient()
		const token = localStorage.getItem('access_token') || ''
		client.connect({ serverUrl: url, accessToken: token, userId: String(user?.id || '') })
		showToast('Подключение к EncProxy...', 'success')
	}

	const toggleTwoFA = async () => {
		if (isYandexAccount) {
			showToast('для yandex аккаунта это не недоступно', 'error')
			return
		}
		const enable = !twoFAEnabled
		setTwoFAEnabled(enable)
		try {
			const res = await fetch('/api/auth/2fa/setup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ method: twoFAMethod, enable }),
			})
			const data = await res.json()
			if (!res.ok) throw new Error(data.error || 'Ошибка обновления 2FA')
			if (data.user?.two_factor_secret) {
				setSecretKey(data.user.two_factor_secret)
			} else {
				setSecretKey(null)
			}
			showToast(enable ? '2FA включена' : '2FA отключена', 'success')
		} catch (e: any) {
			showToast(e.message || 'Ошибка 2FA', 'error')
		}
	}

	const selectMethod = async (m: 'email' | 'totp') => {
		if (isYandexAccount) {
			showToast('для yandex аккаунта это не недоступно', 'error')
			return
		}
		setTwoFAMethod(m)
		try {
			const res = await fetch('/api/auth/2fa/setup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ method: m, enable: true }),
			})
			const data = await res.json()
			if (!res.ok) throw new Error(data.error || 'Ошибка выбора метода 2FA')
			setTwoFAEnabled(true)
			setSecretKey(data.user?.two_factor_secret || null)
			if (m === 'email') setSecretKey(null)
			showToast(
				m === 'totp'
					? 'Вход по секретному ключу (приложение аутентификации)'
					: 'Вход по коду на почту',
				'success',
			)
		} catch (e: any) {
			showToast(e.message || 'Ошибка метода 2FA', 'error')
		}
	}

	const generateSecret = async () => {
		try {
			const res = await fetch('/api/auth/2fa/setup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					method: 'totp',
					enable: true,
					regenerate_secret: true,
				}),
			})
			const data = await res.json()
			if (!res.ok) throw new Error(data.error || 'Не удалось получить секрет')
			setTwoFAEnabled(true)
			setTwoFAMethod('totp')
			setSecretKey(data.user?.two_factor_secret || null)
			showToast('Секретный ключ сгенерирован', 'success')
		} catch (e: any) {
			showToast(e.message || 'Ошибка генерации секрета', 'error')
		}
	}

	const sendEmailCode = async () => {
		try {
			const res = await fetch('/api/auth/2fa/email/send', { method: 'POST' })
			const data = await res.json()
			if (!res.ok) throw new Error(data.error || 'Не удалось отправить код')
			setTwoFAEnabled(true)
			setTwoFAMethod('email')
			if (data.dev_code) {
				setEmailCode(data.dev_code)
				showToast(`Код (dev): ${data.dev_code}`, 'success')
			} else {
				showToast('Код отправлен на почту', 'success')
			}
		} catch (e: any) {
			showToast(e.message || 'Ошибка отправки кода', 'error')
		}
	}

	const verifyEmailCode = async () => {
		try {
			const res = await fetch('/api/auth/2fa/email/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code: emailCode }),
			})
			const data = await res.json()
			if (!res.ok) throw new Error(data.error || 'Неверный код')
			setEmailCode('')
			showToast('Код подтверждён', 'success')
		} catch (e: any) {
			showToast(e.message || 'Ошибка подтверждения кода', 'error')
		}
	}

	const toggleLoginAlert = async () => {
		const next = !loginAlertEnabled
		setLoginAlertEnabled(next)
		try {
			const res = await fetch('/api/auth/login-alerts/toggle', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ enable: next }),
			})
			const data = await res.json()
			if (!res.ok) throw new Error(data.error || 'Ошибка уведомлений о входе')
			showToast(
				next ? 'Оповещения о входе включены' : 'Оповещения о входе отключены',
				'success',
			)
		} catch (e: any) {
			showToast(e.message || 'Ошибка', 'error')
		}
	}

	const loadApiKey = async () => {
		try {
			const res = await fetch('/api/auth/api-key', {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' },
			})
			const data = await res.json()
			if (!res.ok) throw new Error(data.error || 'Ошибка загрузки ключа')
			setApiKey(data.api_key || null)
		} catch (e: any) {
			setApiKey(null)
		}
	}

	const toggleDeveloper = async () => {
		const next = !developerEnabled
		setDeveloperEnabled(next)
		try {
			const res = await fetch('/api/auth/developer/toggle', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ enable: next }),
			})
			const data = await res.json()
			if (!res.ok) throw new Error(data.error || 'Ошибка обновления')
			const updatedUser = data?.user || data
			if (updatedUser) {
				dispatch(setUser(updatedUser))
				localStorage.setItem('user', JSON.stringify(updatedUser))
			}
			if (!next) setApiKey(null)
			if (next) await loadApiKey()
			showToast(
				next ? 'Режим разработчика включён' : 'Режим разработчика отключён',
				'success',
			)
		} catch (e: any) {
			setDeveloperEnabled(!next)
			showToast(e.message || 'Ошибка', 'error')
		}
	}

	const generateApiKey = async () => {
		setApiKeyLoading(true)
		try {
			const res = await fetch('/api/auth/api-key', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
			})
			const data = await res.json()
			if (!res.ok) throw new Error(data.error || 'Ошибка генерации ключа')
			if (data.api_key) {
				setApiKey(data.api_key)
			}
			showToast('API ключ создан', 'success')
		} catch (e: any) {
			showToast(e.message || 'Ошибка', 'error')
		} finally {
			setApiKeyLoading(false)
		}
	}

	useEffect(() => {
		if (developerEnabled) {
			loadApiKey()
		} else {
			setApiKey(null)
		}
	}, [developerEnabled])

	const handleDeleteAccount = async () => {
		if (!user) return
		const normalized = deleteConfirmText.trim().toLowerCase()
		if (normalized !== 'удалить') {
			showToast('Введите УДАЛИТЬ для подтверждения', 'error')
			return
		}
		setDeleteLoading(true)
		try {
			const res = await fetch('/api/users/delete', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ user_id: user.id }),
			})
			const data = await res.json().catch(() => ({}))
			if (!res.ok) {
				throw new Error(data.error || 'Не удалось удалить аккаунт')
			}
			showToast('Аккаунт удалён', 'success')
			logout()
		} catch (e: any) {
			showToast(e.message || 'Не удалось удалить аккаунт', 'error')
		} finally {
			setDeleteLoading(false)
		}
	}

	const terminateSession = async (sessionId: string) => {
		setTerminatingSessionIds(prev => [...prev, sessionId])
		try {
			const res = await fetch(`/api/auth/sessions/${sessionId}`, {
				method: 'DELETE',
			})
			const data = await res.json()
			if (!res.ok) throw new Error(data.error || 'Не удалось завершить сессию')
			setSessions(prev => prev.filter(item => item.session_id !== sessionId))
			showToast('Сессия завершена', 'success')
		} catch (e: any) {
			showToast(e.message || 'Не удалось завершить сессию', 'error')
		} finally {
			setTerminatingSessionIds(prev => prev.filter(id => id !== sessionId))
		}
	}

	const handleChangePassword = async () => {
		setChangePasswordLoading(true)
		try {
			const res = await fetch('/api/auth/forgot-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: user?.email }),
			})
			const data = await res.json().catch(() => ({}))
			if (!res.ok) {
				throw new Error(data.error || 'Не удалось отправить ссылку')
			}
			showToast('Ссылка для смены пароля отправлена на почту', 'success')
			setChangePasswordOpen(false)
		} catch (e: any) {
			showToast(e.message || 'Не удалось отправить ссылку', 'error')
		} finally {
			setChangePasswordLoading(false)
		}
	}

	const formatDateTime = (value?: string) => {
		if (!value) return '—'
		const date = new Date(value)
		if (Number.isNaN(date.getTime())) return value
		return date.toLocaleString('ru-RU')
	}

	const getSessionLabel = (session: SessionItem) => {
		const parts = [
			formatDevice(session.device),
			formatPlatform(session.platform),
		].filter(Boolean)
		return parts.length ? parts.join(' · ') : 'Устройство'
	}
	const formatBrowser = (value?: string) => {
		if (!value) return '—'
		if (value === 'unknown' || value === 'node') return ''
		if (value === 'edge') return 'Edge'
		if (value === 'chrome') return 'Chrome'
		if (value === 'firefox') return 'Firefox'
		if (value === 'safari') return 'Safari'
		if (value === 'opera') return 'Opera'
		if (value === 'web') return 'Браузер'
		if (value === 'desktop') return 'Desktop'
		if (value === 'mobile') return 'Mobile'
		return value
	}

	const formatDevice = (value?: string) => {
		if (!value) return ''
		if (value === 'unknown') return ''
		if (value === 'web') return 'Браузер'
		if (value === 'desktop') return 'Компьютер'
		if (value === 'mobile') return 'Телефон'
		if (value === 'tablet') return 'Планшет'
		return value
	}

	const formatPlatform = (value?: string) => {
		if (!value) return ''
		if (value === 'unknown') return ''
		if (value === 'macos') return 'macOS'
		if (value === 'ios') return 'iOS'
		if (value === 'android') return 'Android'
		if (value === 'windows') return 'Windows'
		return value
	}

	if (!user) return null

	return (
		<FeedPageShell email={user.email} onLogout={logout}>
			<div className='max-w-3xl mx-auto space-y-8'>
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.4 }}
					className='relative rounded-2xl bg-white/5 border border-white/10 p-6 overflow-hidden'
				>
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ duration: 0.8 }}
						className='absolute -top-24 -right-24 w-64 h-64 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full blur-3xl'
					/>
					<h1 className='text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400'>
						Настройки
					</h1>
					<p className='text-sm text-gray-400 mt-2'>
						Управляйте настройками вашего аккаунта.
					</p>
				</motion.div>

				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.4 }}
					className='relative rounded-2xl bg-white/5 border border-white/10 p-2 overflow-hidden'
				>
					<div className='flex gap-1'>
						<button
							onClick={() => setActiveTab('system')}
							className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
								activeTab === 'system'
									? 'bg-indigo-500/20 text-white'
									: 'text-gray-400 hover:text-white hover:bg-white/5'
							}`}
						>
							<FiSettings className='w-4 h-4' />
							Системные
						</button>
						<button
							onClick={() => setActiveTab('mail')}
							className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
								activeTab === 'mail'
									? 'bg-indigo-500/20 text-white'
									: 'text-gray-400 hover:text-white hover:bg-white/5'
							}`}
						>
							<FiMail className='w-4 h-4' />
							Почта
						</button>
						<button
							onClick={() => setActiveTab('interface')}
							className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
								activeTab === 'interface'
									? 'bg-indigo-500/20 text-white'
									: 'text-gray-400 hover:text-white hover:bg-white/5'
							}`}
						>
							<FiMonitor className='w-4 h-4' />
							Интерфейс
						</button>
						<button
							onClick={() => setActiveTab('sounds')}
							className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
								activeTab === 'sounds'
									? 'bg-indigo-500/20 text-white'
									: 'text-gray-400 hover:text-white hover:bg-white/5'
							}`}
						>
							<FiMusic className='w-4 h-4' />
							Звуки
						</button>
					</div>
				</motion.div>

				{activeTab === 'system' && (
					<>
						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.4 }}
							className='relative rounded-2xl bg-white/5 border border-white/10 p-6 overflow-hidden'
						>
							<motion.div
								initial={{ rotate: 0 }}
								animate={{ rotate: [0, 2, -2, 0] }}
								transition={{ duration: 8, repeat: Infinity }}
								className='absolute -top-20 -right-16 w-52 h-52 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-full blur-3xl'
							/>
							<div className='flex items-center gap-3 mb-4'>
								<FiCode className='w-5 h-5 text-emerald-400' />
								<h2 className='text-xl font-semibold'>Разработчик</h2>
							</div>
							<div className='space-y-4'>
								<div className='flex items-center justify-between'>
									<div>
										<p className='text-sm font-medium text-white'>
											Я разработчик
										</p>
										<p className='text-xs text-gray-400'>
											Доступ к публичной API и ключам
										</p>
									</div>
									<button
										onClick={toggleDeveloper}
										className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${developerEnabled ? 'bg-emerald-500/60' : 'bg-white/10'}`}
									>
										<span
											className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${developerEnabled ? 'translate-x-6' : 'translate-x-1'}`}
										/>
									</button>
								</div>
								{developerEnabled && (
									<div className='space-y-4'>
										<div className='flex flex-wrap gap-2'>
											<button
												onClick={generateApiKey}
												disabled={apiKeyLoading}
												className='rounded-lg bg-white/10 border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/20 transition disabled:opacity-60'
											>
												{apiKeyLoading
													? 'Генерация...'
													: 'Сгенерировать API ключ'}
											</button>
											<button
												onClick={() => setIsOauthModalOpen(true)}
												className='rounded-lg bg-indigo-500/20 border border-indigo-500/30 px-4 py-2 text-sm text-indigo-300 hover:bg-indigo-500/30 transition'
											>
												OAuth приложения
											</button>
										</div>
										<div className='rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-gray-300 break-all font-mono'>
											{apiKey || 'Ключ появится здесь после генерации'}
										</div>
									</div>
								)}
							</div>
						</motion.div>

						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.4 }}
							className='relative rounded-2xl bg-white/5 border border-white/10 p-6 overflow-hidden'
						>
							<motion.div
								initial={{ opacity: 0.3 }}
								animate={{ opacity: [0.3, 0.6, 0.3] }}
								transition={{ duration: 5, repeat: Infinity }}
								className='absolute -bottom-24 -left-24 w-64 h-64 bg-gradient-to-tr from-violet-500/10 to-purple-500/10 rounded-full blur-3xl'
							/>
							<div className='flex items-center gap-3 mb-4'>
								<FiLock className='w-5 h-5 text-violet-400' />
								<h2 className='text-xl font-semibold'>EncProxy</h2>
								{encProxyConnected && (
									<span className='rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] text-emerald-300 border border-emerald-500/30'>
										Использует EncProxy
									</span>
								)}
							</div>
							<p className='text-xs text-gray-400 mb-4'>
								Сервер шифрования для end-to-end зашифрованных сообщений. Ключи хранятся только на ваших устройствах.
							</p>
							<div className='space-y-3'>
								<div className='flex items-center justify-between'>
									<div>
										<p className='text-sm font-medium text-white'>
											EncProxy
										</p>
										<p className='text-xs text-gray-400'>
											{encProxyConnected
												? 'Подключён к серверу шифрования'
												: getEncProxyUrl()
													? 'URL сохранён (отключён)'
													: 'Не настроен'}
										</p>
									</div>
									<button
										onClick={toggleEncProxy}
										className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${encProxyConnected ? 'bg-emerald-500/60' : getEncProxyUrl() ? 'bg-violet-500/40' : 'bg-white/10'}`}
									>
										<span
											className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${encProxyConnected ? 'translate-x-6' : getEncProxyUrl() ? 'translate-x-6' : 'translate-x-1'}`}
										/>
									</button>
								</div>
								<div className='space-y-2'>
									<p className='text-sm text-white'>EncProxy URL</p>
									<div className='flex gap-2'>
										<input
											value={encProxyUrl}
											onChange={e => setEncProxyUrlState(e.target.value)}
											placeholder='wss://encproxy.example.com'
											className='flex-1 rounded-lg border border-white/10 bg-black/30 p-2 text-sm text-white placeholder:text-gray-500 font-mono'
										/>
										<button
											onClick={connectEncProxy}
											disabled={!encProxyUrl.trim()}
											className='rounded-lg bg-violet-500/20 border border-violet-500/30 px-4 py-2 text-sm text-violet-300 hover:bg-violet-500/30 transition disabled:opacity-40'
										>
											Подключить
										</button>
									</div>
								</div>
								{encProxyConnected && (
									<div className='rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3'>
										<div className='flex items-center gap-2'>
											<div className='w-2 h-2 rounded-full bg-emerald-400 animate-pulse' />
											<span className='text-sm text-emerald-300'>
												Использует EncProxy
											</span>
										</div>
										<p className='text-xs text-gray-400 mt-1'>
											Сообщения шифруются на клиенте и передаются через EncProxy
										</p>
									</div>
								)}
							</div>
						</motion.div>

						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.4 }}
							className='relative rounded-2xl bg-white/5 border border-white/10 p-6 overflow-hidden'
						>
							<motion.div
								initial={{ opacity: 0.3 }}
								animate={{ opacity: [0.3, 0.6, 0.3] }}
								transition={{ duration: 5, repeat: Infinity }}
								className='absolute -bottom-24 -left-24 w-64 h-64 bg-gradient-to-tr from-emerald-500/10 to-teal-500/10 rounded-full blur-3xl'
							/>
							<div className='flex items-center gap-3 mb-4'>
								<FiShield className='w-5 h-5 text-indigo-400' />
								<h2 className='text-xl font-semibold'>Безопасность</h2>
							</div>
							<div className='space-y-4'>
								<div className='flex items-center justify-between'>
									<div>
										<p className='text-sm font-medium text-white'>
											Двухфакторная аутентификация
										</p>
										<p className='text-xs text-gray-400'>
											Дополнительная защита аккаунта
										</p>
									</div>
									<button
										onClick={toggleTwoFA}
										disabled={isYandexAccount}
										className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${twoFAEnabled ? 'bg-emerald-500/60' : 'bg-white/10'} ${isYandexAccount ? 'opacity-50 cursor-not-allowed' : ''}`}
									>
										<span
											className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${twoFAEnabled ? 'translate-x-7' : 'translate-x-1'}`}
										/>
									</button>
								</div>
										{twoFAEnabled && (
											<div className='mt-2 rounded-xl border border-white/10 bg-white/5 p-4'>
												{isYandexAccount && (
													<p className='text-xs text-red-400 mb-2'>
														для yandex аккаунта это не недоступно
													</p>
												)}
												<div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
													<div className='space-y-2'>
														<p className='text-sm text-white'>Метод</p>
														<div className='flex gap-2'>
															<button
																onClick={() => selectMethod('email')}
																className={`rounded-lg px-3 py-2 text-sm border ${twoFAMethod === 'email' ? 'border-indigo-500 bg-indigo-500/20 text-white' : 'border-white/10 bg-white/5 text-gray-300'}`}
															>
																Код на почту
															</button>
															<button
																onClick={() => selectMethod('totp')}
																className={`rounded-lg px-3 py-2 text-sm border ${twoFAMethod === 'totp' ? 'border-indigo-500 bg-indigo-500/20 text-white' : 'border-white/10 bg-white/5 text-gray-300'}`}
															>
																Секретный ключ
															</button>
														</div>
													</div>
													<div className='space-y-2'>
														<p className='text-sm text-white'>
															Оповещение о входе
														</p>
														<div className='flex items-center justify-between rounded-lg border border-white/10 bg-black/30 p-3'>
															<div className='flex items-center gap-2'>
																<FiMail className='w-4 h-4 text-indigo-300' />
																<span className='text-sm text-gray-300'>
																	Отправлять письмо при входе
																</span>
															</div>
															<button
																onClick={toggleLoginAlert}
																className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${loginAlertEnabled ? 'bg-emerald-500/60' : 'bg-white/10'}`}
															>
																<span
																	className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${loginAlertEnabled ? 'translate-x-6' : 'translate-x-1'}`}
																/>
															</button>
														</div>
													</div>
												</div>
												{twoFAMethod === 'totp' && (
													<div className='mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3'>
														<div className='rounded-lg border border-white/10 bg-black/30 h-32 flex items-center justify-center text-gray-500 text-sm'>
															QR-код
														</div>
														<div className='space-y-2'>
															<div className='rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-gray-300'>
																{secretKey
																	? `Секрет: ${secretKey}`
																	: 'Секрет не сгенерирован'}
															</div>
															<button
																onClick={generateSecret}
																className='rounded-lg bg-white/10 border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/20 transition'
															>
																Сгенерировать секретный ключ
															</button>
														</div>
													</div>
												)}
												{twoFAMethod === 'email' && (
													<div className='mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3'>
														<div className='space-y-2'>
															<button
																onClick={sendEmailCode}
																className='rounded-lg bg-white/10 border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/20 transition'
															>
																Отправить код на почту
															</button>
														</div>
														<div className='space-y-2'>
															<input
																value={emailCode}
																onChange={e => setEmailCode(e.target.value)}
																placeholder='Введите код'
																className='w-full rounded-lg border border-white/10 bg-black/30 p-2 text-sm text-white placeholder:text-gray-500'
															/>
															<button
																onClick={verifyEmailCode}
																className='rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-4 py-2 text-sm text-white hover:bg-emerald-500/30 transition'
															>
																Подтвердить код
															</button>
														</div>
													</div>
												)}
											</div>
										)}
										<div className='mt-4 rounded-xl border border-white/10 bg-black/30 p-4'>
											<div className='flex items-center justify-between mb-3'>
												<div>
													<p className='text-sm font-medium text-white'>
														Сессии
													</p>
													<p className='text-xs text-gray-400'>
														Устройства, где выполнен вход
													</p>
												</div>
												<button
													onClick={loadSessions}
													disabled={sessionsLoading}
													className='rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300 hover:bg-white/10 transition disabled:opacity-60'
												>
													{sessionsLoading ? 'Обновление...' : 'Обновить'}
												</button>
											</div>
											{sessionsLoading ? (
												<div className='text-sm text-gray-400'>Загрузка...</div>
											) : sessions.length === 0 ? (
												<div className='text-sm text-gray-400'>Сессий нет</div>
											) : (
												<div className='space-y-3'>
													<AnimatePresence>
														{sessions.map(session => {
															const isCurrent = !!session.is_current
															const isTerminating =
																terminatingSessionIds.includes(
																	session.session_id,
																)
															const browserLabel = formatBrowser(
																session.browser,
															)
															return (
																<motion.div
																	layout
																	key={session.session_id}
																	initial={{ opacity: 0, y: 10 }}
																	animate={{ opacity: 1, y: 0 }}
																	exit={{ opacity: 0, y: -10 }}
																	transition={{ duration: 0.2 }}
																	className='flex items-start justify-between gap-3 rounded-lg border border-white/10 bg-black/40 p-3'
																>
																	<div className='space-y-2'>
																		<div className='flex flex-wrap items-center gap-2'>
																			<p className='text-sm text-white'>
																				{getSessionLabel(session)}
																			</p>
																			{browserLabel ? (
																				<span className='rounded-full bg-indigo-500/20 px-2 py-0.5 text-[11px] text-indigo-200'>
																					{browserLabel}
																				</span>
																			) : null}
																		</div>
																		<div className='text-xs text-gray-400 space-y-1'>
																			<p>IP: {session.ip || '—'}</p>
																			<p>
																				Последняя активность:{' '}
																				{formatDateTime(session.last_seen)}
																			</p>
																			<p>
																				Создана:{' '}
																				{formatDateTime(session.created_at)}
																			</p>
																		</div>
																		{session.user_agent &&
																		session.user_agent !== 'node' ? (
																			<p className='text-[11px] text-gray-500 break-all'>
																				{session.user_agent}
																			</p>
																		) : null}
																	</div>
																	<div className='flex flex-col items-end gap-2'>
																		{isCurrent ? (
																			<span className='rounded-full bg-emerald-500/20 px-2 py-1 text-[11px] text-emerald-300'>
																				Текущая
																			</span>
																		) : session.device === 'mobile' ? (
																			<span className='rounded-full bg-gray-500/20 px-2 py-1 text-[11px] text-gray-400'>
																				Мобильное приложение
																			</span>
																		) : (
																			<button
																				onClick={() =>
																					terminateSession(session.session_id)
																				}
																				disabled={isTerminating}
																				className='rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-xs text-rose-200 hover:bg-rose-500/20 transition disabled:opacity-60'
																			>
																				{isTerminating
																					? 'Завершаю...'
																					: 'Завершить'}
																			</button>
																		)}
																	</div>
																</motion.div>
															)
														})}
													</AnimatePresence>
												</div>
											)}
										</div>
									</div>
								</motion.div>

								<motion.div
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ duration: 0.4 }}
									className='relative rounded-2xl bg-white/5 border border-white/10 p-6 overflow-hidden'
								>
									<motion.div
										initial={{ opacity: 0.3 }}
										animate={{ opacity: [0.3, 0.6, 0.3] }}
										transition={{ duration: 5, repeat: Infinity }}
										className='absolute -bottom-24 -left-24 w-64 h-64 bg-gradient-to-tr from-amber-500/10 to-orange-500/10 rounded-full blur-3xl'
									/>
									<div className='flex items-center gap-3 mb-4'>
										<FiLock className='w-5 h-5 text-amber-400' />
										<h2 className='text-xl font-semibold'>Пароль</h2>
									</div>
									<div className='space-y-4'>
										{isYandexAccount ? (
											<p className='text-sm text-gray-400'>
												Смена пароля недоступна для аккаунтов Yandex
											</p>
										) : !changePasswordOpen ? (
											<button
												onClick={() => setChangePasswordOpen(true)}
												className='rounded-lg bg-white/10 border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/20 transition'
											>
												Сменить пароль
											</button>
										) : (
											<div className='space-y-3'>
												<p className='text-sm text-gray-400'>
													Отправим ссылку для смены пароля на {user?.email}
												</p>
												<div className='flex gap-3'>
													<button
														onClick={handleChangePassword}
														disabled={changePasswordLoading}
														className='rounded-lg bg-amber-500/20 border border-amber-500/40 px-4 py-2 text-sm text-white hover:bg-amber-500/30 transition disabled:opacity-60'
													>
														{changePasswordLoading ? 'Отправка...' : 'Отправить ссылку'}
													</button>
													<button
														onClick={() => setChangePasswordOpen(false)}
														className='rounded-lg bg-white/5 border border-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/10 transition'
													>
														Отмена
													</button>
												</div>
											</div>
										)}
									</div>
								</motion.div>
							</>
						)}

						{activeTab === 'mail' && (
							<motion.div
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.4 }}
								className='relative rounded-2xl bg-white/5 border border-white/10 p-6 overflow-hidden'
							>
								<motion.div
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									transition={{ duration: 0.8 }}
									className='absolute -top-20 -right-16 w-52 h-52 bg-gradient-to-br from-indigo-500/10 to-blue-500/10 rounded-full blur-3xl'
								/>
								<div className='flex items-center gap-3 mb-4'>
									<FiMail className='w-5 h-5 text-indigo-400' />
									<h2 className='text-xl font-semibold'>Mail API</h2>
								</div>
								{user?.premium ? (
									<MailApiSettings />
								) : (
									<div className='text-center py-8'>
										<div className='mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/20'>
											<FiMail className='h-7 w-7 text-indigo-400' />
										</div>
										<h2 className='text-lg font-semibold mb-2'>
											Mail API доступно только с Vondic Premium
										</h2>
										<p className='text-sm text-gray-400 mb-5'>
											Оформите подписку, чтобы настраивать права доступа к почтовому API.
										</p>
										<Link
											href='/shop'
											className='inline-block rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2 text-sm font-medium shadow-lg shadow-indigo-900/30 hover:from-indigo-500 hover:to-purple-500 transition-all'
										>
											Оформить Premium
										</Link>
									</div>
								)}
							</motion.div>
						)}

						{activeTab === 'interface' && (
							<>
								<motion.div
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ duration: 0.4 }}
									className='relative rounded-2xl bg-white/5 border border-white/10 p-6 overflow-hidden'
								>
									<motion.div
										initial={{ opacity: 0.3 }}
										animate={{ opacity: [0.3, 0.6, 0.3] }}
										transition={{ duration: 6, repeat: Infinity }}
										className='absolute -top-24 -left-24 w-64 h-64 bg-gradient-to-br from-pink-500/10 to-rose-500/10 rounded-full blur-3xl'
									/>
									<div className='flex items-center gap-3 mb-4'>
										<HiOutlineColorSwatch className='w-5 h-5 text-pink-400' />
										<h2 className='text-xl font-semibold'>Оформление</h2>
									</div>
									<div className='grid grid-cols-3 gap-2'>
										<button
											onClick={() => setTheme('system')}
											className={`rounded-lg px-4 py-2 text-sm border ${theme === 'system' ? 'border-indigo-500 bg-indigo-500/20 text-white' : 'border-white/10 bg-white/5 text-gray-300'}`}
										>
											Системная тема
										</button>
										<button
											onClick={() => setTheme('dark')}
											className={`rounded-lg px-4 py-2 text-sm border ${theme === 'dark' ? 'border-indigo-500 bg-indigo-500/20 text-white' : 'border-white/10 bg-white/5 text-gray-300'}`}
										>
											Тёмная
										</button>
										<button
											onClick={() => setTheme('light')}
											className={`rounded-lg px-4 py-2 text-sm border ${theme === 'light' ? 'border-indigo-500 bg-indigo-500/20 text-white' : 'border-white/10 bg-white/5 text-gray-300'}`}
										>
											Светлая
										</button>
									</div>
								</motion.div>

								<motion.div
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ duration: 0.4 }}
									className='relative rounded-2xl bg-white/5 border border-white/10 p-6 overflow-hidden'
								>
									<motion.div
										initial={{ opacity: 0.25 }}
										animate={{ opacity: [0.25, 0.5, 0.25] }}
										transition={{ duration: 7, repeat: Infinity }}
										className='absolute -top-24 -right-24 w-64 h-64 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full blur-3xl'
									/>
									<div className='flex items-center gap-3 mb-4'>
										<HiOutlineColorSwatch className='w-5 h-5 text-indigo-300' />
										<h2 className='text-xl font-semibold'>Цветовая схема</h2>
									</div>

									<div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
										{COLOR_SCHEMES.map(s => (
											<button
												key={s.id}
												onClick={() => {
													setColorSchemeId(s.id)
													saveColorScheme(s.id)
												}}
												className={`rounded-2xl p-4 border-2 transition-all ${
													colorSchemeId === s.id
														? 'border-[var(--app-accent)] ring-2 ring-[var(--app-accent)]/30'
														: 'border-white/10 hover:border-white/20'
												}`}
												style={{ background: s.palette.bg }}
											>
												<div className='w-6 h-6 rounded-full mb-2 mx-auto' style={{ background: s.palette.accent }} />
												<p className='text-sm text-white text-center'>{s.name}</p>
											</button>
										))}
									</div>
								</motion.div>

								<motion.div
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ duration: 0.4 }}
									className='relative rounded-2xl bg-white/5 border border-white/10 p-6 overflow-hidden'
								>
									<motion.div
										initial={{ opacity: 0.25 }}
										animate={{ opacity: [0.25, 0.55, 0.25] }}
										transition={{ duration: 7, repeat: Infinity }}
										className='absolute -bottom-24 -left-24 w-64 h-64 bg-gradient-to-tr from-blue-500/10 to-cyan-500/10 rounded-full blur-3xl'
									/>
									<div className='flex items-center gap-3 mb-4'>
										<FiMessageCircle className='w-5 h-5 text-cyan-300' />
										<h2 className='text-xl font-semibold'>Фон чата</h2>
									</div>

									<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
										<div className='space-y-2'>
											<p className='text-sm text-white'>Тема фона</p>
											<select
												value={chatThemeId}
												onChange={e => {
													const id = e.target.value
													setChatThemeId(id)
													localStorage.setItem('chat_theme', id)
													localStorage.removeItem('chat_background_image')
													setChatBackgroundImage('')
												}}
												className='w-full rounded-lg border border-white/10 bg-black/30 p-2 text-sm text-white'
											>
												{CHAT_THEMES.map(t => (
													<option key={t.id} value={t.id}>
														{t.name}
													</option>
												))}
											</select>
										</div>
										<div className='space-y-2'>
											<p className='text-sm text-white'>Тема пузырьков (мои)</p>
											<select
												value={messageThemeId}
												onChange={e => {
													const id = e.target.value
													setMessageThemeId(id)
													localStorage.setItem('message_theme', id)
												}}
												className='w-full rounded-lg border border-white/10 bg-black/30 p-2 text-sm text-white'
											>
												{CHAT_THEMES.map(t => (
													<option key={t.id} value={t.id}>
														{t.name}
													</option>
												))}
											</select>
										</div>
									</div>

									<div className='mt-4 space-y-3'>
										<div className='space-y-2'>
											<p className='text-sm text-white'>Фон-картинка (как в мессенджере)</p>
											<div className='grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2'>
												<input
													value={chatBackgroundImage}
													onChange={e => setChatBackgroundImage(e.target.value)}
													placeholder='URL или data:image/...'
													className='w-full rounded-lg border border-white/10 bg-black/30 p-2 text-sm text-white placeholder:text-gray-500'
												/>
												<button
													onClick={() => {
														const url = chatBackgroundImage.trim()
														if (!url) return
														localStorage.setItem('chat_background_image', url)
														localStorage.removeItem('chat_theme')
													}}
													className='rounded-lg bg-cyan-500/20 border border-cyan-500/30 px-4 py-2 text-sm text-white hover:bg-cyan-500/30 transition'
												>
													Применить
												</button>
											</div>
											<div className='flex items-center gap-2'>
												<input
													type='file'
													accept='image/*'
													onChange={e => {
														const file = e.target.files?.[0]
														if (!file) return
														const reader = new FileReader()
														reader.onload = () => {
															const url = String(reader.result || '')
															setChatBackgroundImage(url)
															localStorage.setItem('chat_background_image', url)
															localStorage.removeItem('chat_theme')
														}
														reader.readAsDataURL(file)
													}}
													className='block w-full text-xs text-gray-300 file:mr-3 file:rounded-md file:border file:border-white/10 file:bg-white/5 file:px-3 file:py-1.5 file:text-xs file:text-gray-200 hover:file:bg-white/10'
												/>
												<button
													onClick={() => {
														localStorage.removeItem('chat_background_image')
														setChatBackgroundImage('')
													}}
													className='rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-200 hover:bg-white/10 transition'
												>
													Убрать
												</button>
											</div>
										</div>

										<div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
											<div>
												<div className='flex items-center justify-between mb-2'>
													<p className='text-sm text-white'>Прозрачность</p>
													<span className='text-xs text-cyan-300 font-medium'>
														{chatBgOpacity}%
													</span>
												</div>
												<input
													type='range'
													min='0'
													max='100'
													value={chatBgOpacity}
													onChange={e => setChatBgOpacity(Number(e.target.value))}
													className='w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-400'
												/>
											</div>
											<div>
												<div className='flex items-center justify-between mb-2'>
													<p className='text-sm text-white'>Blur</p>
													<span className='text-xs text-cyan-300 font-medium'>
														{chatBgBlur}px
													</span>
												</div>
												<input
													type='range'
													min='0'
													max='30'
													value={chatBgBlur}
													onChange={e => setChatBgBlur(Number(e.target.value))}
													className='w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-400'
												/>
											</div>
											<div className='flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-4'>
												<div>
													<p className='text-sm font-medium text-white'>Сетка</p>
													<p className='text-xs text-gray-400'>Лёгкий узор поверх фона</p>
												</div>
												<button
													onClick={() => setChatBgGrid(v => !v)}
													className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${chatBgGrid ? 'bg-cyan-500/50' : 'bg-white/10'}`}
												>
													<span
														className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${chatBgGrid ? 'translate-x-7' : 'translate-x-1'}`}
													/>
												</button>
											</div>
										</div>
									</div>
								</motion.div>

								<motion.div
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ duration: 0.4 }}
									className='relative rounded-2xl bg-white/5 border border-white/10 p-6 overflow-hidden'
								>
									<div className='flex items-center gap-3 mb-4'>
										<FiMonitor className='w-5 h-5 text-emerald-300' />
										<h2 className='text-xl font-semibold'>Шрифт</h2>
									</div>
									<div className='grid grid-cols-1 sm:grid-cols-3 gap-2'>
										<button
											onClick={() =>
												setFontFamily(
													"var(--font-geist-sans), system-ui, -apple-system, 'Segoe UI', Roboto, Arial, 'Noto Sans', 'Liberation Sans', sans-serif",
												)
											}
											className='rounded-lg px-4 py-2 text-sm border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 transition'
										>
											Geist / default
										</button>
										<button
											onClick={() =>
												setFontFamily(
													"system-ui, -apple-system, 'Segoe UI', Roboto, Arial, 'Noto Sans', 'Liberation Sans', sans-serif",
												)
											}
											className='rounded-lg px-4 py-2 text-sm border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 transition'
										>
											System
										</button>
										<button
											onClick={() =>
												setFontFamily(
													"var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
												)
											}
											className='rounded-lg px-4 py-2 text-sm border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 transition'
										>
											Mono
										</button>
									</div>
									<div className='mt-3 rounded-xl border border-white/10 bg-black/20 p-4'>
										<p className='text-xs text-gray-400 mb-2'>Текущее значение</p>
										<p className='text-xs text-gray-200 break-words'>{fontFamily}</p>
									</div>
								</motion.div>

								<motion.div
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ duration: 0.4 }}
									className='relative rounded-2xl bg-white/5 border border-white/10 p-6 overflow-hidden'
								>
									<div className='flex items-center gap-3 mb-4'>
										<FiMonitor className='w-5 h-5 text-indigo-400' />
										<h2 className='text-xl font-semibold'>Масштабирование</h2>
									</div>
									<div className='space-y-6'>
										<div>
											<div className='flex items-center justify-between mb-2'>
												<p className='text-sm text-white'>Размер шрифта</p>
												<span className='text-xs text-indigo-400 font-medium'>
													{fontSize}px
												</span>
											</div>
											<div className='flex items-center gap-3'>
												<span className='text-[10px] text-gray-500'>A</span>
												<input
													type='range'
													min='12'
													max='20'
													value={fontSize}
													onChange={e => setFontSize(Number(e.target.value))}
													className='flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500'
												/>
												<span className='text-lg text-gray-300'>A</span>
											</div>
										</div>
										<div>
											<div className='flex items-center justify-between mb-2'>
												<p className='text-sm text-white'>Закругление углов</p>
												<span className='text-xs text-indigo-400 font-medium'>
													{borderRadius}px
												</span>
											</div>
											<div className='flex items-center gap-3'>
												<div className='w-4 h-4 border border-gray-600 rounded-none' />
												<input
													type='range'
													min='0'
													max='24'
													value={borderRadius}
													onChange={e =>
														setBorderRadius(Number(e.target.value))
													}
													className='flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500'
												/>
												<div className='w-4 h-4 border border-gray-600 rounded-lg' />
											</div>
										</div>
									</div>
								</motion.div>

							</>
						)}

						{activeTab === 'sounds' && (
							<>
								<motion.div
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ duration: 0.4 }}
									className='relative rounded-2xl bg-white/5 border border-white/10 p-6 overflow-hidden'
								>
									<motion.div
										initial={{ rotate: 0 }}
										animate={{ rotate: [0, 3, -3, 0] }}
										transition={{ duration: 10, repeat: Infinity }}
										className='absolute -top-20 -right-16 w-52 h-52 bg-gradient-to-br from-yellow-500/10 to-orange-500/10 rounded-full blur-3xl'
									/>
									<div className='flex items-center gap-3 mb-4'>
										<FiBell className='w-5 h-5 text-yellow-400' />
										<h2 className='text-xl font-semibold'>Звуки уведомлений</h2>
									</div>
									<div className='space-y-4'>
										<div className='flex items-center justify-between'>
											<p className='text-sm text-white'>
												Оповещение о уведомлениях
											</p>
											<button
												onClick={() => setNotifAlerts(!notifAlerts)}
												className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${notifAlerts ? 'bg-emerald-500/60' : 'bg-white/10'}`}
											>
												<span
													className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${notifAlerts ? 'translate-x-7' : 'translate-x-1'}`}
												/>
											</button>
										</div>
										<div>
											<p className='text-sm text-white mb-2'>
												Громкость рингтона
											</p>
											<div className='flex items-center gap-3'>
												<input
													type='range'
													min='0'
													max='100'
													value={ringtoneVolume}
													onChange={e =>
														setRingtoneVolume(Number(e.target.value))
													}
													className='flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500'
												/>
												<span className='text-white font-medium w-12 text-right'>
													{ringtoneVolume}%
												</span>
											</div>
										</div>
										<div>
											<p className='text-sm text-white mb-2'>
												Громкость сообщений
											</p>
											<div className='flex items-center gap-3'>
												<input
													type='range'
													min='0'
													max='100'
													value={messageVolume}
													onChange={e =>
														setMessageVolume(Number(e.target.value))
													}
													className='flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500'
												/>
												<span className='text-white font-medium w-12 text-right'>
													{messageVolume}%
												</span>
											</div>
										</div>
										<div className='flex items-center justify-between'>
											<div className='flex items-center gap-2'>
												<FiVolume2 className='w-4 h-4 text-gray-400' />
												<p className='text-sm text-white'>Звуки</p>
											</div>
											<button
												onClick={() => setNotifSounds(!notifSounds)}
												className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${notifSounds ? 'bg-emerald-500/60' : 'bg-white/10'}`}
											>
												<span
													className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${notifSounds ? 'translate-x-7' : 'translate-x-1'}`}
												/>
											</button>
										</div>
										<div className='flex items-center justify-between'>
											<div className='flex items-center gap-2'>
												<FiPhoneCall className='w-4 h-4 text-gray-400' />
												<p className='text-sm text-white'>
													Оповещение о входящем звонке
												</p>
											</div>
											<button
												onClick={() => setNotifIncomingCall(!notifIncomingCall)}
												className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${notifIncomingCall ? 'bg-emerald-500/60' : 'bg-white/10'}`}
											>
												<span
													className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${notifIncomingCall ? 'translate-x-7' : 'translate-x-1'}`}
												/>
											</button>
										</div>
									</div>
								</motion.div>
							</>
						)}

						<AnimatePresence>
							{isOauthModalOpen && (
								<motion.div
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									className='fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4'
								>
									<motion.div
										initial={{ scale: 0.95, opacity: 0 }}
										animate={{ scale: 1, opacity: 1 }}
										exit={{ scale: 0.95, opacity: 0 }}
										className='w-full max-w-4xl max-h-[85vh] overflow-y-auto rounded-2xl border border-white/10 bg-gray-950/95 p-5'
									>
										<div className='mb-4 flex items-center justify-between'>
											<div>
												<h3 className='text-xl font-semibold text-white'>
													OAuth приложения
												</h3>
												<p className='text-sm text-gray-400'>
													Настраивайте приложения здесь, а в внешнем проекте
													используйте только ключи клиента.
												</p>
											</div>
											<button
												onClick={() => setIsOauthModalOpen(false)}
												className='rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-200 hover:bg-white/10'
											>
												Закрыть
											</button>
										</div>
										<DeveloperSettings enabled={developerEnabled} />
									</motion.div>
								</motion.div>
							)}
						</AnimatePresence>

						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.4 }}
							className='relative rounded-2xl bg-white/5 border border-rose-500/20 p-6 overflow-hidden'
						>
							<motion.div
								initial={{ opacity: 0.3 }}
								animate={{ opacity: [0.3, 0.6, 0.3] }}
								transition={{ duration: 6, repeat: Infinity }}
								className='absolute -bottom-24 -left-24 w-64 h-64 bg-gradient-to-tr from-rose-500/10 to-red-500/10 rounded-full blur-3xl'
							/>
							<div className='flex items-center gap-3 mb-4'>
								<FiShield className='w-5 h-5 text-rose-400' />
								<h2 className='text-xl font-semibold'>Удаление аккаунта</h2>
							</div>
							<div className='space-y-4'>
								<p className='text-sm text-rose-200'>
									Аккаунт и связанные данные будут удалены без возможности
									восстановления.
								</p>
								<div className='space-y-2'>
									<input
										value={deleteConfirmText}
										onChange={e => setDeleteConfirmText(e.target.value)}
										placeholder='Введите УДАЛИТЬ'
										className='w-full rounded-lg border border-rose-500/30 bg-black/40 p-2 text-sm text-white placeholder:text-rose-300/60'
									/>
									<button
										onClick={handleDeleteAccount}
										disabled={deleteLoading}
										className='w-full rounded-lg bg-rose-600/80 border border-rose-400/60 px-4 py-2 text-sm text-white hover:bg-rose-600 disabled:opacity-60'
									>
										{deleteLoading ? 'Удаление...' : 'Удалить аккаунт'}
									</button>
								</div>
							</div>
						</motion.div>
			</div>
		</FeedPageShell>
	)
}
