'use client'

import SocialFeed from '@/components/social/SocialFeed'
import { useAuth } from '@/lib/AuthContext'
import { setSocketId } from '@/lib/features/authSlice'
import { useAppDispatch } from '@/lib/hooks'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function BlogPage() {
	const { user, logout, isLoading: isAuthLoading, isInitialized } = useAuth()
	const dispatch = useAppDispatch()
	const router = useRouter()
	const [isSocketLoading, setIsSocketLoading] = useState(false)

	useEffect(() => {
		if (isInitialized && !isAuthLoading && !user) {
			router.push('/')
		}
	}, [user, isAuthLoading, isInitialized, router])

	useEffect(() => {
		if (user && !user.socket_id && !isSocketLoading) {
			const fetchSocketId = async () => {
				setIsSocketLoading(true)
				try {
					const socketId = crypto.randomUUID()
					const res = await fetch(`/api/webrtc/set_socket_id`, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							socket_id: socketId,
							user_id: user.id,
						}),
					})
					if (res.ok) {
						dispatch(setSocketId(socketId))
						if (user) {
							const updatedUser = { ...user, socket_id: socketId }
							localStorage.setItem('user', JSON.stringify(updatedUser))
						}
					}
				} catch (e) {
					console.error('Failed to fetch socket_id', e)
				} finally {
					setIsSocketLoading(false)
				}
			}
			fetchSocketId()
		}
	}, [user, dispatch, isSocketLoading])

	const isLoading =
		!isInitialized || isAuthLoading || (!!user && !user.socket_id) || !user

	if (isLoading) {
		return (
			<div className='flex min-h-screen items-center justify-center bg-black'>
				<div className='h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent'></div>
			</div>
		)
	}

	return <SocialFeed email={user.email} onLogout={logout} mode='blog' />
}
