'use client'

import Header from '@/components/social/Header'
import Sidebar from '@/components/social/Sidebar'
import UserProfile from '@/components/social/UserProfile'
import { useAuth } from '@/lib/AuthContext'
import { User } from '@/lib/types'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function ProfileIdPage() {
	const { id } = useParams()
	const { user: currentUser, logout, isLoading: isAuthLoading } = useAuth()
	const [profileUser, setProfileUser] = useState<User | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState('')

	useEffect(() => {
		const fetchProfile = async () => {
			if (isAuthLoading) return

			// If visiting own profile
			if (currentUser && String(currentUser.id) === String(id)) {
				setProfileUser(currentUser as unknown as User)
				setIsLoading(false)
				return
			}

			// Fetch other user
			try {
				const res = await fetch(`/api/users/${id}`)
				if (!res.ok) throw new Error('User not found')
				const data = await res.json()
                // Assuming backend returns the user object directly or nested.
                // If nested like { user: ... }, we need to extract it.
                // Based on auth/me, it's nested. Let's assume consistent API design.
                // But /users/{id} usually returns the resource directly. 
                // I'll check if 'user' property exists, if not use data.
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

	if (isLoading || isAuthLoading) {
		return (
			<div className='flex min-h-screen items-center justify-center bg-gray-900'>
				<div className='h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent'></div>
			</div>
		)
	}

	if (error || !profileUser) {
		return (
			<div className='min-h-screen bg-gray-900 text-gray-100'>
				<Header email={currentUser?.email} onLogout={logout} />
				<div className='mx-auto flex max-w-7xl'>
					<Sidebar />
					<main className='flex-1 p-4 sm:p-6 lg:p-8 flex justify-center items-center'>
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
					</main>
				</div>
			</div>
		)
	}

	return (
		<div className='min-h-screen bg-gray-900 text-gray-100'>
			<Header email={currentUser?.email} onLogout={logout} />
			<div className='mx-auto flex max-w-7xl'>
				<Sidebar />
				<main className='flex-1 p-4 sm:p-6 lg:p-8'>
					<UserProfile
						user={profileUser}
						currentUser={currentUser as unknown as User}
					/>
				</main>
			</div>
		</div>
	)
}
