'use client'

import { useAuth } from '@/lib/AuthContext'
import { useEffect, useRef } from 'react'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

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
		if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

		const register = async () => {
			try {
				const permission = await Notification.requestPermission()
				if (permission !== 'granted') return

				const reg = await navigator.serviceWorker.register('/sw.js')
				await navigator.serviceWorker.ready

				const subscription = await reg.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
				})

				const sub = subscription.toJSON()
				await fetch('/api/push/subscribe', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						subscription: {
							endpoint: sub.endpoint,
							keys: sub.keys,
						},
						user_id: user.id,
						platform: /iPhone|iPad|iPod/.test(navigator.userAgent) ? 'ios_pwa' : 'web',
					}),
				})

				registeredRef.current = true
			} catch (err) {
				console.error('Push registration error:', err)
			}
		}

		register()
	}, [user?.id])

	return null
}
