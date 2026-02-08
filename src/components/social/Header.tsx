'use client'

import { useAppSelector } from '@/lib/hooks'
import { useSocket } from '@/lib/SocketContext'
import { User } from '@/lib/types'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import BrandLogo from './BrandLogo'

type SearchResult = {
	results: any[]
	type: 'users' | 'posts'
}

type Props = {
	email: string
	onLogout: () => void
}

export default function Header({ email, onLogout }: Props) {
	const { user } = useAppSelector(state => state.auth)
	const { isConnected } = useSocket()
	const [isDropdownOpen, setIsDropdownOpen] = useState(false)

	// Search state
	const [searchQuery, setSearchQuery] = useState('')
	const [searchResults, setSearchResults] = useState<SearchResult | null>(null)
	const [isSearching, setIsSearching] = useState(false)
	const [showResults, setShowResults] = useState(false)
	const searchRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				searchRef.current &&
				!searchRef.current.contains(event.target as Node)
			) {
				setShowResults(false)
			}
		}
		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [])

	const handleSearch = async (query: string) => {
		setSearchQuery(query)
		if (!query.trim()) {
			setSearchResults(null)
			return
		}

		// Only search if starts with @ or # and has more content
		// if (query.length < 2) return

		setIsSearching(true)
		try {
			const res = await fetch('/api/search', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ query }),
			})
			if (res.ok) {
				const data = await res.json()
				setSearchResults(data)
				setShowResults(true)
			}
		} catch (error) {
			console.error(error)
		} finally {
			setIsSearching(false)
		}
	}

	return (
		<header className='border-b border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-900'>
			<div className='mx-auto flex max-w-7xl items-center justify-between'>
				<div className='flex items-center gap-3'>
					<BrandLogo size={28} />
					<div
						className={`h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} transition-colors duration-300`}
						title={isConnected ? 'Socket Connected' : 'Socket Disconnected'}
					/>
				</div>

				<div className='flex flex-1 justify-center px-4'>
					<div
						className='relative w-full max-w-md hidden sm:block'
						ref={searchRef}
					>
						<input
							type='text'
							placeholder='Поиск (@пользователь или #пост)'
							value={searchQuery}
							onChange={e => handleSearch(e.target.value)}
							onFocus={() => searchQuery && setShowResults(true)}
							className='w-full rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-800 ring-1 ring-inset ring-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700'
						/>

						{/* Search Results Dropdown */}
						{showResults && searchResults && (
							<div className='absolute mt-2 w-full rounded-md bg-white p-2 shadow-lg ring-1 ring-black ring-opacity-5 dark:bg-gray-800 dark:ring-gray-700 z-50 max-h-96 overflow-y-auto'>
								{isSearching ? (
									<div className='p-2 text-center text-gray-500'>Поиск...</div>
								) : (
									<>
										{/* Users Results */}
										{searchResults.type === 'users' && (
											<div>
												{searchResults.results.length === 0 ? (
													<div className='p-2 text-center text-gray-500'>
														Пользователи не найдены
													</div>
												) : (
													searchResults.results.map((u: User) => (
														<Link
															key={u.id}
															href={`/feed/profile/${u.id}`}
															className='flex items-center gap-3 rounded-md p-2 hover:bg-gray-100 dark:hover:bg-gray-700'
															onClick={() => setShowResults(false)}
														>
															<img
																src={u.avatar_url || '/placeholder-user.jpg'}
																alt={u.username}
																className='h-8 w-8 rounded-full object-cover'
															/>
															<div>
																<div className='text-sm font-semibold text-gray-900 dark:text-white'>
																	{u.username}
																</div>
																<div className='text-xs text-gray-500'>
																	{u.email}
																</div>
															</div>
														</Link>
													))
												)}
											</div>
										)}

										{/* Posts Results */}
										{searchResults.type === 'posts' && (
											<div>
												{searchResults.results.length === 0 ? (
													<div className='p-2 text-center text-gray-500'>
														Посты не найдены
													</div>
												) : (
													searchResults.results.map((post: any) => (
														<div
															key={post.id}
															className='flex items-start gap-3 rounded-md p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors'
														>
															<img
																src={
																	post.author?.avatar_url ||
																	'/placeholder-user.jpg'
																}
																alt={post.author?.username || 'User'}
																className='h-10 w-10 rounded-full object-cover flex-shrink-0'
															/>
															<div className='flex-1 min-w-0'>
																<div className='flex items-center justify-between'>
																	<span className='text-sm font-semibold text-gray-900 dark:text-white truncate'>
																		{post.author?.username || 'Unknown User'}
																	</span>
																	<span className='text-xs text-gray-500 whitespace-nowrap ml-2'>
																		{new Date(
																			post.created_at,
																		).toLocaleDateString()}
																	</span>
																</div>
																<div className='text-sm text-gray-600 dark:text-gray-300 truncate'>
																	{post.content}
																</div>
															</div>
														</div>
													))
												)}
											</div>
										)}
									</>
								)}
							</div>
						)}
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
