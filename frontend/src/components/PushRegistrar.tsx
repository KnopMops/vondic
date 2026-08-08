'use client'

import { useAuth } from '@/lib/AuthContext'
import { useEffect, useRef } from 'react'

const DEFAULT_VAPID_PUBLIC_KEY =
	'BIe-Z2GMAZp05xBkGysdmolFc7jczvXIQJcGDVfkWkyY-P1XJnJoTcyOzW00-z6AvlleA7wxFXa8B-f_RHI5pBk'

const VAPID_PUBLIC_KEY =
	process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY

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
		if (!user) return
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

				const targetKeyArray = urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
				let subscription = await reg.pushManager.getSubscription()

				if (subscription) {
					// Check key match
					const existingKey = subscription.options.applicationServerKey
					let keyMismatch = false
					if (existingKey) {
						const existingArray = new Uint8Array(existingKey)
						if (
							existingArray.length !== targetKeyArray.length ||
							!existingArray.every((val, idx) => val === targetKeyArray[idx])
						) {
							keyMismatch = true
						}
					} else {
						keyMismatch = true
					}

					if (keyMismatch) {
						await subscription.unsubscribe()
						subscription = null
					}
				}

				if (!subscription) {
					subscription = await reg.pushManager.subscribe({
						userVisibleOnly: true,
						applicationServerKey: targetKeyArray,
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

		const handleFocus = () => {
			if (!registeredRef.current) {
				register()
			}
		}

		window.addEventListener('focus', handleFocus)
		return () => window.removeEventListener('focus', handleFocus)
	}, [user?.id])

	return null
}

