'use client'

import Header from '@/components/social/Header'
import { useAuth } from '@/lib/AuthContext'
import { getAttachmentUrl } from '@/lib/utils'
import { motion } from 'framer-motion'
import {
	FiBookmark as Bookmark,
	FiClock as Clock,
	FiHeart as Heart,
	FiHome as Home,
	FiList as List,
	FiUpload as Upload,
	FiUser as User2,
	FiUsers as Users,
} from 'react-icons/fi'
import { FiPlayCircle as PlaySquare } from 'react-icons/fi'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

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
	is_nsfw?: boolean
	has_profanity?: boolean
}

export default function VideoPage() {
	const { user, logout } = useAuth()
	const [videos, setVideos] = useState<VideoItem[]>([])
	const [sort, setSort] = useState<'likes' | 'views' | 'created_at'>('views')
	const [order, setOrder] = useState<'asc' | 'desc'>('desc')
	const [isUploading, setIsUploading] = useState(false)
	const [page, setPage] = useState(0)
	const [isLoading, setIsLoading] = useState(false)
	const [hasMore, setHasMore] = useState(true)
	const loadMoreRef = useRef<HTMLDivElement | null>(null)
	const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
	const [uploadFile, setUploadFile] = useState<File | null>(null)
	const [uploadTitle, setUploadTitle] = useState('')
	const [uploadDescription, setUploadDescription] = useState('')
	const [uploadTags, setUploadTags] = useState('')
	const [uploadAllowComments, setUploadAllowComments] = useState(true)
	const [uploadType, setUploadType] = useState<'video' | 'shorts'>('video')
	const [uploadDuration, setUploadDuration] = useState<number | null>(null)
	const [uploadDurationError, setUploadDurationError] = useState('')
	const [uploadChecked, setUploadChecked] = useState(false)
	const [uploadCheckResult, setUploadCheckResult] = useState<{
		is_nsfw: boolean
		has_profanity: boolean
		verdict?: string
		issues?: any[]
	} | null>(null)
	const [uploadCheckError, setUploadCheckError] = useState('')
	const [uploadVideoUrl, setUploadVideoUrl] = useState<string | null>(null)
	const [isChecking, setIsChecking] = useState(false)
	const [uploadCheckStatus, setUploadCheckStatus] = useState<
		'idle' | 'queued' | 'processing' | 'done' | 'error'
	>('idle')
	const [uploadCheckJobId, setUploadCheckJobId] = useState<string | null>(null)
	const checkPollRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const checkPollAttemptRef = useRef(0)

	const fetchVideos = async (reset = false) => {
		const limit = 24
		const offset = reset ? 0 : page * limit
		const params = new URLSearchParams({
			sort,
			order,
			limit: String(limit),
			offset: String(offset),
		})
		setIsLoading(true)
		const res = await fetch(`/api/videos?${params.toString()}`, {
			cache: 'no-store',
		})
		if (res.ok) {
			const data = await res.json()
			const next = Array.isArray(data) ? data : []
			setVideos(prev => (reset ? next : [...prev, ...next]))
			setHasMore(next.length >= limit)
			if (reset) {
				setPage(0)
			}
		}
		setIsLoading(false)
	}

	useEffect(() => {
		fetchVideos(true)
	}, [sort, order])

	const loadMore = async () => {
		if (isLoading || !hasMore) return
		setPage(p => p + 1)
	}

	useEffect(() => {
		if (page === 0) return
		fetchVideos(false)
	}, [page])

	useEffect(() => {
		if (!loadMoreRef.current || !hasMore) return
		const node = loadMoreRef.current
		const observer = new IntersectionObserver(entries => {
			if (entries[0]?.isIntersecting) {
				loadMore()
			}
		})
		observer.observe(node)
		return () => observer.disconnect()
	}, [hasMore, isLoading])

	const uploadVideoFile = async (file: File) => {
		try {
			const ext = (file.name.split('.').pop() || '').toLowerCase()
			const valid = ['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext)
			if (!valid) throw new Error('Недопустимый формат')
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
			return up.url as string
		} catch (error: any) {
			throw new Error(error?.message || 'Ошибка загрузки')
		}
	}

	const getVideoDuration = (file: File) =>
		new Promise<number>((resolve, reject) => {
			const url = URL.createObjectURL(file)
			const video = document.createElement('video')
			const cleanup = () => {
				URL.revokeObjectURL(url)
			}
			video.preload = 'metadata'
			video.src = url
			video.onloadedmetadata = () => {
				const duration = Number(video.duration || 0)
				cleanup()
				if (!duration || Number.isNaN(duration)) {
					reject(new Error('Не удалось получить длительность'))
					return
				}
				resolve(Math.round(duration * 100) / 100)
			}
			video.onerror = () => {
				cleanup()
				reject(new Error('Не удалось прочитать файл'))
			}
		})

	const resolveUploadDuration = async () => {
		if (!uploadFile) return null
		if (uploadDuration != null) return uploadDuration
		try {
			const duration = await getVideoDuration(uploadFile)
			setUploadDuration(duration)
			return duration
		} catch {
			return null
		}
	}

	const createVideo = async (url: string) => {
		setIsUploading(true)
		try {
			const createRes = await fetch('/api/videos', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: uploadTitle || uploadFile?.name || 'Видео',
					description: uploadDescription || undefined,
					tags: uploadTags || undefined,
					allow_comments: uploadAllowComments,
					is_nsfw: uploadCheckResult?.is_nsfw || false,
					has_profanity: uploadCheckResult?.has_profanity || false,
					duration: uploadDuration ?? undefined,
					url,
				}),
			})
			if (!createRes.ok) throw new Error(await createRes.text())
			await fetchVideos(true)
		} catch {
		} finally {
			setIsUploading(false)
		}
	}

	const handleModalClose = () => {
		if (checkPollRef.current) {
			clearTimeout(checkPollRef.current)
			checkPollRef.current = null
		}
		checkPollAttemptRef.current = 0
		setIsUploadModalOpen(false)
		setUploadFile(null)
		setUploadTitle('')
		setUploadDescription('')
		setUploadTags('')
		setUploadAllowComments(true)
		setUploadType('video')
		setUploadDuration(null)
		setUploadDurationError('')
		setUploadChecked(false)
		setUploadCheckResult(null)
		setUploadCheckError('')
		setUploadVideoUrl(null)
		setUploadCheckStatus('idle')
		setUploadCheckJobId(null)
	}

	const pollCheckStatus = async (jobId: string) => {
		try {
			checkPollAttemptRef.current += 1
			if (checkPollAttemptRef.current > 40) {
				setUploadCheckError('Проверка слишком долгая, попробуйте позже')
				setUploadCheckStatus('error')
				setUploadChecked(false)
				setIsChecking(false)
				return
			}
			const res = await fetch(`/api/videos/check/${jobId}`, {
				cache: 'no-store',
			})
			if (!res.ok) throw new Error(await res.text())
			const data: any = await res.json().catch(() => ({}))
			const status =
				data?.status === 'processing' || data?.status === 'queued'
					? data.status
					: data?.status === 'done'
						? 'done'
						: data?.status === 'error'
							? 'error'
							: 'processing'
			setUploadCheckStatus(status)
			if (status === 'done') {
				const result = data?.result || {}
				setUploadCheckResult({
					is_nsfw: !!result?.is_nsfw,
					has_profanity: !!result?.has_profanity,
					verdict: result?.verdict,
					issues: Array.isArray(result?.issues) ? result.issues : [],
				})
				setUploadChecked(true)
				setIsChecking(false)
				return
			}
			if (status === 'error') {
				setUploadCheckError(data?.error || 'Ошибка проверки')
				setUploadChecked(false)
				setIsChecking(false)
				return
			}
			const delay = Math.min(2000 + checkPollAttemptRef.current * 300, 8000)
			checkPollRef.current = setTimeout(() => {
				pollCheckStatus(jobId)
			}, delay)
		} catch (error: any) {
			setUploadCheckError(error?.message || 'Ошибка проверки')
			setUploadCheckStatus('error')
			setUploadChecked(false)
			setIsChecking(false)
		}
	}

	const handleCheckUpload = async () => {
		if (!uploadFile || !uploadTitle.trim() || isChecking) return
		const duration = await resolveUploadDuration()
		if (uploadType === 'shorts') {
			if (!duration) {
				setUploadDurationError('Не удалось определить длительность')
				return
			}
			if (duration > 60) {
				setUploadDurationError('VShorts до 60 секунд')
				return
			}
		}
		setUploadDurationError('')
		if (checkPollRef.current) {
			clearTimeout(checkPollRef.current)
			checkPollRef.current = null
		}
		checkPollAttemptRef.current = 0
		setIsChecking(true)
		setUploadCheckError('')
		setUploadCheckStatus('queued')
		setUploadChecked(false)
		setUploadCheckResult(null)
		try {
			const url = uploadVideoUrl || (await uploadVideoFile(uploadFile))
			setUploadVideoUrl(url)
			const res = await fetch('/api/videos/check', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ video_url: url }),
			})
			if (!res.ok) throw new Error(await res.text())
			const data: any = await res.json().catch(() => ({}))
			const jobId = data?.job_id
			if (!jobId) throw new Error('Не удалось запустить проверку')
			setUploadCheckJobId(jobId)
			setUploadCheckStatus(data?.status || 'queued')
			pollCheckStatus(jobId)
		} catch (error: any) {
			setUploadCheckError(error?.message || 'Ошибка проверки')
			setUploadCheckStatus('error')
			setUploadChecked(false)
			setIsChecking(false)
		}
	}

	const handleSubmitUpload = async () => {
		if (!uploadFile || !uploadChecked || isUploading) return
		const duration = await resolveUploadDuration()
		if (uploadType === 'shorts') {
			if (!duration) {
				setUploadDurationError('Не удалось определить длительность')
				return
			}
			if (duration > 60) {
				setUploadDurationError('VShorts до 60 секунд')
				return
			}
		}
		setUploadDurationError('')
		const url = uploadVideoUrl || (await uploadVideoFile(uploadFile))
		setUploadVideoUrl(url)
		await createVideo(url)
		handleModalClose()
	}

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
				<aside className='hidden md:flex sticky top-20 h-[calc(100vh-10rem)] w-56 flex-col gap-1 rounded-xl border border-gray-800/50 bg-gray-900/40 backdrop-blur-md px-2 py-3 ml-4'>
					<Link
						href='/video'
						className='group flex items-center rounded-xl px-3 py-2 bg-white/10 justify-between'
						title='Главная'
						aria-label='Главная'
					>
						<Home className='h-5 w-5 text-gray-100 group-hover:scale-105 transition' />
						<div className='text-[11px] text-gray-300'>Главная</div>
					</Link>
					<Link
						href='/video/shorts'
						className='group flex items-center rounded-xl px-3 py-2 text-gray-200 hover:bg-white/10 justify-between'
						title='VShorts'
						aria-label='VShorts'
					>
						<PlaySquare className='h-5 w-5 group-hover:text-white group-hover:scale-105 transition' />
						<div className='text-[11px] text-gray-300'>VShorts</div>
					</Link>
					<Link
						href='/video/subscriptions'
						className='group flex items-center rounded-xl px-3 py-2 text-gray-200 hover:bg-white/10 justify-between'
						title='Подписки'
						aria-label='Подписки'
					>
						<Users className='h-5 w-5 group-hover:text-white group-hover:scale-105 transition' />
						<div className='text-[11px] text-gray-300'>Подписки</div>
					</Link>
					<Link
						href='/video/history'
						className='group flex items-center rounded-xl px-3 py-2 text-gray-200 hover:bg-white/10 justify-between'
						title='История'
						aria-label='История'
					>
						<Clock className='h-5 w-5 group-hover:text-white group-hover:scale-105 transition' />
						<div className='text-[11px] text-gray-300'>История</div>
					</Link>
					<Link
						href='/video/playlists'
						className='group flex items-center rounded-xl px-3 py-2 text-gray-200 hover:bg-white/10 justify-between'
						title='Плейлисты'
						aria-label='Плейлисты'
					>
						<List className='h-5 w-5 group-hover:text-white group-hover:scale-105 transition' />
						<div className='text-[11px] text-gray-300'>Плейлисты</div>
					</Link>
					<Link
						href='/video/later'
						className='group flex items-center rounded-xl px-3 py-2 text-gray-200 hover:bg-white/10 justify-between'
						title='Смотреть позже'
						aria-label='Смотреть позже'
					>
						<Bookmark className='h-5 w-5 group-hover:text-white group-hover:scale-105 transition' />
						<div className='text-[11px] text-gray-300'>Позже</div>
					</Link>
					<Link
						href='/video/liked'
						className='group flex items-center rounded-xl px-3 py-2 text-gray-200 hover:bg-white/10 justify-between'
						title='Понравившиеся'
						aria-label='Понравившиеся'
					>
						<Heart className='h-5 w-5 group-hover:text-white group-hover:scale-105 transition' />
						<div className='text-[11px] text-gray-300'>Понравившиеся</div>
					</Link>
					<Link
						href='/video/studio'
						className='group flex items-center rounded-xl px-3 py-2 text-gray-200 hover:bg-white/10 justify-between'
						title='Моя студия'
						aria-label='Моя студия'
					>
						<User2 className='h-5 w-5 group-hover:text-white group-hover:scale-105 transition' />
						<div className='text-[11px] text-gray-300'>Студия</div>
					</Link>
				</aside>
				<main className='flex-1 px-4 sm:px-6 lg:px-8 pb-20'>
					<div className='flex items-center justify-between gap-3 mb-4'>
						<div className='flex flex-wrap items-center gap-2'>
							<button className='rounded-full bg-white text-black px-3 py-1 text-xs font-medium transition hover:shadow-lg hover:-translate-y-0.5'>
								Все
							</button>
							<button className='rounded-full bg-white/10 px-3 py-1 text-xs text-gray-200 transition hover:bg-white/15 hover:-translate-y-0.5'>
								Популярные
							</button>
							<button className='rounded-full bg-white/10 px-3 py-1 text-xs text-gray-200 transition hover:bg-white/15 hover:-translate-y-0.5'>
								Новые
							</button>
						</div>
						<div className='flex items-center gap-2'>
							<button
								type='button'
								onClick={() => setIsUploadModalOpen(true)}
								className='h-9 rounded-full border border-gray-700 bg-[#222] px-3 text-xs font-semibold text-gray-100 hover:bg-[#333] inline-flex items-center gap-2'
							>
								{isUploading ? (
									<span>Загрузка...</span>
								) : (
									<>
										<Upload className='h-4 w-4' />
										<span className='sr-only'>Загрузить</span>
									</>
								)}
							</button>
							<Link
								href='/video/studio'
								className='hidden sm:inline-flex h-9 items-center rounded-full border border-gray-700 bg-[#222] px-3 text-xs font-semibold text-gray-100 hover:bg-[#333] transition gap-2'
								title='Студия'
							>
								<User2 className='h-4 w-4' />
								<span className='sr-only'>Студия</span>
							</Link>
						</div>
					</div>
					<div className='flex items-center gap-2 text-xs text-gray-400 mb-2'>
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
							<motion.div
								key={v.id}
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.25 }}
								className='overflow-hidden rounded-2xl border border-gray-800/60 bg-gray-900/30 hover:bg-white/5 transition'
							>
								<VideoPreview video={v} />
								<div className='flex gap-3 p-3'>
									<div className='mt-1 h-9 w-9 flex-shrink-0 rounded-full bg-gray-700' />
									<div className='min-w-0 space-y-1'>
										<Link
											href={`/video/watch/${v.id}`}
											className='text-sm font-semibold text-white line-clamp-2 hover:underline'
										>
											{v.title}
										</Link>
										{(v.is_nsfw || v.has_profanity) && (
											<div className='flex flex-wrap gap-1'>
												{v.is_nsfw && (
													<span className='inline-flex items-center rounded-full border border-red-500/50 bg-red-500/10 px-2 py-0.5 text-[10px] text-red-200'>
														18+
													</span>
												)}
												{v.has_profanity && (
													<span className='inline-flex items-center rounded-full border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-200'>
														Нежелательно
													</span>
												)}
											</div>
										)}
										<div className='text-xs text-gray-400'>
											{v.author_name || 'Автор'}
										</div>
										<div className='text-[11px] text-gray-500'>
											{v.views || 0} просмотров · {v.likes || 0} лайков
										</div>
									</div>
									<div className='ml-auto'>
										<Link
											href={`/video/watch/${v.id}`}
											className='h-8 inline-flex items-center rounded-full border border-gray-700 bg-[#222] px-3 text-[11px] font-semibold text-gray-100 hover:bg-[#333]'
										>
											Смотреть
										</Link>
									</div>
								</div>
							</motion.div>
						))}
					</div>
					{hasMore && (
						<div className='mt-6 flex justify-center'>
							<button
								onClick={loadMore}
								disabled={isLoading}
								className='h-9 rounded-full border border-gray-700 bg-[#222] px-4 text-xs font-semibold text-gray-100 hover:bg-[#333] disabled:opacity-60'
							>
								{isLoading ? 'Загрузка...' : 'Показать ещё'}
							</button>
						</div>
					)}
					<div ref={loadMoreRef} className='h-6' />
				</main>
			</div>
			{isUploadModalOpen && (
				<div className='fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-4'>
					<div className='w-full max-w-xl rounded-2xl border border-gray-800 bg-gray-900/95 p-6 text-white shadow-2xl'>
						<div className='mb-5 flex items-center justify-between'>
							<h3 className='text-lg font-semibold'>Загрузка видео</h3>
							<button
								type='button'
								onClick={handleModalClose}
								className='rounded-full px-2 py-1 text-sm text-gray-400 hover:text-white'
							>
								✕
							</button>
						</div>
						<div className='space-y-4'>
							<div className='flex items-center gap-2 text-xs'>
								<button
									type='button'
									onClick={() => {
										setUploadType('video')
										setUploadDurationError('')
									}}
									className={`rounded-full px-3 py-1.5 border ${
										uploadType === 'video'
											? 'border-white/20 bg-white/10 text-white'
											: 'border-gray-800 text-gray-300 hover:bg-white/5'
									}`}
								>
									Видео
								</button>
								<button
									type='button'
									onClick={() => {
										setUploadType('shorts')
										if (uploadDuration && uploadDuration > 60) {
											setUploadDurationError('VShorts до 60 секунд')
										} else {
											setUploadDurationError('')
										}
									}}
									className={`rounded-full px-3 py-1.5 border ${
										uploadType === 'shorts'
											? 'border-white/20 bg-white/10 text-white'
											: 'border-gray-800 text-gray-300 hover:bg-white/5'
									}`}
								>
									VShorts
								</button>
								{uploadType === 'shorts' && (
									<span className='text-gray-400'>до 60 сек</span>
								)}
							</div>
							<div>
								<label className='mb-1 block text-xs text-gray-400'>
									Название
								</label>
								<input
									value={uploadTitle}
									onChange={e => {
										setUploadTitle(e.target.value)
										setUploadChecked(false)
										setUploadCheckResult(null)
										setUploadCheckError('')
										setUploadCheckStatus('idle')
										setUploadCheckJobId(null)
									}}
									className='w-full rounded-xl border border-gray-800 bg-black/40 px-3 py-2 text-sm text-white'
									placeholder='Название видео'
								/>
							</div>
							<div>
								<label className='mb-1 block text-xs text-gray-400'>
									Описание
								</label>
								<textarea
									value={uploadDescription}
									onChange={e => {
										setUploadDescription(e.target.value)
										setUploadChecked(false)
										setUploadCheckResult(null)
										setUploadCheckError('')
										setUploadCheckStatus('idle')
										setUploadCheckJobId(null)
									}}
									className='w-full rounded-xl border border-gray-800 bg-black/40 px-3 py-2 text-sm text-white'
									rows={3}
									placeholder='Описание видео'
								/>
							</div>
							<div>
								<label className='mb-1 block text-xs text-gray-400'>Теги</label>
								<input
									value={uploadTags}
									onChange={e => {
										setUploadTags(e.target.value)
										setUploadChecked(false)
										setUploadCheckResult(null)
										setUploadCheckError('')
										setUploadCheckStatus('idle')
										setUploadCheckJobId(null)
									}}
									className='w-full rounded-xl border border-gray-800 bg-black/40 px-3 py-2 text-sm text-white'
									placeholder='Например: музыка, клипы'
								/>
							</div>
							<div className='flex items-center gap-2 text-sm text-gray-200'>
								<input
									id='allow-comments'
									type='checkbox'
									checked={uploadAllowComments}
									onChange={e => {
										setUploadAllowComments(e.target.checked)
										setUploadChecked(false)
										setUploadCheckResult(null)
										setUploadCheckError('')
										setUploadCheckStatus('idle')
										setUploadCheckJobId(null)
									}}
									className='h-4 w-4 rounded border-gray-700 bg-black/40'
								/>
								<label htmlFor='allow-comments'>Разрешить комментарии</label>
							</div>
							<div>
								<label className='mb-1 block text-xs text-gray-400'>
									Файл видео
								</label>
								<input
									type='file'
									accept='video/*'
									onChange={async e => {
										const file = e.target.files?.[0] || null
										setUploadFile(file)
										if (file && !uploadTitle.trim()) {
											setUploadTitle(file.name)
										}
										setUploadChecked(false)
										setUploadCheckResult(null)
										setUploadCheckError('')
										setUploadVideoUrl(null)
										setUploadCheckStatus('idle')
										setUploadCheckJobId(null)
										setUploadDuration(null)
										setUploadDurationError('')
										if (file) {
											try {
												const duration = await getVideoDuration(file)
												setUploadDuration(duration)
												if (uploadType === 'shorts' && duration > 60) {
													setUploadDurationError('VShorts до 60 секунд')
												}
											} catch {
												setUploadDurationError(
													'Не удалось определить длительность',
												)
											}
										}
									}}
									className='w-full text-sm text-gray-200 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-800 file:px-3 file:py-2 file:text-xs file:text-gray-200 hover:file:bg-gray-700'
								/>
							</div>
							{uploadDuration != null && (
								<div className='text-xs text-gray-400'>
									Длительность: {uploadDuration} сек
								</div>
							)}
						</div>
						{uploadCheckStatus !== 'idle' && !uploadCheckResult && (
							<div className='mt-3 text-xs text-gray-300'>
								{uploadCheckStatus === 'queued' && 'Проверка в очереди'}
								{uploadCheckStatus === 'processing' && 'Проверка выполняется'}
								{uploadCheckStatus === 'error' && 'Ошибка проверки'}
							</div>
						)}
						{uploadCheckResult && (
							<div className='mt-4 text-xs text-gray-300'>
								<div className='flex flex-wrap gap-2'>
									{uploadCheckResult.is_nsfw && (
										<span className='inline-flex items-center rounded-full border border-red-500/50 bg-red-500/10 px-2 py-0.5 text-[10px] text-red-200'>
											18+
										</span>
									)}
									{uploadCheckResult.has_profanity && (
										<span className='inline-flex items-center rounded-full border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-200'>
											Нежелательно
										</span>
									)}
									{!uploadCheckResult.is_nsfw &&
										!uploadCheckResult.has_profanity && (
											<span className='text-emerald-300'>
												Проверка пройдена
											</span>
										)}
								</div>
							</div>
						)}
						{uploadCheckError && (
							<div className='mt-2 text-xs text-red-300'>
								{uploadCheckError}
							</div>
						)}
						{uploadDurationError && (
							<div className='mt-2 text-xs text-red-300'>
								{uploadDurationError}
							</div>
						)}
						<div className='mt-6 flex items-center justify-end gap-2'>
							<button
								type='button'
								onClick={handleCheckUpload}
								className='h-9 rounded-full border border-gray-700 bg-[#222] px-4 text-xs font-semibold text-gray-100 hover:bg-[#333]'
								disabled={!uploadFile || !uploadTitle.trim() || isChecking}
							>
								{isChecking ? 'Проверка...' : 'Проверить'}
							</button>
							<button
								type='button'
								onClick={handleSubmitUpload}
								className='h-9 rounded-full bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50'
								disabled={!uploadChecked || isUploading}
							>
								Загрузить
							</button>
						</div>
					</div>
				</div>
			)}
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
