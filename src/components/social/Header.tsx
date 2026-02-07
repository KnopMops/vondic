'use client'

import { useAppSelector } from '@/lib/hooks'
import { useState } from 'react'
import BrandLogo from './BrandLogo'

type Props = {
	email: string
	onLogout: () => void
}

export default function Header({ email, onLogout }: Props) {
	const { user } = useAppSelector(state => state.auth)
	const [isDropdownOpen, setIsDropdownOpen] = useState(false)

	return (
		<header className='border-b border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-900'>
			<div className='mx-auto flex max-w-7xl items-center justify-between'>
				<div className='flex items-center gap-3'>
					<BrandLogo size={28} />
				</div>

				<div className='flex flex-1 justify-center px-4'>
					<div className='hidden w-full max-w-md sm:block'>
						<input
							type='text'
							placeholder='Поиск'
							className='w-full rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-800 ring-1 ring-inset ring-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700'
						/>
					</div>
				</div>

				<div className='relative flex items-center gap-3'>
					<div className='relative'>
						<button
							onClick={() => setIsDropdownOpen(!isDropdownOpen)}
							className='flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 ring-2 ring-transparent transition-all hover:ring-indigo-500 focus:outline-none dark:bg-gray-700 overflow-hidden'
						>
							{user?.avatar_url ? (
								<img
									src={user.avatar_url}
									alt={user.username}
									className='h-full w-full object-cover'
								/>
							) : (
								<span className='text-sm font-medium text-gray-600 dark:text-gray-300'>
									{user?.username?.[0]?.toUpperCase() || '👤'}
								</span>
							)}
						</button>

						{isDropdownOpen && (
							<div className='absolute right-0 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:bg-gray-800 dark:ring-gray-700 z-50'>
								<div className='px-4 py-2 text-sm text-gray-700 dark:text-gray-200 border-b border-gray-100 dark:border-gray-700'>
									Привет, {user?.username || 'Гость'}
								</div>
								<button
									onClick={onLogout}
									className='block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
								>
									Выйти
								</button>
							</div>
						)}
					</div>
					{/* Overlay to close dropdown when clicking outside */}
					{isDropdownOpen && (
						<div
							className='fixed inset-0 z-40'
							onClick={() => setIsDropdownOpen(false)}
						/>
					)}
				</div>
			</div>
		</header>
	)
}
