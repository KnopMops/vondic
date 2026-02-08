'use client'

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

	return (
		<div className='flex min-h-screen items-center justify-center bg-gray-900'>
			<div className='h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent'></div>
		</div>
	)
}
