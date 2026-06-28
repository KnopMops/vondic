'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
	LuX as X, LuBell as Bell, LuBellOff as BellOff, LuUserPlus as Follow,
	LuUserCheck as Unfollow, LuBan as Ban, LuMessageCircle as Message,
	LuSettings as Settings, LuSearch as Search, LuPhone as Phone, LuTrash2 as Trash,
} from 'react-icons/lu'
import { getAvatarUrl, formatMskDateTime } from '@/lib/utils'

interface ProfileModalProps {
	userId: string
	onClose: () => void
	onOpenSettings?: () => void
	onDeleteHistory?: () => void
	onDiscovery?: () => void
}

export default function ProfileModal({ userId, onClose, onOpenSettings, onDeleteHistory, onDiscovery }: ProfileModalProps) {
	const router = useRouter()
	const [profile, setProfile] = useState<any>(null)
	const [loading, setLoading] = useState(true)
	const [isFollowing, setIsFollowing] = useState(false)
	const [notificationsEnabled, setNotificationsEnabled] = useState(true)

	useEffect(() => {
		fetchProfile()
	}, [userId])

	const fetchProfile = async () => {
		setLoading(true)
		try {
			const res = await fetch(`/api/users/${userId}`)
			if (res.ok) {
				const data = await res.json()
				const u = data?.user || data
				setProfile(u)
				setIsFollowing(!!u?.is_following)
			}
		} catch {}
		setLoading(false)
	}

	const handleFollow = async () => {
		try {
			const endpoint = isFollowing ? '/api/friends/remove' : '/api/friends/add'
			const res = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ user_id: userId }),
			})
			if (res.ok) setIsFollowing(!isFollowing)
		} catch {}
	}

	return (
		<div className='fixed inset-0 z-[80]' onClick={onClose}>
			<div className='absolute inset-0 bg-black/40 backdrop-blur-sm' />
			<div
				className='absolute right-0 top-0 bottom-0 w-full max-w-[380px] bg-[var(--app-bg)] border-l border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300'
				onClick={e => e.stopPropagation()}
			>
				<div className='flex items-center gap-3 p-4 border-b border-white/10'>
					<button onClick={onClose} className='p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition'>
						<X className='h-5 w-5' />
					</button>
					<h2 className='text-sm font-semibold text-[var(--app-fg)]'>Профиль</h2>
				</div>

				<div className='flex-1 overflow-y-auto custom-scrollbar'>
					{loading ? (
						<div className='p-8 space-y-4'>
							<div className='w-24 h-24 rounded-full bg-white/5 animate-pulse mx-auto' />
							<div className='h-5 w-32 bg-white/5 rounded animate-pulse mx-auto' />
							<div className='h-3 w-48 bg-white/5 rounded animate-pulse mx-auto' />
						</div>
					) : profile ? (
						<>
							<div className='flex flex-col items-center pt-8 pb-6 px-4'>
								<img
									src={getAvatarUrl(profile.avatar_url)}
									alt={profile.username}
									className='w-24 h-24 rounded-full object-cover bg-white/5 ring-2 ring-[var(--app-accent)]/30 mb-4'
								/>
								<h3 className='text-xl font-bold text-[var(--app-fg)] flex items-center gap-2'>
									{profile.username}
									{profile.premium && <span className='text-amber-400'>★</span>}
								</h3>
								<div className='flex items-center gap-2 mt-2'>
									<span className={`w-2 h-2 rounded-full ${profile.status?.toLowerCase() === 'online' ? 'bg-[var(--app-accent)]' : 'bg-[var(--app-muted)]'}`} />
									<span className='text-xs text-[var(--app-muted)]'>
										{profile.status?.toLowerCase() === 'online'
											? 'В сети'
											: profile.last_seen
												? `Был(а) ${formatMskDateTime(profile.last_seen)}`
												: 'Не в сети'}
									</span>
								</div>
								{profile.description && (
									<p className='text-sm text-[var(--app-muted)] mt-3 text-center max-w-[280px]'>{profile.description}</p>
								)}
							</div>

							<div className='px-4 pb-2'>
								<button
									onClick={() => { onClose(); router.push(`/feed/profile/${userId}`) }}
									className='w-full rounded-xl bg-[var(--app-accent)] hover:opacity-90 text-white text-sm font-medium py-3 transition-opacity'
								>
									Перейти к профилю
								</button>
							</div>

							<div className='px-4 py-2 space-y-0.5'>
								<button
									onClick={() => setNotificationsEnabled(!notificationsEnabled)}
									className='w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-[var(--app-fg)] hover:bg-white/5 transition-colors'
								>
									<div className='w-8 h-8 rounded-full bg-[var(--app-accent)]/15 flex items-center justify-center shrink-0'>
										{notificationsEnabled
											? <Bell className='h-4 w-4 text-[var(--app-accent)]' />
											: <BellOff className='h-4 w-4 text-[var(--app-muted)]' />}
									</div>
									<div className='flex-1 text-left'>
										<div className='text-sm text-[var(--app-fg)]'>Уведомления</div>
										<div className='text-[11px] text-[var(--app-muted)]'>
											{notificationsEnabled ? 'Включены' : 'Отключены'}
										</div>
									</div>
								</button>

								<button
									onClick={handleFollow}
									className='w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-[var(--app-fg)] hover:bg-white/5 transition-colors'
								>
									<div className='w-8 h-8 rounded-full bg-[var(--app-accent)]/15 flex items-center justify-center shrink-0'>
										{isFollowing
											? <Unfollow className='h-4 w-4 text-[var(--app-accent)]' />
											: <Follow className='h-4 w-4 text-[var(--app-accent)]' />}
									</div>
									<div className='text-left'>
										{isFollowing ? 'Отписаться' : 'Подписаться'}
									</div>
								</button>

								<button
									onClick={() => { onClose(); onOpenSettings?.() }}
									className='w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-[var(--app-fg)] hover:bg-white/5 transition-colors'
								>
									<div className='w-8 h-8 rounded-full bg-[var(--app-accent)]/15 flex items-center justify-center shrink-0'>
										<Settings className='h-4 w-4 text-[var(--app-accent)]' />
									</div>
									<div className='text-left'>Настройки чата</div>
								</button>

								{onDiscovery && (
									<button
										onClick={() => { onClose(); onDiscovery() }}
										className='w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-[var(--app-fg)] hover:bg-white/5 transition-colors'
									>
										<div className='w-8 h-8 rounded-full bg-[var(--app-accent)]/15 flex items-center justify-center shrink-0'>
											<Search className='h-4 w-4 text-[var(--app-accent)]' />
										</div>
										<div className='text-left'>Найти каналы</div>
									</button>
								)}
							</div>

							<div className='px-4 py-2'>
								<div className='border-t border-white/5 pt-2'>
									<button
										onClick={() => { onClose(); onDeleteHistory?.() }}
										className='w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-colors'
									>
										<div className='w-8 h-8 rounded-full bg-red-500/15 flex items-center justify-center shrink-0'>
											<Trash className='h-4 w-4 text-red-400' />
										</div>
										<div className='text-left'>Удалить историю</div>
									</button>
								</div>
							</div>
						</>
					) : (
						<div className='p-8 text-center text-[var(--app-muted)] text-sm'>Профиль не найден</div>
					)}
				</div>
			</div>
		</div>
	)
}
