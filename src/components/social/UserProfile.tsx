'use client'

import { User } from '@/lib/types'
import { useState } from 'react'

type Props = {
	user: User
	currentUser: User | null
}

export default function UserProfile({ user, currentUser }: Props) {
	const [isFriend, setIsFriend] = useState(false) // Ideal would be to check status
	const [isBlocked, setIsBlocked] = useState(user.status === 'blocked')
	const [loading, setLoading] = useState(false)

	const isMe = currentUser?.id === user.id
	const isAdmin = currentUser?.role === 'Admin'

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
			setIsFriend(true)
		} catch (error) {
			console.error(error)
			alert('Ошибка при отправке заявки')
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
						{!isMe && currentUser && (
							<div className='flex gap-2'>
								<button
									onClick={handleAddFriend}
									disabled={loading || isFriend}
									className='rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50'
								>
									{isFriend ? 'Заявка отправлена' : 'Добавить в друзья'}
								</button>

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
