'use client'

import { motion } from 'framer-motion'
import { CheckCircle, Sparkles } from 'lucide-react'
import Link from 'next/link'

export default function PremiumSuccessPage() {
	return (
		<div className='min-h-screen bg-black flex items-center justify-center p-4 overflow-hidden relative'>
			{/* Background Gradients */}
			<div className='absolute inset-0 pointer-events-none'>
				<div className='absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,_rgba(79,70,229,0.15),transparent_50%)]' />
				<div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/10 rounded-full blur-3xl' />
			</div>

			<motion.div
				initial={{ opacity: 0, scale: 0.9 }}
				animate={{ opacity: 1, scale: 1 }}
				transition={{ duration: 0.5 }}
				className='relative z-10 max-w-md w-full bg-gray-900/50 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 text-center shadow-2xl'
			>
				<motion.div
					initial={{ scale: 0 }}
					animate={{ scale: 1 }}
					transition={{
						type: 'spring',
						stiffness: 260,
						damping: 20,
						delay: 0.1,
					}}
					className='w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full mx-auto mb-6 flex items-center justify-center shadow-lg shadow-emerald-500/30'
				>
					<CheckCircle className='w-12 h-12 text-white' strokeWidth={3} />
				</motion.div>

				<motion.h1
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.2 }}
					className='text-3xl font-bold text-white mb-2'
				>
					Оплата прошла успешно!
				</motion.h1>

				<motion.p
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.3 }}
					className='text-gray-400 mb-8 text-lg'
				>
					Добро пожаловать в клуб{' '}
					<span className='font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500'>
						Vondic Premium
					</span>
				</motion.p>

				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.4 }}
					className='space-y-4'
				>
					<div className='bg-white/5 rounded-2xl p-4 border border-white/10'>
						<ul className='space-y-3 text-left'>
							<li className='flex items-center gap-3 text-gray-300'>
								<Sparkles className='w-5 h-5 text-yellow-400 flex-shrink-0' />
								<span>Уникальный значок профиля</span>
							</li>
							<li className='flex items-center gap-3 text-gray-300'>
								<Sparkles className='w-5 h-5 text-yellow-400 flex-shrink-0' />
								<span>5 ГБ облачного хранилища</span>
							</li>
							<li className='flex items-center gap-3 text-gray-300'>
								<Sparkles className='w-5 h-5 text-yellow-400 flex-shrink-0' />
								<span>Загрузка файлов до 100 МБ</span>
							</li>
							<li className='flex items-center gap-3 text-gray-300'>
								<Sparkles className='w-5 h-5 text-yellow-400 flex-shrink-0' />
								<span>GIF-аватарки</span>
							</li>
							<li className='flex items-center gap-3 text-gray-300'>
								<Sparkles className='w-5 h-5 text-yellow-400 flex-shrink-0' />
								<span>Приоритетная поддержка</span>
							</li>
							<li className='flex items-center gap-3 text-gray-300'>
								<Sparkles className='w-5 h-5 text-yellow-400 flex-shrink-0' />
								<span>Расширенная кастомизация</span>
							</li>
						</ul>
					</div>

					<Link
						href='/feed'
						className='block w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98]'
					>
						Вернуться в ленту
					</Link>
				</motion.div>
			</motion.div>
		</div>
	)
}
