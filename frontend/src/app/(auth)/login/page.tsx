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
import { LuEye, LuEyeOff, LuKey } from 'react-icons/lu'
import { loginWithPasskey, isPasskeySupported } from '@/lib/passkey'

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
	const [isModal, setIsModal] = useState(false)

	const notifyParentAuthSuccess = () => {
		if (typeof window !== 'undefined') {
			if (window.parent && window.parent !== window) {
				try {
					window.parent.postMessage({ type: 'VONDIC_AUTH_SUCCESS' }, '*')
				} catch {}
			}
			if (window.opener && !window.opener.closed) {
				try {
					window.opener.postMessage({ type: 'VONDIC_AUTH_SUCCESS' }, '*')
				} catch {}
			}
		}
	}

	useEffect(() => {
		const params = new URLSearchParams(window.location.search)
		const pickAccount = params.get('pick_account') === '1'
		const switchEmail = params.get('email') || params.get('switch')
		const modalParam =
			params.get('modal') === '1' ||
			(typeof window !== 'undefined' && window.self !== window.top)
		setIsModal(modalParam)
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
			if (typeof window !== 'undefined' && (window.parent !== window || isModal)) {
				notifyParentAuthSuccess()
				return
			}
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

	const [passkeyLoading, setPasskeyLoading] = useState(false)

	const handlePasskeyLogin = async () => {
		setLoginError(null)
		setPasskeyLoading(true)
		try {
			const data = await loginWithPasskey()
			if (data?.user) {
				dispatch(setUser(data.user))
				if (typeof window !== 'undefined' && (window.parent !== window || isModal)) {
					notifyParentAuthSuccess()
					return
				}
				window.location.assign(postLoginRedirect || '/feed')
			}
		} catch (err: any) {
			setLoginError(err.message || 'Ошибка входа по Passkey')
		} finally {
			setPasskeyLoading(false)
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
			if (typeof window !== 'undefined' && (window.parent !== window || isModal)) {
				notifyParentAuthSuccess()
				return
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
			if (typeof window !== 'undefined' && (window.parent !== window || isModal)) {
				notifyParentAuthSuccess()
				return
			}
			window.location.assign(consumePostLoginRedirect('/feed'))
		} catch (err: any) {
			setLoginError(err.message || 'Ошибка подтверждения')
		}
	}

	return (
		<div
			className={`flex items-center justify-center text-[#e6edf3] selection:bg-[#0077FF] selection:text-white relative ${
				isModal
					? 'min-h-0 bg-transparent p-1'
					: 'min-h-screen bg-[#0e1117] p-4'
			}`}
		>
			<motion.div
				initial={{ opacity: 0, y: isModal ? 0 : 14 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.35, ease: 'easeOut' }}
				className={`w-full ${
					isModal
						? 'max-w-full rounded-xl bg-[#161b22] border border-[#30363d] p-5 shadow-none'
						: 'max-w-[420px] space-y-6 rounded-2xl bg-[#161b22] border border-[#30363d] p-7 shadow-xl'
				} relative z-10`}
			>
				<div className='flex flex-col items-center justify-center gap-2.5'>
					<div className='relative flex items-center justify-center w-14 h-14 rounded-2xl bg-[#0d1117] border border-[#30363d] shadow-lg shadow-black/40 overflow-hidden p-1.5 group'>
						<img
							src='/logo.png'
							alt='Вондик'
							className='w-full h-full object-contain drop-shadow transition-transform duration-300 group-hover:scale-105'
						/>
					</div>
					<h1 className='text-2xl font-bold text-white tracking-tight mt-1'>
						{isOAuthFlow ? 'Выберите аккаунт Вондик' : 'Вход в Вондик'}
					</h1>
					<p className='text-xs text-[#8b949e] text-center'>
						{isOAuthFlow
							? 'Приложение запрашивает доступ к аккаунту Вондик'
							: 'Единый аккаунт для всех сервисов Вондик'}
					</p>
				</div>

				{showAccountPicker && !twoFactorRequired && (
					<div className='space-y-2'>
						{savedAccounts.map(account => (
							<div key={account.id} className='relative group'>
								<button
									type='button'
									disabled={!!switchingAccountId}
									onClick={() => void handleSavedAccountClick(account)}
									className='flex w-full items-center gap-3 rounded-lg border border-[#30363d] bg-[#0d1117] p-2.5 text-left hover:bg-[#21262d] hover:border-[#8b949e]/40 transition-colors disabled:opacity-50'
								>
									<div className='w-9 h-9 rounded-full overflow-hidden bg-[#21262d] border border-[#30363d] flex items-center justify-center text-white font-semibold text-xs shrink-0'>
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
										<p className='text-xs text-[#8b949e] truncate'>
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
									className='absolute top-2.5 right-2.5 w-5 h-5 rounded bg-black/60 text-[#8b949e] hover:text-red-400 hover:bg-red-500/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-xs'
									title='Удалить из списка'
								>
									×
								</button>
							</div>
						))}
						<button
							type='button'
							onClick={() => setShowEmailForm(true)}
							className='w-full rounded-lg border border-dashed border-[#30363d] py-2 text-xs font-medium text-[#8b949e] hover:text-white hover:bg-[#21262d] transition-colors'
						>
							Войти в другой аккаунт
						</button>
						{!isOAuthFlow && (
							<div className='relative flex items-center justify-center py-2'>
								<div className='absolute inset-0 flex items-center'>
									<div className='w-full border-t border-[#30363d]' />
								</div>
								<span className='relative bg-[#161b22] px-2 text-xs text-[#8b949e]'>
									или войдите по логину
								</span>
							</div>
						)}
						{isOAuthFlow && (
							<>
								<div className='relative flex items-center justify-center py-2'>
									<div className='absolute inset-0 flex items-center'>
										<div className='w-full border-t border-[#30363d]' />
									</div>
									<span className='relative bg-[#161b22] px-2 text-xs text-[#8b949e]'>
										или
									</span>
								</div>
								<button
									type='button'
									onClick={() => loginWithYandex()}
									className='w-full rounded-lg bg-[#ffcc00] hover:bg-[#e6b800] px-4 py-2.5 text-sm font-semibold text-black transition-all'
								>
									Войти через Яндекс
								</button>
							</>
						)}
					</div>
				)}

				{(showEmailForm || !showAccountPicker || twoFactorRequired) && (
				<form
					className='mt-6 space-y-4'
					onSubmit={
						twoFactorRequired ? handleEmailTwoFactor : handleEmailLogin
					}
				>
						<div className='space-y-3'>
							<div>
								<label htmlFor='email-address' className='block text-xs font-medium text-[#8b949e] mb-1.5'>
									Электронная почта или логин
								</label>
								<EmailInput
									id='email-address'
									value={email}
									onChange={setEmail}
									required
									listId='login-email-suggestions'
									className='relative block w-full rounded-lg border border-[#30363d] bg-[#0d1117] py-2.5 px-3.5 text-sm text-white placeholder:text-[#8b949e]/50 focus:border-[#0077FF] focus:ring-1 focus:ring-[#0077FF] transition-all outline-none'
								/>
							</div>
							{!twoFactorRequired ? (
								<div>
									<div className='flex items-center justify-between mb-1.5'>
										<label htmlFor='password' className='block text-xs font-medium text-[#8b949e]'>
											Пароль
										</label>
										<Link
											href='/forgot-password'
											className='text-xs text-[#58a6ff] hover:underline transition-colors'
										>
											Забыли пароль?
										</Link>
									</div>
									<div className='relative'>
										<input
											id='password'
											name='password'
											type={showPassword ? 'text' : 'password'}
											autoComplete='current-password'
											required
											className='relative block w-full rounded-lg border border-[#30363d] bg-[#0d1117] py-2.5 px-3.5 pr-10 text-sm text-white placeholder:text-[#8b949e]/50 focus:border-[#0077FF] focus:ring-1 focus:ring-[#0077FF] transition-all outline-none'
											placeholder='••••••••'
											value={password}
											onChange={e => setPassword(e.target.value)}
										/>
										<button
											type='button'
											onClick={() => setShowPassword(v => !v)}
											className='absolute right-3 top-1/2 -translate-y-1/2 text-[#8b949e] hover:text-white transition-colors'
											tabIndex={-1}
										>
											{showPassword ? <LuEyeOff size={16} /> : <LuEye size={16} />}
										</button>
									</div>
								</div>
							) : (
								<div className='space-y-2 p-3.5 rounded-lg border border-[#30363d] bg-[#0d1117]'>
									<label htmlFor='twofactor' className='block text-xs font-semibold text-white'>
										Подтверждение двухфакторной защиты (2FA)
									</label>
									<input
										id='twofactor'
										type='text'
										autoComplete='one-time-code'
										required
										className='relative block w-full rounded-lg border border-[#30363d] bg-[#161b22] py-2.5 px-3.5 text-center text-lg tracking-widest font-mono text-white placeholder:text-[#8b949e]/40 focus:border-[#0077FF] focus:ring-1 focus:ring-[#0077FF] transition-all outline-none'
										placeholder={
											twoFactorMethod === 'email'
												? 'Код из письма'
												: 'Код из приложения'
										}
										value={twoFactorCode}
										onChange={e => setTwoFactorCode(e.target.value)}
									/>
									<p className='text-xs text-[#8b949e]'>
										{twoFactorMethod === 'email'
											? 'Мы отправили 6-значный код на вашу почту. Введите его для входа.'
											: 'Введите 6-значный код из Google Authenticator или другого приложения.'}
									</p>
									{twoFactorMethod === 'email' && (
										<button
											type='button'
											onClick={sendLoginEmailCode}
											className='text-xs text-[#58a6ff] hover:underline transition-colors'
										>
											Отправить код на почту повторно
										</button>
									)}
								</div>
							)}

						</div>
						{!twoFactorRequired && (
							<SmartCaptcha key={`password-${captchaKey}`} onTokenChange={setCaptchaToken} />
						)}

						<div className='space-y-3 pt-1'>
							<button
								type='submit'
								disabled={
									isLoading ||
									(!twoFactorRequired &&
										!!captchaSiteKey &&
										!captchaToken.trim())
								}
								className='w-full rounded-lg bg-[#0077FF] hover:bg-[#0066dd] py-2.5 text-sm font-medium text-white transition-all shadow-sm active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed'
							>
								{isLoading
									? 'Вход...'
									: twoFactorRequired
										? 'Подтвердить вход'
										: 'Войти в аккаунт'}
							</button>
							{loginError && (
								<p className='text-center text-xs text-[#f85149] bg-[#f85149]/10 border border-[#f85149]/30 rounded-lg p-2.5'>{loginError}</p>
							)}

							<div className='relative flex items-center justify-center my-3'>
								<div className='absolute inset-0 flex items-center'>
									<div className='w-full border-t border-[#30363d]'></div>
								</div>
								<span className='relative bg-[#161b22] px-2 text-xs text-[#8b949e]'>
									или
								</span>
							</div>

							<button
								type='button'
								onClick={handlePasskeyLogin}
								disabled={passkeyLoading}
								className='w-full flex items-center justify-center gap-2 rounded-lg border border-[#30363d] bg-[#21262d] hover:bg-[#30363d] hover:border-[#8b949e]/40 py-2.5 text-sm font-medium text-white transition-all active:scale-[0.99] disabled:opacity-50'
							>
								<LuKey className='h-4 w-4 text-[#58a6ff]' />
								{passkeyLoading ? 'Вход по Passkey...' : 'Войти через Passkey (Ключ доступа)'}
							</button>

							<button
								type='button'
								onClick={() => loginWithYandex(email.trim() ? { loginHint: email.trim() } : undefined)}
								className='w-full flex items-center justify-center gap-2 rounded-lg bg-[#ffcc00] hover:bg-[#e6b800] py-2.5 text-sm font-semibold text-black transition-all active:scale-[0.99]'
							>
								<span className='w-4 h-4 rounded-full bg-[#fc3f1d] text-white flex items-center justify-center text-[10px] font-bold'>Я</span>
								Войти с Яндекс ID
							</button>

							{!twoFactorRequired && (
								<div className='pt-1 text-center'>
									<Link
										href='/login/qr'
										className='text-xs text-[#8b949e] hover:text-white transition-colors'
									>
										Войти по QR-коду со смартфона →
									</Link>
								</div>
							)}

							<p className='text-center text-[11px] text-[#8b949e] leading-relaxed pt-2'>
								Входя в аккаунт, вы соглашаетесь с{' '}
								<a
									href={`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'}/static/docs/privacy_policy.rtf`}
									target='_blank'
									rel='noopener noreferrer'
									className='text-[#58a6ff] hover:underline'
								>
									политикой конфиденциальности
								</a>
								{' '}и{' '}
								<a
									href={`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'}/static/docs/consent_to_processing_personal_data.rtf`}
									target='_blank'
									rel='noopener noreferrer'
									className='text-[#58a6ff] hover:underline'
								>
									согласием на обработку данных
								</a>
								.
							</p>
						</div>
					</form>
				)}

				<p className='mt-4 text-center text-xs text-[#8b949e]'>
					Нет аккаунта?{' '}
					<Link
						href='/register'
						className='font-semibold text-[#58a6ff] hover:underline transition-colors'
					>
						Зарегистрироваться
					</Link>
				</p>
			</motion.div>
		</div>
	)
}
