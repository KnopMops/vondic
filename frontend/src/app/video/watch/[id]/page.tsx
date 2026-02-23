'use client'

import Header from '@/components/social/Header'
import VideoPlayer from '@/components/social/VideoPlayer'
import { useAuth } from '@/lib/AuthContext'
import { Bookmark, Heart, Share2 } from 'lucide-react'
import Link from 'next/link'
import { use, useEffect, useMemo, useState } from 'react'

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
	is_nsfw?: boolean
	has_profanity?: boolean
	allow_comments?: boolean | number | string
}

type CommentItem = {
	id: string
	content: string
	posted_by: string
	author_name?: string
	author_avatar?: string | null
	created_at?: string
}

export default function WatchPage({
	params,
}: {
	params: Promise<{ id: string }>
}) {
	const { id } = use(params)
	const { user, logout } = useAuth()
	const [video, setVideo] = useState<VideoItem | null>(null)
	const [comments, setComments] = useState<CommentItem[]>([])
	const [commentText, setCommentText] = useState('')
	const [likes, setLikes] = useState<number>(0)
	const [isLiked, setIsLiked] = useState(false)
	const [isLater, setIsLater] = useState(false)
	const [isLoadedMeta, setIsLoadedMeta] = useState(false)

	const loadVideo = async () => {
		const res = await fetch(`/api/videos/${id}`, { cache: 'no-store' })
		if (res.ok) {
			const data = await res.json()
			setVideo(data)
			setLikes(Number(data?.likes || 0))
		}
	}
	const loadComments = async () => {
		const res = await fetch(`/api/videos/comments/${id}`, { cache: 'no-store' })
		if (res.ok) {
			const data = await res.json()
			setComments(Array.isArray(data) ? data : [])
		}
	}
	useEffect(() => {
		loadVideo()
		loadComments()
	}, [id])
	useEffect(() => {
		const loadMeta = async () => {
			const [likedRes, laterRes] = await Promise.all([
				fetch('/api/videos/liked', { cache: 'no-store' }),
				fetch('/api/videos/later', { cache: 'no-store' }),
			])
			if (likedRes.ok) {
				const liked = await likedRes.json()
				const ids = Array.isArray(liked) ? liked.map((x: any) => x.id) : []
				setIsLiked(ids.includes(id))
			}
			if (laterRes.ok) {
				const later = await laterRes.json()
				const ids = Array.isArray(later) ? later.map((x: any) => x.id) : []
				setIsLater(ids.includes(id))
			}
			setIsLoadedMeta(true)
		}
		loadMeta()
	}, [id])

	const onFirstPlay = async () => {
		try {
			await fetch('/api/videos/view', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ video_id: id }),
			})
		} catch {}
	}

	const toggleLike = async () => {
		const action = isLiked ? 'unlike' : 'like'
		const res = await fetch('/api/videos/like', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ video_id: id, action }),
		})
		if (res.ok) {
			const data = await res.json()
			setLikes(Number(data?.likes || 0))
			setIsLiked(!isLiked)
		}
	}
	const toggleLater = async () => {
		const action = isLater ? 'remove' : 'add'
		const res = await fetch('/api/videos/later', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ video_id: id, action }),
		})
		if (res.ok) {
			setIsLater(!isLater)
		}
	}
	const submitComment = async () => {
		const content = commentText.trim()
		if (!content) return
		const res = await fetch(`/api/videos/comments/${id}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ content }),
		})
		if (res.ok) {
			setCommentText('')
			loadComments()
		}
	}

	const playlists = useMemo(() => {
		try {
			const raw = localStorage.getItem('vondic_playlists') || '[]'
			const arr = JSON.parse(raw)
			return Array.isArray(arr) ? arr : []
		} catch {
			return []
		}
	}, [])
	const allowComments =
		video?.allow_comments === undefined
			? true
			: video.allow_comments === false ||
					video.allow_comments === 0 ||
					video.allow_comments === '0'
				? false
				: true

	const addToPlaylist = (playlistId: string) => {
		try {
			const raw = localStorage.getItem('vondic_playlists') || '[]'
			const arr = Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : []
			const idx = arr.findIndex((p: any) => p.id === playlistId)
			if (idx >= 0) {
				const p = arr[idx]
				const vids: string[] = Array.isArray(p.videos) ? p.videos : []
				if (!vids.includes(id)) vids.unshift(id)
				p.videos = vids
				arr[idx] = p
				localStorage.setItem('vondic_playlists', JSON.stringify(arr))
			}
		} catch {}
	}

	if (!video) return <div className='min-h-screen bg-black text-gray-100' />

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
							Назад
						</Link>
					</div>
					<div className='grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6'>
						<div>
							<div className='rounded-2xl overflow-hidden border border-gray-800/60 bg-gray-900/30'>
								<VideoPlayer
									src={video.url}
									poster={video.poster || null}
									className='w-full'
									videoId={video.id}
									onFirstPlay={onFirstPlay}
								/>
							</div>
							<div className='mt-4 flex items-start gap-3'>
								<div className='mt-1 h-10 w-10 flex-shrink-0 rounded-full bg-gray-700' />
								<div className='min-w-0 flex-1'>
									<div className='text-lg font-semibold text-white'>
										{video.title}
									</div>
									{(video.is_nsfw || video.has_profanity) && (
										<div className='mt-1 flex flex-wrap gap-1'>
											{video.is_nsfw && (
												<span className='inline-flex items-center rounded-full border border-red-500/50 bg-red-500/10 px-2 py-0.5 text-[10px] text-red-200'>
													18+
												</span>
											)}
											{video.has_profanity && (
												<span className='inline-flex items-center rounded-full border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-200'>
													Нежелательно
												</span>
											)}
										</div>
									)}
									<div className='text-xs text-gray-400'>
										{video.author_name || 'Автор'} · {video.views || 0}{' '}
										просмотров · {likes} лайков
									</div>
								</div>
								<div className='flex items-center gap-2 flex-wrap'>
									<button
										onClick={toggleLike}
										disabled={!isLoadedMeta}
										className={`h-9 rounded-full border border-gray-700 px-3 text-xs font-semibold ${isLiked ? 'bg-red-600 text-white' : 'bg-[#222] text-gray-100 hover:bg-[#333]'} ${isLoadedMeta ? '' : 'opacity-70'}`}
									>
										<Heart className='h-4 w-4 inline-block mr-1' /> Лайк
									</button>
									<button
										onClick={toggleLater}
										disabled={!isLoadedMeta}
										className={`h-9 rounded-full border border-gray-700 px-3 text-xs font-semibold ${isLater ? 'bg-indigo-600 text-white' : 'bg-[#222] text-gray-100 hover:bg-[#333]'} ${isLoadedMeta ? '' : 'opacity-70'}`}
									>
										<Bookmark className='h-4 w-4 inline-block mr-1' /> Позже
									</button>
									<button className='h-9 rounded-full border border-gray-700 bg-[#222] px-3 text-xs font-semibold text-gray-100 hover:bg-[#333]'>
										<Share2 className='h-4 w-4 inline-block mr-1' /> Поделиться
									</button>
									{playlists.length > 0 && (
										<select
											onChange={e => addToPlaylist(e.target.value)}
											defaultValue=''
											className='h-9 rounded-full border border-gray-700 bg-[#222] px-3 text-xs font-semibold text-gray-100 hover:bg-[#333]'
											title='Добавить в плейлист'
										>
											<option value='' disabled>
												В плейлист…
											</option>
											{playlists.map((p: any) => (
												<option key={p.id} value={p.id}>
													{p.name}
												</option>
											))}
										</select>
									)}
								</div>
							</div>

							<div className='mt-6 rounded-2xl border border-gray-800/60 bg-gray-900/30 p-4'>
								<div className='text-sm font-semibold mb-2'>Комментарии</div>
								{allowComments ? (
									<div className='flex gap-2'>
										<input
											type='text'
											value={commentText}
											onChange={e => setCommentText(e.target.value)}
											placeholder='Добавить комментарий...'
											className='flex-1 h-9 rounded-lg border border-gray-800 bg-[#0f0f0f] px-3 text-xs text-gray-200 outline-none'
										/>
										<button
											onClick={submitComment}
											className='h-9 rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-700'
										>
											Отправить
										</button>
									</div>
								) : (
									<div className='rounded-lg border border-gray-800 bg-[#0f0f0f] px-3 py-2 text-xs text-gray-400'>
										Комментарии отключены
									</div>
								)}
								<div className='mt-4 space-y-3'>
									{comments.map(c => (
										<div key={c.id} className='flex gap-3'>
											<div className='mt-1 h-8 w-8 flex-shrink-0 rounded-full bg-gray-700' />
											<div className='min-w-0'>
												<div className='text-xs text-gray-300'>
													{c.author_name || 'Пользователь'}
												</div>
												<div className='text-sm text-gray-100'>{c.content}</div>
											</div>
										</div>
									))}
								</div>
							</div>
						</div>
						<aside className='hidden lg:block'>
							<div className='text-sm font-semibold mb-2'>Похожие</div>
							<Recommendations />
						</aside>
					</div>
				</main>
			</div>
		</div>
	)
}

function Recommendations() {
	const [items, setItems] = useState<VideoItem[]>([])
	useEffect(() => {
		const load = async () => {
			const res = await fetch('/api/videos?sort=views&order=desc&limit=8', {
				cache: 'no-store',
			})
			if (res.ok) {
				const data = await res.json()
				setItems(Array.isArray(data) ? data : [])
			}
		}
		load()
	}, [])
	return (
		<div className='space-y-3'>
			{items.map(v => (
				<Link
					key={v.id}
					href={`/video/watch/${v.id}`}
					className='flex gap-3 rounded-lg bg-[#171717] hover:bg-[#1e1e1e] transition p-2'
				>
					<div className='w-40 shrink-0'>
						<VideoPlayer
							src={v.url}
							poster={v.poster || null}
							className='w-full'
						/>
					</div>
					<div className='min-w-0'>
						<div className='text-xs font-semibold text-white line-clamp-2'>
							{v.title}
						</div>
						<div className='text-[11px] text-gray-400'>
							{v.author_name || 'Автор'}
						</div>
						<div className='text-[11px] text-gray-500'>
							{v.views || 0} просмотров
						</div>
					</div>
				</Link>
			))}
		</div>
	)
}
