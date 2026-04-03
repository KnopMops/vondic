'use client'

import { useAuth } from '@/lib/AuthContext'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function LoginPage() {
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const { login, loginWithYandex, isLoading } = useAuth()
	const router = useRouter()

	const [twoFactorRequired, setTwoFactorRequired] = useState(false)
	const [twoFactorMethod, setTwoFactorMethod] = useState<'email' | 'totp'>(
		'email',
	)
	const [twoFactorCode, setTwoFactorCode] = useState('')
	const [loginError, setLoginError] = useState<string | null>(null)
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
		try {
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password }),
			})
			const data = await res.json().catch(() => ({}))
			if (!res.ok) {
				if (data?.two_factor_required) {
					setTwoFactorRequired(true)
					setTwoFactorMethod(data.method === 'totp' ? 'totp' : 'email')
					return
				}
				setLoginError(data?.error || 'Ошибка входа')
				return
			}
			router.push('/feed')
		} catch (err: any) {
			setLoginError(err.message || 'Ошибка входа')
		}
	}

	const handleEmailTwoFactor = async (e: React.FormEvent) => {
		e.preventDefault()
		setLoginError(null)
		try {
			const body: any = { email, password }
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
			router.push('/feed')
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
					<h2 className='text-2xl font-bold text-white'>Добро пожаловать</h2>
				</div>

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

						<div className='space-y-4'>
							<button
								type='submit'
								disabled={isLoading}
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
