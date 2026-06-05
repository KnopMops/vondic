'use client'

import { useAuth } from '@/lib/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function Home() {
	const { user } = useAuth()
	const router = useRouter()

	useEffect(() => {
		if (user) {
			router.replace('/feed/messages')
		} else {
			router.replace('/login')
		}
	}, [user, router])

	return (
		<div className='min-h-screen bg-black flex items-center justify-center'>
			<div className='h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent' />
		</div>
	)
}
