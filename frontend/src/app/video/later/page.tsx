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

export default function LaterPage() {
	const { user, logout } = useAuth()
	const [videos, setVideos] = useState<VideoItem[]>([])
	const load = async () => {
		const res = await fetch('/api/videos/later', { cache: 'no-store' })
		if (res.ok) {
			const data = await res.json()
			setVideos(Array.isArray(data) ? data : [])
		}
	}
	useEffect(() => {
		load()
	}, [])
	return (
		<div className='min-h-screen bg-[#0e1117] text-[#e6edf3] selection:bg-[#0077FF] selection:text-white overflow-x-hidden relative font-sans'>
			<div className='fixed inset-0 z-0 overflow-hidden pointer-events-none'>
				<div className='absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-[#0077FF]/10 blur-[140px] rounded-full' />
			</div>
			<div className='relative z-20'>
				<Header email={user?.email || ''} onLogout={logout} />
			</div>
			<div className='relative z-10 mx-auto flex max-w-7xl pt-6'>
				<main className='flex-1 px-4 sm:px-6 lg:px-8 pb-20'>
					<div className='mb-4'>
						<Link
							href='/video'
							className='inline-flex items-center rounded-xl border border-[#30363d] bg-[#161b22] px-3.5 py-1.5 text-xs text-[#e6edf3] hover:bg-[#21262d] transition-colors'
						>
							← Назад к видео
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
