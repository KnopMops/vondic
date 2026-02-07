'use client'

import { useAppSelector } from '@/lib/hooks'
import { useEffect, useState } from 'react'

type Comment = {
	id: string
	content: string
	user_id: string
	created_at?: string
	author_name?: string
	author_avatar?: string
	parent_id?: string
	likes?: number
	is_liked?: boolean
}

interface CommentsModalProps {
	postId: string | number
	isOpen: boolean
	onClose: () => void
}

function CommentItem({
	comment,
	onReply,
	currentUserId,
}: {
	comment: Comment
	onReply: (comment: Comment) => void
	currentUserId?: string
}) {
	const [likeCount, setLikeCount] = useState(comment.likes || 0)
	const [isLiked, setIsLiked] = useState(comment.is_liked || false)
	const [isLiking, setIsLiking] = useState(false)

	const handleLike = async () => {
		if (isLiking || !currentUserId) return
		setIsLiking(true)

		const newIsLiked = !isLiked
		const newCount = newIsLiked ? likeCount + 1 : likeCount - 1

		setIsLiked(newIsLiked)
		setLikeCount(newCount)

		try {
			const res = await fetch(`/api/comments/${comment.id}/like`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: newIsLiked ? 'like' : 'unlike' }),
			})

			if (!res.ok) {
				setIsLiked(!newIsLiked)
				setLikeCount(likeCount)
			}
		} catch (e) {
			console.error(e)
			setIsLiked(!newIsLiked)
			setLikeCount(likeCount)
		} finally {
			setIsLiking(false)
		}
	}

	return (
		<div className='flex gap-3'>
			<img
				src={comment.author_avatar || '/placeholder-user.jpg'}
				alt={comment.author_name || 'User'}
				className='w-8 h-8 rounded-full object-cover'
			/>
			<div className='flex-1'>
				<div className='bg-gray-100 dark:bg-gray-700 rounded-lg p-3'>
					<div className='font-semibold text-sm text-gray-900 dark:text-white'>
						{comment.author_name || 'User'}
					</div>
					<div className='text-sm text-gray-700 dark:text-gray-300 mt-1'>
						{comment.content}
					</div>
				</div>
				<div className='flex items-center gap-4 mt-1 ml-1 text-xs text-gray-500 dark:text-gray-400'>
					<span>
						{new Date(comment.created_at || Date.now()).toLocaleDateString()}
					</span>
					<button
						onClick={handleLike}
						disabled={isLiking}
						className={`flex items-center gap-1 font-semibold hover:underline ${isLiked ? 'text-red-500' : ''}`}
					>
						{isLiked ? 'Не нравится' : 'Нравится'}
						{likeCount > 0 && <span className='ml-1'>({likeCount})</span>}
					</button>
					<button
						onClick={() => onReply(comment)}
						className='font-semibold hover:underline'
					>
						Ответить
					</button>
				</div>
			</div>
		</div>
	)
}

export default function CommentsModal({
	postId,
	isOpen,
	onClose,
}: CommentsModalProps) {
	const { user } = useAppSelector(state => state.auth)
	const [comments, setComments] = useState<Comment[]>([])
	const [newComment, setNewComment] = useState('')
	const [loading, setLoading] = useState(false)
	const [submitting, setSubmitting] = useState(false)
	const [replyTo, setReplyTo] = useState<Comment | null>(null)

	const fetchComments = async () => {
		setLoading(true)
		try {
			const res = await fetch(`/api/posts/${postId}/comments`)
			if (res.ok) {
				const data = await res.json()
				setComments(Array.isArray(data) ? data : [])
			}
		} catch (e) {
			console.error(e)
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		if (isOpen) {
			fetchComments()
			setReplyTo(null)
			setNewComment('')
		}
	}, [isOpen, postId])

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!newComment.trim() || !user) return

		setSubmitting(true)
		try {
			const payload: any = { content: newComment }
			if (replyTo) {
				payload.parent_id = replyTo.id
			}

			const res = await fetch(`/api/posts/${postId}/comments`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			})

			if (res.ok) {
				setNewComment('')
				setReplyTo(null)
				fetchComments()
			}
		} catch (e) {
			console.error(e)
		} finally {
			setSubmitting(false)
		}
	}

	if (!isOpen) return null

	return (
		<div className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50'>
			<div className='flex h-[80vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl dark:bg-gray-800'>
				{/* Header */}
				<div className='flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700'>
					<h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
						Комментарии
					</h3>
					<button
						onClick={onClose}
						className='rounded-full p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200'
					>
						<svg
							xmlns='http://www.w3.org/2000/svg'
							fill='none'
							viewBox='0 0 24 24'
							strokeWidth={1.5}
							stroke='currentColor'
							className='h-6 w-6'
						>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								d='M6 18L18 6M6 6l12 12'
							/>
						</svg>
					</button>
				</div>

				{/* Comments List */}
				<div className='flex-1 overflow-y-auto p-4'>
					{loading ? (
						<div className='flex h-full items-center justify-center text-gray-500'>
							Загрузка...
						</div>
					) : comments.length === 0 ? (
						<div className='flex h-full items-center justify-center text-gray-500'>
							Нет комментариев. Будьте первым!
						</div>
					) : (
						<div className='space-y-4'>
							{comments.map(comment => (
								<CommentItem
									key={comment.id}
									comment={comment}
									onReply={setReplyTo}
									currentUserId={user?.id}
								/>
							))}
						</div>
					)}
				</div>

				{/* Input Area */}
				<div className='border-t border-gray-200 p-4 dark:border-gray-700'>
					{replyTo && (
						<div className='mb-2 flex items-center justify-between rounded-md bg-indigo-50 p-2 text-xs text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'>
							<span>
								Ответ пользователю <b>{replyTo.author_name || 'User'}</b>
							</span>
							<button
								onClick={() => setReplyTo(null)}
								className='hover:text-indigo-900 dark:hover:text-indigo-100'
							>
								✕
							</button>
						</div>
					)}
					<form onSubmit={handleSubmit} className='flex gap-2'>
						<input
							type='text'
							value={newComment}
							onChange={e => setNewComment(e.target.value)}
							placeholder='Написать комментарий...'
							className='flex-1 rounded-full border border-gray-300 bg-gray-50 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400'
						/>
						<button
							type='submit'
							disabled={!newComment.trim() || submitting}
							className='rounded-full bg-indigo-600 p-2 text-white hover:bg-indigo-700 disabled:bg-indigo-400'
						>
							<svg
								xmlns='http://www.w3.org/2000/svg'
								viewBox='0 0 20 20'
								fill='currentColor'
								className='h-5 w-5'
							>
								<path d='M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A.75.75 0 003.75 8.25H10a.75.75 0 010 1.5H3.75a.75.75 0 00-.057.056l-1.414 4.925a.75.75 0 00.826.95 12.894 12.894 0 009-3.69 4.48 4.48 0 000-6.32 12.89 12.89 0 00-9-3.69z' />
							</svg>
						</button>
					</form>
				</div>
			</div>
		</div>
	)
}
