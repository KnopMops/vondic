'use client'

import { motion } from 'framer-motion'
import { Sparkles, Zap } from 'lucide-react'

export default function RightPanel() {
	return (
		<aside className='space-y-6'>
			<motion.div
				initial={{ opacity: 0, x: 20 }}
				animate={{ opacity: 1, x: 0 }}
				transition={{ duration: 0.5 }}
				className='rounded-3xl bg-gradient-to-br from-indigo-900/40 to-purple-900/40 backdrop-blur-xl border border-white/10 p-6 shadow-xl relative overflow-hidden group'
			>
				{/* Decorative elements */}
				<div className='absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl group-hover:bg-indigo-500/30 transition-all duration-500' />
				<div className='absolute -bottom-10 -left-10 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl group-hover:bg-purple-500/30 transition-all duration-500' />

				<div className='relative z-10'>
					<div className='flex items-center gap-2 mb-4'>
						<div className='p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20'>
							<Zap className='w-5 h-5 text-white fill-current' />
						</div>
						<h3 className='text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500 drop-shadow-sm'>
							Vondic Premium
						</h3>
					</div>

					<p className='text-sm text-gray-300 mb-6 leading-relaxed'>
						Получите доступ к эксклюзивным функциям, безлимитному хранилищу и
						уникальным стикерам.
					</p>

					<button className='w-full py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 hover:border-white/20 text-white text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 group/btn'>
						<Sparkles className='w-4 h-4 text-yellow-400 group-hover/btn:rotate-12 transition-transform' />
						Подробнее
					</button>
				</div>
			</motion.div>
		</aside>
	)
}
