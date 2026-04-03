'use client'

import { Heart, MessageCircle, Share2, MoreHorizontal, Send, Image, Video, File, Download, Upload, Calendar, Clock, Star, Lock, Unlock, Eye, EyeOff, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ArrowLeft, ArrowRight, MoreVertical, Bell, Search, Home, User, Settings, Menu, X, Check, Plus, Trash2, Edit2 } from 'lucide-react';
import { useSocket } from '@/lib/SocketContext'
import { User } from '@/lib/types'
import { getAttachmentUrl, getAvatarUrl } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface ShareModalProps {
	isOpen: boolean
	onClose: () => void
	post: {
		id: string | number
		author: string
		author_avatar?: string | null
		text: string
		image?: string
		isBlog?: boolean
	}
}

export default function ShareModal({ isOpen, onClose, post }: ShareModalProps) {
	const { socket, isConnected } = useSocket()
	const [friends, setFriends] = useState<User[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [sendingTo, setSendingTo] = useState<Set<string>>(new Set())
	const [sentTo, setSentTo] = useState<Set<string>>(new Set())
	const [mounted, setMounted] = useState(false)

	useEffect(() => {
		if (isOpen) {
			fetchFriends()
		}
	}, [isOpen])
	useEffect(() => {
		setMounted(true)
	}, [])

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

		
		socket.emit('send_message', {
			target_user_id: friend.id,
			content: messageContent,
			attachments: [],
		})

		
		
		

		setTimeout(() => {
			setSendingTo(prev => {
				const newSet = new Set(prev)
				newSet.delete(friend.id)
				return newSet
			})
			setSentTo(prev => new Set(prev).add(friend.id))
		}, 500)
	}

	if (!isOpen || !mounted) return null

	return createPortal(
		<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4'>
			<div className='flex h-[60vh] w-full max-w-md flex-col rounded-lg border border-white/10 bg-black/80 backdrop-blur shadow-xl'>
				<div className='flex items-center justify-between border-b border-white/10 px-4 py-3'>
					<h3 className='text-lg font-semibold text-white'>
						{post.isBlog ? 'Переслать пост' : 'Поделиться'}
					</h3>
					<button
						onClick={onClose}
						className='rounded-full p-1 text-gray-300 hover:bg-white/10 hover:text-white'
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

				{post.isBlog && (
					<div className='px-4 py-2 bg-amber-900/20 border-b border-amber-500/20'>
						<p className='text-xs text-amber-400'>
							📝 Это пост из блога разработчика. Его можно только переслать друзьям.
						</p>
					</div>
				)}

				<div className='flex-1 overflow-y-auto px-4 py-3'>
					{isLoading ? (
						<div className='flex h-full items-center justify-center text-gray-300'>
							Загрузка...
						</div>
					) : friends.length === 0 ? (
						<div className='flex h-full items-center justify-center text-gray-300'>
							У вас пока нет друзей
						</div>
					) : (
						<div className='space-y-3'>
							{friends.map(friend => (
								<div
									key={friend.id}
									className='flex items-center justify-between rounded-lg p-2 hover:bg-white/5'
								>
									<div className='flex items-center gap-3'>
										<img
											src={getAvatarUrl(friend.avatar_url)}
											alt={friend.username}
											className='h-10 w-10 rounded-full object-cover'
										/>
										<div className='flex flex-col'>
											<span className='font-medium text-white'>
												{friend.username}
											</span>
											<span className='text-xs text-gray-400'>
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
												? 'bg-green-900/30 text-green-300'
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
		</div>,
		document.body,
	)
}
