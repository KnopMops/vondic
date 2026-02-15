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
	const { login, loginWithTelegram, loginWithYandex, isLoading } = useAuth()
	const router = useRouter()

	const [loginMethod, setLoginMethod] = useState<'email' | 'telegram'>('email')
	const [telegramStep, setTelegramStep] = useState<'instruction' | 'input'>(
		'instruction',
	)
	const [telegramKey, setTelegramKey] = useState('')
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

	const handleTelegramLogin = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!telegramKey.trim()) return
		await loginWithTelegram(telegramKey)
	}

	return (
		<div className='fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200'>
			{/* Click outside to close */}
			<div className='absolute inset-0' onClick={onClose} />

			<div className='relative w-full max-w-md space-y-6 rounded-2xl bg-gray-900 p-8 shadow-2xl border border-gray-800 animate-in zoom-in-95 duration-200'>
				{/* Close button */}
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
					<h2 className='text-2xl font-bold text-white'>Вход в Vondic</h2>
				</div>

				{loginMethod === 'email' ? (
					<form
						className='mt-8 space-y-6'
						onSubmit={
							twoFactorRequired ? handleEmailTwoFactor : handleEmailLogin
						}
					>
						<div className='-space-y-px rounded-md shadow-sm'>
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
									className='relative block w-full rounded-t-xl border-0 bg-gray-800 py-3 text-white ring-1 ring-inset ring-gray-700 placeholder:text-gray-500 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 transition-all'
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
										className='relative block w-full rounded-b-xl border-0 bg-gray-800 py-3 text-white ring-1 ring-inset ring-gray-700 placeholder:text-gray-500 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 transition-all'
										placeholder='Пароль'
										value={password}
										onChange={e => setPassword(e.target.value)}
									/>
								</div>
							) : (
								<div className='space-y-2'>
									<label htmlFor='twofactor' className='sr-only'>
										Two Factor Code
									</label>
									<input
										id='twofactor'
										name='twofactor'
										type='text'
										autoComplete='one-time-code'
										required
										className='relative block w-full rounded-b-xl border-0 bg-gray-800 py-3 text-white ring-1 ring-inset ring-gray-700 placeholder:text-gray-500 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 transition-all'
										placeholder={
											twoFactorMethod === 'email'
												? 'Код из письма'
												: 'Код из приложения'
										}
										value={twoFactorCode}
										onChange={e => setTwoFactorCode(e.target.value)}
									/>
									<p className='text-xs text-gray-400'>
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

						<div className='space-y-3'>
							<button
								type='submit'
								disabled={isLoading}
								className='group relative flex w-full justify-center rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50 transition-all shadow-lg shadow-indigo-500/20'
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

							<div className='relative flex items-center justify-center my-4'>
								<div className='absolute inset-0 flex items-center'>
									<div className='w-full border-t border-gray-800'></div>
								</div>
								<span className='relative bg-gray-900 px-2 text-sm text-gray-500'>
									или
								</span>
							</div>

							<button
								type='button'
								onClick={() => setLoginMethod('telegram')}
								className='group relative flex w-full justify-center rounded-xl border border-gray-700 bg-transparent px-4 py-3 text-sm font-semibold text-white hover:bg-gray-800 transition-all'
							>
								Войти через Telegram
							</button>

							<button
								type='button'
								onClick={() => loginWithYandex()}
								className='group relative flex w-full justify-center rounded-xl border border-red-900/30 bg-red-500/5 px-4 py-3 text-sm font-semibold text-red-400 hover:bg-red-500/10 transition-all'
							>
								Войти через Яндекс
							</button>
						</div>
					</form>
				) : (
					<div className='mt-8 space-y-6'>
						{telegramStep === 'instruction' ? (
							<div className='space-y-6 text-center animate-in fade-in slide-in-from-right-4 duration-300'>
								<div className='space-y-2'>
									<h3 className='text-lg font-medium text-white'>
										Авторизация через Telegram
									</h3>
									<p className='text-sm text-gray-400'>
										Для входа необходимо получить секретный ключ у нашего бота.
									</p>
								</div>

								<div className='rounded-xl bg-gray-800/50 p-6 ring-1 ring-inset ring-gray-700'>
									<p className='mb-3 text-xs text-gray-500 uppercase tracking-wider'>
										Напишите боту
									</p>
									<a
										href='https://t.me/vodnic_registration_bot'
										target='_blank'
										rel='noopener noreferrer'
										className='flex items-center justify-center gap-2 text-xl font-bold text-blue-400 hover:text-blue-300 transition-colors'
									>
										<svg
											className='w-6 h-6'
											fill='currentColor'
											viewBox='0 0 24 24'
											aria-hidden='true'
										>
											<path
												fillRule='evenodd'
												d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .24z'
												clipRule='evenodd'
											/>
										</svg>
										@vodnic_registration_bot
									</a>
								</div>

								<button
									onClick={() => setTelegramStep('input')}
									className='w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-500 transition-all'
								>
									Я получил ключ
								</button>
							</div>
						) : (
							<form
								onSubmit={handleTelegramLogin}
								className='space-y-6 animate-in fade-in slide-in-from-right-4 duration-300'
							>
								<div className='space-y-2 text-center'>
									<h3 className='text-lg font-medium text-white'>
										Введите ключ
									</h3>
									<p className='text-sm text-gray-400'>
										Вставьте ключ в формате <code>ID:SECRET</code>
									</p>
								</div>

								<div>
									<label htmlFor='telegram-key' className='sr-only'>
										Секретный ключ
									</label>
									<input
										id='telegram-key'
										type='text'
										required
										className='block w-full rounded-xl border-0 bg-gray-800 py-3 text-white ring-1 ring-inset ring-gray-700 placeholder:text-gray-500 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 text-center tracking-wide'
										placeholder='Пример: 123456:AbCdEf...'
										value={telegramKey}
										onChange={e => setTelegramKey(e.target.value)}
									/>
								</div>

								<button
									type='submit'
									disabled={isLoading}
									className='w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50 transition-all'
								>
									{isLoading ? 'Вход...' : 'Войти в аккаунт'}
								</button>
							</form>
						)}

						<button
							type='button'
							onClick={() => {
								if (telegramStep === 'input') {
									setTelegramStep('instruction')
								} else {
									setLoginMethod('email')
								}
							}}
							className='mt-4 w-full text-sm text-gray-500 hover:text-gray-300 transition-colors'
						>
							{telegramStep === 'input'
								? 'Назад к инструкции'
								: 'Вернуться к Email'}
						</button>
					</div>
				)}

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
