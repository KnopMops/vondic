'use client'

import Header from '@/components/social/Header'
import { useAuth } from '@/lib/AuthContext'
import { getAttachmentUrl } from '@/lib/utils'
import { FiHome as Home, FiUpload as Upload } from 'react-icons/fi'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

type VideoItem = {
	id: string
	title: string
	description?: string | null
	url: string
	poster?: string | null
	views?: number
	likes?: number
	is_published?: boolean
	created_at?: string
}

export default function StudioPage() {
	const { user, logout } = useAuth()
	const [videos, setVideos] = useState<VideoItem[]>([])
	const [isUploading, setIsUploading] = useState(false)
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editTitle, setEditTitle] = useState('')
	const [editDescription, setEditDescription] = useState('')
	const [actionId, setActionId] = useState<string | null>(null)
	const [statsId, setStatsId] = useState<string | null>(null)
	const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
	const [uploadFile, setUploadFile] = useState<File | null>(null)
	const [uploadTitle, setUploadTitle] = useState('')
	const [uploadDescription, setUploadDescription] = useState('')
	const [uploadTags, setUploadTags] = useState('')
	const [uploadAllowComments, setUploadAllowComments] = useState(true)
	const [uploadType, setUploadType] = useState<'video' | 'shorts'>('video')
	const [uploadDuration, setUploadDuration] = useState<number | null>(null)
	const [uploadDurationError, setUploadDurationError] = useState('')
	const [uploadError, setUploadError] = useState('')

	const fetchMyVideos = async () => {
		const params = new URLSearchParams({
			sort: 'created_at',
			order: 'desc',
			limit: '100',
		})
		const res = await fetch(`/api/videos/my?${params.toString()}`, {
			cache: 'no-store',
		})
		if (res.ok) {
			const data = await res.json()
			setVideos(Array.isArray(data) ? data : [])
		}
	}

	useEffect(() => {
		fetchMyVideos()
	}, [])

	const startEdit = (video: VideoItem) => {
		setEditingId(video.id)
		setEditTitle(video.title || '')
		setEditDescription(video.description || '')
	}

	const cancelEdit = () => {
		setEditingId(null)
		setEditTitle('')
		setEditDescription('')
	}

	const saveEdit = async (videoId: string) => {
		if (!editTitle.trim()) return
		setActionId(videoId)
		try {
			const res = await fetch(`/api/videos/${videoId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: editTitle.trim(),
					description: editDescription.trim() || null,
				}),
			})
			if (res.ok) {
				const data = await res.json()
				setVideos(prev =>
					prev.map(v => (v.id === videoId ? { ...v, ...data } : v)),
				)
				cancelEdit()
			}
		} finally {
			setActionId(null)
		}
	}

	const togglePublish = async (video: VideoItem) => {
		setActionId(video.id)
		try {
			const res = await fetch(`/api/videos/${video.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ is_published: !video.is_published }),
			})
			if (res.ok) {
				const data = await res.json()
				setVideos(prev =>
					prev.map(v => (v.id === video.id ? { ...v, ...data } : v)),
				)
			}
		} finally {
			setActionId(null)
		}
	}

	const removeVideo = async (videoId: string) => {
		setActionId(videoId)
		try {
			const res = await fetch(`/api/videos/${videoId}`, { method: 'DELETE' })
			if (res.ok) {
				setVideos(prev => prev.filter(v => v.id !== videoId))
			}
		} finally {
			setActionId(null)
		}
	}

	const uploadVideoFile = async (file: File) => {
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

	const handleModalClose = () => {
		setIsUploadModalOpen(false)
		setUploadFile(null)
		setUploadTitle('')
		setUploadDescription('')
		setUploadTags('')
		setUploadAllowComments(true)
		setUploadType('video')
		setUploadDuration(null)
		setUploadDurationError('')
		setUploadError('')
	}

	const handleSubmitUpload = async () => {
		if (!uploadFile || !uploadTitle.trim() || isUploading) return
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
		setIsUploading(true)
		setUploadError('')
		try {
			const url = await uploadVideoFile(uploadFile)
			const createRes = await fetch('/api/videos', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: uploadTitle.trim(),
					description: uploadDescription.trim() || null,
					tags: uploadTags.trim() || null,
					allow_comments: uploadAllowComments,
					duration: uploadDuration ?? undefined,
					url,
				}),
			})
			if (!createRes.ok) throw new Error(await createRes.text())
			await fetchMyVideos()
			handleModalClose()
		} catch (e: any) {
			setUploadError(e?.message || 'Ошибка загрузки')
		} finally {
			setIsUploading(false)
		}
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
				<main className='flex-1 px-4 sm:px-6 lg:px-8 pb-20'>
					<div className='mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
						<div className='text-lg font-semibold'>Моя студия</div>
						<div className='flex items-center gap-2'>
							<button
								onClick={() => setIsUploadModalOpen(true)}
								className='h-9 rounded-full border border-gray-700/70 bg-gray-900/60 px-3 text-xs font-semibold text-gray-100 hover:bg-gray-900/80 inline-flex items-center gap-2'
							>
								{isUploading ? (
									<span>Загрузка...</span>
								) : (
									<>
										<Upload className='h-4 w-4' />
										<span>Загрузить</span>
									</>
								)}
							</button>
							<Link
								href='/video'
								className='hidden sm:inline-flex h-9 items-center rounded-full border border-gray-700/70 bg-gray-900/60 px-3 text-xs font-semibold text-gray-100 hover:bg-gray-900/80 transition gap-2'
								title='Главная'
							>
								<Home className='h-4 w-4' />
								<span className='sr-only'>Главная</span>
							</Link>
						</div>
					</div>
					<div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
						{videos.map(v => (
							<div
								key={v.id}
								className='overflow-hidden rounded-2xl border border-gray-800/60 bg-gray-900/30 hover:bg-white/5 transition'
							>
								<VideoPreview video={v} />
								<div className='flex gap-3 p-3 text-sm'>
									<div className='mt-1 h-8 w-8 flex-shrink-0 rounded-full bg-gray-700' />
									<div className='min-w-0 space-y-1'>
										{editingId === v.id ? (
											<div className='space-y-2'>
												<input
													value={editTitle}
													onChange={e => setEditTitle(e.target.value)}
													className='h-8 w-full rounded-lg border border-gray-700 bg-black/40 px-2 text-xs text-gray-100 outline-none'
												/>
												<textarea
													value={editDescription}
													onChange={e => setEditDescription(e.target.value)}
													className='w-full rounded-lg border border-gray-700 bg-black/40 px-2 py-1 text-xs text-gray-100 outline-none'
													rows={3}
												/>
												<div className='flex gap-2'>
													<button
														onClick={() => saveEdit(v.id)}
														disabled={actionId === v.id}
														className='h-8 rounded-full border border-gray-700 bg-[#222] px-3 text-[11px] font-semibold text-gray-100 hover:bg-[#333] disabled:opacity-60'
													>
														Сохранить
													</button>
													<button
														onClick={cancelEdit}
														className='h-8 rounded-full border border-gray-700 bg-transparent px-3 text-[11px] font-semibold text-gray-300 hover:text-white'
													>
														Отмена
													</button>
												</div>
											</div>
										) : (
											<>
												<div className='font-semibold line-clamp-2'>
													{v.title}
												</div>
												<div className='text-xs text-gray-400'>
													{v.views || 0} просмотров · {v.likes || 0} лайков
												</div>
												<div className='text-[11px] text-gray-500'>
													{v.is_published
														? 'Опубликовано'
														: 'Снято с публикации'}
												</div>
												<div className='flex flex-wrap gap-2 pt-2'>
													<button
														onClick={() => startEdit(v)}
														className='h-8 rounded-full border border-gray-700 bg-transparent px-3 text-[11px] font-semibold text-gray-300 hover:text-white'
													>
														Изменить
													</button>
													<button
														onClick={() => togglePublish(v)}
														disabled={actionId === v.id}
														className='h-8 rounded-full border border-gray-700 bg-[#222] px-3 text-[11px] font-semibold text-gray-100 hover:bg-[#333] disabled:opacity-60'
													>
														{v.is_published ? 'Снять' : 'Опубликовать'}
													</button>
													<button
														onClick={() =>
															setStatsId(statsId === v.id ? null : v.id)
														}
														className='h-8 rounded-full border border-gray-700 bg-transparent px-3 text-[11px] font-semibold text-gray-300 hover:text-white'
													>
														Статистика
													</button>
													<button
														onClick={() => removeVideo(v.id)}
														disabled={actionId === v.id}
														className='h-8 rounded-full border border-red-800/70 bg-red-900/20 px-3 text-[11px] font-semibold text-red-200 hover:bg-red-900/40 disabled:opacity-60'
													>
														Удалить
													</button>
												</div>
												{statsId === v.id && (
													<div className='mt-2 text-[11px] text-gray-400 space-y-1'>
														<div>Просмотры: {v.views || 0}</div>
														<div>Лайки: {v.likes || 0}</div>
														<div>
															Дата:{' '}
															{v.created_at
																? new Date(v.created_at).toLocaleString()
																: '—'}
														</div>
													</div>
												)}
											</>
										)}
									</div>
								</div>
							</div>
						))}
					</div>
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
									onChange={e => setUploadTitle(e.target.value)}
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
									onChange={e => setUploadDescription(e.target.value)}
									className='w-full rounded-xl border border-gray-800 bg-black/40 px-3 py-2 text-sm text-white'
									rows={3}
									placeholder='Описание видео'
								/>
							</div>
							<div>
								<label className='mb-1 block text-xs text-gray-400'>Теги</label>
								<input
									value={uploadTags}
									onChange={e => setUploadTags(e.target.value)}
									className='w-full rounded-xl border border-gray-800 bg-black/40 px-3 py-2 text-sm text-white'
									placeholder='Например: музыка, клипы'
								/>
							</div>
							<div className='flex items-center gap-2 text-sm text-gray-200'>
								<input
									id='allow-comments-studio'
									type='checkbox'
									checked={uploadAllowComments}
									onChange={e => setUploadAllowComments(e.target.checked)}
									className='h-4 w-4 rounded border-gray-700 bg-black/40'
								/>
								<label htmlFor='allow-comments-studio'>
									Разрешить комментарии
								</label>
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
						{uploadError && (
							<div className='mt-2 text-xs text-red-300'>{uploadError}</div>
						)}
						{uploadDurationError && (
							<div className='mt-2 text-xs text-red-300'>
								{uploadDurationError}
							</div>
						)}
						<div className='mt-6 flex items-center justify-end gap-2'>
							<button
								type='button'
								onClick={handleSubmitUpload}
								className='h-9 rounded-full bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50'
								disabled={!uploadFile || !uploadTitle.trim() || isUploading}
							>
								{isUploading ? 'Загрузка...' : 'Загрузить'}
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
