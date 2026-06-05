'use client'

import BrandLogo from '@/components/social/BrandLogo'
import PasswordInput from '@/components/ui/PasswordInput'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { LuCheck as Check, LuKeyRound as KeyRound } from 'react-icons/lu'

export default function ResetPasswordPage() {
	const searchParams = useSearchParams()
	const token = searchParams.get('token')
	const [password, setPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
	const [message, setMessage] = useState('')

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setMessage('')
		if (!token) {
			setStatus('error')
			setMessage('Отсутствует токен сброса пароля')
			return
		}
		if (password.length < 6) {
			setStatus('error')
			setMessage('Пароль должен быть не менее 6 символов')
			return
		}
		if (password !== confirmPassword) {
			setStatus('error')
			setMessage('Пароли не совпадают')
			return
		}
		setStatus('loading')
		try {
			const res = await fetch('/api/auth/reset-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token, new_password: password }),
			})
			const data = await res.json()
			if (res.ok) {
				setStatus('success')
				setMessage(data.message || 'Пароль успешно изменён')
			} else {
				setStatus('error')
				setMessage(data.error || 'Ошибка сброса пароля')
			}
		} catch {
			setStatus('error')
			setMessage('Произошла ошибка при соединении с сервером')
		}
	}

	return (
		<div className='flex min-h-screen items-center justify-center bg-black overflow-hidden relative'>
			<div className='absolute inset-0 z-0 overflow-hidden pointer-events-none'>
				<div className='absolute top-[20%] left-[20%] w-[40%] h-[40%] rounded-full bg-indigo-900/20 blur-[120px]' />
				<div className='absolute bottom-[20%] right-[20%] w-[40%] h-[40%] rounded-full bg-purple-900/20 blur-[120px]' />
			</div>

			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.8, ease: 'easeOut' }}
				className='w-full max-w-md space-y-6 rounded-3xl bg-white/5 border border-white/10 p-8 shadow-2xl backdrop-blur-xl relative z-10 text-center'
			>
				<div className='flex flex-col items-center justify-center gap-4'>
					<motion.div
						initial={{ scale: 0.8, opacity: 0 }}
						animate={{ scale: 1, opacity: 1 }}
						transition={{ delay: 0.2, duration: 0.5 }}
					>
						<BrandLogo size={48} />
					</motion.div>
					<motion.h2
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 0.3 }}
						className='text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400'
					>
						{status === 'success' ? 'Готово!' : 'Новый пароль'}
					</motion.h2>
				</div>

				{status === 'success' ? (
					<motion.div
						initial={{ opacity: 0, scale: 0.9 }}
						animate={{ opacity: 1, scale: 1 }}
						className='space-y-4'
					>
						<div className='w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4'>
							<Check className='w-8 h-8 text-green-500' />
						</div>
						<p className='text-white text-lg font-medium'>{message}</p>
						<p className='text-sm text-gray-400'>
							Теперь вы можете войти с новым паролем.
						</p>
					</motion.div>
				) : (
					<form onSubmit={handleSubmit} className='space-y-4 text-left'>
						<div>
							<label htmlFor='password' className='sr-only'>
								Новый пароль
							</label>
							<div className='relative'>
								<KeyRound className='absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 z-10 pointer-events-none' />
								<PasswordInput
									id='password'
									name='password'
									autoComplete='new-password'
									required
									wrapperClassName='w-full'
									className='block w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-11 text-white placeholder:text-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all outline-none'
									placeholder='Новый пароль'
									value={password}
									onChange={e => setPassword(e.target.value)}
								/>
							</div>
						</div>
						<div>
							<label htmlFor='confirm-password' className='sr-only'>
								Подтвердите пароль
							</label>
							<PasswordInput
								id='confirm-password'
								name='confirm-password'
								autoComplete='new-password'
								required
								wrapperClassName='w-full'
								className='block w-full rounded-xl border border-white/10 bg-white/5 py-3 px-4 text-white placeholder:text-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all outline-none'
								placeholder='Подтвердите пароль'
								value={confirmPassword}
								onChange={e => setConfirmPassword(e.target.value)}
							/>
						</div>

						{status === 'error' && (
							<p className='text-center text-sm text-red-400'>{message}</p>
						)}

						<button
							type='submit'
							disabled={status === 'loading'}
							className='group relative flex w-full justify-center rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 text-sm font-semibold text-white hover:shadow-lg hover:shadow-indigo-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed'
						>
							{status === 'loading' ? 'Сохранение...' : 'Сменить пароль'}
						</button>
					</form>
				)}

				<div className='mt-4 text-center text-sm text-gray-400'>
					<Link
						href='/login'
						className='font-medium text-indigo-400 hover:text-indigo-300 transition-colors'
					>
						{status === 'success' ? 'Войти в аккаунт' : 'Вернуться ко входу'}
					</Link>
				</div>
			</motion.div>
		</div>
	)
}
