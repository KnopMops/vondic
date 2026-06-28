'use client'

import PremiumModal from '@/components/premium/PremiumModal'
import { useAuth } from '@/lib/AuthContext'
import { useNotificationStore } from '@/lib/stores/notificationStore'
import { useMusicPlayerStore } from '@/lib/stores/musicPlayerStore'
import { User } from '@/lib/types'
import { getAvatarUrl } from '@/lib/utils'
import { motion } from 'framer-motion'
import {
	LuSparkles as Sparkles,
	LuZap as Zap,
	LuPlay as Play,
	LuPause as Pause,
	LuSkipBack as SkipBack,
	LuSkipForward as SkipForward,
	LuMusic as Music,
} from 'react-icons/lu'
import Link from 'next/link'
import { useEffect, useState } from 'react'

const formatTime = (time: number) => {
	if (isNaN(time)) return '0:00'
	const mins = Math.floor(time / 60)
	const secs = Math.floor(time % 60)
	return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default function RightPanel() {
	const { user } = useAuth()
	const { notifications } = useNotificationStore()
	const items = notifications.slice(0, 3)
	const [friends, setFriends] = useState<User[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [premiumOpen, setPremiumOpen] = useState(false)

	const {
		currentTrack,
		isPlaying,
		currentTime,
		duration,
		togglePlay,
		nextTrack,
		previousTrack,
		seek,
	} = useMusicPlayerStore()

	useEffect(() => {
		const fetchFriends = async () => {
			if (!user) return
			setIsLoading(true)
			try {
				const res = await fetch('/api/friends/list', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ user_id: user.id }),
				})
				if (res.ok) {
					const data = await res.json()
					setFriends(Array.isArray(data) ? data : [])
				}
			} catch (e) {
				console.error(e)
			} finally {
				setIsLoading(false)
			}
		}
		fetchFriends()
	}, [user?.id])

	const onlineFriends = friends.filter(f => f.status === 'online')

	return (
		<aside className='space-y-6'>
			{/* Vondic Music Player Widget */}
			<div className='glass-panel p-4 relative overflow-hidden'>
				<span className='text-xs font-semibold text-accent uppercase tracking-widest flex items-center gap-1.5'>
					<Music className='w-3.5 h-3.5' /> Вондик Музыка
				</span>
				{isPlaying && (
					<span className='flex gap-0.5 items-end h-3 mt-1'>
						<span className='w-0.5 bg-[var(--app-accent)] rounded-full animate-bounce h-2' style={{ animationDelay: '0.1s' }} />
						<span className='w-0.5 bg-[var(--app-accent)] rounded-full animate-bounce h-3' style={{ animationDelay: '0.3s' }} />
						<span className='w-0.5 bg-[var(--app-accent)] rounded-full animate-bounce h-1.5' style={{ animationDelay: '0.5s' }} />
					</span>
				)}

				<div className='relative z-10'>
					{currentTrack ? (
						<div className='space-y-3'>
							<div>
								<div className='text-sm font-bold text-gray-100 truncate'>
									{currentTrack.title}
								</div>
								<div className='text-xs text-violet-300/70 truncate'>
									{currentTrack.artist}
								</div>
							</div>

							{/* Progress Bar */}
							<div className='space-y-1'>
								<input
									type='range'
									min={0}
									max={duration || 100}
									value={currentTime}
									onChange={(e) => seek(Number(e.target.value))}
									className='w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-violet-400 focus:outline-none'
								/>
								<div className='flex justify-between text-[10px] text-gray-400 font-mono'>
									<span>{formatTime(currentTime)}</span>
									<span>{formatTime(duration)}</span>
								</div>
							</div>

							{/* Controls */}
							<div className='flex items-center justify-center gap-5 pt-0.5'>
								<button
									onClick={previousTrack}
									className='p-1.5 text-gray-400 hover:text-white transition-colors active:scale-90'
									title='Предыдущий трек'
								>
									<SkipBack className='w-5 h-5 fill-current' />
								</button>
							<button
								onClick={togglePlay}
								className='w-9 h-9 rounded-full btn-accent flex items-center justify-center transition-all shadow-lg active:scale-95'
								>
									{isPlaying ? (
										<Pause className='w-4.5 h-4.5 fill-current' />
									) : (
										<Play className='w-4.5 h-4.5 fill-current ml-0.5' />
									)}
								</button>
								<button
									onClick={nextTrack}
									className='p-1.5 text-gray-400 hover:text-white transition-colors active:scale-90'
									title='Следующий трек'
								>
									<SkipForward className='w-5 h-5 fill-current' />
								</button>
							</div>
						</div>
					) : (
						<div className='py-4 text-center space-y-2'>
							<div className='w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-gray-400'>
								<Music className='w-5 h-5' />
							</div>
							<p className='text-xs text-gray-400'>Выберите музыку в разделе VMьюзик</p>
						</div>
					)}
				</div>
			</div>

			{/* Online Friends List */}
			<div className='glass-panel p-4 text-[var(--app-fg)]'>
				<div className='flex items-center justify-between mb-3.5'>
					<div className='text-sm font-semibold text-white'>
						Друзья
					</div>
					{onlineFriends.length > 0 && (
						<span className='text-[10px] font-bold px-2 py-0.5 rounded-full bg-[rgb(var(--app-accent-rgb)/0.1)] text-[var(--app-accent-2)] border border-[rgb(var(--app-accent-rgb)/0.2)]'>
							{onlineFriends.length} онлайн
						</span>
					)}
				</div>

				{isLoading ? (
					<div className='text-xs text-gray-400 py-3 text-center'>Загрузка...</div>
				) : friends.length === 0 ? (
					<div className='text-xs text-gray-400 py-3 text-center'>Нет друзей</div>
				) : (
					<div className='space-y-3.5'>
						{/* Overlapping avatars row */}
						{onlineFriends.length > 0 && (
							<div className='flex items-center -space-x-2.5 py-1 px-1 border-b border-white/5 mb-2'>
								{onlineFriends.slice(0, 7).map(friend => (
									<Link key={friend.id} href={`/feed/profile/${friend.id}`} title={friend.username}>
										<img
											src={getAvatarUrl(friend.avatar_url)}
											alt={friend.username}
											className='h-8 w-8 rounded-full object-cover ring-2 ring-[#0f0e1b] hover:scale-110 hover:z-10 transition-transform cursor-pointer'
										/>
									</Link>
								))}
								{onlineFriends.length > 7 && (
									<div className='flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-[10px] font-bold text-gray-300 ring-2 ring-[#0f0e1b]'>
										+{onlineFriends.length - 7}
									</div>
								)}
							</div>
						)}

						{/* Detailed list */}
						<div className='space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1'>
							{friends.slice(0, 10).map(friend => {
								const isOnline = friend.status === 'online'
								return (
									<Link
										key={friend.id}
										href={`/feed/profile/${friend.id}`}
										className='flex items-center gap-3 rounded-xl p-2 hover:bg-white/5 border border-transparent hover:border-white/5 transition-all'
									>
										<div className='relative shrink-0'>
											<img
												src={getAvatarUrl(friend.avatar_url)}
												alt={friend.username}
												className='h-10 w-10 rounded-full object-cover ring-1 ring-white/10'
											/>
											<div
												className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#0f0e1b] ${
													isOnline ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-gray-500'
												}`}
											/>
										</div>
										<div className='flex-1 min-w-0'>
											<div className='text-sm font-semibold text-gray-200 truncate'>
												{friend.username}
											</div>
											<div className='text-[10px] text-gray-500 truncate'>
												{isOnline ? 'в сети' : 'не в сети'}
											</div>
										</div>
									</Link>
								)
							})}
						</div>
					</div>
				)}

				{friends.length > 0 && (
					<Link
						href='/feed/friends'
						className='block mt-3 text-center text-xs font-semibold text-accent hover:text-[var(--app-accent-2)] transition-colors'
					>
						Все друзья →
					</Link>
				)}
			</div>

			{!user?.premium && (
				<motion.div
					initial={{ opacity: 0, x: 20 }}
					animate={{ opacity: 1, x: 0 }}
					transition={{ duration: 0.5 }}
					className='rounded-3xl bg-gradient-to-br from-indigo-900/40 to-purple-900/40 backdrop-blur-xl border border-white/10 p-6 shadow-xl relative overflow-hidden group'
				>
					<div className='absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl group-hover:bg-indigo-500/30 transition-all duration-500' />
					<div className='absolute -bottom-10 -left-10 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl group-hover:bg-purple-500/30 transition-all duration-500' />

					<div className='relative z-10'>
						<div className='flex items-center gap-2 mb-4'>
							<div className='p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20'>
								<Zap className='w-5 h-5 text-white fill-current' />
							</div>
							<h3 className='text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500 drop-shadow-sm'>
								Вондик Premium
							</h3>
						</div>

						<p className='text-sm text-gray-300 mb-6 leading-relaxed'>
							Получите доступ к эксклюзивным функциям: 2 ГБ хранилища, загрузка
							файлов до 100 МБ, GIF-аватарки и многое другое. уникальным
							стикерам.
						</p>

						<button
							type='button'
							onClick={() => setPremiumOpen(true)}
							className='w-full py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 hover:border-white/20 text-white text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 group/btn'
						>
							<Sparkles className='w-4 h-4 text-yellow-400 group-hover/btn:rotate-12 transition-transform' />
							Подробнее
						</button>
					</div>
				</motion.div>
			)}
			<PremiumModal isOpen={premiumOpen} onClose={() => setPremiumOpen(false)} />
		</aside>
	)
}
