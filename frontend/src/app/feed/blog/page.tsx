'use client'

import AppLoader from '@/components/ui/AppLoader'
import SocialFeed from '@/components/social/SocialFeed'
import { useAuth } from '@/lib/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function BlogPage() {
	const { user, logout, isLoading: isAuthLoading, isInitialized } = useAuth()
	const router = useRouter()

	useEffect(() => {
		if (isInitialized && !isAuthLoading && !user) {
			router.push('/')
		}
	}, [user, isAuthLoading, isInitialized, router])

	if (!isInitialized || isAuthLoading || !user) {
		return <AppLoader fullScreen size='lg' />
	}

	return <SocialFeed email={user.email} onLogout={logout} mode='blog' />
}
