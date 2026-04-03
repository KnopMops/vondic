'use client'

import Header from '@/components/social/Header'
import Sidebar from '@/components/social/Sidebar'
import { useAuth } from '@/lib/AuthContext'
import { setUser } from '@/lib/features/authSlice'
import { useAppDispatch } from '@/lib/hooks'
import { useToast } from '@/lib/ToastContext'
import { AnimatePresence, motion } from 'framer-motion'
import {
	Bell,
	Code,
	Eye,
	Mail,
	Monitor,
	Music,
	Palette,
	PhoneCall,
	Settings,
	Shield,
	Volume2,
} from 'lucide-react'
import { useEffect, useState } from 'react'

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
	const [presenceStatus, setPresenceStatus] = useState<'Online' | 'Offline'>(
		'Online',
	)
	const [showEmail, setShowEmail] = useState(true)
	const [theme, setTheme] = useState<'system' | 'dark' | 'light'>('system')
	const [fontSize, setFontSize] = useState<number>(14)
	const [borderRadius, setBorderRadius] = useState<number>(12)
	const [deleteConfirmText, setDeleteConfirmText] = useState('')
	const [deleteLoading, setDeleteLoading] = useState(false)
	const [sessions, setSessions] = useState<SessionItem[]>([])
	const [sessionsLoading, setSessionsLoading] = useState(false)
	const [terminatingSessionIds, setTerminatingSessionIds] = useState<string[]>(
		[],
	)
	const [activeTab, setActiveTab] = useState<'system' | 'interface' | 'sounds'>(
		'system',
	)
	const [ringtoneVolume, setRingtoneVolume] = useState<number>(70)
	const [messageVolume, setMessageVolume] = useState<number>(50)

	const dispatch = useAppDispatch()

	useEffect(() => {
		if (user) {
			setTwoFAEnabled(!!user.two_factor_enabled)
			setTwoFAMethod((user.two_factor_method as any) || 'email')
			setSecretKey(user.two_factor_secret || null)
			setLoginAlertEnabled(!!user.login_alert_enabled)
			setDeveloperEnabled(!!user.is_developer)
			const rawStatus = String(user.status || '').toLowerCase()
			setPresenceStatus(rawStatus === 'offline' ? 'Offline' : 'Online')
			setShowEmail(user.privacy_settings?.show_email !== false)
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
			const items = Array.isArray(data.items) ? data.items : []
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
	}, [])

	useEffect(() => {
		const savedFontSize = localStorage.getItem('app_font_size')
		const savedBorderRadius = localStorage.getItem('app_border_radius')
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
		applyTheme(theme)
		localStorage.setItem('app_theme', theme)
	}, [theme])

	const updateStatus = async (nextStatus: 'Online' | 'Offline') => {
		if (!user) return
		setPresenceStatus(nextStatus)
		try {
			const res = await fetch('/api/users/update', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ user_id: user.id, status: nextStatus }),
			})
			const data = await res.json()
			if (!res.ok) {
				throw new Error(data.error || 'Ошибка обновления статуса')
			}
			const updatedUser = data?.user || data
			if (updatedUser) {
				dispatch(setUser(updatedUser))
				localStorage.setItem('user', JSON.stringify(updatedUser))
			}
			showToast(
				nextStatus === 'Online' ? 'Статус: В сети' : 'Статус: Не в сети',
				'success',
			)
		} catch (e: any) {
			setPresenceStatus(
				String(user.status || '').toLowerCase() === 'offline'
					? 'Offline'
					: 'Online',
			)
			showToast(e.message || 'Не удалось обновить статус', 'error')
		}
	}

	const updatePrivacy = async (key: string, value: any) => {
		if (!user) return
		const nextPrivacy = {
			...(user.privacy_settings || { show_email: true }),
			[key]: value,
		}
		if (key === 'show_email') setShowEmail(value)

		try {
			const res = await fetch('/api/users/update', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					user_id: user.id,
					privacy_settings: nextPrivacy,
				}),
			})
			const data = await res.json()
			if (!res.ok) throw new Error(data.error || 'Ошибка обновления')
			const updatedUser = data?.user || data
			if (updatedUser) {
				dispatch(setUser(updatedUser))
				localStorage.setItem('user', JSON.stringify(updatedUser))
			}
			showToast('Настройки приватности обновлены', 'success')
		} catch (e: any) {
			if (key === 'show_email')
				setShowEmail(user.privacy_settings?.show_email !== false)
			showToast(e.message || 'Ошибка обновления', 'error')
		}
	}

	const isYandexAccount = !!user?.email?.endsWith('@yandex.ru')

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
		if (!twoFAEnabled) return
		try {
			const res = await fetch('/api/auth/2fa/setup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ method: m, enable: true }),
			})
			const data = await res.json()
			if (!res.ok) throw new Error(data.error || 'Ошибка выбора метода 2FA')
			setSecretKey(data.user?.two_factor_secret || null)
			showToast('Метод 2FA обновлён', 'success')
		} catch (e: any) {
			showToast(e.message || 'Ошибка метода 2FA', 'error')
		}
	}

	const generateSecret = async () => {
		try {
			const res = await fetch('/api/auth/2fa/setup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ method: 'totp', enable: true }),
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
			const res = await fetch('/api/auth/sessions/terminate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ session_id: sessionId }),
			})
			const data = await res.json()
			if (!res.ok) throw new Error(data.error || 'Не удалось завершить сессию')
			const items = Array.isArray(data.items) ? data.items : []
			if (items.length) {
				setSessions(items)
			} else {
				setSessions(prev => prev.filter(item => item.session_id !== sessionId))
			}
			if (data.logout_current) {
				showToast('Сессия завершена', 'success')
				logout()
				return
			}
			showToast('Сессия завершена', 'success')
		} catch (e: any) {
			showToast(e.message || 'Не удалось завершить сессию', 'error')
		} finally {
			setTerminatingSessionIds(prev => prev.filter(id => id !== sessionId))
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
		return value
	}

	const formatDevice = (value?: string) => {
		if (!value) return ''
		if (value === 'unknown') return ''
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

	return (
		<div className='min-h-screen bg-black text-white selection:bg-indigo-500 selection:text-white overflow-x-hidden relative'>
			<div className='fixed inset-0 z-0 overflow-hidden pointer-events-none'>
				<motion.div
					initial={{ opacity: 0.2, scale: 0.9 }}
					animate={{ opacity: 0.4, scale: 1 }}
					transition={{ duration: 1.2 }}
					className='absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-indigo-900/20 blur-[120px]'
				/>
				<motion.div
					initial={{ x: 0 }}
					animate={{ x: [0, -20, 0] }}
					transition={{ duration: 6, repeat: Infinity }}
					className='absolute top-[40%] -right-[10%] w-[40%] h-[60%] rounded-full bg-purple-900/20 blur-[120px]'
				/>
				<motion.div
					initial={{ y: 0 }}
					animate={{ y: [0, 15, 0] }}
					transition={{ duration: 8, repeat: Infinity }}
					className='absolute bottom-[10%] left-[20%] w-[30%] h-[30%] rounded-full bg-emerald-900/10 blur-[100px]'
				/>
			</div>

			<div className='relative z-20'>
				<Header email={user?.email} onLogout={logout} />
			</div>

			<div className='relative z-10 mx-auto flex max-w-7xl pt-6'>
				<Sidebar />
				<main className='flex-1 px-4 sm:px-6 lg:px-8 pb-20'>
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
									<Settings className='w-4 h-4' />
									Системные
								</button>
								<button
									onClick={() => setActiveTab('interface')}
									className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
										activeTab === 'interface'
											? 'bg-indigo-500/20 text-white'
											: 'text-gray-400 hover:text-white hover:bg-white/5'
									}`}
								>
									<Monitor className='w-4 h-4' />
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
									<Music className='w-4 h-4' />
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
										<Code className='w-5 h-5 text-emerald-400' />
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
											<div className='space-y-2'>
												<button
													onClick={generateApiKey}
													disabled={apiKeyLoading}
													className='rounded-lg bg-white/10 border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/20 transition disabled:opacity-60'
												>
													{apiKeyLoading
														? 'Генерация...'
														: 'Сгенерировать API ключ'}
												</button>
												<div className='rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-gray-300 break-all'>
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
										className='absolute -bottom-24 -left-24 w-64 h-64 bg-gradient-to-tr from-emerald-500/10 to-teal-500/10 rounded-full blur-3xl'
									/>
									<div className='flex items-center gap-3 mb-4'>
										<Shield className='w-5 h-5 text-indigo-400' />
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
																<Mail className='w-4 h-4 text-indigo-300' />
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
																				Это устройство
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
							</>
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
										<Palette className='w-5 h-5 text-pink-400' />
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
									<div className='flex items-center gap-3 mb-4'>
										<Monitor className='w-5 h-5 text-indigo-400' />
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

								<motion.div
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ duration: 0.4 }}
									className='relative rounded-2xl bg-white/5 border border-white/10 p-6 overflow-hidden'
								>
									<motion.div
										initial={{ opacity: 0.2 }}
										animate={{ opacity: [0.2, 0.4, 0.2] }}
										transition={{ duration: 7, repeat: Infinity }}
										className='absolute -bottom-24 -right-24 w-64 h-64 bg-gradient-to-tr from-blue-500/10 to-indigo-500/10 rounded-full blur-3xl'
									/>
									<div className='flex items-center gap-3 mb-4'>
										<Eye className='w-5 h-5 text-blue-400' />
										<h2 className='text-xl font-semibold'>
											Конфиденциальность
										</h2>
									</div>
									<div className='space-y-4'>
										<div>
											<p className='text-sm text-white mb-2'>Статус</p>
											<div className='grid grid-cols-2 gap-2'>
												<button
													onClick={() => updateStatus('Online')}
													className={`rounded-lg px-4 py-2 text-sm border ${presenceStatus === 'Online' ? 'border-indigo-500 bg-indigo-500/20 text-white' : 'border-white/10 bg-white/5 text-gray-300'}`}
												>
													В сети
												</button>
												<button
													onClick={() => updateStatus('Offline')}
													className={`rounded-lg px-4 py-2 text-sm border ${presenceStatus === 'Offline' ? 'border-indigo-500 bg-indigo-500/20 text-white' : 'border-white/10 bg-white/5 text-gray-300'}`}
												>
													Не в сети
												</button>
											</div>
										</div>
										<div className='flex items-center justify-between'>
											<div>
												<p className='text-sm font-medium text-white'>
													Показывать почту
												</p>
												<p className='text-xs text-gray-400'>
													Видна ли ваша почта другим пользователям
												</p>
											</div>
											<button
												onClick={() => updatePrivacy('show_email', !showEmail)}
												className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${showEmail ? 'bg-emerald-500/60' : 'bg-white/10'}`}
											>
												<span
													className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${showEmail ? 'translate-x-7' : 'translate-x-1'}`}
												/>
											</button>
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
										<Bell className='w-5 h-5 text-yellow-400' />
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
												<Volume2 className='w-4 h-4 text-gray-400' />
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
												<PhoneCall className='w-4 h-4 text-gray-400' />
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
								<Shield className='w-5 h-5 text-rose-400' />
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
				</main>
			</div>
		</div>
	)
}
