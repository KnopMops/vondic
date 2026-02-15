'use client'

import { useAppSelector } from '@/lib/hooks'
import { getAttachmentUrl } from '@/lib/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import VideoPlayer from './VideoPlayer'

type Reaction = { user_id: string; emoji: string; created_at?: string }
type Item = {
	id: string
	url: string
	type?: 'image' | 'video'
	created_at?: string
	reactions?: Reaction[]
}

type Props = {
	isOpen: boolean
	onClose: () => void
	items: Item[]
	title?: string
	ownerId: string
}

const REACTIONS = ['❤️', '😂', '🔥', '😮', '😢', '👍']

export default function StoriesModal({
	isOpen,
	onClose,
	items,
	title,
	ownerId,
}: Props) {
	const { user } = useAppSelector(state => state.auth)
	const [index, setIndex] = useState(0)
	const [storyItems, setStoryItems] = useState<Item[]>(items)
	useEffect(() => {
		if (!isOpen) setIndex(0)
	}, [isOpen])
	useEffect(() => {
		if (isOpen) {
			setStoryItems(items)
		}
	}, [items, isOpen])

	if (!isOpen) return null

	const current = storyItems[index]
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

	return (
		<AnimatePresence>
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				className='fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4'
			>
				<motion.div
					initial={{ scale: 0.9, opacity: 0 }}
					animate={{ scale: 1, opacity: 1 }}
					exit={{ scale: 0.9, opacity: 0 }}
					className='w-full max-w-md space-y-6 rounded-2xl bg-gray-900/90 border border-white/10 p-8 shadow-2xl backdrop-blur-xl'
				>
					<div className='flex items-center justify-between'>
						<div className='text-sm text-gray-400'>{title || 'Сторис'}</div>
						<button
							onClick={onClose}
							className='rounded-md bg-white/10 px-3 py-1 text-sm text-white hover:bg-white/20 transition-colors'
						>
							Закрыть
						</button>
					</div>

					<div className='rounded-xl overflow-hidden bg-black'>
						{current?.type === 'video' ? (
							<VideoPlayer src={getAttachmentUrl(current.url)} />
						) : (
							<img
								src={getAttachmentUrl(current?.url || '')}
								alt='story'
								className='w-full max-h-[70vh] object-contain'
							/>
						)}
					</div>

					{Object.keys(reactionCounts).length > 0 && (
						<div className='flex flex-wrap gap-2'>
							{Object.entries(reactionCounts).map(([emoji, count]) => (
								<div
									key={emoji}
									className='flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-sm text-gray-300'
								>
									<span>{emoji}</span>
									<span className='text-xs text-gray-400'>{count}</span>
								</div>
							))}
						</div>
					)}

					<div className='flex flex-wrap gap-2'>
						{REACTIONS.map(emoji => (
							<button
								key={emoji}
								onClick={() => handleReact(emoji)}
								className={`rounded-full px-2.5 py-1.5 text-lg transition-colors ${
									userReaction === emoji
										? 'bg-indigo-500/20 text-white'
										: 'bg-white/10 text-gray-300 hover:bg-white/20'
								}`}
							>
								{emoji}
							</button>
						))}
					</div>

					{storyItems.length > 1 && (
						<div className='flex items-center justify-between'>
							<button
								onClick={() => setIndex(i => Math.max(0, i - 1))}
								className='rounded-md bg-white/10 px-3 py-1 text-sm text-white hover:bg-white/20 transition-colors'
							>
								Назад
							</button>
							<div className='text-xs text-gray-400'>
								{index + 1} / {storyItems.length}
							</div>
							<button
								onClick={() =>
									setIndex(i => Math.min(storyItems.length - 1, i + 1))
								}
								className='rounded-md bg-white/10 px-3 py-1 text-sm text-white hover:bg-white/20 transition-colors'
							>
								Вперёд
							</button>
						</div>
					)}
				</motion.div>
			</motion.div>
		</AnimatePresence>
	)
}
