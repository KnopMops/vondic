'use client'

import { useState, useEffect, useCallback } from 'react'

export type PermissionKind = 'camera' | 'microphone' | 'notifications'

interface PermissionState {
	camera: PermissionState['status']
	microphone: PermissionState['status']
	notifications: PermissionState['status']
}

type Status = 'granted' | 'denied' | 'prompt' | 'unknown'

export function useBrowserPermissions() {
	const [permissions, setPermissions] = useState<Record<PermissionKind, Status>>({
		camera: 'unknown',
		microphone: 'unknown',
		notifications: 'unknown',
	})

	const checkPermissions = useCallback(async () => {
		if (typeof navigator === 'undefined' || !navigator.permissions) return

		const results: Record<PermissionKind, Status> = {
			camera: 'unknown',
			microphone: 'unknown',
			notifications: 'unknown',
		}

		try {
			const cam = await navigator.permissions.query({ name: 'camera' as PermissionName })
			results.camera = cam.state as Status
		} catch { /* not supported */ }

		try {
			const mic = await navigator.permissions.query({ name: 'microphone' as PermissionName })
			results.microphone = mic.state as Status
		} catch { /* not supported */ }

		try {
			const notif = await navigator.permissions.query({ name: 'notifications' as PermissionName })
			results.notifications = notif.state as Status
		} catch { /* not supported */ }

		setPermissions(results)
	}, [])

	useEffect(() => {
		checkPermissions()
	}, [checkPermissions])

	const requestCameraAndMic = useCallback(async (): Promise<boolean> => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
			stream.getTracks().forEach(t => t.stop())
			setPermissions(p => ({ ...p, camera: 'granted', microphone: 'granted' }))
			return true
		} catch {
			setPermissions(p => ({ ...p, camera: 'denied', microphone: 'denied' }))
			return false
		}
	}, [])

	const requestMicOnly = useCallback(async (): Promise<boolean> => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
			stream.getTracks().forEach(t => t.stop())
			setPermissions(p => ({ ...p, microphone: 'granted' }))
			return true
		} catch {
			setPermissions(p => ({ ...p, microphone: 'denied' }))
			return false
		}
	}, [])

	const requestNotifications = useCallback(async (): Promise<boolean> => {
		try {
			const result = await Notification.requestPermission()
			const granted = result === 'granted'
			setPermissions(p => ({ ...p, notifications: granted ? 'granted' : 'denied' }))
			return granted
		} catch {
			return false
		}
	}, [])

	return {
		permissions,
		checkPermissions,
		requestCameraAndMic,
		requestMicOnly,
		requestNotifications,
	}
}
