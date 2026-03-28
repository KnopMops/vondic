'use client'

import Composer from '@/components/social/Composer'
import Header from '@/components/social/Header'
import Sidebar from '@/components/social/Sidebar'
import { useAuth } from '@/lib/AuthContext'
import { motion } from 'framer-motion'

export default function ProfilePage() {
	const { user, logout } = useAuth()

	if (!user) {
		return (
			<div className='flex min-h-screen items-center justify-center bg-black text-gray-100'>
				<p>Вы не авторизованы</p>
			</div>
		)
	}

	const registeredDate = user.registeredAt
		? new Date(user.registeredAt).toLocaleDateString('ru-RU', {
				year: 'numeric',
				month: 'long',
			})
		: '—'

	return (
		<div className='min-h-screen bg-black text-white selection:bg-indigo-500 selection:text-white overflow-x-hidden relative'>
			{/* Background Gradients */}
			<div className='fixed inset-0 z-0 overflow-hidden pointer-events-none'>
				<div className='absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-indigo-900/20 blur-[120px]' />
				<div className='absolute top-[40%] -right-[10%] w-[40%] h-[60%] rounded-full bg-purple-900/20 blur-[120px]' />
				<div className='absolute bottom-[10%] left-[20%] w-[30%] h-[30%] rounded-full bg-emerald-900/10 blur-[100px]' />
			</div>

			<div className='relative z-20'>
				<Header email={user.email} onLogout={logout} />
			</div>

			<div className='relative z-10 mx-auto flex max-w-7xl pt-6'>
				<Sidebar />
				<main className='flex-1 p-4 sm:p-6 lg:p-8'>
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.5 }}
						className='mx-auto max-w-3xl space-y-6'
					>
						{/* Cover Image */}
						<div className='relative h-48 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 overflow-hidden shadow-lg'>
							<div className='absolute inset-0 bg-black/20' />
						</div>

						{/* User Info Section */}
						<div className='flex flex-col sm:flex-row items-end gap-6 px-4'>
							<motion.div
								initial={{ scale: 0.8, opacity: 0 }}
								animate={{ scale: 1, opacity: 1 }}
								transition={{ delay: 0.2 }}
								className='-mt-20 flex h-32 w-32 items-center justify-center rounded-full bg-gray-900 ring-4 ring-black overflow-hidden shadow-xl z-10'
							>
								{/* Placeholder for avatar since this page uses user.displayName which implies it might be a different user object structure or just basic info */}
								<div className='h-full w-full bg-yellow-300 text-5xl flex items-center justify-center'>
									👨‍💻
								</div>
							</motion.div>

							<div className='flex-1 pb-2 w-full'>
								<div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4'>
									<div>
										<h1 className='text-3xl font-bold text-white'>
											{user.displayName || user.username}
										</h1>
										<p className='text-sm text-gray-400'>
											{user.handle || user.email}
										</p>
										<p className='mt-1 text-sm text-gray-400'>
											Регистрация: {registeredDate}
										</p>
									</div>
									<motion.button
										whileHover={{ scale: 1.05 }}
										whileTap={{ scale: 0.95 }}
										className='rounded-xl bg-white/10 border border-white/20 px-6 py-2 text-sm font-semibold text-white hover:bg-white/20 backdrop-blur-md transition-all shadow-lg'
									>
										Редактировать
									</motion.button>
								</div>
							</div>
						</div>

						<div className='rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md p-1'>
							<div className='flex mb-4'>
								<button className='flex-1 rounded-2xl bg-white/10 py-3 text-sm font-medium text-white shadow-sm transition-all'>
									Посты
								</button>
								<button className='flex-1 rounded-2xl py-3 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all'>
									Понравившиеся
								</button>
							</div>

							<div className='px-4 pb-4 space-y-4'>
								<Composer onCreate={() => {}} />
								<div className='rounded-xl border border-white/10 bg-white/5 p-8 text-center text-sm text-gray-400 backdrop-blur-sm'>
									Пока нет постов
								</div>
							</div>
						</div>

						<footer className='text-xs text-gray-500 text-center py-4'>
							© 2025 Вондик • Условия использования • Конфиденциальность •
							Cookies
						</footer>
					</motion.div>
				</main>
			</div>
		</div>
	)
}
