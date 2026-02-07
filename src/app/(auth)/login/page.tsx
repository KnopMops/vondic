'use client'

import BrandLogo from '@/components/social/BrandLogo'
import { useAuth } from '@/lib/AuthContext'
import Link from 'next/link'
import { useState } from 'react'

export default function LoginPage() {
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const { login, loginWithTelegram, loginWithYandex, isLoading } = useAuth()

	const [loginMethod, setLoginMethod] = useState<'email' | 'telegram'>('email')
	const [telegramStep, setTelegramStep] = useState<'instruction' | 'input'>(
		'instruction',
	)
	const [telegramKey, setTelegramKey] = useState('')

	const handleEmailLogin = async (e: React.FormEvent) => {
		e.preventDefault()
		await login(email, password)
	}

	const handleTelegramLogin = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!telegramKey.trim()) return
		await loginWithTelegram(telegramKey)
	}

	return (
		<div className='flex min-h-screen items-center justify-center bg-gray-900'>
			<div className='w-full max-w-md space-y-6 rounded-2xl bg-gray-800 p-8 shadow-xl'>
				<div className='flex items-center justify-center gap-3'>
					<BrandLogo size={32} />
					<h2 className='text-2xl font-bold text-white'>
						Добро пожаловать в Vondic
					</h2>
				</div>

				{loginMethod === 'email' ? (
					<form className='mt-8 space-y-6' onSubmit={handleEmailLogin}>
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
									className='relative block w-full rounded-t-md border-0 bg-gray-700 py-2 text-white ring-1 ring-inset ring-gray-600 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-indigo-500'
									placeholder='Электронная почта'
									value={email}
									onChange={e => setEmail(e.target.value)}
								/>
							</div>
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
									className='relative block w-full rounded-b-md border-0 bg-gray-700 py-2 text-white ring-1 ring-inset ring-gray-600 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-indigo-500'
									placeholder='Пароль'
									value={password}
									onChange={e => setPassword(e.target.value)}
								/>
							</div>
						</div>

						<div className='space-y-3'>
							<button
								type='submit'
								disabled={isLoading}
								className='group relative flex w-full justify-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50'
							>
								{isLoading ? 'Вход...' : 'Войти'}
							</button>

							<div className='relative flex items-center justify-center'>
								<span className='bg-gray-800 px-2 text-sm text-gray-500'>
									или
								</span>
							</div>

							<button
								type='button'
								onClick={() => setLoginMethod('telegram')}
								className='group relative flex w-full justify-center rounded-full border border-gray-600 bg-transparent px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700'
							>
								Войти через Telegram
							</button>

							<button
								type='button'
								onClick={() => loginWithYandex()}
								className='group relative flex w-full justify-center rounded-full border border-red-500 bg-transparent px-4 py-2 text-sm font-semibold text-white hover:bg-red-500/10'
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

								<div className='rounded-xl bg-gray-700/50 p-6 ring-1 ring-inset ring-gray-600/50'>
									<p className='mb-3 text-xs text-gray-400 uppercase tracking-wider'>
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
									className='w-full rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-all'
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
										className='block w-full rounded-md border-0 bg-gray-700 py-2 text-white ring-1 ring-inset ring-gray-600 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 text-center tracking-wide'
										placeholder='Пример: 123456:AbCdEf...'
										value={telegramKey}
										onChange={e => setTelegramKey(e.target.value)}
									/>
								</div>

								<button
									type='submit'
									disabled={isLoading}
									className='w-full rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50'
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

				<p className='mt-2 text-center text-sm text-gray-400'>
					Нет аккаунта?{' '}
					<Link
						href='/register'
						className='font-medium text-blue-400 hover:text-blue-300'
					>
						Зарегистрироваться
					</Link>
				</p>
			</div>
		</div>
	)
}
