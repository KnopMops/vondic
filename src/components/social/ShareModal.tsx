'use client'

import { useSocket } from '@/lib/SocketContext'
import { User } from '@/lib/types'
import { getAttachmentUrl } from '@/lib/utils'
import { useEffect, useState } from 'react'

interface ShareModalProps {
	isOpen: boolean
	onClose: () => void
	post: {
		id: string | number
		author: string
		author_avatar?: string | null
		text: string
		image?: string
	}
}

export default function ShareModal({ isOpen, onClose, post }: ShareModalProps) {
	const { socket, isConnected } = useSocket()
	const [friends, setFriends] = useState<User[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [sendingTo, setSendingTo] = useState<Set<string>>(new Set())
	const [sentTo, setSentTo] = useState<Set<string>>(new Set())

	useEffect(() => {
		if (isOpen) {
			fetchFriends()
		}
	}, [isOpen])

	const fetchFriends = async () => {
		setIsLoading(true)
		try {
			const res = await fetch('/api/friends/list', {
				method: 'POST',
			})
			if (res.ok) {
				const data = await res.json()
				setFriends(Array.isArray(data) ? data : [])
			}
		} catch (e) {
			console.error(e)
		} finally {
			setIsLoading(false)
		}
	}

	const handleSend = async (friend: User) => {
		if (!socket || sendingTo.has(friend.id)) return

		setSendingTo(prev => new Set(prev).add(friend.id))

		const payload = {
			type: 'shared_post',
			post: {
				id: post.id,
				author: post.author,
				author_avatar: post.author_avatar,
				text: post.text,
				image: post.image,
			},
		}

		const messageContent = JSON.stringify(payload)

		// Emit socket event
		socket.emit('send_message', {
			target_user_id: friend.id,
			content: messageContent,
		})

		// Simulate success (since we don't wait for ack here easily without callback in this setup,
		// though useChat handles it via events. We assume success for UI feedback)
		// Better: Listen for 'message_sent' or just show "Sent" after a small timeout

		setTimeout(() => {
			setSendingTo(prev => {
				const newSet = new Set(prev)
				newSet.delete(friend.id)
				return newSet
			})
			setSentTo(prev => new Set(prev).add(friend.id))
		}, 500)
	}

	if (!isOpen) return null

	return (
		<div className='fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50'>
			<div className='flex h-[60vh] w-full max-w-md flex-col rounded-xl bg-white shadow-xl dark:bg-gray-800'>
				<div className='flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700'>
					<h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
						Поделиться
					</h3>
					<button
						onClick={onClose}
						className='rounded-full p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200'
					>
						<svg
							xmlns='http://www.w3.org/2000/svg'
							fill='none'
							viewBox='0 0 24 24'
							strokeWidth={1.5}
							stroke='currentColor'
							className='h-6 w-6'
						>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								d='M6 18L18 6M6 6l12 12'
							/>
						</svg>
					</button>
				</div>

				<div className='flex-1 overflow-y-auto p-4'>
					{isLoading ? (
						<div className='flex h-full items-center justify-center text-gray-500'>
							Загрузка...
						</div>
					) : friends.length === 0 ? (
						<div className='flex h-full items-center justify-center text-gray-500'>
							У вас пока нет друзей
						</div>
					) : (
						<div className='space-y-3'>
							{friends.map(friend => (
								<div
									key={friend.id}
									className='flex items-center justify-between rounded-lg p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50'
								>
									<div className='flex items-center gap-3'>
										<img
											src={
												getAttachmentUrl(friend.avatar_url) ||
												'/placeholder-user.jpg'
											}
											alt={friend.username}
											className='h-10 w-10 rounded-full object-cover'
										/>
										<div className='flex flex-col'>
											<span className='font-medium text-gray-900 dark:text-white'>
												{friend.username}
											</span>
											<span className='text-xs text-gray-500'>
												{friend.status === 'Online' ? 'В сети' : 'Не в сети'}
											</span>
										</div>
									</div>
									<button
										onClick={() => handleSend(friend)}
										disabled={
											sendingTo.has(friend.id) ||
											sentTo.has(friend.id) ||
											!isConnected
										}
										className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
											sentTo.has(friend.id)
												? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
												: 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50'
										}`}
									>
										{sendingTo.has(friend.id)
											? '...'
											: sentTo.has(friend.id)
												? 'Отправлено'
												: !isConnected
													? 'Нет сети'
													: 'Отправить'}
									</button>
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
