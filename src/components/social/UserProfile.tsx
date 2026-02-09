'use client'

import { User } from '@/lib/types'
import { AnimatePresence, motion } from 'framer-motion'
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
					body: JSON.stringify({ user_id: currentUser.id }),
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
				email: user.email,
				username: user.username,
				avatar_url: avatarUrl,
			}

			const res = await fetch('/api/users/update', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			})

			if (!res.ok) throw new Error('Failed to update profile')

			alert('Профиль обновлен!')
			setIsEditModalOpen(false)
			window.location.reload()
		} catch (error) {
			console.error(error)
			alert('Ошибка обновления профиля')
		} finally {
			setIsUpdating(false)
		}
	}

	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.5 }}
			className='mx-auto max-w-3xl space-y-6'
		>
			{/* Cover Image */}
			<div className='relative h-48 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 overflow-hidden shadow-lg'>
				<div className='absolute inset-0 bg-black/20' />
			</div>

			{/* User Info Section */}
			<div className='flex flex-col sm:flex-row items-end gap-6 px-4'>
				<motion.div
					initial={{ scale: 0.8, opacity: 0 }}
					animate={{ scale: 1, opacity: 1 }}
					transition={{ delay: 0.2 }}
					className='-mt-20 flex h-32 w-32 items-center justify-center rounded-full bg-gray-900 ring-4 ring-black overflow-hidden shadow-xl z-10'
				>
					{user.avatar_url ? (
						<img
							src={user.avatar_url}
							alt={user.username}
							className='h-full w-full object-cover'
						/>
					) : (
						<span className='text-5xl'>
							{user.username?.[0]?.toUpperCase() || '👤'}
						</span>
					)}
				</motion.div>

				<div className='flex-1 pb-2 w-full'>
					<div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4'>
						<div>
							<h1 className='text-3xl font-bold text-white'>{user.username}</h1>
							{!user.email?.endsWith('@telegram.bot') && (
								<p className='text-sm text-gray-400'>{user.email}</p>
							)}
							<p
								className={`text-sm capitalize mt-1 ${
									user.role === 'Admin'
										? 'text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500 font-bold'
										: 'text-gray-400'
								}`}
							>
								{user.role === 'Admin' ? 'Администратор' : 'Пользователь'}
							</p>
						</div>

						{/* Actions */}
						{isMe && (
							<motion.button
								whileHover={{ scale: 1.05 }}
								whileTap={{ scale: 0.95 }}
								onClick={() => setIsEditModalOpen(true)}
								className='rounded-xl bg-white/10 border border-white/20 px-6 py-2 text-sm font-semibold text-white hover:bg-white/20 backdrop-blur-md transition-all shadow-lg'
							>
								Редактировать
							</motion.button>
						)}

						{/* Edit Modal */}
						<AnimatePresence>
							{isEditModalOpen && (
								<motion.div
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4'
								>
									<motion.div
										initial={{ scale: 0.9, opacity: 0 }}
										animate={{ scale: 1, opacity: 1 }}
										exit={{ scale: 0.9, opacity: 0 }}
										className='w-full max-w-md space-y-6 rounded-2xl bg-gray-900/90 border border-white/10 p-8 shadow-2xl backdrop-blur-xl'
									>
										<h2 className='text-2xl font-bold text-white'>
											Редактировать профиль
										</h2>
										<div>
											<label className='mb-2 block text-sm font-medium text-gray-400'>
												Ссылка на аватар
											</label>
											<input
												type='text'
												value={avatarUrl}
												onChange={e => setAvatarUrl(e.target.value)}
												className='w-full rounded-xl border border-gray-700 bg-black/50 px-4 py-3 text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all'
												placeholder='https://...'
											/>
										</div>
										<div className='flex justify-end gap-3 pt-4'>
											<button
												onClick={() => setIsEditModalOpen(false)}
												className='rounded-xl px-4 py-2 text-sm font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-all'
											>
												Отмена
											</button>
											<button
												onClick={handleUpdateProfile}
												disabled={isUpdating}
												className='rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-2 text-sm font-semibold text-white hover:shadow-lg hover:shadow-indigo-500/25 transition-all disabled:opacity-50'
											>
												{isUpdating ? 'Сохранение...' : 'Сохранить'}
											</button>
										</div>
									</motion.div>
								</motion.div>
							)}
						</AnimatePresence>

						{!isMe && currentUser && !checkingStatus && (
							<div className='flex flex-wrap gap-3'>
								{/* Friend Button */}
								{isFriend ? (
									<motion.button
										whileHover={{ scale: 1.05 }}
										whileTap={{ scale: 0.95 }}
										onClick={handleRemoveFriend}
										disabled={loading}
										className='rounded-xl bg-red-500/10 border border-red-500/50 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50'
									>
										Удалить из друзей
									</motion.button>
								) : (
									<motion.button
										whileHover={{ scale: 1.05 }}
										whileTap={{ scale: 0.95 }}
										onClick={handleAddFriend}
										disabled={loading}
										className='rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white hover:shadow-lg hover:shadow-indigo-500/25 transition-all disabled:opacity-50'
									>
										Добавить в друзья
									</motion.button>
								)}

								{/* Subscribe Button */}
								{isSubscribed ? (
									<motion.button
										whileHover={{ scale: 1.05 }}
										whileTap={{ scale: 0.95 }}
										onClick={handleUnsubscribe}
										disabled={loading}
										className='rounded-xl bg-white/10 border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 transition-all disabled:opacity-50'
									>
										Отписаться
									</motion.button>
								) : (
									<motion.button
										whileHover={{ scale: 1.05 }}
										whileTap={{ scale: 0.95 }}
										onClick={handleSubscribe}
										disabled={loading}
										className='rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-all disabled:opacity-50'
									>
										Подписаться
									</motion.button>
								)}

								{isAdmin && (
									<>
										{isBlocked ? (
											<motion.button
												whileHover={{ scale: 1.05 }}
												whileTap={{ scale: 0.95 }}
												onClick={handleUnblock}
												disabled={loading}
												className='rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 transition-all disabled:opacity-50'
											>
												Разблокировать
											</motion.button>
										) : (
											<motion.button
												whileHover={{ scale: 1.05 }}
												whileTap={{ scale: 0.95 }}
												onClick={handleBlock}
												disabled={loading}
												className='rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 transition-all disabled:opacity-50'
											>
												Заблокировать
											</motion.button>
										)}
									</>
								)}
							</div>
						)}
					</div>

					{user.description && (
						<p className='mt-4 text-sm text-gray-300 max-w-2xl'>
							{user.description}
						</p>
					)}
				</div>
			</div>

			{/* Content Tabs */}
			<div className='rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md p-1'>
				<div className='flex'>
					<button className='flex-1 rounded-2xl bg-white/10 py-3 text-sm font-medium text-white shadow-sm transition-all'>
						Посты
					</button>
					<button className='flex-1 rounded-2xl py-3 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all'>
						Друзья
					</button>
					<button className='flex-1 rounded-2xl py-3 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all'>
						Фото
					</button>
				</div>

				<div className='min-h-[300px] flex flex-col items-center justify-center py-12 text-center text-gray-400'>
					<motion.div
						initial={{ scale: 0.8, opacity: 0 }}
						animate={{ scale: 1, opacity: 1 }}
						transition={{ delay: 0.4 }}
						className='mb-4 text-6xl opacity-50'
					>
						📭
					</motion.div>
					<p className='text-lg font-medium'>Пока нет постов</p>
					<p className='text-sm text-gray-500'>
						Здесь будут отображаться публикации пользователя
					</p>
				</div>
			</div>
		</motion.div>
	)
}
