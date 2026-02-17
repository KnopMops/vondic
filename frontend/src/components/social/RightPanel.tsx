'use client'

import { useAuth } from '@/lib/AuthContext'
import { useNotificationStore } from '@/lib/stores/notificationStore'
import { motion } from 'framer-motion'
import { Sparkles, Zap } from 'lucide-react'

export default function RightPanel() {
	const { user } = useAuth()
	const { notifications } = useNotificationStore()
	const items = notifications.slice(0, 3)

	return (
		<aside className='space-y-6'>
			<div className='rounded-2xl border border-gray-800 bg-gray-900/60 p-4 text-gray-200'>
				<div className='text-sm font-semibold text-white mb-2'>
					Уведомления
				</div>
				{items.length === 0 ? (
					<div className='text-xs text-gray-400'>
						Нет новых уведомлений
					</div>
				) : (
					<div className='space-y-2'>
						{items.map(item => (
							<div
								key={item.id}
								className='rounded-lg border border-gray-800 bg-gray-900 px-3 py-2'
							>
								<div className='text-xs font-medium text-white'>
									{item.title}
								</div>
								{item.message && (
									<div className='text-xs text-gray-300'>{item.message}</div>
								)}
								<div className='text-[10px] text-gray-500'>
									{new Date(item.createdAt).toLocaleTimeString()}
								</div>
							</div>
						))}
					</div>
				)}
			</div>
			{!user?.premium && (
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
							Получите доступ к эксклюзивным функциям: 5 ГБ хранилища, загрузка файлов до 100 МБ, GIF-аватарки и многое другое.
							уникальным стикерам.
						</p>

						<button className='w-full py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 hover:border-white/20 text-white text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 group/btn'>
							<Sparkles className='w-4 h-4 text-yellow-400 group-hover/btn:rotate-12 transition-transform' />
							Подробнее
						</button>
					</div>
				</motion.div>
			)}
		</aside>
	)
}
