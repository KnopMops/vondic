import { create } from 'zustand'

export type NotificationType =
	| 'info'
	| 'success'
	| 'warning'
	| 'error'
	| 'message'
	| 'call'
	| 'system'

export interface NotificationItem {
	id: string
	title: string
	message: string
	type: NotificationType
	createdAt: number
	read: boolean
}

interface NotificationStore {
	notifications: NotificationItem[]
	unreadCount: number
	add: (n: Omit<NotificationItem, 'id' | 'createdAt' | 'read'>) => void
	markAllRead: () => void
	clear: () => void
}

export const useNotificationStore = create<NotificationStore>(set => ({
	notifications: [],
	unreadCount: 0,
	add: n =>
		set(state => {
			const item: NotificationItem = {
				id: Math.random().toString(36).slice(2),
				title: n.title,
				message: n.message,
				type: n.type,
				createdAt: Date.now(),
				read: false,
			}
			const list = [item, ...state.notifications].slice(0, 100)
			const unread = list.filter(x => !x.read).length
			return { notifications: list, unreadCount: unread }
		}),
	markAllRead: () =>
		set(state => {
			const list = state.notifications.map(x => ({ ...x, read: true }))
			return { notifications: list, unreadCount: 0 }
		}),
	clear: () => set({ notifications: [], unreadCount: 0 }),
}))
