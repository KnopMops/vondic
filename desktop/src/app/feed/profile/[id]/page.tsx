'use client'

import AppLoader from '@/components/ui/AppLoader'
import FeedPageShell from '@/components/social/FeedPageShell'
import UserProfile from '@/components/social/UserProfile'
import { useAuth } from '@/lib/AuthContext'
import { useSocket } from '@/lib/SocketContext'
import { User } from '@/lib/types'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function ProfileIdPage() {
	const { id } = useParams()
	const { user: currentUser, logout, isLoading: isAuthLoading } = useAuth()
	const { socket } = useSocket()
	const [profileUser, setProfileUser] = useState<User | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState('')

	useEffect(() => {
		const fetchProfile = async () => {
			if (isAuthLoading) return

			
			if (currentUser && String(currentUser.id) === String(id)) {
				setProfileUser(currentUser as unknown as User)
				setIsLoading(false)
				return
			}

			
			try {
				const res = await fetch(`/api/users/${id}`)
				if (!res.ok) throw new Error('User not found')
				const data = await res.json()
				setProfileUser(data.user || data)
			} catch (err) {
				console.error(err)
				setError('User not found')
			} finally {
				setIsLoading(false)
			}
		}

		fetchProfile()
	}, [id, currentUser, isAuthLoading])

	useEffect(() => {
		if (!socket || !profileUser) return

		const handleStatusChange = (data: { user_id: string; status: string; last_seen?: string }) => {
			if (String(data.user_id) !== String(profileUser.id)) return
			setProfileUser(prev => prev ? {
				...prev,
				status: data.status,
				...(data.last_seen ? { last_seen: data.last_seen } : {}),
			} : prev)
		}

		const handleOnlineUsers = (ids: string[]) => {
			const isOnline = ids.some(uid => String(uid) === String(profileUser.id))
			setProfileUser(prev => prev ? { ...prev, status: isOnline ? 'online' : 'offline' } : prev)
		}

		socket.on('user_status_changed', handleStatusChange)
		socket.on('user_status_change', handleStatusChange)
		socket.on('online_users', handleOnlineUsers)
		socket.on('user_connected', (data: { user_id: string }) => {
			if (String(data.user_id) !== String(profileUser.id)) return
			setProfileUser(prev => prev ? { ...prev, status: 'online' } : prev)
		})
		socket.on('user_disconnected', (data: { user_id: string; last_seen?: string }) => {
			if (String(data.user_id) !== String(profileUser.id)) return
			setProfileUser(prev => prev ? {
				...prev,
				status: 'offline',
				...(data.last_seen ? { last_seen: data.last_seen } : {}),
			} : prev)
		})

		if (socket.connected) {
			socket.emit('get_online_users')
		} else {
			socket.once('connect', () => socket.emit('get_online_users'))
		}

		return () => {
			socket.off('user_status_changed', handleStatusChange)
			socket.off('user_status_change', handleStatusChange)
			socket.off('online_users', handleOnlineUsers)
			socket.off('user_connected')
			socket.off('user_disconnected')
		}
	}, [socket, profileUser?.id])

	if (isLoading || isAuthLoading) {
		return <AppLoader fullScreen size='lg' />
	}

	if (error || !profileUser) {
		return (
			<FeedPageShell email={currentUser?.email} onLogout={logout}>
				<div className='flex justify-center items-center py-20'>
					<div className='text-center'>
						<h2 className='mb-4 text-2xl font-bold'>
							Пользователь не найден
						</h2>
						<Link
							href='/feed'
							className='text-indigo-400 hover:text-indigo-300'
						>
							Вернуться в ленту
						</Link>
					</div>
				</div>
			</FeedPageShell>
		)
	}

	return (
		<FeedPageShell email={currentUser?.email} onLogout={logout}>
			<UserProfile
				user={profileUser}
				currentUser={currentUser as unknown as User}
			/>
		</FeedPageShell>
	)
}
