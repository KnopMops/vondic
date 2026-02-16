'use client'

import Header from '@/components/social/Header'
import Sidebar from '@/components/social/Sidebar'
import { useAuth } from '@/lib/AuthContext'
import { setUser } from '@/lib/features/authSlice'
import { useAppDispatch } from '@/lib/hooks'
import { useToast } from '@/lib/ToastContext'
import { motion } from 'framer-motion'
import {
	Bell,
	Code,
	Eye,
	Mail,
	Palette,
	PhoneCall,
	Shield,
	Volume2,
} from 'lucide-react'
import { useEffect, useState } from 'react'

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
	const [theme, setTheme] = useState<'system' | 'dark' | 'light'>('system')
	/* removed experimental features state */
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

	const isTelegramAccount = !!user?.email?.endsWith('@telegram.bot')
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
		if (m === 'totp' && isTelegramAccount) return
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
								Скоро здесь появятся параметры вашего аккаунта.
							</p>
						</motion.div>

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
														disabled={isTelegramAccount}
														className={`rounded-lg px-3 py-2 text-sm border ${twoFAMethod === 'totp' ? 'border-indigo-500 bg-indigo-500/20 text-white' : 'border-white/10 bg-white/5 text-gray-300'} ${isTelegramAccount ? 'opacity-50 cursor-not-allowed' : ''}`}
													>
														Секретный ключ
													</button>
												</div>
											</div>
											<div className='space-y-2'>
												<p className='text-sm text-white'>Оповещение о входе</p>
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
							</div>
						</motion.div>

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
								<h2 className='text-xl font-semibold'>Уведомления</h2>
							</div>
							<div className='space-y-3'>
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
								<h2 className='text-xl font-semibold'>Конфиденциальность</h2>
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
					</div>
				</main>
			</div>
		</div>
	)
}
