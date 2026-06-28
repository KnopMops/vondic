'use client'

import Header from '@/components/social/Header'
import { useAuth } from '@/lib/AuthContext'
import { getAttachmentUrl } from '@/lib/utils'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

type VideoItem = {
	id: string
	title: string
	url: string
	poster?: string | null
	views?: number
	likes?: number
}

export default function HistoryPage() {
	const { user, logout } = useAuth()
	const [videos, setVideos] = useState<VideoItem[]>([])
	const load = async () => {
		const res = await fetch('/api/videos/history', { cache: 'no-store' })
		if (res.ok) {
			const data = await res.json()
			setVideos(Array.isArray(data) ? data : [])
		}
	}
	useEffect(() => {
		load()
	}, [])
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
							История
						</Link>
					</div>
					<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
						{videos.map(v => (
							<div
								key={v.id}
								className='rounded-2xl border border-gray-800/60 bg-gray-900/30 hover:bg-white/5 transition overflow-hidden'
							>
								<VideoPreview video={v} />
								<div className='p-3'>
									<div className='text-xs font-semibold text-white line-clamp-2'>
										{v.title}
									</div>
									<div className='text-[11px] text-gray-500'>
										{v.views || 0} просмотров · {v.likes || 0} лайков
									</div>
								</div>
							</div>
						))}
					</div>
				</main>
			</div>
		</div>
	)
}

function VideoPreview({ video }: { video: VideoItem }) {
	const ref = useRef<HTMLVideoElement>(null)
	const [isHover, setIsHover] = useState(false)
	const src = getAttachmentUrl(video.url) || video.url
	const poster =
		getAttachmentUrl(video.poster || '') || video.poster || undefined
	const onEnter = () => {
		setIsHover(true)
		const el = ref.current
		if (!el) return
		el.muted = true
		el.currentTime = 0
		el.play().catch(() => {})
	}
	const onLeave = () => {
		setIsHover(false)
		const el = ref.current
		if (!el) return
		el.pause()
		el.currentTime = 0
	}
	return (
		<Link href={`/video/watch/${video.id}`} className='block'>
			<div
				className='relative aspect-video w-full overflow-hidden'
				onMouseEnter={onEnter}
				onMouseLeave={onLeave}
				onFocus={onEnter}
				onBlur={onLeave}
			>
				<video
					ref={ref}
					src={src}
					poster={poster}
					className='h-full w-full object-cover'
					playsInline
					muted
					loop
					preload='metadata'
				/>
				<div
					className={`absolute inset-0 bg-black/0 transition ${isHover ? 'bg-black/10' : ''}`}
				/>
			</div>
		</Link>
	)
}
