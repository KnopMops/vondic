'use client'

import Composer from '@/components/social/Composer'
import Header from '@/components/social/Header'
import Sidebar from '@/components/social/Sidebar'
import { useAuth } from '@/lib/AuthContext'

export default function ProfilePage() {
	const { user, logout } = useAuth()

	if (!user) {
		return (
			<div className='flex min-h-screen items-center justify-center bg-gray-900 text-gray-100'>
				<p>Вы не авторизованы</p>
			</div>
		)
	}

	const registeredDate = new Date(user.registeredAt).toLocaleDateString(
		'ru-RU',
		{
			year: 'numeric',
			month: 'long',
		},
	)

	return (
		<div className='min-h-screen bg-gray-900 text-gray-100'>
			<Header email={user.email} onLogout={logout} />
			<div className='mx-auto flex max-w-7xl'>
				<Sidebar />
				<main className='flex-1 p-4 sm:p-6 lg:p-8'>
					<div className='mx-auto max-w-3xl space-y-6'>
						<div className='h-36 rounded-2xl bg-gradient-to-r from-indigo-500 to-cyan-500' />
						<div className='flex items-end gap-4'>
							<div className='-mt-12 h-20 w-20 rounded-full bg-yellow-300 text-3xl flex items-center justify-center'>
								👨‍💻
							</div>
							<div className='flex-1'>
								<h1 className='text-2xl font-bold'>{user.displayName}</h1>
								<p className='text-sm text-gray-400'>{user.handle}</p>
								<p className='mt-1 text-sm text-gray-400'>
									Регистрация: {registeredDate}
								</p>
							</div>
							<button className='rounded-md bg-gray-800 px-3 py-1.5 text-sm'>
								Редактировать
							</button>
						</div>

						<div className='rounded-xl bg-gray-800 p-4'>
							<div className='flex gap-6 text-sm'>
								<button className='border-b-2 border-indigo-500 pb-2 font-semibold'>
									Посты
								</button>
								<button className='pb-2 text-gray-400'>Понравившиеся</button>
							</div>

							<div className='mt-4 space-y-4'>
								<Composer onCreate={() => {}} />
								<div className='rounded-lg border border-gray-700 p-6 text-center text-sm text-gray-400'>
									Пока нет постов
								</div>
							</div>
						</div>

						<footer className='text-xs text-gray-500'>
							© 2025 Vondic • Условия использования • Конфиденциальность •
							Cookies
						</footer>
					</div>
				</main>
			</div>
		</div>
	)
}
