'use client'

import Header from '@/components/social/Header'
import Sidebar from '@/components/social/Sidebar'
import { useAuth } from '@/lib/AuthContext'
import Link from 'next/link'

export default function ProfilePage() {
	const { user, logout, isLoading } = useAuth()

	if (isLoading) {
		return (
			<div className='flex min-h-screen items-center justify-center bg-gray-900'>
				<div className='h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent'></div>
			</div>
		)
	}

	if (!user) {
		return (
			<div className='flex min-h-screen items-center justify-center bg-gray-900 text-gray-100'>
				<div className='text-center'>
					<p className='mb-4 text-xl'>Вы не авторизованы</p>
					<Link
						href='/login'
						className='rounded-full bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-500'
					>
						Войти
					</Link>
				</div>
			</div>
		)
	}

	return (
		<div className='min-h-screen bg-gray-900 text-gray-100'>
			<Header email={user.email} onLogout={logout} />
			<div className='mx-auto flex max-w-7xl'>
				<Sidebar />
				<main className='flex-1 p-4 sm:p-6 lg:p-8'>
					<div className='mx-auto max-w-3xl space-y-6'>
						{/* Cover Image */}
						<div className='h-36 rounded-2xl bg-gradient-to-r from-indigo-500 to-cyan-500' />

						{/* User Info Section */}
						<div className='flex items-end gap-4 px-4'>
							<div className='-mt-12 flex h-24 w-24 items-center justify-center rounded-full bg-gray-800 ring-4 ring-gray-900 overflow-hidden'>
								{user.avatar_url ? (
									<img
										src={user.avatar_url}
										alt={user.username}
										className='h-full w-full object-cover'
									/>
								) : (
									<span className='text-4xl'>
										{user.username?.[0]?.toUpperCase() || '👤'}
									</span>
								)}
							</div>
							<div className='flex-1 pb-2'>
								<h1 className='text-2xl font-bold'>{user.username}</h1>
								{!user.email?.endsWith('@telegram.bot') && (
									<p className='text-sm text-gray-400'>{user.email}</p>
								)}
								<p
									className={`text-sm capitalize ${
										user.role === 'Admin'
											? 'text-red-500 font-bold'
											: 'text-gray-400'
									}`}
								>
									{user.role === 'Admin' ? 'Администратор' : 'Пользователь'}
								</p>
								{user.description && (
									<p className='mt-2 text-sm text-gray-300'>
										{user.description}
									</p>
								)}
							</div>
						</div>

						{/* Content Tabs */}
						<div className='rounded-xl bg-gray-800 p-4'>
							<div className='flex gap-6 text-sm border-b border-gray-700 pb-4'>
								<button className='border-b-2 border-indigo-500 pb-1 font-semibold text-white'>
									Посты
								</button>
								<button className='pb-1 text-gray-400 hover:text-white transition-colors'>
									Друзья
								</button>
								<button className='pb-1 text-gray-400 hover:text-white transition-colors'>
									Фото
								</button>
							</div>

							<div className='mt-8 flex flex-col items-center justify-center py-8 text-center text-gray-400'>
								<div className='mb-2 text-4xl'>📭</div>
								<p>Пока нет постов</p>
							</div>
						</div>
					</div>
				</main>
			</div>
		</div>
	)
}
