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
		<div className='flex min-h-screen items-center justify-center bg-[#0e1117] p-4 text-[#e6edf3] selection:bg-[#0077FF] selection:text-white relative'>
			<motion.div
				initial={{ opacity: 0, y: 14 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.35, ease: 'easeOut' }}
				className='w-full max-w-[420px] space-y-6 rounded-2xl bg-[#161b22] border border-[#30363d] p-7 shadow-xl relative z-10 text-center'
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
						{status === 'success' ? 'Готово!' : 'Новый пароль Вондик'}
					</h1>
					<p className='text-xs text-[#8b949e] text-center'>
						{status === 'success'
							? 'Ваш пароль успешно обновлен'
							: 'Придумайте надежный пароль для входа в Вондик'}
					</p>
				</div>

				{status === 'success' ? (
					<motion.div
						initial={{ opacity: 0, scale: 0.95 }}
						animate={{ opacity: 1, scale: 1 }}
						className='space-y-4 py-2'
					>
						<div className='w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto'>
							<Check className='w-6 h-6 text-emerald-400' />
						</div>
						<p className='text-white text-sm font-medium'>{message}</p>
						<p className='text-xs text-[#8b949e]'>
							Теперь вы можете войти в аккаунт с новым паролем.
						</p>
					</motion.div>
				) : (
					<form onSubmit={handleSubmit} className='space-y-4 text-left mt-2'>
						<div>
							<label htmlFor='password' className='block text-xs font-medium text-[#8b949e] mb-1.5'>
								Новый пароль
							</label>
							<div className='relative'>
								<KeyRound className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8b949e] z-10 pointer-events-none' />
								<PasswordInput
									id='password'
									name='password'
									autoComplete='new-password'
									required
									wrapperClassName='w-full'
									className='block w-full rounded-lg border border-[#30363d] bg-[#0d1117] py-2.5 pl-9 pr-11 text-sm text-white placeholder:text-[#8b949e]/50 focus:border-[#0077FF] focus:ring-1 focus:ring-[#0077FF] transition-all outline-none'
									placeholder='Минимум 6 символов'
									value={password}
									onChange={e => setPassword(e.target.value)}
								/>
							</div>
						</div>
						<div>
							<label htmlFor='confirm-password' className='block text-xs font-medium text-[#8b949e] mb-1.5'>
								Подтвердите пароль
							</label>
							<PasswordInput
								id='confirm-password'
								name='confirm-password'
								autoComplete='new-password'
								required
								wrapperClassName='w-full'
								className='block w-full rounded-lg border border-[#30363d] bg-[#0d1117] py-2.5 px-3.5 text-sm text-white placeholder:text-[#8b949e]/50 focus:border-[#0077FF] focus:ring-1 focus:ring-[#0077FF] transition-all outline-none'
								placeholder='Повторите пароль'
								value={confirmPassword}
								onChange={e => setConfirmPassword(e.target.value)}
							/>
						</div>

						{status === 'error' && (
							<p className='text-center text-xs text-red-400'>{message}</p>
						)}

						<button
							type='submit'
							disabled={status === 'loading'}
							className='w-full rounded-lg bg-[#0077FF] hover:bg-[#0066dd] px-4 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm'
						>
							{status === 'loading' ? 'Сохранение...' : 'Сменить пароль'}
						</button>
					</form>
				)}

				<div className='pt-2 text-center text-xs text-[#8b949e]'>
					<Link
						href='/login'
						className='font-medium text-[#58a6ff] hover:underline transition-colors'
					>
						{status === 'success' ? 'Войти в аккаунт' : 'Вернуться ко входу'}
					</Link>
				</div>
			</motion.div>
		</div>
	)
}
