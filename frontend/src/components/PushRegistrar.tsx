'use client'

import { useAuth } from '@/lib/AuthContext'
import { useEffect, useRef } from 'react'

const VAPID_PUBLIC_KEY =
	process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
	'BEl62iUYgUivxIkv69yViEuiBIa45bWf6pL-61M_7x7B4_mNq5H7Z3l2-w0Q6U0dK5m7pL-61M_7x7B'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
	const rawData = window.atob(base64)
	const outputArray = new Uint8Array(rawData.length)
	for (let i = 0; i < rawData.length; ++i) {
		outputArray[i] = rawData.charCodeAt(i)
	}
	return outputArray
}

export default function PushRegistrar() {
	const { user } = useAuth()
	const registeredRef = useRef(false)

	useEffect(() => {
		if (!user || registeredRef.current) return
		if (typeof window === 'undefined') return
		if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

		const register = async () => {
			try {
				const reg = await navigator.serviceWorker.register('/sw.js')
				await navigator.serviceWorker.ready

				if (Notification.permission === 'denied') return
				if (Notification.permission === 'default') {
					const perm = await Notification.requestPermission()
					if (perm !== 'granted') return
				}

				let subscription = await reg.pushManager.getSubscription()
				if (!subscription) {
					subscription = await reg.pushManager.subscribe({
						userVisibleOnly: true,
						applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
					})
				}

				const sub = subscription.toJSON()
				const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent)

				await fetch('/api/push/subscribe', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						subscription: {
							endpoint: sub.endpoint,
							keys: sub.keys,
						},
						user_id: user.id,
						platform: isIOS ? 'ios_pwa' : 'web_pwa',
					}),
				})

				registeredRef.current = true
			} catch (err) {
				console.warn('PWA Push registration skipped or not supported:', err)
			}
		}

		register()
	}, [user?.id])

	return null
}
