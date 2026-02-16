'use client'

import { useAuth } from '@/lib/AuthContext'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useState } from 'react'

export default function RegisterPage() {
	const [email, setEmail] = useState('')
	const [username, setUsername] = useState('')
	const [password, setPassword] = useState('')
	const { register, isLoading } = useAuth()

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		await register(email, username, password)
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
					<h2 className='text-2xl font-bold text-white'>Создать аккаунт</h2>
				</div>

				<form className='mt-8 space-y-6' onSubmit={handleSubmit}>
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
							<label htmlFor='username' className='sr-only'>
								Username
							</label>
							<input
								id='username'
								name='username'
								type='text'
								autoComplete='username'
								required
								className='relative block w-full rounded-xl border border-white/10 bg-white/5 py-3 px-4 text-white placeholder:text-gray-500 focus:z-10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all outline-none'
								placeholder='Имя пользователя'
								value={username}
								onChange={e => setUsername(e.target.value)}
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
								autoComplete='new-password'
								required
								className='relative block w-full rounded-xl border border-white/10 bg-white/5 py-3 px-4 text-white placeholder:text-gray-500 focus:z-10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all outline-none'
								placeholder='Пароль'
								value={password}
								onChange={e => setPassword(e.target.value)}
							/>
						</div>
					</div>

					<div>
						<button
							type='submit'
							disabled={isLoading}
							className='group relative flex w-full justify-center rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 text-sm font-semibold text-white hover:shadow-lg hover:shadow-indigo-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed'
						>
							{isLoading ? 'Создание...' : 'Зарегистрироваться'}
						</button>
					</div>
					<p className='mt-3 text-center text-xs text-gray-500'>
						Регистрируясь, вы соглашаетесь с{' '}
						<a
							href={`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'}/static/privacy_policy.rtf`}
							target='_blank'
							rel='noopener noreferrer'
							className='text-indigo-400 hover:text-indigo-300 transition-colors'
						>
							политикой конфиденциальности
						</a>
						.
					</p>
				</form>

				<p className='mt-4 text-center text-sm text-gray-400'>
					Уже есть аккаунт?{' '}
					<Link
						href='/login'
						className='font-medium text-indigo-400 hover:text-indigo-300 transition-colors'
					>
						Войти
					</Link>
				</p>
			</motion.div>
		</div>
	)
}
