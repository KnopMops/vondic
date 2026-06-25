'use client'

import { useAuth } from '@/lib/AuthContext'
import {
	consumePostLoginRedirect,
	storePostLoginRedirect,
} from '@/lib/authRedirect'
import { isOAuthLoginRedirect } from '@/lib/features/auth-oauth-flow'
import {
	getSavedAccounts,
	isAccountStale,
	removeSavedAccount,
	saveAccount,
	type SavedAccount,
} from '@/lib/savedAccounts'
import { getAvatarUrl } from '@/lib/utils'
import SmartCaptcha from '@/components/auth/SmartCaptcha'
import { motion } from 'framer-motion'
import { setUser } from '@/lib/features/authSlice'
import { useAppDispatch } from '@/lib/hooks'
import EmailInput from '@/components/ui/EmailInput'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { LuEye, LuEyeOff } from 'react-icons/lu'

export default function LoginPage() {
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const { loginWithYandex, switchAccount, isLoading } = useAuth()
	const dispatch = useAppDispatch()
	const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([])
	const [switchingAccountId, setSwitchingAccountId] = useState<string | null>(
		null,
	)
	const [showEmailForm, setShowEmailForm] = useState(false)
	const [pickAccountMode, setPickAccountMode] = useState(false)
	const isOAuthFlow = useMemo(() => isOAuthLoginRedirect(), [])
	const postLoginRedirect = useMemo(() => consumePostLoginRedirect('/feed'), [])
	const captchaSiteKey =
		process.env.NEXT_PUBLIC_YANDEX_SMARTCAPTCHA_SITE_KEY || ''

	const [twoFactorRequired, setTwoFactorRequired] = useState(false)
	const [twoFactorMethod, setTwoFactorMethod] = useState<'email' | 'totp'>(
		'email',
	)
	const [twoFactorCode, setTwoFactorCode] = useState('')
	const [loginError, setLoginError] = useState<string | null>(null)
	const [captchaToken, setCaptchaToken] = useState('')
	const [captchaKey, setCaptchaKey] = useState(0)
	const [showPassword, setShowPassword] = useState(false)

	useEffect(() => {
		const params = new URLSearchParams(window.location.search)
		const pickAccount = params.get('pick_account') === '1'
		const switchEmail = params.get('email') || params.get('switch')
		setPickAccountMode(pickAccount)
		if (switchEmail && switchEmail !== '1') {
			setEmail(switchEmail)
		}
		setSavedAccounts(getSavedAccounts())

		if (pickAccount) {
			void fetch('/api/auth/logout', { method: 'POST' })
		}
		const redirect = params.get('redirect')
		if (redirect?.startsWith('/')) {
			storePostLoginRedirect(redirect)
		}
	}, [])

	const showAccountPicker =
		savedAccounts.length > 0 && (isOAuthFlow || pickAccountMode || !showEmailForm)

	const handleSavedAccountClick = async (account: SavedAccount) => {
		if (isAccountStale(account)) {
			if (account.auth_provider === 'yandex') {
				await loginWithYandex({ loginHint: account.email })
			} else {
				setEmail(account.email)
				setShowEmailForm(true)
			}
			return
		}
		setSwitchingAccountId(account.id)
		try {
			await switchAccount(account, postLoginRedirect)
		} catch {
			if (account.auth_provider === 'yandex') {
				await loginWithYandex({ loginHint: account.email })
			} else {
				setEmail(account.email)
				setShowEmailForm(true)
			}
		} finally {
			setSwitchingAccountId(null)
		}
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
		} catch (err: any) {
			setLoginError(err.message || 'Ошибка отправки кода')
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
					email: email.trim().toLowerCase(),
					password,
					device_type: 'web',
					smart_captcha_token: captchaToken || undefined,
				}),
			})
			const data = await res.json().catch(() => ({}))
			if (!res.ok) {
				if (data?.two_factor_required) {
					setTwoFactorRequired(true)
					setTwoFactorMethod(data.method === 'totp' ? 'totp' : 'email')
					return
				}
				if (data?.send_reset_link) {
					window.location.href = `/reset-link-sent?email=${encodeURIComponent(data.email || '')}`
					return
				}
				setLoginError(data?.error || 'Ошибка входа')
				setCaptchaKey(k => k + 1)
				setCaptchaToken('')
				return
			}
			if (data.user) {
				const userData = { ...data.user }
				if (data.access_token) userData.access_token = data.access_token
				dispatch(setUser(userData))
				localStorage.setItem('user', JSON.stringify(userData))
				saveAccount({
					id: userData.id,
					email: userData.email,
					username: userData.username,
					avatar_url: userData.avatar_url ?? null,
					auth_provider: 'email',
					last_login_at: Date.now(),
					added_at: Date.now(),
					refresh_token: data.refresh_token || undefined,
				})
			}
			window.location.assign(consumePostLoginRedirect('/feed'))
		} catch (err: any) {
			setLoginError(err.message || 'Ошибка входа')
			setCaptchaKey(k => k + 1)
			setCaptchaToken('')
		}
	}

	const handleEmailTwoFactor = async (e: React.FormEvent) => {
		e.preventDefault()
		setLoginError(null)
		try {
			const body: any = {
				email: email.trim().toLowerCase(),
				password,
				device_type: 'web',
			}
			if (twoFactorMethod === 'email') body.email_code = twoFactorCode
			else body.totp_code = twoFactorCode
			if (captchaToken.trim()) body.smart_captcha_token = captchaToken.trim()
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
			if (data.user) {
				const userData = { ...data.user }
				if (data.access_token) userData.access_token = data.access_token
				dispatch(setUser(userData))
				localStorage.setItem('user', JSON.stringify(userData))
				saveAccount({
					id: userData.id,
					email: userData.email,
					username: userData.username,
					avatar_url: userData.avatar_url ?? null,
					auth_provider: 'email',
					last_login_at: Date.now(),
					added_at: Date.now(),
					refresh_token: data.refresh_token || undefined,
				})
			}
			window.location.assign(consumePostLoginRedirect('/feed'))
		} catch (err: any) {
			setLoginError(err.message || 'Ошибка подтверждения')
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
						{isOAuthFlow ? 'Выберите аккаунт' : 'Добро пожаловать'}
					</h2>
					{isOAuthFlow && (
						<p className='text-sm text-gray-400 text-center'>
							Приложение запрашивает доступ к аккаунту Вондик
						</p>
					)}
				</div>

				{showAccountPicker && !twoFactorRequired && (
					<div className='space-y-2'>
						{savedAccounts.map(account => (
							<div key={account.id} className='relative group'>
								<button
									type='button'
									disabled={!!switchingAccountId}
									onClick={() => void handleSavedAccountClick(account)}
									className='flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-left hover:bg-white/10 transition-colors disabled:opacity-50'
								>
									<div className='w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shrink-0'>
										{account.avatar_url ? (
											<img
												src={getAvatarUrl(account.avatar_url)}
												alt={account.username}
												className='w-full h-full object-cover'
											/>
										) : (
											account.username.charAt(0).toUpperCase()
										)}
									</div>
									<div className='flex-1 min-w-0'>
										<p className='text-sm font-medium text-white truncate'>
											{account.username}
										</p>
										<p className='text-xs text-gray-400 truncate'>
											{switchingAccountId === account.id
												? 'Вход…'
												: account.email}
										</p>
									</div>
								</button>
								<button
									type='button'
									onClick={(e) => {
										e.stopPropagation()
										removeSavedAccount(account.id)
										setSavedAccounts(getSavedAccounts())
									}}
									className='absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 text-gray-400 hover:text-red-400 hover:bg-red-500/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-xs'
									title='Удалить из списка'
								>
									×
								</button>
							</div>
						))}
						<button
							type='button'
							onClick={() => setShowEmailForm(true)}
							className='w-full rounded-xl border border-dashed border-white/15 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition-colors'
						>
							Другой аккаунт
						</button>
						{!isOAuthFlow && (
							<div className='relative flex items-center justify-center py-2'>
								<div className='absolute inset-0 flex items-center'>
									<div className='w-full border-t border-white/10' />
								</div>
								<span className='relative bg-transparent px-2 text-xs text-gray-500'>
									или войдите по email
								</span>
							</div>
						)}
						{isOAuthFlow && (
							<>
								<div className='relative flex items-center justify-center py-2'>
									<div className='absolute inset-0 flex items-center'>
										<div className='w-full border-t border-white/10' />
									</div>
									<span className='relative px-2 text-xs text-gray-500'>
										или
									</span>
								</div>
								<button
									type='button'
									onClick={() => loginWithYandex()}
									className='w-full rounded-full border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-400 hover:bg-red-500/20 transition-all'
								>
									Войти через Яндекс
								</button>
							</>
						)}
					</div>
				)}

				{(showEmailForm || !showAccountPicker || twoFactorRequired) && (
				<form
					className='mt-8 space-y-6'
					onSubmit={
						twoFactorRequired ? handleEmailTwoFactor : handleEmailLogin
					}
				>
						<div className='space-y-4'>
							<div>
								<label htmlFor='email-address' className='sr-only'>
									Электронная почта
								</label>
								<EmailInput
									id='email-address'
									value={email}
									onChange={setEmail}
									required
									listId='login-email-suggestions'
									className='relative block w-full rounded-xl border border-white/10 bg-white/5 py-3 px-4 text-white placeholder:text-gray-500 focus:z-10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all outline-none'
								/>
							</div>
							{!twoFactorRequired ? (
								<div className='relative'>
									<label htmlFor='password' className='sr-only'>
										Пароль
									</label>
									<input
										id='password'
										name='password'
										type={showPassword ? 'text' : 'password'}
										autoComplete='current-password'
										required
										className='relative block w-full rounded-xl border border-white/10 bg-white/5 py-3 px-4 pr-12 text-white placeholder:text-gray-500 focus:z-10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all outline-none'
										placeholder='Пароль'
										value={password}
										onChange={e => setPassword(e.target.value)}
									/>
									<button
										type='button'
										onClick={() => setShowPassword(v => !v)}
										className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors'
										tabIndex={-1}
									>
										{showPassword ? <LuEyeOff size={20} /> : <LuEye size={20} />}
									</button>
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
							<SmartCaptcha key={`password-${captchaKey}`} onTokenChange={setCaptchaToken} />
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
								<p className='text-center text-sm text-red-400'>{loginError}</p>
							)}

							{!twoFactorRequired && (
								<div className='flex items-center justify-between'>
									<Link
										href='/login/qr'
										className='text-sm text-gray-400 hover:text-white transition-colors'
									>
										Войти по QR-коду
									</Link>
									<Link
										href='/forgot-password'
										className='text-sm text-indigo-400 hover:text-indigo-300 transition-colors'
									>
										Забыли пароль?
									</Link>
								</div>
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
								onClick={() => loginWithYandex(email.trim() ? { loginHint: email.trim() } : undefined)}
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
								</a>
								{' '}
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
					</form>
				)}

				<p className='mt-4 text-center text-sm text-gray-400'>
					Нет аккаунта?{' '}
					<Link
						href='/register'
						className='font-medium text-indigo-400 hover:text-indigo-300 transition-colors'
					>
						Зарегистрироваться
					</Link>
				</p>
			</motion.div>
		</div>
	)
}
