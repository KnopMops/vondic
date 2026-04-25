'use client'

import BrandLogo from '@/components/social/BrandLogo'
import { useAuth } from '@/lib/AuthContext'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface LoginModalProps {
	isOpen: boolean
	onClose: () => void
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
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

	if (!isOpen) return null

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
		<div className='fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200'>
			<div className='absolute inset-0' onClick={onClose} />

			<div className='relative w-full max-w-md space-y-6 rounded-2xl bg-gray-900 p-8 shadow-2xl border border-gray-800 animate-in zoom-in-95 duration-200'>
				<button
					onClick={onClose}
					className='absolute top-4 right-4 text-gray-500 hover:text-white transition-colors'
				>
					<svg
						xmlns='http://www.w3.org/2000/svg'
						fill='none'
						viewBox='0 0 24 24'
						strokeWidth={1.5}
						stroke='currentColor'
						className='w-6 h-6'
					>
						<path
							strokeLinecap='round'
							strokeLinejoin='round'
							d='M6 18L18 6M6 6l12 12'
						/>
					</svg>
				</button>

				<div className='flex items-center justify-center gap-3'>
					<BrandLogo size={32} />
					<h2 className='text-2xl font-bold text-white'>Вход в Вондик</h2>
				</div>

				<form
					className='mt-8 space-y-4'
					onSubmit={twoFactorRequired ? handleEmailTwoFactor : handleEmailLogin}
				>
					<div className='space-y-4'>
						<div>
							<label htmlFor='email-address' className='sr-only'>
								Email address
							</label>
							<input
								id='email-address'
								name='email'
								type='email'
								autoComplete='email'
								required
								className='relative block w-full rounded-xl border-0 bg-gray-800/50 py-3.5 px-4 text-white ring-1 ring-inset ring-gray-700/50 placeholder:text-gray-500 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-indigo-500/50 transition-all hover:bg-gray-800'
								placeholder='Электронная почта'
								value={email}
								onChange={e => setEmail(e.target.value)}
							/>
						</div>
						{!twoFactorRequired ? (
							<div>
								<label htmlFor='password' className='sr-only'>
									Password
								</label>
								<input
									id='password'
									name='password'
									type='password'
									autoComplete='current-password'
									required
									className='relative block w-full rounded-xl border-0 bg-gray-800/50 py-3.5 px-4 text-white ring-1 ring-inset ring-gray-700/50 placeholder:text-gray-500 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-indigo-500/50 transition-all hover:bg-gray-800'
									placeholder='Пароль'
									value={password}
									onChange={e => setPassword(e.target.value)}
								/>
							</div>
						) : (
							<div className='space-y-3'>
								<label htmlFor='twofactor' className='sr-only'>
									Two Factor Code
								</label>
								<input
									id='twofactor'
									name='twofactor'
									type='text'
									autoComplete='one-time-code'
									required
									className='relative block w-full rounded-xl border-0 bg-gray-800/50 py-3.5 px-4 text-white ring-1 ring-inset ring-gray-700/50 placeholder:text-gray-500 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-indigo-500/50 transition-all hover:bg-gray-800'
									placeholder={
										twoFactorMethod === 'email'
											? 'Код из письма'
											: 'Код из приложения'
									}
									value={twoFactorCode}
									onChange={e => setTwoFactorCode(e.target.value)}
								/>
								<p className='text-xs text-gray-400 px-1'>
									{twoFactorMethod === 'email'
										? 'Введите 6-значный код, отправленный на вашу почту.'
										: 'Введите 6-значный код из приложения аутентификации.'}
								</p>
								{twoFactorMethod === 'email' && (
									<button
										type='button'
										onClick={sendLoginEmailCode}
										className='mt-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors px-1'
									>
										Отправить код на почту
									</button>
								)}
							</div>
						)}
					</div>

					<div className='space-y-4 pt-2'>
						<button
							type='submit'
							disabled={isLoading}
							className='group relative flex w-full justify-center rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50 transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98]'
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

						<div className='relative flex items-center justify-center my-6'>
							<div className='absolute inset-0 flex items-center'>
								<div className='w-full border-t border-gray-800'></div>
							</div>
							<span className='relative bg-gray-900 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider'>
								или
							</span>
						</div>

						<button
							type='button'
							onClick={() => loginWithYandex()}
							className='group relative flex w-full items-center justify-center gap-3 rounded-xl border border-white/20 bg-transparent px-4 py-3.5 text-sm font-semibold text-white hover:bg-white/5 transition-all active:scale-[0.98]'
						>
							Яндекс
							<svg
								width='20'
								height='20'
								viewBox='0 0 20 20'
								fill='none'
								xmlns='http://www.w3.org/2000/svg'
							>
								<path
									fillRule='evenodd'
									clipRule='evenodd'
									d='M10 20C15.5228 20 20 15.5228 20 10C20 4.47715 15.5228 0 10 0C4.47715 0 0 4.47715 0 10C0 15.5228 4.47715 20 10 20ZM8.57143 14.2857H7.14286V5.71429H8.57143V14.2857ZM12.8571 14.2857H11.4286L12.8571 10.7143L10.7143 5.71429H12.1429L13.5714 9.28571L15 5.71429H16.4286L14.2857 10.7143L12.8571 14.2857Z'
									fill='#FC3F1D'
								/>
							</svg>
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
				</form>

				<p className='mt-2 text-center text-sm text-gray-500'>
					Нет аккаунта?{' '}
					<Link
						href='/register'
						className='font-medium text-indigo-400 hover:text-indigo-300 transition-colors'
					>
						Зарегистрироваться
					</Link>
				</p>
			</div>
		</div>
	)
}
