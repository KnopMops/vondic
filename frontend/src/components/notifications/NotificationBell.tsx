'use client'

import { useSocket } from '@/lib/SocketContext'
import { useNotificationStore } from '@/lib/stores/notificationStore'
import { useToast } from '@/lib/ToastContext'
import React, { useEffect, useMemo, useState } from 'react'

export const NotificationBell: React.FC = () => {
	const { notifications, unreadCount, add, markAllRead } =
		useNotificationStore()
	const { socket } = useSocket()
	const { showToast } = useToast()
	const [polling, setPolling] = useState(false)
	const escSeenRef = React.useRef<Set<string>>(new Set())
	const userCacheRef = React.useRef<Map<string, string>>(new Map())
	const audioRef = React.useRef<HTMLAudioElement | null>(null)
	const [open, setOpen] = useState(false)
	
	// Check if user is admin
	const [isAdmin, setIsAdmin] = useState(false)
	useEffect(() => {
		const userData = localStorage.getItem('user_data')
		if (userData) {
			try {
				const user = JSON.parse(userData)
				setIsAdmin(user?.role === 'Admin' || user?.role === 'admin')
			} catch {}
		}
	}, [])

	useEffect(() => {
		const backendUrl =
			process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'
		const audioUrl = `${backendUrl}/static/message.mp3`
		audioRef.current = new Audio(audioUrl)
		audioRef.current.preload = 'auto'
		audioRef.current.load()
		return () => {
			audioRef.current = null
		}
	}, [])

	useEffect(() => {
		if (!socket) return
		let active = true
		const playNotificationSound = () => {
			const audio = audioRef.current
			if (!audio) return
			audio.currentTime = 0
			audio.play().catch(() => {})
		}

		const resolveUsername = async (userId?: string) => {
			if (!userId) return 'Пользователь'
			const cached = userCacheRef.current.get(userId)
			if (cached) return cached
			try {
				const res = await fetch(`/api/users/${userId}`)
				if (res.ok) {
					const data = await res.json()
					const user = data?.user || data
					const username = user?.username || `Пользователь ${userId}`
					userCacheRef.current.set(userId, username)
					return username
				}
			} catch {}
			const fallback = `Пользователь ${userId}`
			userCacheRef.current.set(userId, fallback)
			return fallback
		}

		const getActiveChat = () => {
			if (typeof window === 'undefined') return null
			try {
				const raw = localStorage.getItem('active_chat')
				if (!raw) return null
				const parsed = JSON.parse(raw)
				if (!parsed?.id || !parsed?.kind) return null
				return parsed as { id: string; kind: 'dm' | 'group' | 'channel' }
			} catch {
				return null
			}
		}

		const isActiveDm = (senderId?: string) => {
			if (!senderId) return false
			const activeChat = getActiveChat()
			if (!activeChat || activeChat.kind !== 'dm') return false
			return String(activeChat.id) === String(senderId)
		}

		const onAny = (event: string, ...args: any[]) => {
			try {
				if (event === 'error') {
					const message = args?.[0]?.message
					if (
						typeof message === 'string' &&
						/attachments must be a list/i.test(message)
					) {
						return
					}
				}
				console.log('[Notifications] Event:', event, args[0])
			} catch {}
		}
		socket.onAny(onAny)

		const onConnect = () =>
			showToast('Соединение с уведомлениями установлено', 'success')
		const onDisconnect = () =>
			showToast('Соединение с уведомлениями потеряно', 'warning')

		socket.on('connect', onConnect)
		socket.on('disconnect', onDisconnect)

		const onGeneric = (data: any) => {
			const title = data?.title || 'Уведомление'
			const message = data?.message || ''
			const type = (data?.type || 'info') as any
			playNotificationSound()
			add({ title, message, type })
			const toastType =
				type === 'success' ||
				type === 'error' ||
				type === 'warning' ||
				type === 'info'
					? type
					: 'info'
			showToast(message || title, toastType)
		}
		const onMessage = (data: any) => {
			const senderId =
				data?.sender_id || data?.from_user_id || data?.from_id || data?.user_id
			if (isActiveDm(senderId)) return
			const from = data?.from_username || data?.from_name || 'Сообщение'
			const text = data?.text || ''
			playNotificationSound()
			add({ title: from, message: text, type: 'message' })
			showToast(`Новое сообщение от ${from}`, 'info')
		}
		const onReceiveMessage = (data: any) => {
			const senderId = data?.sender_id
			if (isActiveDm(senderId)) return
			resolveUsername(senderId).then(username => {
				if (!active) return
				playNotificationSound()
				add({
					title: 'Вам отправили сообщение',
					message: username,
					type: 'message',
				})
				showToast(`Вам отправили сообщение от ${username}`, 'info')
			})
		}
		const onSupport = (data: any) => {
			const t = data?.title || 'Обновление поддержки'
			const m = data?.message || ''
			playNotificationSound()
			add({ title: t, message: m, type: 'system' })
			showToast(t, 'info')
		}
		const onMissed = (data: any) => {
			const who = data?.from_username || 'Звонок'
			playNotificationSound()
			add({ title: 'Пропущенный звонок', message: who, type: 'call' })
			showToast('Пропущенный звонок', 'warning')
		}
		const onIncomingCall = (data: any) => {
			const who =
				data?.from_username ||
				data?.username ||
				data?.caller_name ||
				'Входящий звонок'
			playNotificationSound()
			add({ title: 'Входящий звонок', message: `${who}`, type: 'call' })
			showToast('Входящий звонок', 'info')
		}
		const onCallAccepted = (data: any) => {
			const who = data?.username || data?.responder_name || ''
			playNotificationSound()
			add({ title: 'Звонок принят', message: `${who}`, type: 'success' })
			showToast('Звонок принят', 'success')
		}
		const onCallRejected = (data: any) => {
			const who = data?.username || data?.responder_name || ''
			playNotificationSound()
			add({ title: 'Звонок отклонён', message: `${who}`, type: 'warning' })
			showToast('Звонок отклонён', 'warning')
		}
		const onCallEnded = (data: any) => {
			const who = data?.username || data?.responder_name || ''
			playNotificationSound()
			add({ title: 'Звонок завершён', message: `${who}`, type: 'info' })
			showToast('Звонок завершён', 'info')
		}
		const onFollowed = (data: any) => {
			const who =
				data?.username || data?.user_name || data?.user || 'Новый подписчик'
			playNotificationSound()
			add({ title: 'Новый подписчик', message: `${who}`, type: 'success' })
			showToast(`Новый подписчик: ${who}`, 'success')
		}
		const onSubscription = (data: any) => {
			const who = data?.username || data?.user_name || 'Подписка'
			playNotificationSound()
			add({ title: 'Оформлена подписка', message: `${who}`, type: 'success' })
			showToast('Оформлена подписка', 'success')
		}
		const onGift = (data: any) => {
			const from = data?.from_username || data?.from_name || 'Подарок'
			const gift = data?.gift_name || data?.gift_id || ''
			playNotificationSound()
			add({
				title: 'Подарок',
				message: `${from}${gift ? ` • ${gift}` : ''}`,
				type: 'info',
			})
			showToast('Получен подарок', 'info')
		}
		const onRequestCreated = (data: any) => {
			const title = data?.title || 'Новая заявка'
			playNotificationSound()
			add({ title, message: data?.message || '', type: 'system' })
			showToast(title, 'info')
		}
		const onRequestStatus = (data: any) => {
			const status = (data?.status || '').toLowerCase()
			const title =
				status === 'approved' || status === 'accepted'
					? 'Заявка одобрена'
					: status === 'rejected'
						? 'Заявка отклонена'
						: 'Статус заявки обновлён'
			playNotificationSound()
			add({
				title,
				message: data?.message || '',
				type: status === 'rejected' ? 'warning' : 'success',
			})
			showToast(title, status === 'rejected' ? 'warning' : 'success')
		}
		const onConfirmation = (data: any) => {
			const title = 'Требуется подтверждение'
			const msg = data?.message || ''
			playNotificationSound()
			add({ title, message: msg, type: 'warning' })
			showToast(title, 'warning')
		}
		socket.on('notification', onGeneric)
		socket.on('new_message', onMessage)
		socket.on('receive_message', onReceiveMessage)
		socket.on('support_update', onSupport)
		socket.on('call_missed', onMissed)
		socket.on('incoming_call', onIncomingCall)
		socket.on('call_accepted', onCallAccepted)
		socket.on('call_rejected', onCallRejected)
		socket.on('call_ended', onCallEnded)
		socket.on('user_followed', onFollowed)
		socket.on('subscription_started', onSubscription)
		socket.on('subscription_created', onSubscription)
		socket.on('subscribed', onSubscription)
		socket.on('gift_received', onGift)
		socket.on('gift', onGift)
		socket.on('gift_sent', onGift)
		socket.on('request_created', onRequestCreated)
		socket.on('new_request', onRequestCreated)
		socket.on('request_status_changed', onRequestStatus)
		socket.on('request_updated', onRequestStatus)
		socket.on('request_status', onRequestStatus)
		socket.on('confirmation_required', onConfirmation)
		socket.on('verify_required', onConfirmation)

		return () => {
			active = false
			socket.offAny(onAny)
			socket.off('connect', onConnect)
			socket.off('disconnect', onDisconnect)
			socket.off('notification', onGeneric)
			socket.off('new_message', onMessage)
			socket.off('receive_message', onReceiveMessage)
			socket.off('support_update', onSupport)
			socket.off('call_missed', onMissed)
			socket.off('incoming_call', onIncomingCall)
			socket.off('call_accepted', onCallAccepted)
			socket.off('call_rejected', onCallRejected)
			socket.off('call_ended', onCallEnded)
			socket.off('user_followed', onFollowed)
			socket.off('subscription_started', onSubscription)
			socket.off('subscription_created', onSubscription)
			socket.off('subscribed', onSubscription)
			socket.off('gift_received', onGift)
			socket.off('gift', onGift)
			socket.off('gift_sent', onGift)
			socket.off('request_created', onRequestCreated)
			socket.off('new_request', onRequestCreated)
			socket.off('request_status_changed', onRequestStatus)
			socket.off('request_updated', onRequestStatus)
			socket.off('request_status', onRequestStatus)
			socket.off('confirmation_required', onConfirmation)
			socket.off('verify_required', onConfirmation)
		}
	}, [socket, add, showToast])

	useEffect(() => {
		let timer: any
		const poll = async () => {
			// Only poll for admin users
			if (!isAdmin) return
			
			try {
				setPolling(true)
				const res = await fetch('/api/support/admin/escalations')
				if (res.ok) {
					const data = await res.json()
					const list: any[] = Array.isArray(data) ? data : data?.items || []
					const currentIds = new Set<string>()
					for (const item of list) {
						const id = String(
							item?.id ?? item?.escalation_id ?? item?.uuid ?? '',
						)
						if (!id) continue
						currentIds.add(id)
						if (!escSeenRef.current.has(id)) {
							escSeenRef.current.add(id)
							const title = item?.title || 'Новая заявка'
							const who =
								item?.user_name || item?.username || item?.from_user || ''
							const msg = who ? `${who}` : ''
							if (audioRef.current) {
								audioRef.current.currentTime = 0
								audioRef.current.play().catch(() => {})
							}
							add({ title, message: msg, type: 'system' })
							showToast(title, 'info')
						}
					}
					for (const oldId of Array.from(escSeenRef.current)) {
						if (!currentIds.has(oldId)) {
							escSeenRef.current.delete(oldId)
						}
					}
				}
			} catch {
			} finally {
				setPolling(false)
			}
		}
		poll()
		timer = setInterval(poll, 15000)
		return () => {
			if (timer) clearInterval(timer)
		}
	}, [add, showToast])

	useEffect(() => {
		let timer: any
		const poll = async () => {
			try {
				const res = await fetch('/api/support/notifications/updates')
				const text = await res.text()
				let data: any = {}
				try {
					data = JSON.parse(text)
				} catch {
					return
				}
				const list: any[] = Array.isArray(data)
					? data
					: data?.notifications || []
				if (!Array.isArray(list) || list.length === 0) return
				for (const item of list) {
					const message = item?.message || ''
					const title = item?.title || 'Уведомление'
					const type = (item?.type || 'system') as any
					if (!message && !title) continue
					if (audioRef.current) {
						audioRef.current.currentTime = 0
						audioRef.current.play().catch(() => {})
					}
					add({ title, message, type })
					showToast(message || title, type === 'blog' ? 'info' : 'info')
				}
			} catch {}
		}
		poll()
		timer = setInterval(poll, 15000)
		return () => {
			if (timer) clearInterval(timer)
		}
	}, [add, showToast])

	const items = useMemo(() => notifications.slice(0, 10), [notifications])

	return (
		<div className='fixed bottom-4 left-4 z-50'>
			<button
				onClick={() => {
					setOpen(o => !o)
					markAllRead()
				}}
				className='relative rounded-full bg-white/10 text-white px-3 py-2 hover:bg-white/20 transition'
			>
				<span>🔔</span>
				{unreadCount > 0 && (
					<span className='absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full px-1'>
						{unreadCount}
					</span>
				)}
			</button>
			{open && (
				<div
					className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4'
					onClick={() => setOpen(false)}
				>
					<div
						className='w-full max-w-md bg-black/80 backdrop-blur rounded-lg border border-white/10 shadow-xl p-2'
						onClick={e => e.stopPropagation()}
					>
						{items.length === 0 && (
							<div className='text-sm text-gray-300 px-2 py-3'>
								Нет уведомлений
							</div>
						)}
						{items.map(n => (
							<div
								key={n.id}
								className={`px-3 py-2 rounded transition ${
									n.type === 'blog'
										? 'bg-amber-400/20 hover:bg-amber-400/30'
										: 'hover:bg-white/5'
								}`}
							>
								<div className='text-sm font-medium text-white'>{n.title}</div>
								{n.message && (
									<div className='text-xs text-gray-300'>{n.message}</div>
								)}
								<div className='text-[10px] text-gray-500'>
									{new Date(n.createdAt).toLocaleTimeString()}
								</div>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	)
}

export default NotificationBell
