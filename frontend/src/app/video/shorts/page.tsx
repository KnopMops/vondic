'use client'

import Header from '@/components/social/Header'
import { useAuth } from '@/lib/AuthContext'
import { getAttachmentUrl } from '@/lib/utils'
import {
	FiPause as Pause,
	FiPlay as Play,
	FiVolume2 as Volume2,
	FiVolumeX as VolumeX,
} from 'react-icons/fi'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

type VideoItem = {
	id: string
	title: string
	description?: string
	url: string
	poster?: string | null
	views?: number
	likes?: number
	author_name?: string
	author_avatar?: string | null
}

export default function ShortsPage() {
	const { user, logout } = useAuth()
	const [shorts, setShorts] = useState<VideoItem[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [activeId, setActiveId] = useState<string | null>(null)
	const itemRefs = useRef(new Map<string, HTMLDivElement | null>())

	const loadShorts = async () => {
		setIsLoading(true)
		try {
			const params = new URLSearchParams({
				shorts: 'true',
				sort: 'created_at',
				order: 'desc',
				limit: '50',
				offset: '0',
			})
			const res = await fetch(`/api/videos?${params.toString()}`, {
				cache: 'no-store',
			})
			const data = res.ok ? await res.json() : []
			const items = Array.isArray(data) ? data : []
			setShorts(items)
			if (items.length > 0) {
				setActiveId(items[0].id)
			}
		} catch {
			setShorts([])
		} finally {
			setIsLoading(false)
		}
	}

	useEffect(() => {
		loadShorts()
	}, [])

	useEffect(() => {
		const observer = new IntersectionObserver(
			entries => {
				entries.forEach(entry => {
					if (entry.isIntersecting) {
						const id = entry.target.getAttribute('data-id')
						if (id) setActiveId(id)
					}
				})
			},
			{ threshold: 0.6 },
		)
		itemRefs.current.forEach(node => {
			if (node) observer.observe(node)
		})
		return () => observer.disconnect()
	}, [shorts.length])

	const shortsList = useMemo(() => shorts, [shorts])

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
				<main className='flex-1 px-4 sm:px-6 lg:px-8 pb-20'>
					<div className='mb-4'>
						<Link
							href='/video'
							className='inline-flex items-center rounded-full border border-gray-800/60 bg-gray-900/40 px-3 py-1.5 text-xs text-gray-200 hover:bg-white/10'
						>
							VShorts
						</Link>
					</div>
					{isLoading ? (
						<div className='text-sm text-gray-400'>Загрузка...</div>
					) : shortsList.length === 0 ? (
						<div className='text-sm text-gray-400'>Пока пусто</div>
					) : (
						<div className='h-[calc(100vh-8rem)] overflow-y-auto snap-y snap-mandatory rounded-2xl border border-gray-800/60 bg-gray-900/30'>
							{shortsList.map(item => (
								<div
									key={item.id}
									data-id={item.id}
									ref={node => itemRefs.current.set(item.id, node)}
									className='snap-start h-[calc(100vh-8rem)] flex items-center justify-center'
								>
									<ShortItem video={item} active={activeId === item.id} />
								</div>
							))}
						</div>
					)}
				</main>
			</div>
		</div>
	)
}

function ShortItem({ video, active }: { video: VideoItem; active: boolean }) {
	const [isMuted, setIsMuted] = useState(true)
	const [isPlaying, setIsPlaying] = useState(false)
	const [currentTime, setCurrentTime] = useState(0)
	const [duration, setDuration] = useState(0)
	const ref = useRef<HTMLVideoElement | null>(null)
	const src = getAttachmentUrl(video.url) || video.url
	const poster = getAttachmentUrl(video.poster || '') || video.poster || undefined
	const progress = duration ? Math.min(100, (currentTime / duration) * 100) : 0

	useEffect(() => {
		const el = ref.current
		if (!el) return
		if (active) {
			el.play().then(() => setIsPlaying(true)).catch(() => {})
		} else {
			el.pause()
			setIsPlaying(false)
		}
	}, [active])

	return (
		<div className='relative h-full w-full max-w-[520px] px-3 py-6'>
			<div className='relative h-full w-full overflow-hidden rounded-2xl bg-black'>
				<video
					ref={ref}
					src={src}
					poster={poster}
					className='h-full w-full object-cover'
					playsInline
					muted={isMuted}
					loop
					preload='metadata'
					onTimeUpdate={e => setCurrentTime(e.currentTarget.currentTime)}
					onLoadedMetadata={e => setDuration(e.currentTarget.duration || 0)}
					onPause={() => setIsPlaying(false)}
					onPlay={() => setIsPlaying(true)}
					onClick={() => {
						const el = ref.current
						if (!el) return
						if (el.paused) {
							el.play().catch(() => {})
						} else {
							el.pause()
						}
					}}
				/>
				<div className='absolute inset-x-0 bottom-0 h-1 bg-white/10'>
					<div
						className='h-1 bg-indigo-500 transition-[width]'
						style={{ width: `${progress}%` }}
					/>
				</div>
				<div className='absolute right-3 top-3 flex flex-col items-center gap-2'>
					<button
						type='button'
						onClick={() => setIsMuted(v => !v)}
						className='rounded-full bg-black/40 px-3 py-2 text-white backdrop-blur'
					>
						{isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
					</button>
					<button
						type='button'
						onClick={() => {
							const el = ref.current
							if (!el) return
							if (el.paused) {
								el.play().catch(() => {})
							} else {
								el.pause()
							}
						}}
						className='rounded-full bg-black/40 px-3 py-2 text-white backdrop-blur'
					>
						{isPlaying ? <Pause size={16} /> : <Play size={16} />}
					</button>
				</div>
				<div className='absolute left-3 bottom-4 right-14 space-y-1 text-sm'>
					<div className='font-semibold text-white line-clamp-2'>
						{video.title}
					</div>
					<div className='text-xs text-gray-300'>
						{video.author_name || 'Автор'} · {video.views || 0} просмотров
					</div>
				</div>
			</div>
		</div>
	)
}
