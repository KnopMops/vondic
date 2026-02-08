'use client'

import { User } from '@/lib/types'
import { useEffect, useState } from 'react'

type Props = {
	user: User
	currentUser: User | null
}

export default function UserProfile({ user, currentUser }: Props) {
	const [isFriend, setIsFriend] = useState(false)
	const [isSubscribed, setIsSubscribed] = useState(false)
	const [isBlocked, setIsBlocked] = useState(user.status === 'blocked')
	const [loading, setLoading] = useState(false)
	const [checkingStatus, setCheckingStatus] = useState(true)

	// Edit Profile Modal State
	const [isEditModalOpen, setIsEditModalOpen] = useState(false)
	const [avatarUrl, setAvatarUrl] = useState(user.avatar_url || '')
	const [isUpdating, setIsUpdating] = useState(false)

	const isMe = currentUser?.id === user.id
	const isAdmin = currentUser?.role === 'Admin'

	useEffect(() => {
		if (!currentUser || isMe) {
			setCheckingStatus(false)
			return
		}

		const checkStatus = async () => {
			try {
				// 1. Check Friends
				const friendsRes = await fetch('/api/friends/list', {
					method: 'POST',
				})
				if (friendsRes.ok) {
					const friends = await friendsRes.json()
					if (Array.isArray(friends)) {
						// Check if current profile user is in my friends list
						// The friend object might have 'id' or 'friend_id' depending on backend
						// Based on previous code, we enriched it, but let's check id matching
						const isMyFriend = friends.some(
							(f: any) => f.id === user.id || f.friend_id === user.id,
						)
						setIsFriend(isMyFriend)
					}
				}

				// 2. Check Subscriptions (Following)
				const followingRes = await fetch('/api/subscriptions/following', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ user_id: currentUser.id }), // Assuming we want MY following list
				})
				if (followingRes.ok) {
					const following = await followingRes.json()
					if (Array.isArray(following)) {
						const isFollowing = following.some(
							(f: any) => f.id === user.id || f.user_id === user.id,
						)
						setIsSubscribed(isFollowing)
					}
				}
			} catch (error) {
				console.error('Error checking status:', error)
			} finally {
				setCheckingStatus(false)
			}
		}

		checkStatus()
	}, [currentUser, user.id, isMe])

	const handleAddFriend = async () => {
		if (!currentUser) return
		setLoading(true)
		try {
			const res = await fetch('/api/friends/add', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ friend_id: user.id }),
			})
			if (!res.ok) throw new Error('Failed to add friend')
			alert('Заявка отправлена!')
			// Note: Usually adding a friend sends a request, it doesn't make them a friend immediately.
			// But for UI feedback we might want to disable the button or show "Pending"
			// The user requirement says "как сейчас добавить в друзья", so we keep it.
		} catch (error) {
			console.error(error)
			alert('Ошибка при отправке заявки')
		} finally {
			setLoading(false)
		}
	}

	const handleRemoveFriend = async () => {
		if (!currentUser) return
		if (!confirm('Удалить из друзей?')) return
		setLoading(true)
		try {
			const res = await fetch('/api/friends/remove', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ friend_id: user.id }),
			})
			if (!res.ok) throw new Error('Failed to remove friend')
			setIsFriend(false)
		} catch (error) {
			console.error(error)
			alert('Ошибка при удалении из друзей')
		} finally {
			setLoading(false)
		}
	}

	const handleSubscribe = async () => {
		if (!currentUser) return
		setLoading(true)
		try {
			const res = await fetch('/api/subscriptions/subscribe', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ target_id: user.id }),
			})
			if (!res.ok) throw new Error('Failed to subscribe')
			setIsSubscribed(true)
		} catch (error) {
			console.error(error)
			alert('Ошибка при подписке')
		} finally {
			setLoading(false)
		}
	}

	const handleUnsubscribe = async () => {
		if (!currentUser) return
		setLoading(true)
		try {
			const res = await fetch('/api/subscriptions/unsubscribe', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ target_id: user.id }),
			})
			if (!res.ok) throw new Error('Failed to unsubscribe')
			setIsSubscribed(false)
		} catch (error) {
			console.error(error)
			alert('Ошибка при отписке')
		} finally {
			setLoading(false)
		}
	}

	const handleBlock = async () => {
		if (!currentUser || !isAdmin) return
		if (!confirm('Вы уверены, что хотите заблокировать пользователя?')) return
		setLoading(true)
		try {
			const res = await fetch('/api/users/block', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					user_id: user.id,
					admin_user_id: currentUser.id,
				}),
			})
			if (!res.ok) throw new Error('Failed to block')
			alert('Пользователь заблокирован')
			setIsBlocked(true)
		} catch (error) {
			console.error(error)
			alert('Ошибка блокировки')
		} finally {
			setLoading(false)
		}
	}

	const handleUnblock = async () => {
		if (!currentUser || !isAdmin) return
		if (!confirm('Разблокировать пользователя?')) return
		setLoading(true)
		try {
			const res = await fetch('/api/users/unblock', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					user_id: user.id,
					admin_user_id: currentUser.id,
				}),
			})
			if (!res.ok) throw new Error('Failed to unblock')
			alert('Пользователь разблокирован')
			setIsBlocked(false)
		} catch (error) {
			console.error(error)
			alert('Ошибка разблокировки')
		} finally {
			setLoading(false)
		}
	}

	const handleUpdateProfile = async () => {
		if (!currentUser) return
		setIsUpdating(true)
		try {
			const payload = {
				user_id: user.id,
				email: user.email, // Required by backend, cannot be changed
				username: user.username, // Required by backend, cannot be changed
				avatar_url: avatarUrl,
			}

			const res = await fetch('/api/users/update', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			})

			if (!res.ok) throw new Error('Failed to update profile')

			const updatedUser = await res.json()
			alert('Профиль обновлен!')
			setIsEditModalOpen(false)
			// Ideally update parent state or force refresh, but for now user will see updated image on reload or simple state update if we had setProfileUser passed down
			// For immediate feedback let's reload or we need a callback from parent
			window.location.reload()
		} catch (error) {
			console.error(error)
			alert('Ошибка обновления профиля')
		} finally {
			setIsUpdating(false)
		}
	}

	return (
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
					<div className='flex items-center justify-between'>
						<div>
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
						</div>

						{/* Actions */}
						{isMe && (
							<button
								onClick={() => setIsEditModalOpen(true)}
								className='rounded-lg bg-gray-700 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-600'
							>
								Редактировать
							</button>
						)}

						{/* Edit Modal */}
						{isEditModalOpen && (
							<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'>
								<div className='w-full max-w-md space-y-4 rounded-xl bg-gray-800 p-6 shadow-xl'>
									<h2 className='text-xl font-bold text-white'>
										Редактировать профиль
									</h2>
									<div>
										<label className='mb-1 block text-sm font-medium text-gray-400'>
											Ссылка на аватар
										</label>
										<input
											type='text'
											value={avatarUrl}
											onChange={e => setAvatarUrl(e.target.value)}
											className='w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none'
											placeholder='https://...'
										/>
									</div>
									<div className='flex justify-end gap-3'>
										<button
											onClick={() => setIsEditModalOpen(false)}
											className='rounded-lg px-4 py-2 text-sm font-semibold text-gray-400 hover:text-white'
										>
											Отмена
										</button>
										<button
											onClick={handleUpdateProfile}
											disabled={isUpdating}
											className='rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50'
										>
											{isUpdating ? 'Сохранение...' : 'Сохранить'}
										</button>
									</div>
								</div>
							</div>
						)}

						{!isMe && currentUser && !checkingStatus && (
							<div className='flex gap-2'>
								{/* Friend Button */}
								{isFriend ? (
									<button
										onClick={handleRemoveFriend}
										disabled={loading}
										className='rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50'
									>
										Удалить из друзей
									</button>
								) : (
									<button
										onClick={handleAddFriend}
										disabled={loading}
										className='rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50'
									>
										Добавить в друзья
									</button>
								)}

								{/* Subscribe Button */}
								{isSubscribed ? (
									<button
										onClick={handleUnsubscribe}
										disabled={loading}
										className='rounded-lg bg-gray-600 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-500 disabled:opacity-50'
									>
										Отписаться
									</button>
								) : (
									<button
										onClick={handleSubscribe}
										disabled={loading}
										className='rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50'
									>
										Подписаться
									</button>
								)}

								{isAdmin && (
									<>
										{isBlocked ? (
											<button
												onClick={handleUnblock}
												disabled={loading}
												className='rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50'
											>
												Разблокировать
											</button>
										) : (
											<button
												onClick={handleBlock}
												disabled={loading}
												className='rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50'
											>
												Заблокировать
											</button>
										)}
									</>
								)}
							</div>
						)}
					</div>

					{user.description && (
						<p className='mt-2 text-sm text-gray-300'>{user.description}</p>
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
	)
}
