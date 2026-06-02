'use client'

import { useAuth } from '@/lib/AuthContext'
import SmartCaptcha from '@/components/auth/SmartCaptcha'
import {
	getSavedAccounts,
	removeSavedAccount,
	saveAccount,
	type SavedAccount,
} from '@/lib/savedAccounts'
import { motion, AnimatePresence } from 'framer-motion'
import { setUser } from '@/lib/features/authSlice'
import { useAppDispatch } from '@/lib/hooks'
import Link from 'next/link'
import { useEffect, useState } from 'react'

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000

function persistUserAfterLogin(
	dispatch: ReturnType<typeof useAppDispatch>,
	data: { user?: Record<string, unknown>; access_token?: string; refresh_token?: string },
) {
	if (!data.user) return
	const userData = { ...data.user } as Record<string, unknown>
	if (data.access_token) userData.access_token = data.access_token
	dispatch(setUser(userData as Parameters<typeof setUser>[0]))
	localStorage.setItem('user', JSON.stringify(userData))
	saveAccount({
		id: String(userData.id),
		email: String(userData.email),
		username: String(userData.username),
		avatar_url: (userData.avatar_url as string | null) ?? null,
		auth_provider: 'email',
		last_login_at: Date.now(),
		added_at: Date.now(),
		refresh_token: data.refresh_token || undefined,
	})
}

export default function LoginPage() {
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const { loginWithYandex, isLoading } = useAuth()
	const dispatch = useAppDispatch()
	const captchaSiteKey =
		process.env.NEXT_PUBLIC_YANDEX_SMARTCAPTCHA_SITE_KEY || ''

	const [accounts, setAccounts] = useState<SavedAccount[]>([])
	const [showAll, setShowAll] = useState(false)

	const [twoFactorRequired, setTwoFactorRequired] = useState(false)
	const [twoFactorMethod, setTwoFactorMethod] = useState<'email' | 'totp'>(
		'email',
	)
	const [twoFactorCode, setTwoFactorCode] = useState('')
	const [loginError, setLoginError] = useState<string | null>(null)
	const [captchaToken, setCaptchaToken] = useState('')

	useEffect(() => {
		setAccounts(getSavedAccounts())
	}, [])

	useEffect(() => {
		const params = new URLSearchParams(window.location.search)
		const switchParam = params.get('switch')
		const emailParam = params.get('email')
		if (switchParam === '1' && emailParam) {
			const allAccounts = getSavedAccounts()
			const target = allAccounts.find(a => a.email === emailParam)
			if (target) {
				handleSelectAccount(target)
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const isStale = (account: SavedAccount) =>
		Date.now() - account.last_login_at > THREE_DAYS_MS

	const showAccountList = accounts.length > 0 && !showAll

	const [restoringAccountId, setRestoringAccountId] = useState<string | null>(null)

	const handleSelectAccount = async (account: SavedAccount) => {
		setEmail(account.email)
		setPassword('')
		setLoginError(null)
		setCaptchaToken('')
		setTwoFactorRequired(false)

		if (!isStale(account) && account.refresh_token) {
			setRestoringAccountId(account.id)
			try {
				const res = await fetch('/api/auth/restore', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ refresh_token: account.refresh_token }),
				})
				const data = await res.json().catch(() => ({}))
				if (res.ok && data.user) {
					persistUserAfterLogin(dispatch, data)
					const redirectUrl = new URLSearchParams(window.location.search).get('redirect') || '/feed'
					window.location.assign(redirectUrl)
					return
				}
			} catch {
				// fall through to login form
			} finally {
				setRestoringAccountId(null)
			}
		}

		setShowAll(true)
	}

	const handleRemoveAccount = (e: React.MouseEvent, accountId: string) => {
		e.stopPropagation()
		removeSavedAccount(accountId)
		setAccounts(prev => prev.filter(a => a.id !== accountId))
	}

	const sendLoginEmailCode = async () => {
		try {
			const res = await fetch('/api/auth/2fa/email/send', { method: 'POST' })
			const data = await res.json().catch(() => ({}))
			if (!res.ok) {
				setLoginError(data?.error || 'Не удалось отправить код')
				return
			}
			if (data.dev_code) {
				setTwoFactorCode(data.dev_code)
				setLoginError(null)
			}
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Ошибка отправки кода'
			setLoginError(message)
		}
	}

	const handleEmailLogin = async (e: React.FormEvent) => {
		e.preventDefault()
		setLoginError(null)
		if (captchaSiteKey && !captchaToken.trim()) {
			setLoginError('Подтвердите, что вы не робот')
			return
		}
		try {
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email,
					password,
					smart_captcha_token: captchaToken || undefined,
				}),
			})
			const data = await res.json().catch(() => ({}))
			if (!res.ok) {
				if (data?.two_factor_required) {
					setTwoFactorRequired(true)
					setTwoFactorMethod(data.method === 'totp' ? 'totp' : 'email')
					setCaptchaToken('')
					if (data?.error) setLoginError(data.error)
					return
				}
				setLoginError(data?.error || 'Ошибка входа')
				return
			}
			persistUserAfterLogin(dispatch, data)
			const redirectUrl = new URLSearchParams(window.location.search).get('redirect') || '/feed'
			window.location.assign(redirectUrl)
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Ошибка входа'
			setLoginError(message)
		}
	}

	const handleEmailTwoFactor = async (e: React.FormEvent) => {
		e.preventDefault()
		setLoginError(null)
		try {
			const body: Record<string, string> = { email, password }
			if (twoFactorMethod === 'email') body.email_code = twoFactorCode
			else body.totp_code = twoFactorCode
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			})
			const data = await res.json().catch(() => ({}))
			if (!res.ok) {
				setLoginError(data?.error || 'Неверный код')
				return
			}
			persistUserAfterLogin(dispatch, data)
			const redirectUrl = new URLSearchParams(window.location.search).get('redirect') || '/feed'
			window.location.assign(redirectUrl)
		} catch (err: unknown) {
			const message =
				err instanceof Error ? err.message : 'Ошибка подтверждения'
			setLoginError(message)
		}
	}

	return (
		<div className='flex min-h-screen items-center justify-center bg-black text-white selection:bg-indigo-500 selection:text-white overflow-hidden relative'>
			<div className='fixed inset-0 z-0 overflow-hidden pointer-events-none'>
				<div className='absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-indigo-900/20 blur-[120px]' />
				<div className='absolute top-[40%] -right-[10%] w-[40%] h-[60%] rounded-full bg-purple-900/20 blur-[120px]' />
				<div className='absolute bottom-[10%] left-[20%] w-[30%] h-[30%] rounded-full bg-emerald-900/10 blur-[100px]' />
			</div>

			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.8, ease: 'easeOut' }}
				className='w-full max-w-md space-y-6 rounded-3xl bg-white/5 border border-white/10 p-8 shadow-2xl backdrop-blur-xl relative z-10'
			>
				<div className='flex flex-col items-center justify-center gap-4'>
					<div className='flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 shadow-lg shadow-indigo-500/20'>
						<span className='text-2xl font-bold text-white'>V</span>
					</div>
					<h2 className='text-2xl font-bold text-white'>
						{showAccountList ? 'Продолжить как' : 'Добро пожаловать'}
					</h2>
				</div>

				<AnimatePresence mode='wait'>
					{showAccountList ? (
						<motion.div
							key='accounts'
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							className='space-y-3'
						>
							{accounts.map((account, idx) => (
								<motion.button
									key={account.id}
									initial={{ opacity: 0, x: -10 }}
									animate={{ opacity: 1, x: 0 }}
									transition={{ delay: idx * 0.05 }}
									type='button'
									onClick={() => handleSelectAccount(account)}
									className='group relative flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-left hover:bg-white/10 transition-all'
								>
									<div className='relative w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shrink-0'>
										{account.avatar_url ? (
											<img
												src={account.avatar_url}
												alt={account.username}
												className='w-full h-full object-cover'
											/>
										) : (
											account.username.charAt(0).toUpperCase()
										)}
									</div>
									<div className='flex-1 min-w-0'>
										<p className='text-white font-medium truncate'>
											{account.username}
										</p>
										<p className='text-sm text-gray-400 truncate'>
											{account.email}
										</p>
										{isStale(account) && (
											<p className='text-xs text-amber-400 mt-0.5'>
												Требуется повторный вход (прошло более 3 дней)
											</p>
										)}
									</div>
									<span className='text-sm font-semibold text-indigo-400 group-hover:text-indigo-300'>
										{restoringAccountId === account.id ? 'Входим…' : 'Войти'}
									</span>
									<button
										type='button'
										onClick={e => handleRemoveAccount(e, account.id)}
										className='absolute top-2 right-2 p-1 rounded-full text-gray-500 hover:text-red-400 hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-all'
										title='Удалить из списка'
									>
										<svg
											xmlns='http://www.w3.org/2000/svg'
											width='14'
											height='14'
											viewBox='0 0 24 24'
											fill='none'
											stroke='currentColor'
											strokeWidth='2'
											strokeLinecap='round'
											strokeLinejoin='round'
										>
											<line x1='18' y1='6' x2='6' y2='18' />
											<line x1='6' y1='6' x2='18' y2='18' />
										</svg>
									</button>
								</motion.button>
							))}

							<button
								type='button'
								onClick={() => {
									setEmail('')
									setPassword('')
									setShowAll(true)
								}}
								className='group relative flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-left hover:bg-white/10 transition-all'
							>
								<div className='w-12 h-12 rounded-full bg-white/10 flex items-center justify-center shrink-0'>
									<svg
										xmlns='http://www.w3.org/2000/svg'
										width='20'
										height='20'
										viewBox='0 0 24 24'
										fill='none'
										stroke='currentColor'
										strokeWidth='2'
										strokeLinecap='round'
										strokeLinejoin='round'
										className='text-gray-400'
									>
										<line x1='12' y1='5' x2='12' y2='19' />
										<line x1='5' y1='12' x2='19' y2='12' />
									</svg>
								</div>
								<p className='text-white font-medium'>Войти в другой аккаунт</p>
							</button>
						</motion.div>
					) : (
						<motion.form
							key='login-form'
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							className='mt-2 space-y-6'
							onSubmit={
								twoFactorRequired ? handleEmailTwoFactor : handleEmailLogin
							}
						>
							{accounts.length > 0 && (
								<button
									type='button'
									onClick={() => setShowAll(false)}
									className='w-full text-center text-xs text-indigo-400 hover:text-indigo-300 transition-colors'
								>
									← Назад к сохранённым аккаунтам
								</button>
							)}

							<div className='space-y-4'>
								<div>
									<label htmlFor='email-address' className='sr-only'>
										Электронная почта
									</label>
									<input
										id='email-address'
										name='email'
										type='email'
										autoComplete='email'
										required
										className='relative block w-full rounded-xl border border-white/10 bg-white/5 py-3 px-4 text-white placeholder:text-gray-500 focus:z-10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all outline-none'
										placeholder='Электронная почта'
										value={email}
										onChange={e => setEmail(e.target.value)}
									/>
								</div>
								{!twoFactorRequired ? (
									<div>
										<label htmlFor='password' className='sr-only'>
											Пароль
										</label>
										<input
											id='password'
											name='password'
											type='password'
											autoComplete='current-password'
											required
											className='relative block w-full rounded-xl border border-white/10 bg-white/5 py-3 px-4 text-white placeholder:text-gray-500 focus:z-10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all outline-none'
											placeholder='Пароль'
											value={password}
											onChange={e => setPassword(e.target.value)}
										/>
									</div>
								) : (
									<div>
										<label htmlFor='twofactor' className='sr-only'>
											Код двухфакторной аутентификации
										</label>
										<input
											id='twofactor'
											type='text'
											autoComplete='one-time-code'
											required
											className='relative block w-full rounded-xl border border-white/10 bg-white/5 py-3 px-4 text-white placeholder:text-gray-500 focus:z-10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all outline-none'
											placeholder={
												twoFactorMethod === 'email'
													? 'Код из письма'
													: 'Код из приложения'
											}
											value={twoFactorCode}
											onChange={e => setTwoFactorCode(e.target.value)}
										/>
										<p className='text-xs text-gray-500 mt-1'>
											{twoFactorMethod === 'email'
												? 'Введите 6-значный код, отправленный на вашу почту.'
												: 'Введите 6-значный код из приложения аутентификации.'}
										</p>
										{twoFactorMethod === 'email' && (
											<button
												type='button'
												onClick={sendLoginEmailCode}
												className='mt-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors'
											>
												Отправить код на почту
											</button>
										)}
									</div>
								)}
							</div>

							{!twoFactorRequired && (
								<SmartCaptcha onTokenChange={setCaptchaToken} />
							)}

							<div className='space-y-4'>
								<button
									type='submit'
									disabled={
										isLoading ||
										(!twoFactorRequired &&
											!!captchaSiteKey &&
											!captchaToken.trim())
									}
									className='group relative flex w-full justify-center rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 text-sm font-semibold text-white hover:shadow-lg hover:shadow-indigo-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed'
								>
									{isLoading
										? 'Вход...'
										: twoFactorRequired
											? 'Подтвердить'
											: 'Войти'}
								</button>
								{loginError && (
									<p className='text-center text-sm text-red-400'>
										{loginError}
									</p>
								)}

								{!twoFactorRequired && (
									<p className='text-center text-sm'>
										<Link
											href='/forgot-password'
											className='text-indigo-400 hover:text-indigo-300 transition-colors'
										>
											Забыли пароль?
										</Link>
									</p>
								)}

								<div className='relative flex items-center justify-center'>
									<div className='absolute inset-0 flex items-center'>
										<div className='w-full border-t border-white/10'></div>
									</div>
									<span className='relative bg-black/50 px-2 text-sm text-gray-500 rounded backdrop-blur-sm'>
										или
									</span>
								</div>

								<button
									type='button'
									onClick={() => loginWithYandex()}
									className='group relative flex w-full justify-center rounded-full border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-400 hover:bg-red-500/20 transition-all'
								>
									Войти через Яндекс
								</button>
								<p className='text-center text-xs text-gray-500'>
									Входя через соцсети, вы соглашаетесь с{' '}
									<a
										href={`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'}/static/docs/privacy_policy.rtf`}
										target='_blank'
										rel='noopener noreferrer'
										className='text-indigo-400 hover:text-indigo-300 transition-colors'
									>
										политикой конфиденциальности
									</a>{' '}
									и{' '}
									<a
										href={`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'}/static/docs/consent_to_processing_personal_data.rtf`}
										target='_blank'
										rel='noopener noreferrer'
										className='text-indigo-400 hover:text-indigo-300 transition-colors'
									>
										согласием на обработку данных
									</a>
									.
								</p>
							</div>
						</motion.form>
					)}
				</AnimatePresence>

				{!showAccountList && (
					<p className='mt-2 text-center text-sm text-gray-400'>
						Нет аккаунта?{' '}
						<Link
							href='/register'
							className='font-medium text-indigo-400 hover:text-indigo-300 transition-colors'
						>
							Зарегистрироваться
						</Link>
					</p>
				)}
			</motion.div>
		</div>
	)
}
