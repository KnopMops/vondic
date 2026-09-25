'use client'

import FeedPageShell from '@/components/social/FeedPageShell'
import { useAuth } from '@/lib/AuthContext'
import { User } from '@/lib/types'
import { userShowsEmail } from '@/lib/userPrivacy'
import { getAvatarUrl } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import {
	LuSearch as Search,
	LuUserCheck as UserCheck,
	LuUserPlus as UserPlus,
	LuUsers as Users,
	LuUserX as UserX,
	LuMessageSquare as MessageSquare,
	LuTrash2 as Trash2,
	LuSparkles as Sparkles,
	LuUserMinus as UserMinus,
} from 'react-icons/lu'
import Link from 'next/link'
import { useEffect, useState, useRef, useCallback } from 'react'

export default function FriendsPage() {
	const { user, logout } = useAuth()
	const [friends, setFriends] = useState<User[]>([])
	const [requests, setRequests] = useState<User[]>([])
	const [following, setFollowing] = useState<User[]>([])
	const [followers, setFollowers] = useState<User[]>([])

	const [friendsLoading, setFriendsLoading] = useState(true)
	const [tabLoading, setTabLoading] = useState(false)
	const [activeTab, setActiveTab] = useState<
		'friends' | 'requests' | 'following' | 'followers'
	>('friends')

	const [searchQuery, setSearchQuery] = useState('')
	const [searchResults, setSearchResults] = useState<User[]>([])
	const [isSearching, setIsSearching] = useState(false)
	const [actionPendingId, setActionPendingId] = useState<string | null>(null)

	// Instant cache restore
	useEffect(() => {
		if (!user?.id || typeof window === 'undefined') return
		try {
			const cached = sessionStorage.getItem(`vondic_cache_friends_${user.id}`)
			if (cached) {
				const parsed = JSON.parse(cached)
				if (Array.isArray(parsed) && parsed.length > 0) {
					setFriends(parsed)
					setFriendsLoading(false)
				}
			}
		} catch {}
	}, [user?.id])

	// Fast parallel fetchers
	const fetchFriends = useCallback(async () => {
		if (!user?.id) return
		try {
			const res = await fetch('/api/friends/list', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ user_id: user.id }),
			})
			if (res.ok) {
				const data = await res.json()
				const list = Array.isArray(data) ? data : data?.friends || []
				setFriends(list)
				if (typeof window !== 'undefined') {
					try {
						sessionStorage.setItem(
							`vondic_cache_friends_${user.id}`,
							JSON.stringify(list),
						)
					} catch {}
				}
			}
		} catch (e) {
			console.error('Error fetching friends:', e)
		} finally {
			setFriendsLoading(false)
		}
	}, [user?.id])

	const fetchRequests = useCallback(async () => {
		if (!user?.id) return
		try {
			const res = await fetch('/api/friends/requests', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ user_id: user.id }),
			})
			if (res.ok) {
				const data = await res.json()
				const list = Array.isArray(data) ? data : data?.requests || []
				setRequests(list)
			}
		} catch (e) {
			console.error('Error fetching requests:', e)
		}
	}, [user?.id])

	const fetchFollowing = useCallback(async () => {
		if (!user?.id) return
		try {
			const res = await fetch('/api/subscriptions/following', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ user_id: user.id }),
			})
			if (res.ok) {
				const data = await res.json()
				const list = Array.isArray(data) ? data : data?.following || []
				setFollowing(list)
			}
		} catch (e) {
			console.error('Error fetching following:', e)
		}
	}, [user?.id])

	const fetchFollowers = useCallback(async () => {
		if (!user?.id) return
		try {
			const res = await fetch('/api/subscriptions/followers', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ user_id: user.id }),
			})
			if (res.ok) {
				const data = await res.json()
				const list = Array.isArray(data) ? data : data?.followers || []
				setFollowers(list)
			}
		} catch (e) {
			console.error('Error fetching followers:', e)
		}
	}, [user?.id])

	// Initial load: Fetch friends immediately for millisecond render, then background others in parallel
	useEffect(() => {
		if (!user?.id) return
		void fetchFriends()
		void Promise.allSettled([
			fetchRequests(),
			fetchFollowing(),
			fetchFollowers(),
		])

		const interval = setInterval(() => {
			void fetchFriends()
			void fetchRequests()
		}, 10000)

		return () => clearInterval(interval)
	}, [user?.id, fetchFriends, fetchRequests, fetchFollowing, fetchFollowers])

	const handleAccept = async (requesterId: string) => {
		setActionPendingId(requesterId)
		try {
			const res = await fetch('/api/friends/accept', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ requester_id: requesterId }),
			})
			if (!res.ok) throw new Error('Failed to accept')
			await Promise.allSettled([fetchRequests(), fetchFriends()])
		} catch (err) {
			console.error(err)
			alert('Ошибка при принятии заявки')
		} finally {
			setActionPendingId(null)
		}
	}

	const handleReject = async (requesterId: string) => {
		setActionPendingId(requesterId)
		try {
			const res = await fetch('/api/friends/reject', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ requester_id: requesterId }),
			})
			if (!res.ok) throw new Error('Failed to reject')
			await fetchRequests()
		} catch (err) {
			console.error(err)
			alert('Ошибка при отклонении заявки')
		} finally {
			setActionPendingId(null)
		}
	}

	const handleRemoveFriend = async (friendId: string) => {
		if (!confirm('Удалить из друзей?')) return
		setActionPendingId(friendId)
		try {
			const res = await fetch('/api/friends/remove', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ friend_id: friendId }),
			})
			if (!res.ok) throw new Error('Failed to remove friend')
			await fetchFriends()
		} catch (err) {
			console.error(err)
			alert('Ошибка при удалении из друзей')
		} finally {
			setActionPendingId(null)
		}
	}

	const handleSearch = async () => {
		if (!searchQuery.trim()) return
		setIsSearching(true)
		try {
			const res = await fetch('/api/users/search', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ query: searchQuery.trim() }),
			})
			if (res.ok) {
				const data = await res.json()
				const list = Array.isArray(data)
					? data
					: data?.users || data?.results || []
				setSearchResults(list)
			}
		} catch (error) {
			console.error(error)
		} finally {
			setIsSearching(false)
		}
	}

	const handleAddFriend = async (friendId: string) => {
		if (!user) return
		setActionPendingId(friendId)
		try {
			const res = await fetch('/api/friends/add', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ friend_id: friendId }),
			})
			if (!res.ok) {
				const text = await res.text()
				let msg = text || 'Не удалось отправить заявку'
				try {
					const data = JSON.parse(text)
					msg = data?.error || data?.message || msg
				} catch {}
				throw new Error(msg)
			}
			alert('Заявка в друзья отправлена!')
		} catch (error: any) {
			console.error(error)
			alert(error?.message || 'Ошибка при отправке заявки')
		} finally {
			setActionPendingId(null)
		}
	}

	if (!user) return null

	const renderUserList = (
		users: User[],
		emptyMsg: string,
		isRequest = false,
		isFriendList = false,
	) => {
		const isLoading = friendsLoading && users.length === 0
		if (isLoading) {
			return (
				<div className='flex flex-col items-center justify-center py-16 text-[#8b949e]'>
					<div className='h-8 w-8 animate-spin rounded-full border-2 border-[#0077FF] border-t-transparent mb-3' />
					<p className='text-xs'>Загрузка списка друзей...</p>
				</div>
			)
		}

		if (users.length === 0) {
			return (
				<div className='flex flex-col items-center justify-center py-16 rounded-2xl bg-[#161b22] border border-[#30363d] text-center p-8'>
					<div className='w-12 h-12 rounded-xl bg-[#0d1117] border border-[#30363d] flex items-center justify-center text-[#8b949e] mb-3'>
						<Users className='w-6 h-6' />
					</div>
					<h3 className='text-sm font-semibold text-white mb-1'>Список пуст</h3>
					<p className='text-xs text-[#8b949e] max-w-xs'>{emptyMsg}</p>
				</div>
			)
		}

		return (
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ duration: 0.2 }}
				className='grid grid-cols-1 gap-3'
			>
				{users.map((u, i) => {
					const isPending = actionPendingId === u.id
					return (
						<motion.div
							key={u.id}
							initial={{ opacity: 0, y: 6 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: Math.min(i * 0.03, 0.25) }}
							className='group flex items-center justify-between p-3.5 sm:p-4 rounded-xl bg-[#161b22] border border-[#30363d] hover:border-[#8b949e]/40 hover:bg-[#1c2129] transition-all'
						>
							<Link
								href={`/feed/profile/${u.id}`}
								className='flex items-center gap-3.5 min-w-0 flex-1 hover:opacity-90 transition-opacity'
							>
								<div className='relative shrink-0'>
									<img
										src={getAvatarUrl(u.avatar_url)}
										alt={u.username}
										className='h-11 w-11 rounded-full object-cover border border-[#30363d] group-hover:border-[#0077FF] transition-colors'
									/>
									<div
										className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#161b22] ${
											u.status === 'online' ? 'bg-emerald-500' : 'bg-gray-500'
										}`}
									/>
								</div>
								<div className='min-w-0 flex-1'>
									<div className='flex items-center gap-1.5'>
										<span className='font-semibold text-sm text-white group-hover:text-[#58a6ff] transition-colors truncate'>
											{u.username}
										</span>
										{u.premium && (
											<span className='text-amber-400 text-xs shrink-0' title='Премиум'>
												★
											</span>
										)}
									</div>
									{userShowsEmail(u, user?.id) && u.email ? (
										<p className='text-xs text-[#8b949e] truncate mt-0.5'>{u.email}</p>
									) : (
										<p className='text-[11px] text-[#8b949e] truncate mt-0.5'>
											{u.status === 'online' ? 'В сети' : 'Не в сети'}
										</p>
									)}
								</div>
							</Link>

							<div className='flex items-center gap-2 ml-3 shrink-0'>
								{isRequest ? (
									<>
										<button
											disabled={isPending}
											onClick={() => handleAccept(u.id)}
											className='flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0077FF] hover:bg-[#0066dd] text-white text-xs font-medium transition-colors disabled:opacity-50'
											title='Принять заявку'
										>
											<UserCheck className='w-4 h-4' />
											<span className='hidden sm:inline'>Принять</span>
										</button>
										<button
											disabled={isPending}
											onClick={() => handleReject(u.id)}
											className='flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#21262d] border border-[#30363d] hover:bg-red-500/10 hover:border-red-500/30 text-[#f85149] text-xs font-medium transition-colors disabled:opacity-50'
											title='Отклонить заявку'
										>
											<UserX className='w-4 h-4' />
											<span className='hidden sm:inline'>Отклонить</span>
										</button>
									</>
								) : isFriendList ? (
									<>
										<Link
											href={`/feed/messages?userId=${u.id}`}
											className='p-2 rounded-lg bg-[#21262d] border border-[#30363d] text-[#e6edf3] hover:text-[#58a6ff] hover:border-[#0077FF]/40 transition-colors'
											title='Написать сообщение'
										>
											<MessageSquare className='w-4 h-4' />
										</Link>
										<button
											disabled={isPending}
											onClick={() => handleRemoveFriend(u.id)}
											className='p-2 rounded-lg bg-[#21262d] border border-[#30363d] text-[#8b949e] hover:text-[#f85149] hover:border-red-500/30 transition-colors disabled:opacity-50'
											title='Удалить из друзей'
										>
											<UserMinus className='w-4 h-4' />
										</button>
									</>
								) : (
									<Link
										href={`/feed/profile/${u.id}`}
										className='px-3 py-1.5 rounded-lg bg-[#21262d] border border-[#30363d] text-xs font-medium text-[#e6edf3] hover:text-white hover:border-[#8b949e]/40 transition-colors'
									>
										Профиль
									</Link>
								)}
							</div>
						</motion.div>
					)
				})}
			</motion.div>
		)
	}

	return (
		<FeedPageShell email={user.email} onLogout={logout}>
			<div className='max-w-4xl mx-auto space-y-6'>
				{/* Top Header Card */}
				<div className='rounded-2xl bg-[#161b22] border border-[#30363d] p-5 shadow-sm space-y-4'>
					<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
						<div>
							<h1 className='text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2'>
								<Users className='w-6 h-6 text-[#0077FF]' />
								Друзья и контакты
							</h1>
							<p className='text-xs text-[#8b949e] mt-0.5'>
								Управляйте списком друзей, входящими заявками и подписками
							</p>
						</div>

						{/* Search Input */}
						<div className='relative w-full sm:w-72'>
							<Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8b949e]' />
							<input
								type='text'
								placeholder='Поиск пользователей...'
								value={searchQuery}
								onChange={e => setSearchQuery(e.target.value)}
								onKeyDown={e => e.key === 'Enter' && handleSearch()}
								className='w-full rounded-xl border border-[#30363d] bg-[#0d1117] py-2 pl-9 pr-4 text-xs text-white placeholder:text-[#8b949e]/60 focus:border-[#0077FF] focus:ring-1 focus:ring-[#0077FF] outline-none transition-colors'
							/>
							{isSearching && (
								<div className='absolute right-3 top-1/2 -translate-y-1/2'>
									<div className='h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#0077FF] border-t-transparent' />
								</div>
							)}
						</div>
					</div>

					{/* Segmented Control Tabs */}
					<div className='flex p-1 rounded-xl bg-[#0d1117] border border-[#30363d] overflow-x-auto custom-scrollbar'>
						{[
							{ id: 'friends', label: 'Мои друзья', count: friends.length },
							{ id: 'requests', label: 'Заявки', count: requests.length },
							{ id: 'following', label: 'Подписки', count: following.length },
							{ id: 'followers', label: 'Подписчики', count: followers.length },
						].map(tab => {
							const isActive = activeTab === tab.id
							return (
								<button
									key={tab.id}
									onClick={() => setActiveTab(tab.id as any)}
									className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
										isActive
											? 'bg-[#21262d] text-white border border-[#30363d] shadow-sm font-semibold'
											: 'text-[#8b949e] hover:text-white hover:bg-[#161b22]'
									}`}
								>
									<span>{tab.label}</span>
									{tab.count > 0 && (
										<span
											className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
												isActive
													? 'bg-[#0077FF] text-white'
													: 'bg-[#21262d] text-[#8b949e]'
											}`}
										>
											{tab.count}
										</span>
									)}
								</button>
							)
						})}
					</div>
				</div>

				{/* Search Results Display */}
				{searchResults.length > 0 && (
					<div className='rounded-2xl bg-[#161b22] border border-[#30363d] p-5 shadow-sm space-y-4'>
						<div className='flex items-center justify-between'>
							<h2 className='text-sm font-semibold text-white flex items-center gap-2'>
								<Search className='w-4 h-4 text-[#0077FF]' />
								Результаты поиска ({searchResults.length})
							</h2>
							<button
								onClick={() => setSearchResults([])}
								className='text-xs text-[#8b949e] hover:text-white transition-colors'
							>
								Скрыть
							</button>
						</div>
						<div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
							{searchResults.map(u => (
								<div
									key={u.id}
									className='flex items-center justify-between p-3 rounded-xl bg-[#0d1117] border border-[#30363d] hover:border-[#8b949e]/40 transition-colors'
								>
									<Link
										href={`/feed/profile/${u.id}`}
										className='flex items-center gap-3 min-w-0 flex-1'
									>
										<img
											src={getAvatarUrl(u.avatar_url)}
											alt={u.username}
											className='h-9 w-9 rounded-full object-cover border border-[#30363d]'
										/>
										<div className='min-w-0 flex-1'>
											<span className='font-semibold text-xs text-white truncate block'>
												{u.username}
											</span>
											{u.email && (
												<span className='text-[10px] text-[#8b949e] truncate block'>
													{u.email}
												</span>
											)}
										</div>
									</Link>
									<button
										disabled={actionPendingId === u.id}
										onClick={() => handleAddFriend(u.id)}
										className='ml-2 p-2 rounded-lg bg-[#0077FF] hover:bg-[#0066dd] text-white text-xs transition-colors shrink-0 disabled:opacity-50'
										title='Добавить в друзья'
									>
										<UserPlus className='w-4 h-4' />
									</button>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Tab Content */}
				<div className='min-h-[300px]'>
					{activeTab === 'friends' &&
						renderUserList(
							friends,
							'У вас пока нет добавленных друзей. Найдите знакомых через поиск выше!',
							false,
							true,
						)}
					{activeTab === 'requests' &&
						renderUserList(
							requests,
							'Новых заявок в друзья пока нет.',
							true,
							false,
						)}
					{activeTab === 'following' &&
						renderUserList(
							following,
							'Вы пока ни на кого не подписаны.',
							false,
							false,
						)}
					{activeTab === 'followers' &&
						renderUserList(
							followers,
							'На вас пока никто не подписан.',
							false,
							false,
						)}
				</div>
			</div>
		</FeedPageShell>
	)
}
