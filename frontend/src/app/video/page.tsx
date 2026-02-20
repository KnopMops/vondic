'use client'

import VideoPlayer from '@/components/social/VideoPlayer'
import { Clock, Compass, Heart, Home, User2, Video } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

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
	author_premium?: boolean
}

export default function VideoPage() {
	const [videos, setVideos] = useState<VideoItem[]>([])
	const [sort, setSort] = useState<'likes' | 'views' | 'created_at'>('views')
	const [order, setOrder] = useState<'asc' | 'desc'>('desc')
	const [isUploading, setIsUploading] = useState(false)

	const fetchVideos = async () => {
		const params = new URLSearchParams({ sort, order, limit: '24' })
		const res = await fetch(`/api/videos?${params.toString()}`, {
			cache: 'no-store',
		})
		if (res.ok) {
			const data = await res.json()
			setVideos(Array.isArray(data) ? data : [])
		}
	}

	useEffect(() => {
		fetchVideos()
	}, [sort, order])

	const onFirstPlay = async (videoId: string) => {
		try {
			await fetch('/api/videos/view', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ video_id: videoId }),
			})
		} catch {}
	}

	const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (!file) return
		setIsUploading(true)
		try {
			const ext = (file.name.split('.').pop() || '').toLowerCase()
			const valid = ['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext)
			if (!valid) {
				setIsUploading(false)
				return
			}
			const buf = await file.arrayBuffer()
			const base64 = Buffer.from(buf).toString('base64')
			const dataUrl = `data:video/${ext};base64,${base64}`
			const upRes = await fetch('/api/upload/video', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ file: dataUrl, filename: file.name }),
			})
			if (!upRes.ok) throw new Error(await upRes.text())
			const up = await upRes.json()
			const url = up.url
			const createRes = await fetch('/api/videos', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: file.name,
					url,
				}),
			})
			if (!createRes.ok) throw new Error(await createRes.text())
			await fetchVideos()
		} catch {
		} finally {
			setIsUploading(false)
			e.target.value = ''
		}
	}

	return (
		<div className='min-h-screen bg-black text-gray-100'>
			<header className='sticky top-0 z-20 flex h-14 items-center border-b border-gray-800 bg-[#0f0f0f]/95 px-4'>
				<div className='flex items-center gap-4 w-full max-w-7xl mx-auto'>
					<Link
						href='/feed'
						className='flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/5'
					>
						<div className='h-4 w-4 rounded-[2px] border border-gray-300' />
					</Link>
					<div className='flex items-center gap-2'>
						<div className='flex h-8 w-8 items-center justify-center rounded-full bg-red-600'>
							<Video className='h-4 w-4 text-white' />
						</div>
						<span className='text-xl font-semibold tracking-tight'>Vondic</span>
					</div>
					<div className='ml-8 flex-1 max-w-2xl'>
						<div className='flex items-center overflow-hidden rounded-full border border-gray-700 bg-[#0f0f0f]'>
							<input
								type='text'
								placeholder='Поиск'
								className='h-9 flex-1 bg-transparent px-4 text-sm outline-none placeholder:text-gray-500'
							/>
							<button className='flex h-9 w-12 items-center justify-center border-l border-gray-700 bg-[#222]'>
								<span className='text-xs text-gray-300'>Поиск</span>
							</button>
						</div>
					</div>
					<div className='flex items-center gap-2'>
						<label className='h-9 rounded-full border border-gray-700 bg-[#222] px-4 text-xs font-semibold text-gray-100 hover:bg-[#333] cursor-pointer'>
							{isUploading ? 'Загрузка...' : 'Загрузить'}
							<input
								type='file'
								accept='video/*'
								onChange={handleUpload}
								className='hidden'
							/>
						</label>
						<Link
							href='/video/studio'
							className='hidden sm:inline-flex h-9 items-center rounded-full border border-gray-700 bg-[#222] px-4 text-xs font-semibold text-gray-100 hover:bg-[#333]'
						>
							Студия
						</Link>
					</div>
				</div>
			</header>
			<div className='flex'>
				<aside className='hidden md:flex w-60 flex-col gap-1 border-r border-gray-900 bg-[#0f0f0f] px-2 pt-3'>
					<Link
						href='/video'
						className='flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium bg-[#272727]'
					>
						<Home className='h-5 w-5' />
						<span>Главная</span>
					</Link>
					<button className='flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-gray-200 hover:bg-[#272727]'>
						<Compass className='h-5 w-5' />
						<span>В тренде</span>
					</button>
					<button className='flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-gray-200 hover:bg-[#272727]'>
						<Clock className='h-5 w-5' />
						<span>История</span>
					</button>
					<button className='flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-gray-200 hover:bg-[#272727]'>
						<Heart className='h-5 w-5' />
						<span>Понравившиеся</span>
					</button>
					<Link
						href='/video/studio'
						className='flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-gray-200 hover:bg-[#272727]'
					>
						<User2 className='h-5 w-5' />
						<span>Моя студия</span>
					</Link>
				</aside>
				<main className='flex-1 min-h-screen bg-black'>
					<div className='mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4'>
						<div className='flex flex-wrap items-center gap-2'>
							<button className='rounded-full bg-white text-black px-3 py-1 text-xs font-medium'>
								Все
							</button>
							<button className='rounded-full bg-[#272727] px-3 py-1 text-xs text-gray-200'>
								Популярные
							</button>
							<button className='rounded-full bg-[#272727] px-3 py-1 text-xs text-gray-200'>
								Новые
							</button>
						</div>
						<div className='flex items-center gap-2 text-xs text-gray-400'>
							<select
								value={sort}
								onChange={e =>
									setSort(e.target.value as 'likes' | 'views' | 'created_at')
								}
								className='h-8 rounded-lg border border-gray-800 bg-[#0f0f0f] px-3 text-xs text-gray-200'
							>
								<option value='views'>По просмотрам</option>
								<option value='likes'>По лайкам</option>
								<option value='created_at'>По дате</option>
							</select>
							<select
								value={order}
								onChange={e => setOrder(e.target.value as 'asc' | 'desc')}
								className='h-8 rounded-lg border border-gray-800 bg-[#0f0f0f] px-3 text-xs text-gray-200'
							>
								<option value='desc'>Сначала популярные</option>
								<option value='asc'>Сначала новые</option>
							</select>
						</div>
						<div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
							{videos.map(v => (
								<div
									key={v.id}
									className='overflow-hidden rounded-xl bg-[#181818]'
								>
									<VideoPlayer
										src={v.url}
										poster={v.poster || null}
										className='w-full'
										videoId={v.id}
										onFirstPlay={() => onFirstPlay(v.id)}
									/>
									<div className='flex gap-3 p-3'>
										<div className='mt-1 h-9 w-9 flex-shrink-0 rounded-full bg-gray-700' />
										<div className='min-w-0 space-y-1'>
											<div className='text-sm font-semibold text-white line-clamp-2'>
												{v.title}
											</div>
											<div className='text-xs text-gray-400'>
												{v.author_name || 'Автор'}
											</div>
											<div className='text-[11px] text-gray-500'>
												{v.views || 0} просмотров · {v.likes || 0} лайков
											</div>
										</div>
									</div>
								</div>
							))}
						</div>
					</div>
				</main>
			</div>
		</div>
	)
}
