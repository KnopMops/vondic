'use client'

import Header from '@/components/social/Header'
import Sidebar from '@/components/social/Sidebar'
import { useAuth } from '@/lib/AuthContext'
import { User } from '@/lib/types'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function FriendsPage() {
	const { user, logout } = useAuth()
	const [requests, setRequests] = useState<User[]>([])
	const [friends, setFriends] = useState<User[]>([])
	const [following, setFollowing] = useState<User[]>([])
	const [followers, setFollowers] = useState<User[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const [activeTab, setActiveTab] = useState<
		'friends' | 'requests' | 'following' | 'followers'
	>('friends')

	const [isAddFriendModalOpen, setIsAddFriendModalOpen] = useState(false)
	const [searchQuery, setSearchQuery] = useState('')
	const [searchResults, setSearchResults] = useState<User[]>([])
	const [isSearching, setIsSearching] = useState(false)

	const fetchData = async () => {
		if (!user) return
		try {
			// 1. Requests
			const reqRes = await fetch('/api/friends/requests', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ user_id: user.id }),
			})
			if (reqRes.ok) {
				const data = await reqRes.json()
				setRequests(Array.isArray(data) ? data : [])
			}

			// 2. Friends
			const friendsRes = await fetch('/api/friends/list', {
				method: 'POST',
			})
			if (friendsRes.ok) {
				const data = await friendsRes.json()
				setFriends(Array.isArray(data) ? data : [])
			}

			// 3. Following
			const followingRes = await fetch('/api/subscriptions/following', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ user_id: user.id }),
			})
			if (followingRes.ok) {
				const data = await followingRes.json()
				setFollowing(Array.isArray(data) ? data : [])
			}

			// 4. Followers
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
			// Don't set global error on poll failure to avoid UI flickering
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
			fetchData() // Update immediately
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
			fetchData() // Update immediately
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
			// Optionally refresh data or update UI state
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
			return <div className='text-center text-gray-500'>Загрузка...</div>
		if (users.length === 0)
			return <div className='text-center text-gray-500'>{emptyMsg}</div>

		return (
			<div className='space-y-4'>
				{users.map(u => (
					<div
						key={u.id}
						className='flex items-center justify-between rounded-lg bg-gray-700 p-4'
					>
						<Link
							href={`/feed/profile/${u.id}`}
							className='flex items-center gap-3 hover:opacity-80'
						>
							<img
								src={u.avatar_url || '/placeholder-user.jpg'}
								alt={u.username}
								className='h-12 w-12 rounded-full object-cover'
							/>
							<div>
								<div className='font-semibold'>{u.username}</div>
								{!u.email?.endsWith('@telegram.bot') && (
									<div className='text-sm text-gray-400'>{u.email}</div>
								)}
							</div>
						</Link>
						{isRequest && (
							<div className='flex gap-2'>
								<button
									onClick={() => handleAccept(u.id)}
									className='rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700'
								>
									Принять
								</button>
								<button
									onClick={() => handleReject(u.id)}
									className='rounded-md bg-gray-600 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-500'
								>
									Отклонить
								</button>
							</div>
						)}
					</div>
				))}
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
						<div className='rounded-xl bg-gray-800 p-6'>
							<h1 className='mb-6 text-2xl font-bold'>Социальные связи</h1>

							<div className='mb-6 flex gap-4 border-b border-gray-700 pb-2 overflow-x-auto'>
								<button
									onClick={() => setActiveTab('friends')}
									className={`pb-2 text-sm font-medium transition-colors whitespace-nowrap ${
										activeTab === 'friends'
											? 'border-b-2 border-indigo-500 text-indigo-400'
											: 'text-gray-400 hover:text-gray-200'
									}`}
								>
									Друзья
								</button>
								<button
									onClick={() => setActiveTab('requests')}
									className={`pb-2 text-sm font-medium transition-colors whitespace-nowrap ${
										activeTab === 'requests'
											? 'border-b-2 border-indigo-500 text-indigo-400'
											: 'text-gray-400 hover:text-gray-200'
									}`}
								>
									Заявки ({requests.length})
								</button>
								<button
									onClick={() => setActiveTab('following')}
									className={`pb-2 text-sm font-medium transition-colors whitespace-nowrap ${
										activeTab === 'following'
											? 'border-b-2 border-indigo-500 text-indigo-400'
											: 'text-gray-400 hover:text-gray-200'
									}`}
								>
									Подписки
								</button>
								<button
									onClick={() => setActiveTab('followers')}
									className={`pb-2 text-sm font-medium transition-colors whitespace-nowrap ${
										activeTab === 'followers'
											? 'border-b-2 border-indigo-500 text-indigo-400'
											: 'text-gray-400 hover:text-gray-200'
									}`}
								>
									Подписчики
								</button>
							</div>

							{activeTab === 'friends' && (
								<div>
									<div className='mb-4 flex items-center justify-between'>
										<h2 className='text-lg font-semibold text-gray-400'>
											Ваши друзья
										</h2>
										<button
											onClick={() => setIsAddFriendModalOpen(true)}
											className='rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700'
										>
											Добавить в друзья
										</button>
									</div>
									{renderUserList(friends, 'У вас пока нет друзей')}
								</div>
							)}

							{activeTab === 'requests' && (
								<div>
									<h2 className='mb-4 text-lg font-semibold text-gray-400'>
										Заявки в друзья
									</h2>
									{renderUserList(requests, 'Нет новых заявок', true)}
								</div>
							)}

							{activeTab === 'following' && (
								<div>
									<h2 className='mb-4 text-lg font-semibold text-gray-400'>
										Вы подписаны
									</h2>
									{renderUserList(following, 'Вы ни на кого не подписаны')}
								</div>
							)}

							{activeTab === 'followers' && (
								<div>
									<h2 className='mb-4 text-lg font-semibold text-gray-400'>
										Ваши подписчики
									</h2>
									{renderUserList(followers, 'У вас нет подписчиков')}
								</div>
							)}
						</div>
					</div>

					{/* Search Modal */}
					{isAddFriendModalOpen && (
						<div className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4'>
							<div className='w-full max-w-lg rounded-xl bg-gray-800 p-6 shadow-xl'>
								<div className='mb-4 flex items-center justify-between'>
									<h2 className='text-xl font-bold text-white'>
										Поиск пользователей
									</h2>
									<button
										onClick={() => setIsAddFriendModalOpen(false)}
										className='text-gray-400 hover:text-white'
									>
										✕
									</button>
								</div>

								<div className='mb-6 flex gap-2'>
									<input
										type='text'
										placeholder='Введите имя или email...'
										value={searchQuery}
										onChange={e => setSearchQuery(e.target.value)}
										onKeyDown={e => e.key === 'Enter' && handleSearch()}
										className='flex-1 rounded-md border border-gray-700 bg-gray-900 px-4 py-2 text-white focus:border-indigo-500 focus:outline-none'
									/>
									<button
										onClick={handleSearch}
										disabled={isSearching}
										className='rounded-md bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50'
									>
										{isSearching ? '...' : 'Найти'}
									</button>
								</div>

								<div className='max-h-96 overflow-y-auto space-y-4'>
									{searchResults.length === 0 &&
										!isSearching &&
										searchQuery && (
											<div className='text-center text-gray-500'>
												Ничего не найдено
											</div>
										)}

									{searchResults.map(result => (
										<div
											key={result.id}
											className='flex items-center justify-between rounded-lg bg-gray-700 p-4'
										>
											<Link
												href={`/feed/profile/${result.id}`}
												className='flex items-center gap-3 hover:opacity-80'
												onClick={() => setIsAddFriendModalOpen(false)}
											>
												<img
													src={result.avatar_url || '/placeholder-user.jpg'}
													alt={result.username}
													className='h-12 w-12 rounded-full object-cover'
												/>
												<div>
													<div className='font-semibold'>{result.username}</div>
													{!result.email?.endsWith('@telegram.bot') && (
														<div className='text-sm text-gray-400'>
															{result.email}
														</div>
													)}
												</div>
											</Link>
											{/* Only show Add button if not self and not already friend (simplified check) */}
											{user.id !== result.id && (
												<button
													onClick={() => handleAddFriend(result.id)}
													className='rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700'
												>
													Отправить заявку
												</button>
											)}
										</div>
									))}
								</div>
							</div>
						</div>
					)}
				</main>
			</div>
		</div>
	)
}
