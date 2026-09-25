'use client'

import SmartCaptcha from '@/components/auth/SmartCaptcha'
import BrandLogo from '@/components/social/BrandLogo'
import PasswordInput from '@/components/ui/PasswordInput'
import { useAuth } from '@/lib/AuthContext'
import { setUser } from '@/lib/features/authSlice'
import { useAppDispatch } from '@/lib/hooks'
import Link from 'next/link'
import { useState } from 'react'
import { LuX as X, LuKey } from 'react-icons/lu'
import { SiYandexcloud as Yandex } from 'react-icons/si'
import { loginWithPasskey } from '@/lib/passkey'

interface LoginModalProps {
	isOpen: boolean
	onClose: () => void
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const { loginWithYandex, isLoading } = useAuth()
	const dispatch = useAppDispatch()
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

	const [passkeyLoading, setPasskeyLoading] = useState(false)

	const handlePasskeyLogin = async () => {
		setLoginError(null)
		setPasskeyLoading(true)
		try {
			const data = await loginWithPasskey()
			if (data?.user) {
				dispatch(setUser(data.user))
				onClose()
				window.location.assign('/feed')
			}
		} catch (err: any) {
			setLoginError(err.message || 'Ошибка входа по Passkey')
		} finally {
			setPasskeyLoading(false)
		}
	}

	if (!isOpen) return null

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
				if (data?.send_reset_link) {
					window.location.href = `/reset-link-sent?email=${encodeURIComponent(data.email || '')}`
					return
				}
				setLoginError(data?.error || 'Ошибка входа')
				setCaptchaKey(k => k + 1)
				setCaptchaToken('')
				return
			}
			const userData = data.user ? { ...data.user } : null
			if (userData && data.access_token) {
				userData.access_token = data.access_token
			}
			if (userData) {
				dispatch(setUser(userData))
				localStorage.setItem('user', JSON.stringify(userData))
			}
			onClose()
			window.location.assign('/feed')
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
			const userData = data.user ? { ...data.user } : null
			if (userData && data.access_token) {
				userData.access_token = data.access_token
			}
			if (userData) {
				dispatch(setUser(userData))
				localStorage.setItem('user', JSON.stringify(userData))
			}
			onClose()
			window.location.assign('/feed')
		} catch (err: any) {
			setLoginError(err.message || 'Ошибка подтверждения')
		}
	}

	return (
		<div className='fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200'>
			<div className='absolute inset-0' onClick={onClose} />

			<div className='relative w-full max-w-[420px] space-y-5 rounded-2xl bg-[#161b22] p-7 shadow-2xl border border-[#30363d] animate-in zoom-in-95 duration-200'>
				<button
					onClick={onClose}
					className='absolute top-4 right-4 text-[#8b949e] hover:text-white transition-colors'
					aria-label='Закрыть'
				>
					<X className='w-5 h-5' />
				</button>

				<div className='flex flex-col items-center justify-center gap-2'>
					<div className='flex items-center justify-center w-10 h-10 rounded-xl bg-[#0077FF] text-white font-bold text-lg'>
						V
					</div>
					<h2 className='text-lg font-bold text-white'>Вход в Vondic</h2>
					<p className='text-xs text-[#8b949e]'>Единый аккаунт для всех сервисов</p>
				</div>

				<form
					className='mt-4 space-y-3.5'
					onSubmit={twoFactorRequired ? handleEmailTwoFactor : handleEmailLogin}
				>
					<div className='space-y-3'>
						<div>
							<label htmlFor='email-address' className='block text-xs font-medium text-[#8b949e] mb-1.5'>
								Электронная почта или логин
							</label>
							<input
								id='email-address'
								name='email'
								type='text'
								autoComplete='email'
								required
								className='relative block w-full rounded-lg border border-[#30363d] bg-[#0d1117] py-2.5 px-3.5 text-sm text-white placeholder:text-[#8b949e]/50 focus:border-[#0077FF] focus:ring-1 focus:ring-[#0077FF] transition-all outline-none'
								placeholder='name@example.com'
								value={email}
								onChange={e => setEmail(e.target.value)}
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
										onClick={onClose}
									>
										Забыли пароль?
									</Link>
								</div>
								<PasswordInput
									id='password'
									name='password'
									autoComplete='current-password'
									required
									wrapperClassName='w-full'
									className='relative block w-full rounded-lg border border-[#30363d] bg-[#0d1117] py-2.5 px-3.5 text-sm text-white placeholder:text-[#8b949e]/50 focus:border-[#0077FF] focus:ring-1 focus:ring-[#0077FF] transition-all outline-none'
									placeholder='••••••••'
									value={password}
									onChange={e => setPassword(e.target.value)}
								/>
							</div>
						) : (
							<div className='space-y-2 p-3.5 rounded-lg border border-[#30363d] bg-[#0d1117]'>
								<label htmlFor='twofactor' className='block text-xs font-semibold text-white'>
									Подтверждение двухфакторной защиты (2FA)
								</label>
								<input
									id='twofactor'
									name='twofactor'
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
										? 'Мы отправили 6-значный код на вашу почту.'
										: 'Введите 6-значный код из приложения аутентификации.'}
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
						{!twoFactorRequired && (
							<SmartCaptcha
								key={`password-${captchaKey}`}
								onTokenChange={setCaptchaToken}
							/>
						)}
					</div>

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
							onClick={() => loginWithYandex()}
							className='w-full flex items-center justify-center gap-2 rounded-lg bg-[#ffcc00] hover:bg-[#e6b800] py-2.5 text-sm font-semibold text-black transition-all active:scale-[0.99]'
						>
							<span className='w-4 h-4 rounded-full bg-[#fc3f1d] text-white flex items-center justify-center text-[10px] font-bold'>Я</span>
							Войти с Яндекс ID
						</button>

						<p className='text-center text-[11px] text-[#8b949e] leading-relaxed pt-1'>
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

				<p className='mt-3 text-center text-xs text-[#8b949e]'>
					Нет аккаунта?{' '}
					<Link
						href='/register'
						className='font-semibold text-[#58a6ff] hover:underline transition-colors'
						onClick={onClose}
					>
						Зарегистрироваться
					</Link>
				</p>
			</div>
		</div>
	)
}
