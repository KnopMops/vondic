'use client'

import { useAuth } from '@/lib/AuthContext'
import { User } from '@/lib/types'
import { apiUrl } from '@/lib/url-fallback'
import { getAvatarUrl } from '@/lib/utils'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import {
	FiSearch as Search,
	FiUserCheck as UserCheck,
	FiUserPlus as UserPlus,
	FiUsers as Users,
	FiUserX as UserX,
} from 'react-icons/fi'

interface FriendsPanelProps {
	onUserClick?: (user: User) => void
}

export default function FriendsPanel({ onUserClick }: FriendsPanelProps) {
	const { user } = useAuth()
	const [requests, setRequests] = useState<User[]>([])
	const [friends, setFriends] = useState<User[]>([])
	const [following, setFollowing] = useState<User[]>([])
	const [followers, setFollowers] = useState<User[]>([])
	const [loading, setLoading] = useState(true)
	const [activeTab, setActiveTab] = useState<
		'friends' | 'requests' | 'following' | 'followers'
	>('friends')

	const [searchQuery, setSearchQuery] = useState('')
	const [searchResults, setSearchResults] = useState<User[]>([])
	const [isSearching, setIsSearching] = useState(false)

	const accessToken = user?.access_token || ''
	const backendUrl = apiUrl()

	const fetchData = async () => {
		if (!user) return
		try {
			const headers: HeadersInit = {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${accessToken}`,
			}

			const [reqRes, friendsRes, followingRes, followersRes] = await Promise.all([
				fetch(`${backendUrl}/api/v1/friends/requests`, {
					method: 'POST',
					headers,
					body: JSON.stringify({ user_id: user.id }),
				}),
				fetch(`${backendUrl}/api/v1/friends/list`, {
					method: 'POST',
					headers,
				}),
				fetch(`${backendUrl}/api/v1/subscriptions/following`, {
					method: 'POST',
					headers,
					body: JSON.stringify({ user_id: user.id }),
				}),
				fetch(`${backendUrl}/api/v1/subscriptions/followers`, {
					method: 'POST',
					headers,
					body: JSON.stringify({ user_id: user.id }),
				}),
			])

			if (reqRes.ok) {
				const data = await reqRes.json()
				setRequests(Array.isArray(data) ? data : [])
			}
			if (friendsRes.ok) {
				const data = await friendsRes.json()
				setFriends(Array.isArray(data) ? data : [])
			}
			if (followingRes.ok) {
				const data = await followingRes.json()
				setFollowing(Array.isArray(data) ? data : [])
			}
			if (followersRes.ok) {
				const data = await followersRes.json()
				setFollowers(Array.isArray(data) ? data : [])
			}
		} catch (err) {
			console.error(err)
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		fetchData()
		const interval = setInterval(fetchData, 5000)
		return () => clearInterval(interval)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [user])

	const handleAccept = async (requesterId: string) => {
		try {
			const res = await fetch(`${backendUrl}/api/v1/friends/accept`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${accessToken}`,
				},
				body: JSON.stringify({ requester_id: requesterId }),
			})
			if (!res.ok) throw new Error('Failed to accept')
			fetchData()
		} catch (err) {
			console.error(err)
			alert('Ошибка при принятии заявки')
		}
	}

	const handleReject = async (requesterId: string) => {
		try {
			const res = await fetch(`${backendUrl}/api/v1/friends/reject`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${accessToken}`,
				},
				body: JSON.stringify({ requester_id: requesterId }),
			})
			if (!res.ok) throw new Error('Failed to reject')
			fetchData()
		} catch (err) {
			console.error(err)
			alert('Ошибка при отклонении заявки')
		}
	}

	const handleSearch = async () => {
		if (!searchQuery.trim()) return
		setIsSearching(true)
		try {
			const res = await fetch(`${backendUrl}/api/v1/users/search`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${accessToken}`,
				},
				body: JSON.stringify({ query: searchQuery }),
			})
			if (res.ok) {
				const data = await res.json()
				setSearchResults(Array.isArray(data) ? data : [])
			}
		} catch (error) {
			console.error(error)
		} finally {
			setIsSearching(false)
		}
	}

	const handleAddFriend = async (friendId: string) => {
		if (!user) return
		try {
			const res = await fetch(`${backendUrl}/api/v1/friends/request`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${accessToken}`,
				},
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
			alert('Заявка отправлена!')
		} catch (error) {
			console.error(error)
			alert((error as any)?.message || 'Ошибка при отправке заявки')
		}
	}

	const renderUserList = (users: User[], emptyMsg: string, isRequest = false) => {
		if (loading && users.length === 0)
			return (
				<div className='flex justify-center py-12'>
					<div className='h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent' />
				</div>
			)
		if (users.length === 0)
			return (
				<div className='flex flex-col items-center justify-center py-12 text-gray-500'>
					<Users className='w-12 h-12 mb-4 opacity-20' />
					<p>{emptyMsg}</p>
				</div>
			)

		return (
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ duration: 0.4 }}
				className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
			>
				{users.map((u, i) => (
					<motion.div
						key={u.id}
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: i * 0.05 }}
						className='group flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all backdrop-blur-sm'
					>
						<div
							onClick={() => onUserClick?.(u)}
							className='flex items-center gap-4 hover:opacity-80 transition-opacity cursor-pointer'
						>
							<div className='relative'>
								<img
									src={getAvatarUrl(u.avatar_url)}
									alt={u.username}
									className='h-12 w-12 rounded-full object-cover ring-2 ring-transparent group-hover:ring-indigo-500/50 transition-all'
								/>
								<div
									className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-black ${
										u.status === 'online' ? 'bg-green-500' : 'bg-gray-500'
									}`}
								/>
							</div>
							<div>
								<div className='font-semibold text-white group-hover:text-indigo-400 transition-colors'>
									{u.username}
									{u.premium && <span className='ml-1 text-amber-400'>★</span>}
								</div>
								{u.privacy_settings?.show_email === true && u.email && (
									<div className='text-xs text-gray-400'>{u.email}</div>
								)}
							</div>
						</div>
						{isRequest ? (
							<div className='flex gap-2'>
								<button
									onClick={e => {
										e.stopPropagation()
										handleAccept(u.id)
									}}
									className='p-2 rounded-xl bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 hover:scale-105 transition-all'
									title='Принять'
								>
									<UserCheck className='w-5 h-5' />
								</button>
								<button
									onClick={e => {
										e.stopPropagation()
										handleReject(u.id)
									}}
									className='p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:scale-105 transition-all'
									title='Отклонить'
								>
									<UserX className='w-5 h-5' />
								</button>
							</div>
						) : (
							<button className='p-2 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white transition-colors'>
								<Users className='w-5 h-5' />
							</button>
						)}
					</motion.div>
				))}
			</motion.div>
		)
	}

	return (
		<div className='flex flex-col h-full overflow-hidden'>
			<div className='p-6 border-b border-white/10 bg-black/20 backdrop-blur-sm flex-shrink-0'>
				<div className='flex items-center justify-between mb-6'>
					<h1 className='text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400'>
						Друзья
					</h1>

					<div className='relative'>
						<Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500' />
						<input
							type='text'
							placeholder='Найти людей...'
							value={searchQuery}
							onChange={e => setSearchQuery(e.target.value)}
							onKeyDown={e => e.key === 'Enter' && handleSearch()}
							className='bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 w-64 transition-all placeholder-gray-500'
						/>
						{isSearching && (
							<div className='absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin' />
						)}
					</div>
				</div>

				<div className='flex p-1 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm'>
					{[
						{ id: 'friends', label: 'Мои друзья', count: friends.length },
						{ id: 'requests', label: 'Заявки', count: requests.length },
						{ id: 'following', label: 'Подписки', count: following.length },
						{ id: 'followers', label: 'Подписчики', count: followers.length },
					].map(tab => (
						<button
							key={tab.id}
							onClick={() => setActiveTab(tab.id as any)}
							className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
								activeTab === tab.id
									? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25'
									: 'text-gray-400 hover:text-white hover:bg-white/5'
							}`}
						>
							{tab.label}
							{tab.count > 0 && (
								<span
									className={`text-xs px-2 py-0.5 rounded-full ${
										activeTab === tab.id
											? 'bg-white/20 text-white'
											: 'bg-white/10 text-gray-400'
									}`}
								>
									{tab.count}
								</span>
							)}
						</button>
					))}
				</div>
			</div>

			<div className='flex-1 overflow-y-auto custom-scrollbar p-6'>
				{activeTab === 'friends' && renderUserList(friends, 'У вас пока нет друзей')}
				{activeTab === 'requests' &&
					renderUserList(requests, 'Нет входящих заявок', true)}
				{activeTab === 'following' &&
					renderUserList(following, 'Вы ни на кого не подписаны')}
				{activeTab === 'followers' &&
					renderUserList(followers, 'У вас нет подписчиков')}

				{searchResults.length > 0 && (
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						className='mt-8 pt-8 border-t border-white/10'
					>
						<h2 className='text-xl font-bold mb-6 text-white'>Результаты поиска</h2>
						<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
							{searchResults.map(u => (
								<div
									key={u.id}
									className='flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all'
								>
									<div className='flex items-center gap-4'>
										<img
											src={getAvatarUrl(u.avatar_url)}
											alt={u.username}
											className='h-12 w-12 rounded-full'
										/>
										<div>
											<div className='font-semibold text-white'>
												{u.username}
												{u.premium && (
													<span className='ml-1 text-amber-400'>★</span>
												)}
											</div>
										</div>
									</div>
									<button
										onClick={e => {
											e.stopPropagation()
											handleAddFriend(u.id)
										}}
										className='p-2 rounded-xl bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-all'
									>
										<UserPlus className='w-5 h-5' />
									</button>
								</div>
							))}
						</div>
					</motion.div>
				)}
			</div>
		</div>
	)
}
