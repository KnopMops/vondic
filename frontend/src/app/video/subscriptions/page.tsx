'use client'

import Header from '@/components/social/Header'
import { useAuth } from '@/lib/AuthContext'
import { getAttachmentUrl } from '@/lib/utils'
import Link from 'next/link'
import { useEffect, useState } from 'react'

type UserItem = {
	id: string
	username: string
	avatar_url?: string | null
}

export default function SubscriptionsPage() {
	const { user, logout } = useAuth()
	const [subscribedUsers, setSubscribedUsers] = useState<UserItem[]>([])
	const [isLoading, setIsLoading] = useState(false)

	const loadSubscriptions = async () => {
		if (!user?.id) return
		setIsLoading(true)
		try {
			const res = await fetch('/api/subscriptions/following', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ user_id: user.id }),
			})
			const data = res.ok ? await res.json() : []
			const items = Array.isArray(data) ? data : []
			setSubscribedUsers(items)
		} catch {
			setSubscribedUsers([])
		} finally {
			setIsLoading(false)
		}
	}

	useEffect(() => {
		loadSubscriptions()
	}, [user?.id])

	return (
		<div className='min-h-screen bg-[#0e1117] text-[#e6edf3] selection:bg-[#0077FF] selection:text-white overflow-x-hidden relative font-sans'>
			<div className='fixed inset-0 z-0 overflow-hidden pointer-events-none'>
				<div className='absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-[#0077FF]/10 blur-[140px] rounded-full' />
			</div>
			<div className='relative z-20'>
				<Header email={user?.email || ''} onLogout={logout} />
			</div>
			<div className='relative z-10 mx-auto flex max-w-7xl pt-6'>
				<main className='flex-1 px-4 sm:px-6 lg:px-8 pb-20 space-y-6'>
					<div className='mb-4'>
						<Link
							href='/video'
							className='inline-flex items-center rounded-xl border border-[#30363d] bg-[#161b22] px-3.5 py-1.5 text-xs text-[#e6edf3] hover:bg-[#21262d] transition-colors'
						>
							← Назад к видео
						</Link>
					</div>
					{isLoading && (
						<div className='text-sm text-gray-400'>Загрузка...</div>
					)}
					{!isLoading && subscribedUsers.length === 0 && (
						<div className='text-sm text-gray-400'>Подписок пока нет</div>
					)}
					<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
						{subscribedUsers.map(u => (
							<div
								key={u.id}
								className='rounded-2xl border border-gray-800/60 bg-gray-900/30 p-4 flex items-center gap-3'
							>
								<div className='h-10 w-10 overflow-hidden rounded-full bg-gray-700'>
									{u.avatar_url && (
										<img
											src={getAttachmentUrl(u.avatar_url) || u.avatar_url}
											alt={u.username}
											className='h-full w-full object-cover'
										/>
									)}
								</div>
								<div className='min-w-0 flex-1'>
									<div className='text-sm font-semibold text-white truncate'>
										{u.username}
									</div>
									<Link
										href={`/feed/profile/${u.id}`}
										className='text-xs text-gray-400 hover:text-gray-200'
									>
										Профиль
									</Link>
								</div>
							</div>
						))}
					</div>
				</main>
			</div>
		</div>
	)
}
