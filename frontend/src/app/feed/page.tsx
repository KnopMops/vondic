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

	// socket_id задаёт только сервер signaling (SocketContext → connection_success).
	// Старый random UUID через /set_socket_id ломал release_socket при выходе (профиль висел «в сети»).
	const isLoading =
		!isInitialized ||
		isAuthLoading ||
		!user ||
		!isConnected ||
		!user.socket_id

	if (isLoading) {
		return <AppLoader fullScreen size='lg' />
	}

	return <SocialFeed email={user.email} onLogout={logout} mode='feed' />
}
