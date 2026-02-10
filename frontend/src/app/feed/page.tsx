'use client'

import SocialFeed from '@/components/social/SocialFeed'
import { useAuth } from '@/lib/AuthContext'
import { setSocketId } from '@/lib/features/authSlice'
import { useAppDispatch } from '@/lib/hooks'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function FeedPage() {
	const { user, logout, isLoading: isAuthLoading } = useAuth()
	const dispatch = useAppDispatch()
	const router = useRouter()
	const [isSocketLoading, setIsSocketLoading] = useState(false)

	useEffect(() => {
		if (!isAuthLoading && !user) {
			router.push('/')
		}
	}, [user, isAuthLoading, router])

	useEffect(() => {
		if (user && !user.socket_id && !isSocketLoading) {
			const fetchSocketId = async () => {
				setIsSocketLoading(true)
				try {
					const webrtcUrl = process.env.NEXT_PUBLIC_WEBRTC_URL
					if (webrtcUrl) {
						const socketId = crypto.randomUUID()
						const res = await fetch(`${webrtcUrl}/set_socket_id`, {
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
							// Don't overwrite the whole user object with the response from WebRTC server
							// as it might be incomplete (missing username, etc.)
							dispatch(setSocketId(socketId))

							// Update localStorage to persist the socket_id
							if (user) {
								const updatedUser = { ...user, socket_id: socketId }
								localStorage.setItem('user', JSON.stringify(updatedUser))
							}
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

	// Блокируем отображение, пока загружается авторизация или (если пользователь есть) пока нет socket_id
	// Также блокируем, если нет пользователя (ждем редиректа)
	const isLoading = isAuthLoading || (!!user && !user.socket_id) || !user

	if (isLoading) {
		return (
			<div className='flex min-h-screen items-center justify-center bg-black'>
				<div className='h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent'></div>
			</div>
		)
	}

	return <SocialFeed email={user.email} onLogout={logout} />
}
