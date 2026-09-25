'use client'

import { motion } from 'framer-motion'
import { LuCheck as Check, LuSparkles as Sparkles } from 'react-icons/lu'
import Link from 'next/link'

export default function PremiumSuccessPage() {
	return (
		<div className='min-h-screen bg-[#0e1117] text-[#e6edf3] selection:bg-[#0077FF] selection:text-white flex items-center justify-center p-4 overflow-hidden relative font-sans'>
			<div className='absolute inset-0 pointer-events-none'>
				<div className='absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-[#0077FF]/10 blur-[140px] rounded-full' />
			</div>

			<motion.div
				initial={{ opacity: 0, scale: 0.95 }}
				animate={{ opacity: 1, scale: 1 }}
				transition={{ duration: 0.35 }}
				className='relative z-10 max-w-md w-full bg-[#161b22] border border-[#30363d] rounded-2xl p-8 text-center shadow-xl'
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
					className='w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl mx-auto mb-5 flex items-center justify-center shadow-sm'
				>
					<Check className='w-8 h-8' />
				</motion.div>

				<motion.h1
					initial={{ opacity: 0, y: 15 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.2 }}
					className='text-2xl font-bold text-white mb-1.5 tracking-tight'
				>
					Оплата прошла успешно!
				</motion.h1>

				<motion.p
					initial={{ opacity: 0, y: 15 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.25 }}
					className='text-xs text-[#8b949e] mb-6'
				>
					Добро пожаловать в клуб{' '}
					<span className='font-bold text-amber-400'>
						Вондик Premium
					</span>
				</motion.p>

				<motion.div
					initial={{ opacity: 0, y: 15 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.3 }}
					className='space-y-4'
				>
					<div className='bg-[#0d1117] rounded-xl p-4 border border-[#30363d]'>
						<ul className='space-y-2.5 text-left text-xs'>
							<li className='flex items-center gap-2.5 text-[#e6edf3]'>
								<Sparkles className='w-4 h-4 text-amber-400 shrink-0' />
								<span>Уникальный значок профиля</span>
							</li>
							<li className='flex items-center gap-2.5 text-[#e6edf3]'>
								<Sparkles className='w-4 h-4 text-amber-400 shrink-0' />
								<span>512 МБ облачного хранилища</span>
							</li>
							<li className='flex items-center gap-2.5 text-[#e6edf3]'>
								<Sparkles className='w-4 h-4 text-amber-400 shrink-0' />
								<span>Загрузка файлов до 100 МБ</span>
							</li>
							<li className='flex items-center gap-2.5 text-[#e6edf3]'>
								<Sparkles className='w-4 h-4 text-amber-400 shrink-0' />
								<span>GIF-аватарки</span>
							</li>
							<li className='flex items-center gap-2.5 text-[#e6edf3]'>
								<Sparkles className='w-4 h-4 text-amber-400 shrink-0' />
								<span>Приоритетная поддержка 24/7</span>
							</li>
							<li className='flex items-center gap-2.5 text-[#e6edf3]'>
								<Sparkles className='w-4 h-4 text-amber-400 shrink-0' />
								<span>Расширенная кастомизация профиля</span>
							</li>
						</ul>
					</div>

					<Link
						href='/feed'
						className='block w-full py-2.5 px-4 bg-[#0077FF] hover:bg-[#0066dd] text-white font-semibold text-xs rounded-xl transition-colors shadow-sm'
					>
						Перейти в ленту
					</Link>
				</motion.div>
			</motion.div>
		</div>
	)
}
