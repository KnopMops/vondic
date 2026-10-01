'use client'

import AppLoader from '@/components/ui/AppLoader'
import { useAuth } from '@/lib/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function ProfilePage() {
	const { user, isLoading } = useAuth()
	const router = useRouter()

	useEffect(() => {
		if (!isLoading) {
			if (user) {
				const rawId = (user as any)?.id || (user as any)?._id || (user as any)?.user_id
				const idStr = typeof rawId === 'string' || typeof rawId === 'number' ? String(rawId).trim() : ''
				if (idStr && !idStr.includes('[object')) {
					router.replace(`/feed/profile/${encodeURIComponent(idStr)}`)
				} else {
					router.replace('/feed')
				}
			} else {
				router.push('/login')
			}
		}
	}, [user, isLoading, router])

	return <AppLoader fullScreen size='lg' />
}
