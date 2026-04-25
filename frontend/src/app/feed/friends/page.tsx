'use client'

import Header from '@/components/social/Header'
import Sidebar from '@/components/social/Sidebar'
import { useAuth } from '@/lib/AuthContext'
import { User } from '@/lib/types'
import { getAttachmentUrl, getAvatarUrl } from '@/lib/utils'
import { motion } from 'framer-motion'
import {
	FiSearch as Search,
	FiUserCheck as UserCheck,
	FiUserPlus as UserPlus,
	FiUsers as Users,
	FiUserX as UserX,
} from 'react-icons/fi'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function FriendsPage() {
	const { user, logout } = useAuth()
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

	const fetchData = async () => {
		if (!user) return
		try {
			
			const reqRes = await fetch('/api/friends/requests', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ user_id: user.id }),
			})
			if (reqRes.ok) {
				const data = await reqRes.json()
				setRequests(Array.isArray(data) ? data : [])
			}

			
			const friendsRes = await fetch('/api/friends/list', {
				method: 'POST',
			})
			if (friendsRes.ok) {
				const data = await friendsRes.json()
				setFriends(Array.isArray(data) ? data : [])
			}

			
			const followingRes = await fetch('/api/subscriptions/following', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ user_id: user.id }),
			})
			if (followingRes.ok) {
				const data = await followingRes.json()
				setFollowing(Array.isArray(data) ? data : [])
			}

			
			const followersRes = await fetch('/api/subscriptions/followers', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ user_id: user.id }),
			})
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
	}, [user])

	const handleAccept = async (requesterId: string) => {
		try {
			const res = await fetch('/api/friends/accept', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
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
			const res = await fetch('/api/friends/reject', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
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
			const res = await fetch('/api/users/search', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
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
			const res = await fetch('/api/friends/add', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ friend_id: friendId }),
			})
			if (!res.ok) throw new Error('Failed to add friend')
			alert('Заявка отправлена!')
		} catch (error) {
			console.error(error)
			alert('Ошибка при отправке заявки')
		}
	}

	if (!user) return null

	const renderUserList = (
		users: User[],
		emptyMsg: string,
		isRequest = false,
	) => {
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
				className='grid grid-cols-1 gap-4'
			>
				{users.map((u, i) => (
					<motion.div
						key={u.id}
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: i * 0.05 }}
						className='group flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all backdrop-blur-sm'
					>
						<Link
							href={`/feed/profile/${u.id}`}
							className='flex items-center gap-4 hover:opacity-80 transition-opacity'
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
								<div className='text-xs text-gray-400'>{u.email}</div>
							</div>
						</Link>
						{isRequest ? (
							<div className='flex gap-2'>
								<button
									onClick={() => handleAccept(u.id)}
									className='p-2 rounded-xl bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 hover:scale-105 transition-all'
									title='Принять'
								>
									<UserCheck className='w-5 h-5' />
								</button>
								<button
									onClick={() => handleReject(u.id)}
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
		<div className='min-h-screen bg-black text-white selection:bg-indigo-500 selection:text-white overflow-x-hidden relative'>
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
				<main className='flex-1 px-4 sm:px-6 lg:px-8 pb-20'>
					<div className='max-w-3xl mx-auto space-y-8'>
						<div className='flex items-center justify-between'>
							<h1 className='text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400'>
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
									className='bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 w-64 transition-all'
								/>
							</div>
						</div>

						
						<div className='flex p-1 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm'>
							{[
								{ id: 'friends', label: 'Мои друзья', count: friends.length },
								{ id: 'requests', label: 'Заявки', count: requests.length },
								{ id: 'following', label: 'Подписки', count: following.length },
								{
									id: 'followers',
									label: 'Подписчики',
									count: followers.length,
								},
							].map(tab => (
								<button
									key={tab.id}
									onClick={() => setActiveTab(tab.id as any)}
									className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all ${
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

						
						<div className='min-h-[400px]'>
							{activeTab === 'friends' &&
								renderUserList(friends, 'У вас пока нет друзей')}
							{activeTab === 'requests' &&
								renderUserList(requests, 'Нет входящих заявок', true)}
							{activeTab === 'following' &&
								renderUserList(following, 'Вы ни на кого не подписаны')}
							{activeTab === 'followers' &&
								renderUserList(followers, 'У вас нет подписчиков')}
						</div>

						
						{searchResults.length > 0 && (
							<motion.div
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								className='mt-12 pt-8 border-t border-white/10'
							>
								<h2 className='text-xl font-bold mb-6 text-white'>
									Результаты поиска
								</h2>
								<div className='grid grid-cols-1 gap-4'>
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
												onClick={() => handleAddFriend(u.id)}
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
				</main>
			</div>
		</div>
	)
}
