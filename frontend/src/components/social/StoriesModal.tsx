"'use client'"

import { useAppSelector } from '@/lib/hooks'
import { getAttachmentUrl } from '@/lib/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type Reaction = { user_id: string; emoji: string; created_at?: string }
type Item = {
	id: string
	url: string
	type?: 'image' | 'video'
	created_at?: string
	text?: string
	reactions?: Reaction[]
}

type Props = {
	isOpen: boolean
	onClose: () => void
	items: Item[]
	title?: string
	ownerId: string
	onUpdateStories?: (items: Item[]) => void
}

const REACTIONS = ['❤️', '😂', '🔥', '😮', '😢', '👍']

export default function StoriesModal({
	isOpen,
	onClose,
	items,
	title,
	ownerId,
	onUpdateStories,
}: Props) {
	const { user } = useAppSelector(state => state.auth)
	const [mounted, setMounted] = useState(false)
	const [index, setIndex] = useState(0)
	const [storyItems, setStoryItems] = useState<Item[]>(items)
	const [progress, setProgress] = useState(0)
	const [isPaused, setIsPaused] = useState(false)
	const videoRef = useRef<HTMLVideoElement | null>(null)
	const pausedRef = useRef(false)

	useEffect(() => {
		setMounted(true)
	}, [])

	const current = storyItems[index]
	const isVideo = current?.type === 'video'

	const reactionCounts = (current?.reactions || []).reduce(
		(acc, reaction) => {
			if (!reaction?.emoji) return acc
			acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1
			return acc
		},
		{} as Record<string, number>,
	)
	const userReaction =
		current?.reactions?.find(r => r.user_id === user?.id)?.emoji || null

	const next = () => {
		if (storyItems.length === 0) return
		if (index < storyItems.length - 1) {
			setIndex(i => i + 1)
			setProgress(0)
			return
		}
		onClose()
	}

	const prev = () => {
		if (storyItems.length === 0) return
		if (index > 0) {
			setIndex(i => i - 1)
			setProgress(0)
			return
		}
	}
	useEffect(() => {
		if (!isOpen) setIndex(0)
	}, [isOpen])
	useEffect(() => {
		if (isOpen) {
			setStoryItems(items)
			setProgress(0)
		}
	}, [items, isOpen])

	useEffect(() => {
		pausedRef.current = isPaused
	}, [isPaused])

	useEffect(() => {
		if (!isOpen || !current) return
		const total = isVideo ? 60000 : 10000
		const step = 50
		let elapsed = 0
		setProgress(0)
		const id = setInterval(() => {
			if (pausedRef.current) return
			elapsed += step
			const value = Math.min(1, elapsed / total)
			setProgress(value)
			if (value >= 1) {
				clearInterval(id)
				next()
			}
		}, step)
		return () => {
			clearInterval(id)
		}
	}, [index, isOpen, isVideo, current])

	useEffect(() => {
		const v = videoRef.current
		if (!v) return
		if (isPaused) {
			v.pause()
		} else {
			v.play().catch(() => {})
		}
	}, [isPaused, index])

	if (!isOpen || !mounted) return null

	const handleReact = async (emoji: string) => {
		if (!current?.id || !ownerId) return
		const res = await fetch('/api/storis/react', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ owner_id: ownerId, story_id: current.id, emoji }),
		})
		if (!res.ok) return
		const data = await res.json().catch(() => ({}))
		if (data?.story) {
			setStoryItems(prev =>
				prev.map(item => (item.id === data.story.id ? data.story : item)),
			)
		}
	}

	const mediaUrl = current?.url ? getAttachmentUrl(current.url) : ''
	const backgroundUrl = mediaUrl

	const getSegmentProgress = (i: number) => {
		if (i < index) return 1
		if (i > index) return 0
		return progress
	}

	const isOwner = user?.id === ownerId

	const handleDelete = async () => {
		if (!current?.id) return
		const res = await fetch('/api/storis/delete', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ story_id: current.id }),
		})
		if (!res.ok) return
		const data = await res.json().catch(() => ({}))
		if (Array.isArray(data?.storis)) {
			const items = data.storis as Item[]
			setStoryItems(items)
			if (onUpdateStories) {
				onUpdateStories(items)
			}
			if (items.length === 0) {
				onClose()
				return
			}
			const idx = items.findIndex(it => it.id === current.id)
			if (idx === -1) {
				setIndex(0)
			}
		} else {
			setStoryItems(prev => {
				const nextItems = prev.filter(it => it.id !== current.id)
				if (onUpdateStories) {
					onUpdateStories(nextItems)
				}
				return nextItems
			})
			if (storyItems.length <= 1) {
				onClose()
			} else if (index >= storyItems.length - 1) {
				setIndex(prev => Math.max(0, prev - 1))
			}
		}
	}

	return createPortal(
		<AnimatePresence>
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				className='fixed inset-0 z-[99999] flex items-center justify-center'
			>
				<div className='absolute inset-0'>
					<div
						className='absolute inset-0 bg-center bg-cover'
						style={{
							backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : undefined,
							filter: 'blur(24px)',
							transform: 'scale(1.1)',
						}}
					/>
					<div className='absolute inset-0 bg-black/60' />
				</div>
				<motion.div
					initial={{ opacity: 0, scale: 0.9, y: 40 }}
					animate={{ opacity: 1, scale: 1, y: 0 }}
					exit={{ opacity: 0, scale: 0.9, y: 40 }}
					transition={{ duration: 0.18 }}
					className='relative z-10 flex w-full max-w-md items-center justify-center px-3 md:px-0'
				>
					<div className='relative w-full aspect-[9/16] max-h-[90vh] rounded-3xl bg-black/80 overflow-hidden'>
						<div className='absolute inset-0'>
							{mediaUrl
								? isVideo
									? (
										<video
											ref={videoRef}
											src={mediaUrl}
											className='h-full w-full object-cover'
											autoPlay
											playsInline
											muted={false}
											onEnded={next}
										/>
									)
									: (
										<img
											src={mediaUrl}
											alt='story'
											className='h-full w-full object-cover'
										/>
									)
								: null}
							<div className='absolute inset-0 flex'>
								<button
									type='button'
									onClick={prev}
									className='h-full flex-1 bg-transparent'
								/>
								<button
									type='button'
									onClick={() => setIsPaused(x => !x)}
									className='h-full flex-1 bg-transparent'
								/>
								<button
									type='button'
									onClick={next}
									className='h-full flex-1 bg-transparent'
								/>
							</div>
						</div>

						<div className='absolute left-4 right-4 top-4 space-y-3'>
							<div className='flex gap-1'>
								{storyItems.map((item, i) => (
									<div
										key={item.id}
										className='h-1 flex-1 overflow-hidden rounded-full bg-white/25'
									>
										<div
											className='h-full bg-white transition-[width] duration-150'
											style={{ width: `${getSegmentProgress(i) * 100}%` }}
										/>
									</div>
								))}
							</div>
							<div className='flex items-center justify-between px-1'>
								<div className='text-sm text-gray-200'>
									{title || 'Сторис'}
								</div>
								<div className='flex items-center gap-2'>
									{isOwner && (
										<button
											onClick={handleDelete}
											className='rounded-full bg-red-500/70 px-3 py-1 text-xs font-medium text-white hover:bg-red-500 transition-colors'
										>
											Удалить
										</button>
									)}
									<button
										onClick={onClose}
										className='rounded-full bg-black/40 px-3 py-1 text-xs font-medium text-white hover:bg-black/60 transition-colors'
									>
										Закрыть
									</button>
								</div>
							</div>
						</div>

						<div className='absolute bottom-4 left-4 right-4 space-y-3'>
							{current?.text && (
								<div className='rounded-2xl bg-black/40 px-3 py-2 text-sm text-gray-100'>
									{current.text}
								</div>
							)}
							{Object.keys(reactionCounts).length > 0 && (
								<div className='flex flex-wrap gap-2'>
									{Object.entries(reactionCounts).map(([emoji, count]) => (
										<div
											key={emoji}
											className='flex items-center gap-1 rounded-full bg-black/40 px-2 py-1 text-sm text-gray-100'
										>
											<span>{emoji}</span>
											<span className='text-xs text-gray-300'>{count}</span>
										</div>
									))}
								</div>
							)}

							<div className='flex flex-wrap items-center justify-between gap-3'>
								<div className='flex flex-wrap gap-2'>
									{REACTIONS.map(emoji => (
										<button
											key={emoji}
											onClick={() => handleReact(emoji)}
											className={`rounded-full px-2.5 py-1.5 text-lg transition-colors ${
												userReaction === emoji
													? 'bg-indigo-500/40 text-white'
													: 'bg-black/40 text-gray-100 hover:bg-black/60'
											}`}
										>
											{emoji}
										</button>
									))}
								</div>
								{storyItems.length > 1 && (
									<div className='text-xs text-gray-200'>
										{index + 1} / {storyItems.length}
									</div>
								)}
							</div>
						</div>
					</div>
				</motion.div>
			</motion.div>
		</AnimatePresence>,
		document.body,
	)
}
