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
		<div className='min-h-screen bg-black text-white selection:bg-indigo-500 selection:text-white overflow-x-hidden relative'>
			<div className='fixed inset-0 z-0 overflow-hidden pointer-events-none'>
				<div className='absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-indigo-900/20 blur-[120px]' />
				<div className='absolute top-[40%] -right-[10%] w-[40%] h-[60%] rounded-full bg-purple-900/20 blur-[120px]' />
				<div className='absolute bottom-[10%] left-[20%] w-[30%] h-[30%] rounded-full bg-emerald-900/10 blur-[100px]' />
			</div>
			<div className='relative z-20'>
				<Header email={user?.email || ''} onLogout={logout} />
			</div>
			<div className='relative z-10 mx-auto flex max-w-7xl pt-6'>
				<main className='flex-1 px-4 sm:px-6 lg:px-8 pb-20 space-y-6'>
					<div className='mb-4'>
						<Link
							href='/video'
							className='inline-flex items-center rounded-full border border-gray-800/60 bg-gray-900/40 px-3 py-1.5 text-xs text-gray-200 hover:bg-white/10'
						>
							Подписки
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
