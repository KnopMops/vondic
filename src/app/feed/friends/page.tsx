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
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')

	useEffect(() => {
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
			} catch (err) {
				console.error(err)
				setError('Не удалось загрузить данные')
			} finally {
				setLoading(false)
			}
		}

		fetchData()
	}, [user])

	const handleAccept = async (requesterId: string) => {
		try {
			const res = await fetch('/api/friends/accept', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ requester_id: requesterId }),
			})
			if (!res.ok) throw new Error('Failed to accept')

			// Remove from list
			setRequests(prev => prev.filter(r => r.id !== requesterId))
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

			// Remove from list
			setRequests(prev => prev.filter(r => r.id !== requesterId))
		} catch (err) {
			console.error(err)
			alert('Ошибка при отклонении заявки')
		}
	}

	if (!user) return null

	return (
		<div className='min-h-screen bg-gray-900 text-gray-100'>
			<Header email={user.email} onLogout={logout} />
			<div className='mx-auto flex max-w-7xl'>
				<Sidebar />
				<main className='flex-1 p-4 sm:p-6 lg:p-8'>
					<div className='mx-auto max-w-3xl space-y-6'>
						<div className='rounded-xl bg-gray-800 p-6'>
							<h1 className='mb-6 text-2xl font-bold'>Друзья</h1>

							{/* Tabs or Sections could go here, for now just Requests */}
							<div className='space-y-4'>
								<h2 className='text-lg font-semibold text-gray-400'>
									Заявки в друзья
								</h2>

								{loading ? (
									<div className='text-center text-gray-500'>Загрузка...</div>
								) : error ? (
									<div className='text-center text-red-500'>{error}</div>
								) : requests.length === 0 ? (
									<div className='text-center text-gray-500'>
										Нет новых заявок
									</div>
								) : (
									<div className='space-y-4'>
										{requests.map(req => (
											<div
												key={req.id}
												className='flex items-center justify-between rounded-lg bg-gray-700 p-4'
											>
												<Link
													href={`/feed/profile/${req.id}`}
													className='flex items-center gap-3 hover:opacity-80'
												>
													<img
														src={req.avatar_url || '/placeholder-user.jpg'}
														alt={req.username}
														className='h-12 w-12 rounded-full object-cover'
													/>
													<div>
														<div className='font-semibold'>{req.username}</div>
														{!req.email?.endsWith('@telegram.bot') && (
															<div className='text-sm text-gray-400'>
																{req.email}
															</div>
														)}
													</div>
												</Link>
												<div className='flex gap-2'>
													<button
														onClick={() => handleAccept(req.id)}
														className='rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700'
													>
														Принять
													</button>
													<button
														onClick={() => handleReject(req.id)}
														className='rounded-md bg-gray-600 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-500'
													>
														Отклонить
													</button>
												</div>
											</div>
										))}
									</div>
								)}
							</div>

							{/* Friends List */}
							<div className='space-y-4 pt-8 border-t border-gray-700'>
								<h2 className='text-lg font-semibold text-gray-400'>
									Ваши друзья
								</h2>

								{friends.length === 0 && !loading ? (
									<div className='text-center text-gray-500'>
										У вас пока нет друзей
									</div>
								) : (
									<div className='space-y-4'>
										{friends.map(friend => (
											<div
												key={friend.id}
												className='flex items-center justify-between rounded-lg bg-gray-700 p-4'
											>
												<Link
													href={`/feed/profile/${friend.id}`}
													className='flex items-center gap-3 hover:opacity-80'
												>
													<img
														src={friend.avatar_url || '/placeholder-user.jpg'}
														alt={friend.username}
														className='h-12 w-12 rounded-full object-cover'
													/>
													<div>
														<div className='font-semibold'>
															{friend.username}
														</div>
														{!friend.email?.endsWith('@telegram.bot') && (
															<div className='text-sm text-gray-400'>
																{friend.email}
															</div>
														)}
													</div>
												</Link>
												{/* Optional: Add "Remove friend" or "Message" button here */}
											</div>
										))}
									</div>
								)}
							</div>
						</div>
					</div>
				</main>
			</div>
		</div>
	)
}
