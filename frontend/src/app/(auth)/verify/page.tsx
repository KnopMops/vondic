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
						{status === 'success'
							? 'Готово!'
							: status === 'error'
								? 'Ошибка'
								: 'Подтвердите Email'}
					</motion.h2>
				</div>

				<div className='space-y-4 text-gray-300'>
					{status === 'loading' && (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							className='flex flex-col items-center gap-4'
						>
							<div className='w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin' />
							<p>Подтверждаем вашу почту...</p>
						</motion.div>
					)}

					{status === 'success' && (
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
								Теперь вы можете войти в свой аккаунт.
							</p>
						</motion.div>
					)}

					{status === 'error' && (
						<motion.div
							initial={{ opacity: 0, scale: 0.9 }}
							animate={{ opacity: 1, scale: 1 }}
							className='space-y-4'
						>
							<div className='w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4'>
								<X className='w-8 h-8 text-red-500' />
							</div>
							<p className='text-red-400 font-medium'>{message}</p>
						</motion.div>
					)}

					{status === 'idle' && (
						<>
							<motion.p
								initial={{ opacity: 0, x: -20 }}
								animate={{ opacity: 1, x: 0 }}
								transition={{ delay: 0.4 }}
							>
								Мы отправили письмо с подтверждением на вашу электронную почту.
							</motion.p>
							<motion.p
								initial={{ opacity: 0, x: 20 }}
								animate={{ opacity: 1, x: 0 }}
								transition={{ delay: 0.5 }}
							>
								Пожалуйста, перейдите по ссылке в письме, чтобы активировать
								аккаунт.
							</motion.p>
						</>
					)}
				</div>

				<div className='mt-8'>
					<Link
						href='/login'
						className='group relative flex w-full justify-center rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 text-sm font-semibold text-white hover:shadow-lg hover:shadow-indigo-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all'
					>
						{status === 'success' ? 'Войти в аккаунт' : 'Вернуться ко входу'}
					</Link>
				</div>
			</motion.div>
		</div>
	)
}
