'use client'

import BrandLogo from '@/components/social/BrandLogo'
import { motion } from 'framer-motion'
import Link from 'next/link'

export default function VerifyPage() {
	return (
		<div className='flex min-h-screen items-center justify-center bg-black overflow-hidden relative'>
			{/* Background Gradients */}
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
						Подтвердите Email
					</motion.h2>
				</div>

				<div className='space-y-4 text-gray-300'>
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
				</div>

				<div className='mt-8'>
					<Link
						href='/login'
						className='group relative flex w-full justify-center rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 text-sm font-semibold text-white hover:shadow-lg hover:shadow-indigo-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all'
					>
						Вернуться ко входу
					</Link>
				</div>
			</motion.div>
		</div>
	)
}
