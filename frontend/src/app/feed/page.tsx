'use client'

import AppLoader from '@/components/ui/AppLoader'
import SocialFeed from '@/components/social/SocialFeed'
import { useAuth } from '@/lib/AuthContext'
import { useSocket } from '@/lib/SocketContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function FeedPage() {
	const { user, logout, isLoading: isAuthLoading, isInitialized } = useAuth()
	const { isConnected } = useSocket()
	const router = useRouter()

	useEffect(() => {
		if (isInitialized && !isAuthLoading && !user) {
			router.push('/')
		}
	}, [user, isAuthLoading, isInitialized, router])

	const isLoading = !isInitialized || isAuthLoading || !user

	if (isLoading) {
		return <AppLoader fullScreen size='lg' />
	}


	return <SocialFeed email={user.email} onLogout={logout} mode='feed' />
}
