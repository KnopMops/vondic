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
				router.replace(`/feed/profile/${user.id}`)
			} else {
				router.push('/login')
			}
		}
	}, [user, isLoading, router])

	return <AppLoader fullScreen size='lg' />
}
