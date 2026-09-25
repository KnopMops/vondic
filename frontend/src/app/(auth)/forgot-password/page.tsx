'use client'

import BrandLogo from '@/components/social/BrandLogo'
import EmailInput from '@/components/ui/EmailInput'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useState } from 'react'
import { LuCheck as Check, LuMail as Mail } from 'react-icons/lu'

export default function ForgotPasswordPage() {
	const [email, setEmail] = useState('')
	const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
	const [message, setMessage] = useState('')

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setStatus('loading')
		setMessage('')
		try {
			const res = await fetch('/api/auth/forgot-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: email.trim().toLowerCase() }),
			})
			const data = await res.json()
			if (res.ok) {
				setStatus('success')
				setMessage(data.message || 'Письмо с инструкциями отправлено')
			} else {
				setStatus('error')
				setMessage(data.error || 'Ошибка запроса')
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
				<div className='flex flex-col items-center justify-center gap-2'>
					<div className='flex items-center justify-center w-11 h-11 rounded-xl bg-[#0077FF] shadow-sm'>
						<span className='text-xl font-bold text-white tracking-wide'>V</span>
					</div>
					<h1 className='text-xl font-bold text-white tracking-tight mt-1'>
						{status === 'success' ? 'Готово!' : 'Сброс пароля'}
					</h1>
					<p className='text-xs text-[#8b949e] text-center'>
						{status === 'success'
							? 'Проверьте входящие сообщения'
							: 'Введите email, указанный при регистрации'}
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
							Мы отправили ссылку для смены пароля. Проверьте папку «Входящие» и «Спам».
						</p>
					</motion.div>
				) : (
					<form onSubmit={handleSubmit} className='space-y-4 text-left mt-2'>
						<div>
							<label htmlFor='email' className='block text-xs font-medium text-[#8b949e] mb-1.5'>
								Электронная почта
							</label>
							<div className='relative'>
								<Mail className='absolute left-3 top-1/2 z-10 -translate-y-1/2 w-4 h-4 text-[#8b949e] pointer-events-none' />
								<EmailInput
									id='email'
									value={email}
									onChange={setEmail}
									required
									listId='forgot-email-suggestions'
									className='block w-full rounded-lg border border-[#30363d] bg-[#0d1117] py-2.5 pl-9 pr-3.5 text-sm text-white placeholder:text-[#8b949e]/50 focus:border-[#0077FF] focus:ring-1 focus:ring-[#0077FF] transition-all outline-none'
								/>
							</div>
						</div>

						{status === 'error' && (
							<p className='text-center text-xs text-red-400'>{message}</p>
						)}

						<button
							type='submit'
							disabled={status === 'loading'}
							className='w-full rounded-lg bg-[#0077FF] hover:bg-[#0066dd] px-4 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm'
						>
							{status === 'loading' ? 'Отправка...' : 'Отправить ссылку'}
						</button>
					</form>
				)}

				<div className='pt-2 text-center text-xs text-[#8b949e]'>
					<Link
						href='/login'
						className='font-medium text-[#58a6ff] hover:underline transition-colors'
					>
						Вернуться ко входу
					</Link>
				</div>
			</motion.div>
		</div>
	)
}
