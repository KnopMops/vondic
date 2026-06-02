'use client'

import { useAuth } from '@/lib/AuthContext'
import { useAppSelector } from '@/lib/hooks'
import { useSocket } from '@/lib/SocketContext'
import { User } from '@/lib/types'
import { getAttachmentUrl, getAvatarUrl, formatMskDateTime } from '@/lib/utils'
import {
	getSavedAccounts,
	removeSavedAccount,
	type SavedAccount,
} from '@/lib/savedAccounts'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import BrandLogo from './BrandLogo'
import { sidebarItems } from './sidebar.items'
import { LuSearch as Search, LuMenu as Menu, LuX as CloseIcon } from 'react-icons/lu'

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
	const { logout, loginWithYandex } = useAuth()
	const pathname = usePathname()
	const [isDropdownOpen, setIsDropdownOpen] = useState(false)
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
	const [showAccountSwitcher, setShowAccountSwitcher] = useState(false)
	const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([])

	const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000
	const isStale = (account: SavedAccount) =>
		Date.now() - account.last_login_at > THREE_DAYS_MS

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

	useEffect(() => {
		if (isDropdownOpen) {
			setSavedAccounts(getSavedAccounts())
		} else {
			setShowAccountSwitcher(false)
		}
	}, [isDropdownOpen])

	const handleSearch = async (query: string) => {
		setSearchQuery(query)
		if (!query.trim()) {
			setSearchResults(null)
			return
		}

		
		

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
		<header className='sticky top-0 z-50 border-b border-white/10 bg-black/20 backdrop-blur-xl'>
			<div className='mx-auto flex max-w-7xl items-center justify-between px-4 py-3'>
				<div className='flex items-center gap-3'>
					<Link href='/feed' aria-label='Перейти в ленту'>
						<BrandLogo size={28} />
					</Link>
				</div>

				<div className='flex flex-1 justify-center px-4'>
					<div
						className='relative w-full max-w-md hidden sm:block'
						ref={searchRef}
					>
						<div className='relative'>
							<input
								type='text'
								placeholder='@ - поиск пользователя, # - поиск поста'
								value={searchQuery}
								onChange={e => handleSearch(e.target.value)}
								onFocus={() => searchQuery && setShowResults(true)}
								className='w-full rounded-xl bg-black/20 px-4 py-2 text-sm text-gray-200 placeholder-gray-500 border border-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all'
							/>
							<div className='absolute right-3 top-1/2 -translate-y-1/2'>
								<Search className='h-4 w-4 text-gray-500' />
							</div>
						</div>

						
						{showResults && searchResults && (
							<div className='absolute mt-2 w-full rounded-xl bg-black/40 backdrop-blur-xl p-2 shadow-2xl ring-1 ring-white/10 z-50 max-h-96 overflow-y-auto custom-scrollbar'>
								{isSearching ? (
									<div className='p-4 text-center text-gray-400'>Поиск...</div>
								) : (
									<>
										
										{searchResults.type === 'users' && (
											<div className='space-y-1'>
												{searchResults.results.length === 0 ? (
													<div className='p-4 text-center text-gray-500'>
														Пользователи не найдены
													</div>
												) : (
													searchResults.results.map((u: User) => (
														<Link
															key={u.id}
															href={`/feed/profile/${u.id}`}
															className='flex items-center gap-3 rounded-lg p-2 hover:bg-white/5 transition-colors'
															onClick={() => setShowResults(false)}
														>
															<img
																src={getAvatarUrl(u.avatar_url)}
																alt={u.username}
																className='h-10 w-10 rounded-full object-cover ring-2 ring-gray-800'
															/>
															<div>
																<div className='text-sm font-semibold text-gray-200'>
																	{u.username}
																	{u.premium && (
																		<span className='ml-1 text-amber-400'>
																			★
																		</span>
																	)}
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

										
										{searchResults.type === 'posts' && (
											<div className='space-y-1'>
												{searchResults.results.length === 0 ? (
													<div className='p-4 text-center text-gray-500'>
														Посты не найдены
													</div>
												) : (
													searchResults.results.map((post: any) => (
														<div
															key={post.id}
															className='flex items-start gap-3 rounded-lg p-3 hover:bg-white/5 cursor-pointer transition-colors'
														>
															<img
																src={getAvatarUrl(post.author?.avatar_url)}
																alt={post.author?.username || 'User'}
																className='h-8 w-8 rounded-full object-cover flex-shrink-0 ring-2 ring-gray-800'
															/>
															<div className='flex-1 min-w-0'>
																<div className='flex items-center justify-between'>
																	<span className='text-sm font-semibold text-gray-200 truncate'>
																		{post.author?.username || 'Unknown User'}
																	</span>
																	<span className='text-xs text-gray-500 whitespace-nowrap ml-2'>
																		{formatMskDateTime(post.created_at)}
																	</span>
																</div>
																<div className='text-sm text-gray-400 truncate mt-0.5'>
																	{post.content}
																</div>
															</div>
														</div>
													))
												)}
											</div>
										)}
										{searchResults.type === 'unknown' && (
											<div className='p-4 text-center text-gray-500 text-sm'>
												Начните запрос с <span className='text-indigo-300'>@</span>{' '}
												для поиска пользователей или с{' '}
												<span className='text-indigo-300'>#</span> для поиска постов
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
							className='flex h-9 w-9 items-center justify-center rounded-full bg-black/30 ring-1 ring-white/15 transition-all hover:ring-indigo-500 focus:outline-none overflow-hidden'
						>
							{user?.avatar_url ? (
								<img
									src={getAttachmentUrl(user.avatar_url)}
									alt={user.username}
									className='h-full w-full object-cover'
								/>
							) : (
								<span className='text-sm font-medium text-gray-300'>
									{user?.username?.[0]?.toUpperCase() || '👤'}
								</span>
							)}
						</button>

						{isDropdownOpen && (
							<div className='absolute right-0 mt-2 w-56 origin-top-right rounded-xl bg-gray-900 py-1 shadow-2xl ring-1 ring-white/10 focus:outline-none z-50'>
								{showAccountSwitcher ? (
									<div className='p-2 space-y-1'>
										<div className='px-2 py-1.5 text-sm font-medium text-gray-200 border-b border-white/10 mb-1'>
											Выберите аккаунт
										</div>
										{savedAccounts.map(account => (
											<div
												key={account.id}
												className='group relative flex items-center gap-3 rounded-lg p-2 hover:bg-white/5 cursor-pointer transition-colors'
													onClick={() => {
														if (account.auth_provider === 'yandex') {
															localStorage.setItem('post_logout_provider', 'yandex')
														}
														if (isStale(account)) {
															logout('/login')
														} else {
															window.location.assign(`/login?switch=1&email=${encodeURIComponent(account.email)}`)
														}
													}}
											>
												<div className='w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shrink-0'>
													{account.avatar_url ? (
														<img
															src={account.avatar_url}
															alt={account.username}
															className='w-full h-full object-cover'
														/>
													) : (
														account.username.charAt(0).toUpperCase()
													)}
												</div>
												<div className='flex-1 min-w-0'>
													<p className='text-sm text-white font-medium truncate'>
														{account.username}
													</p>
													<p className='text-xs text-gray-400 truncate'>
														{account.email}
													</p>
												</div>
												<button
													type='button'
													onClick={e => {
														e.stopPropagation()
														removeSavedAccount(account.id)
														setSavedAccounts(prev => prev.filter(a => a.id !== account.id))
													}}
													className='p-1 rounded-full text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all'
													title='Удалить аккаунт'
												>
													<svg
														xmlns='http://www.w3.org/2000/svg'
														width='12'
														height='12'
														viewBox='0 0 24 24'
														fill='none'
														stroke='currentColor'
														strokeWidth='2'
														strokeLinecap='round'
														strokeLinejoin='round'
														>
														<line x1='18' y1='6' x2='6' y2='18' />
														<line x1='6' y1='6' x2='18' y2='18' />
													</svg>
												</button>
											</div>
										))}
										<button
											type='button'
											onClick={() => {
												logout('/login')
											}}
											className='flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-white/5 transition-colors'
										>
											<div className='w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0'>
												<svg
													xmlns='http://www.w3.org/2000/svg'
													width='16'
													height='16'
													viewBox='0 0 24 24'
													fill='none'
													stroke='currentColor'
													strokeWidth='2'
													strokeLinecap='round'
													strokeLinejoin='round'
													className='text-gray-400'
												>
													<line x1='12' y1='5' x2='12' y2='19' />
													<line x1='5' y1='12' x2='19' y2='12' />
												</svg>
											</div>
											<span className='text-sm text-white font-medium'>
												Войти в другой аккаунт
											</span>
										</button>
										<button
											type='button'
											onClick={() => setShowAccountSwitcher(false)}
											className='w-full text-center text-xs text-indigo-400 hover:text-indigo-300 transition-colors pt-1'
										>
											← Назад
										</button>
									</div>
								) : (
									<>
										<div className='px-4 py-3 text-sm text-gray-200 border-b border-white/10'>
											<div className='font-medium'>Привет,</div>
											<div className='font-bold text-indigo-400 truncate'>
												{user?.username || 'Гость'}
											</div>
										</div>
										<Link
											href={`/feed/profile/${user?.id}`}
											className='block w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors'
											onClick={() => setIsDropdownOpen(false)}
										>
											Моя страница
										</Link>
										<Link
											href='/feed/settings'
											className='block w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors'
											onClick={() => setIsDropdownOpen(false)}
										>
											Настройки
										</Link>
										{savedAccounts.length > 0 && (
											<button
												type='button'
												onClick={() => setShowAccountSwitcher(true)}
												className='block w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors'
											>
												Сменить аккаунт
											</button>
										)}
										<button
											onClick={onLogout}
											className='block w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors'
										>
											Выйти
										</button>
									</>
								)}
							</div>
						)}
					</div>
					
					{isDropdownOpen && (
						<div
							className='fixed inset-0 z-40'
							onClick={() => setIsDropdownOpen(false)}
						/>
					)}
				</div>
			</div>

			{isMobileMenuOpen && (
				<div className='fixed inset-0 z-[9999] md:hidden'>
					<div
						className='absolute inset-0 bg-black/60 backdrop-blur-sm'
						onClick={() => setIsMobileMenuOpen(false)}
					/>
					<div className='absolute left-0 top-0 bottom-0 w-64 max-w-[80vw] bg-gray-950 border-r border-white/10 p-4 flex flex-col animate-in slide-in-from-left duration-200'>
						<div className='flex items-center justify-between mb-6'>
							<BrandLogo size={28} />
							<button
								onClick={() => setIsMobileMenuOpen(false)}
								className='p-2 text-gray-400 hover:text-white transition-colors'
								aria-label='Закрыть'
							>
								<CloseIcon className='h-5 w-5' />
							</button>
						</div>
						<nav className='flex flex-col gap-2'>
							{sidebarItems.map(item => {
								const Icon = (item as any).icon
								let href = item.href
								if (href === '/feed/profile' && user?.id) {
									href = `/feed/profile/${user.id}`
								}
								if (href === '/friends') {
									href = '/feed/friends'
								}
								return (
									<Link
										key={item.label}
										href={href}
										onClick={() => setIsMobileMenuOpen(false)}
										className={`flex items-center gap-4 rounded-xl px-3 py-3 text-gray-300 hover:bg-white/10 hover:text-white transition-colors ${
											pathname?.startsWith(href) ? 'bg-white/15 text-white' : ''
										}`}
									>
										<Icon className='h-5 w-5' />
										<span className='text-sm font-medium'>{item.label}</span>
									</Link>
								)
							})}
							{(user?.role === 'Support' || user?.role === 'Admin') && (
								<Link
									href='/feed/admin'
									onClick={() => setIsMobileMenuOpen(false)}
									className={`flex items-center gap-4 rounded-xl px-3 py-3 text-gray-300 hover:bg-white/10 hover:text-white transition-colors ${
										pathname?.startsWith('/feed/admin') ? 'bg-white/15 text-white' : ''
									}`}
								>
									<span className='text-sm font-medium'>Админка</span>
								</Link>
							)}
						</nav>
					</div>
				</div>
			)}
		</header>
	)
}
