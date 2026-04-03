'use client'

import { Heart, MessageCircle, Share2, MoreHorizontal, Send, Image, Video, File, Download, Upload, Calendar, Clock, Star, Lock, Unlock, Eye, EyeOff, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ArrowLeft, ArrowRight, MoreVertical, Bell, Search, Home, User, Settings, Menu, X, Check, Plus, Trash2, Edit2 } from 'lucide-react';
import { useAppSelector } from '@/lib/hooks'
import { useSocket } from '@/lib/SocketContext'
import { User } from '@/lib/types'
import { getAttachmentUrl, getAvatarUrl, formatMskDateTime } from '@/lib/utils'
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
		<header className='sticky top-0 z-50 border-b border-gray-800/50 bg-gray-900/40 backdrop-blur-xl'>
			<div className='mx-auto flex max-w-7xl items-center justify-between px-4 py-3'>
				<div className='flex items-center gap-3'>
					<BrandLogo size={28} />
				</div>

				<div className='flex flex-1 justify-center px-4'>
					<div
						className='relative w-full max-w-md hidden sm:block'
						ref={searchRef}
					>
						<div className='relative'>
							<input
								type='text'
								placeholder='Поиск'
								value={searchQuery}
								onChange={e => handleSearch(e.target.value)}
								onFocus={() => searchQuery && setShowResults(true)}
								className='w-full rounded-xl bg-gray-800/50 px-4 py-2 text-sm text-gray-200 placeholder-gray-500 border border-gray-700/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all'
							/>
							<div className='absolute right-3 top-1/2 -translate-y-1/2'>
								<svg
									xmlns='http://www.w3.org/2000/svg'
									className='h-4 w-4 text-gray-500'
									fill='none'
									viewBox='0 0 24 24'
									stroke='currentColor'
								>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth={2}
										d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
									/>
								</svg>
							</div>
						</div>

						
						{showResults && searchResults && (
							<div className='absolute mt-2 w-full rounded-xl bg-gray-900/90 backdrop-blur-xl p-2 shadow-2xl ring-1 ring-white/10 z-50 max-h-96 overflow-y-auto custom-scrollbar'>
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
							className='flex h-9 w-9 items-center justify-center rounded-full bg-gray-800 ring-2 ring-gray-700 transition-all hover:ring-indigo-500 focus:outline-none overflow-hidden'
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
							<div className='absolute right-0 mt-2 w-48 origin-top-right rounded-xl bg-gray-900/90 backdrop-blur-xl py-1 shadow-2xl ring-1 ring-white/10 focus:outline-none z-50'>
								<div className='px-4 py-3 text-sm text-gray-200 border-b border-gray-700/50'>
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
								<button
									onClick={onLogout}
									className='block w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors'
								>
									Выйти
								</button>
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
		</header>
	)
}
