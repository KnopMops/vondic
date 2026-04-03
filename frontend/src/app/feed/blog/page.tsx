'use client'

import SocialFeed from '@/components/social/SocialFeed'
import { useAuth } from '@/lib/AuthContext'
import { setSocketId } from '@/lib/features/authSlice'
import { useAppDispatch } from '@/lib/hooks'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

function generateUUID(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID()
	}
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0
		const v = c === 'x' ? r : (r & 0x3) | 0x8
		return v.toString(16)
	})
}

export default function BlogPage() {
	const { user, logout, isLoading: isAuthLoading, isInitialized } = useAuth()
	const router = useRouter()

	useEffect(() => {
		if (isInitialized && !isAuthLoading) {
			
			router.push('/feed')
		}
	}, [isInitialized, isAuthLoading, router])

	return (
		<div className='flex min-h-screen items-center justify-center bg-black'>
			<div className='h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent'></div>
		</div>
	)
}
