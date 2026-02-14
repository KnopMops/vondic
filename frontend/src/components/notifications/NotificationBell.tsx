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
	const [open, setOpen] = useState(false)

	useEffect(() => {
		if (!socket) return

		const onAny = (event: string, ...args: any[]) => {
			try {
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
			const from = data?.from_username || data?.from_name || 'Сообщение'
			const text = data?.text || ''
			add({ title: from, message: text, type: 'message' })
			showToast(`Новое сообщение от ${from}`, 'info')
		}
		const onSupport = (data: any) => {
			const t = data?.title || 'Обновление поддержки'
			const m = data?.message || ''
			add({ title: t, message: m, type: 'system' })
			showToast(t, 'info')
		}
		const onMissed = (data: any) => {
			const who = data?.from_username || 'Звонок'
			add({ title: 'Пропущенный звонок', message: who, type: 'call' })
			showToast('Пропущенный звонок', 'warning')
		}
		const onIncomingCall = (data: any) => {
			const who =
				data?.from_username ||
				data?.username ||
				data?.caller_name ||
				'Входящий звонок'
			add({ title: 'Входящий звонок', message: `${who}`, type: 'call' })
			showToast('Входящий звонок', 'info')
		}
		const onCallAccepted = (data: any) => {
			const who = data?.username || data?.responder_name || ''
			add({ title: 'Звонок принят', message: `${who}`, type: 'success' })
			showToast('Звонок принят', 'success')
		}
		const onCallRejected = (data: any) => {
			const who = data?.username || data?.responder_name || ''
			add({ title: 'Звонок отклонён', message: `${who}`, type: 'warning' })
			showToast('Звонок отклонён', 'warning')
		}
		const onCallEnded = (data: any) => {
			const who = data?.username || data?.responder_name || ''
			add({ title: 'Звонок завершён', message: `${who}`, type: 'info' })
			showToast('Звонок завершён', 'info')
		}
		const onFollowed = (data: any) => {
			const who =
				data?.username || data?.user_name || data?.user || 'Новый подписчик'
			add({ title: 'Новый подписчик', message: `${who}`, type: 'success' })
			showToast(`Новый подписчик: ${who}`, 'success')
		}
		const onSubscription = (data: any) => {
			const who = data?.username || data?.user_name || 'Подписка'
			add({ title: 'Оформлена подписка', message: `${who}`, type: 'success' })
			showToast('Оформлена подписка', 'success')
		}
		const onGift = (data: any) => {
			const from = data?.from_username || data?.from_name || 'Подарок'
			const gift = data?.gift_name || data?.gift_id || ''
			add({
				title: 'Подарок',
				message: `${from}${gift ? ` • ${gift}` : ''}`,
				type: 'info',
			})
			showToast('Получен подарок', 'info')
		}
		const onRequestCreated = (data: any) => {
			const title = data?.title || 'Новая заявка'
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
			add({ title, message: msg, type: 'warning' })
			showToast(title, 'warning')
		}
		socket.on('notification', onGeneric)
		socket.on('new_message', onMessage)
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
			socket.offAny(onAny)
			socket.off('connect', onConnect)
			socket.off('disconnect', onDisconnect)
			socket.off('notification', onGeneric)
			socket.off('new_message', onMessage)
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

	const items = useMemo(() => notifications.slice(0, 10), [notifications])

	return (
		<div className='fixed top-4 right-4 z-50'>
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
				<div className='mt-2 w-80 max-w-[80vw] bg-black/80 backdrop-blur rounded-lg border border-white/10 shadow-xl p-2'>
					{items.length === 0 && (
						<div className='text-sm text-gray-300 px-2 py-3'>
							Нет уведомлений
						</div>
					)}
					{items.map(n => (
						<div
							key={n.id}
							className='px-3 py-2 rounded hover:bg-white/5 transition'
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
			)}
		</div>
	)
}

export default NotificationBell
