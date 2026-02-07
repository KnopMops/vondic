'use client'

import SocialFeed from '@/components/social/SocialFeed'
import { useAuth } from '@/lib/AuthContext'
import { setUser } from '@/lib/features/authSlice'
import { useAppDispatch } from '@/lib/hooks'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function FeedPage() {
	const { user, logout, isLoading: isAuthLoading } = useAuth()
	const dispatch = useAppDispatch()
	const [isSocketLoading, setIsSocketLoading] = useState(false)

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
							const updatedUser = await res.json()
							dispatch(setUser(updatedUser))
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

	// Блокируем отображение, пока загружается авторизация или (если пользователь есть) пока нет socket_id
	const isLoading = isAuthLoading || (!!user && !user.socket_id)

	if (isLoading) {
		return (
			<div className='flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900'>
				<div className='h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent'></div>
			</div>
		)
	}

	if (user) {
		return <SocialFeed email={user.email} onLogout={logout} />
	}

	return (
		<div className='flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4 dark:bg-gray-900'>
			<main className='flex w-full max-w-3xl flex-col items-center justify-center space-y-8 text-center'>
				<h1 className='text-5xl font-extrabold tracking-tight text-gray-900 sm:text-6xl dark:text-white'>
					Welcome to{' '}
					<span className='text-indigo-600 dark:text-indigo-400'>Vondic</span>
				</h1>

				<div className='w-full max-w-md space-y-6 rounded-xl bg-white p-8 shadow-xl dark:bg-gray-800'>
					<div className='space-y-2'>
						<h2 className='text-2xl font-bold text-gray-900 dark:text-white'>
							Access Restricted
						</h2>
						<p className='text-gray-600 dark:text-gray-300'>
							You are not currently authorized. Please sign in or create an
							account to continue.
						</p>
					</div>
					<div className='flex flex-col gap-3 sm:flex-row'>
						<Link
							href='/login'
							className='flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800'
						>
							Sign in
						</Link>
						<Link
							href='/register'
							className='flex-1 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:bg-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-gray-600 dark:focus:ring-offset-gray-800'
						>
							Create account
						</Link>
					</div>
				</div>
			</main>
		</div>
	)
}
