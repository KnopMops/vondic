'use client'

import BrandLogo from '@/components/social/BrandLogo'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LuCheck as Check, LuX as X } from 'react-icons/lu'

export default function VerifyPage() {
	const searchParams = useSearchParams()
	const token = searchParams.get('token')
	const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'idle'>(
		token ? 'loading' : 'idle',
	)
	const [message, setMessage] = useState('')

	useEffect(() => {
		if (token) {
			const verifyToken = async () => {
				try {
					const res = await fetch(`/api/auth/verify-email/${token}`)
					const data = await res.json()
					if (res.ok) {
						setStatus('success')
						setMessage(data.message || 'Email успешно подтвержден!')
					} else {
						setStatus('error')
						setMessage(data.error || 'Ошибка подтверждения')
					}
				} catch (err) {
					setStatus('error')
					setMessage('Произошла ошибка при соединении с сервером')
				}
			}
			verifyToken()
		}
	}, [token])

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
						{status === 'success'
							? 'Готово!'
							: status === 'error'
								? 'Ошибка'
								: 'Подтверждение Вондик'}
					</h1>
					<p className='text-xs text-[#8b949e] text-center'>
						{status === 'success'
							? 'Ваш email успешно подтвержден'
							: 'Проверка ссылки подтверждения аккаунта Вондик'}
					</p>
				</div>

				<div className='space-y-4 py-2'>
					{status === 'loading' && (
						<div className='flex flex-col items-center gap-3 py-4'>
							<div className='w-8 h-8 border-2 border-[#0077FF] border-t-transparent rounded-full animate-spin' />
							<p className='text-xs text-[#8b949e]'>Подтверждаем вашу почту...</p>
						</div>
					)}

					{status === 'success' && (
						<motion.div
							initial={{ opacity: 0, scale: 0.95 }}
							animate={{ opacity: 1, scale: 1 }}
							className='space-y-4'
						>
							<div className='w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto'>
								<Check className='w-6 h-6 text-emerald-400' />
							</div>
							<p className='text-white text-sm font-medium'>{message}</p>
							<p className='text-xs text-[#8b949e]'>
								Теперь вы можете войти в свой аккаунт.
							</p>
						</motion.div>
					)}

					{status === 'error' && (
						<motion.div
							initial={{ opacity: 0, scale: 0.95 }}
							animate={{ opacity: 1, scale: 1 }}
							className='space-y-4'
						>
							<div className='w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto'>
								<X className='w-6 h-6 text-red-400' />
							</div>
							<p className='text-red-400 text-sm font-medium'>{message}</p>
						</motion.div>
					)}

					{status === 'idle' && (
						<div className='space-y-2 text-xs text-[#8b949e]'>
							<p>
								Мы отправили письмо с подтверждением на вашу электронную почту.
							</p>
							<p>
								Пожалуйста, перейдите по ссылке в письме, чтобы активировать аккаунт.
							</p>
						</div>
					)}
				</div>

				<div className='pt-2'>
					<Link
						href='/login'
						className='w-full inline-flex items-center justify-center rounded-lg bg-[#0077FF] hover:bg-[#0066dd] px-4 py-2.5 text-sm font-semibold text-white transition-all shadow-sm'
					>
						{status === 'success' ? 'Войти в аккаунт' : 'Вернуться ко входу'}
					</Link>
				</div>
			</motion.div>
		</div>
	)
}
