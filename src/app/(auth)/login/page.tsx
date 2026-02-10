'use client'

import BrandLogo from '@/components/social/BrandLogo'
import { useAuth } from '@/lib/AuthContext'
import { motion } from 'framer-motion'
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
						Добро пожаловать
					</h2>
				</div>

				{loginMethod === 'email' ? (
					<form className='mt-8 space-y-6' onSubmit={handleEmailLogin}>
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
									className='relative block w-full rounded-xl border border-white/10 bg-white/5 py-3 px-4 text-white placeholder:text-gray-500 focus:z-10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all outline-none'
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
									className='relative block w-full rounded-xl border border-white/10 bg-white/5 py-3 px-4 text-white placeholder:text-gray-500 focus:z-10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all outline-none'
									placeholder='Пароль'
									value={password}
									onChange={e => setPassword(e.target.value)}
								/>
							</div>
						</div>

						<div className='space-y-4'>
							<button
								type='submit'
								disabled={isLoading}
								className='group relative flex w-full justify-center rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 text-sm font-semibold text-white hover:shadow-lg hover:shadow-indigo-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed'
							>
								{isLoading ? 'Вход...' : 'Войти'}
							</button>

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
								onClick={() => setLoginMethod('telegram')}
								className='group relative flex w-full justify-center rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-all'
							>
								Войти через Telegram
							</button>

							<button
								type='button'
								onClick={() => loginWithYandex()}
								className='group relative flex w-full justify-center rounded-full border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-400 hover:bg-red-500/20 transition-all'
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

								<div className='rounded-2xl bg-white/5 border border-white/10 p-6'>
									<p className='mb-3 text-xs text-gray-500 uppercase tracking-wider'>
										Напишите боту
									</p>
									<a
										href='https://t.me/vodnic_registration_bot'
										target='_blank'
										rel='noopener noreferrer'
										className='flex items-center justify-center gap-2 text-lg font-bold text-indigo-400 hover:text-indigo-300 transition-colors'
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
									className='w-full rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 text-sm font-semibold text-white hover:shadow-lg hover:shadow-indigo-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all'
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
										className='block w-full rounded-xl border border-white/10 bg-white/5 py-3 text-white placeholder:text-gray-500 focus:z-10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-center tracking-wide outline-none'
										placeholder='Пример: 123456:AbCdEf...'
										value={telegramKey}
										onChange={e => setTelegramKey(e.target.value)}
									/>
								</div>

								<button
									type='submit'
									disabled={isLoading}
									className='w-full rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 text-sm font-semibold text-white hover:shadow-lg hover:shadow-indigo-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50'
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
							className='flex w-full justify-center text-sm text-gray-400 hover:text-white transition-colors'
						>
							Назад
						</button>
					</div>
				)}
				
				<p className="mt-4 text-center text-sm text-gray-400">
					Нет аккаунта?{" "}
					<Link
						href="/register"
						className="font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
					>
						Зарегистрироваться
					</Link>
				</p>
			</motion.div>
		</div>
	)
}
