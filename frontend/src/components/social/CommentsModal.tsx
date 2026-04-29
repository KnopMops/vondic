'use client'

import { useAppSelector } from '@/lib/hooks'
import { useComments } from '@/lib/hooks/useComments'
import { getAvatarUrl, getAttachmentUrl } from '@/lib/utils'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
	LuCornerUpLeft as Reply,
	LuHeart as Heart,
	LuMoreVertical as MoreVertical,
	LuPencil as Pencil,
	LuSend as Send,
	LuTrash2 as Trash2,
	LuX as X,
} from 'react-icons/lu'

type Comment = {
	id: string
	content: string
	user_id: string
	created_at?: string
	author_name?: string
	author_avatar?: string
	author_premium?: boolean
	parent_id?: string
	likes?: number
	is_liked?: boolean
	children?: Comment[]
}

interface CommentsModalProps {
	postId: string | number
	isOpen: boolean
	onClose: () => void
}

const DotsVerticalIcon = MoreVertical
const EditIcon = Pencil
const TrashIcon = Trash2

function CommentItem({
	comment,
	onReply,
	currentUser,
	onUpdate,
	onDelete,
}: {
	comment: Comment
	onReply: (comment: Comment) => void
	currentUser?: any
	onUpdate: (id: string, content: string) => Promise<void>
	onDelete: (comment: Comment) => void
}) {
	const [likeCount, setLikeCount] = useState(comment.likes || 0)
	const [isLiked, setIsLiked] = useState(comment.is_liked || false)
	const [isLiking, setIsLiking] = useState(false)
	const [isMenuOpen, setIsMenuOpen] = useState(false)
	const [isEditing, setIsEditing] = useState(false)
	const [editContent, setEditContent] = useState(comment.content)
	const [isSaving, setIsSaving] = useState(false)
	const menuRef = useRef<HTMLDivElement>(null)

	
	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
				setIsMenuOpen(false)
			}
		}
		document.addEventListener('mousedown', handleClickOutside)
		return () => {
			document.removeEventListener('mousedown', handleClickOutside)
		}
	}, [])

	const handleLike = async () => {
		if (isLiking || !currentUser) return
		setIsLiking(true)

		const previousIsLiked = isLiked
		const previousLikeCount = likeCount

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
				if (res.status === 400 && newIsLiked) {
					// If we tried to like and got 400, try to dislike (toggle fix)
					try {
						const resDislike = await fetch(`/api/comments/${comment.id}/like`, {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ action: 'unlike' }),
						})

						if (resDislike.ok) {
							// If dislike succeeded, the final state is unliked
							setIsLiked(false)
							// Revert count to what it was before we optimistically added a like
							// (assuming previous state was unliked, so previousLikeCount is correct for unliked state)
							setLikeCount(previousLikeCount)
						} else {
							// If dislike also failed, just revert
							setIsLiked(previousIsLiked)
							setLikeCount(previousLikeCount)
						}
					} catch (e) {
						setIsLiked(previousIsLiked)
						setLikeCount(previousLikeCount)
					}
				} else {
					setIsLiked(previousIsLiked)
					setLikeCount(previousLikeCount)
				}
			}
		} catch (e) {
			console.error(e)
			setIsLiked(previousIsLiked)
			setLikeCount(previousLikeCount)
		} finally {
			setIsLiking(false)
		}
	}

	const handleSaveEdit = async () => {
		if (!editContent.trim() || isSaving) return
		setIsSaving(true)
		try {
			await onUpdate(comment.id, editContent)
			setIsEditing(false)
		} catch (e) {
			console.error(e)
		} finally {
			setIsSaving(false)
		}
	}

	// Helper to render content with highlighted mentions
	const renderContent = (content: string) => {
		return content.split(/(\s+)/).map((part, index) => {
			if (part.startsWith('@')) {
				return (
					<span
						key={index}
						className='font-bold text-indigo-600 dark:text-indigo-400'
					>
						{part}
					</span>
				)
			}
			return part
		})
	}

	const canEdit =
		currentUser?.id && String(currentUser.id) === String(comment.user_id)
	const canDelete =
		(currentUser?.id && String(currentUser.id) === String(comment.user_id)) ||
		currentUser?.role === 'admin' ||
		currentUser?.role === 'Admin'

	return (
		<div className='flex gap-3'>
			<Link href={`/feed/profile/${comment.user_id}`}>
				<img
					src={getAvatarUrl(comment.author_avatar)}
					alt={comment.author_name || 'User'}
					className='h-8 w-8 rounded-full object-cover hover:opacity-80 transition-opacity'
				/>
			</Link>
			<div className='flex-1'>
				<div className='relative rounded-lg bg-gray-100 p-3 dark:bg-gray-700'>
					<div className='flex items-start justify-between'>
						<div className='text-sm font-semibold text-gray-900 dark:text-white'>
							<Link
								href={`/feed/profile/${comment.user_id}`}
								className='hover:underline'
							>
								{comment.author_name || 'User'}
							</Link>
							{comment.author_premium && (
								<span className='ml-1 text-amber-500'>★</span>
							)}
						</div>
						{(canEdit || canDelete) && (
							<div className='relative' ref={menuRef}>
								<button
									onClick={() => setIsMenuOpen(!isMenuOpen)}
									className='rounded-full p-1 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600'
								>
									<DotsVerticalIcon className='h-4 w-4' />
								</button>
								{isMenuOpen && (
									<div className='absolute right-0 top-6 z-10 w-32 rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800'>
										{canEdit && (
											<button
												onClick={() => {
													setIsEditing(true)
													setIsMenuOpen(false)
												}}
												className='flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
											>
												<EditIcon className='h-4 w-4' />
												Изменить
											</button>
										)}
										{canDelete && (
											<button
												onClick={() => {
													onDelete(comment)
													setIsMenuOpen(false)
												}}
												className='flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100 dark:text-red-400 dark:hover:bg-gray-700'
											>
												<TrashIcon className='h-4 w-4' />
												Удалить
											</button>
										)}
									</div>
								)}
							</div>
						)}
					</div>

					<div className='mt-1 text-sm text-gray-700 dark:text-gray-300'>
						{isEditing ? (
							<div className='mt-2'>
								<textarea
									value={editContent}
									onChange={e => setEditContent(e.target.value)}
									className='w-full rounded-md border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white'
									rows={2}
								/>
								<div className='mt-2 flex gap-2'>
									<button
										onClick={handleSaveEdit}
										disabled={isSaving}
										className='rounded-md bg-indigo-600 px-3 py-1 text-xs text-white hover:bg-indigo-700 disabled:opacity-50'
									>
										{isSaving ? 'Сохранение...' : 'Сохранить'}
									</button>
									<button
										onClick={() => {
											setIsEditing(false)
											setEditContent(comment.content)
										}}
										className='rounded-md bg-gray-200 px-3 py-1 text-xs text-gray-700 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500'
									>
										Отмена
									</button>
								</div>
							</div>
						) : (
							renderContent(comment.content)
						)}
					</div>
				</div>
				<div className='mt-1 ml-1 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400'>
					<span>
						{new Date(comment.created_at || Date.now()).toLocaleDateString()}
					</span>
					<button
						onClick={handleLike}
						disabled={isLiking}
						className={`flex items-center gap-1 font-semibold transition-colors hover:text-indigo-600 ${isLiked ? 'text-red-500' : ''}`}
						title={isLiked ? 'Не нравится' : 'Нравится'}
					>
						<Heart className='h-4 w-4' fill={isLiked ? 'currentColor' : 'none'} />
						{likeCount > 0 && <span>{likeCount}</span>}
					</button>
					<button
						onClick={() => onReply(comment)}
						className='flex items-center gap-1 font-semibold hover:text-indigo-600'
						title='Ответить'
					>
						<Reply className='h-4 w-4' />
					</button>
				</div>
			</div>
		</div>
	)
}

function CommentNode({
	comment,
	onReply,
	currentUser,
	onUpdate,
	onDelete,
	depth = 0,
}: {
	comment: Comment
	onReply: (comment: Comment) => void
	currentUser?: any
	onUpdate: (id: string, content: string) => Promise<void>
	onDelete: (comment: Comment) => void
	depth?: number
}) {
	return (
		<div className='flex flex-col gap-2'>
			<CommentItem
				comment={comment}
				onReply={onReply}
				currentUser={currentUser}
				onUpdate={onUpdate}
				onDelete={onDelete}
			/>
			{comment.children && comment.children.length > 0 && (
				<div
					className={`ml-8 flex flex-col gap-2 border-l-2 border-gray-100 pl-4 dark:border-gray-700`}
				>
					{comment.children.map(child => (
						<CommentNode
							key={child.id}
							comment={child}
							onReply={onReply}
							currentUser={currentUser}
							onUpdate={onUpdate}
							onDelete={onDelete}
							depth={depth + 1}
						/>
					))}
				</div>
			)}
		</div>
	)
}

export default function CommentsModal({
	postId,
	isOpen,
	onClose,
}: CommentsModalProps) {
	const { user } = useAppSelector(state => state.auth)
	const [newComment, setNewComment] = useState('')
	const [replyTo, setReplyTo] = useState<Comment | null>(null)

	// Admin delete state
	const [adminDeleteComment, setAdminDeleteComment] = useState<Comment | null>(
		null,
	)
	const [deleteReason, setDeleteReason] = useState('')

	const {
		data: comments = [],
		isLoading: loading,
		createComment,
		updateComment,
		deleteComment,
		isCreating,
	} = useComments(postId)

	// Reset state when modal opens/closes
	useEffect(() => {
		if (isOpen) {
			setReplyTo(null)
			setNewComment('')
		}
	}, [isOpen, postId])

	const commentTree = useMemo(() => {
		const map = new Map<string, Comment>()
		const roots: Comment[] = []

		// Deep clone to avoid mutating read-only objects from React Query
		const commentsCopy = comments.map(c => ({ ...c, children: [] }))

		commentsCopy.forEach(c => {
			map.set(c.id, c)
		})

		commentsCopy.forEach(c => {
			if (c.parent_id && map.has(c.parent_id)) {
				map.get(c.parent_id)!.children!.push(c)
			} else {
				roots.push(c)
			}
		})

		return roots
	}, [comments])

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!newComment.trim() || !user) return

		createComment(
			{ content: newComment, replyToId: replyTo?.id },
			{
				onSuccess: () => {
					setNewComment('')
					setReplyTo(null)
				},
			},
		)
	}

	const handleReply = (comment: Comment) => {
		setReplyTo(comment)
		setNewComment(`@${comment.author_name || 'User'} `)
	}

	const handleUpdateComment = async (id: string, content: string) => {
		updateComment({ id, content })
	}

	const handleDeleteRequest = (comment: Comment) => {
		if (user?.role === 'admin' || user?.role === 'Admin') {
			setAdminDeleteComment(comment)
			setDeleteReason('')
		} else {
			if (window.confirm('Вы уверены, что хотите удалить этот комментарий?')) {
				performDelete(comment)
			}
		}
	}

	const performDelete = async (comment: Comment, reason?: string) => {
		if (!user) return
		const isAdmin = user.role === 'admin' || user.role === 'Admin'
		deleteComment(
			{ id: comment.id, userId: user.id, isAdmin, reason },
			{
				onSuccess: () => {
					setAdminDeleteComment(null)
					setDeleteReason('')
				},
			},
		)
	}

	if (!isOpen) return null

	return (
		<div className='fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4'>
			<div className='flex h-[80vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl dark:bg-gray-800'>
				
				<div className='flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700'>
					<h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
						Комментарии
					</h3>
					<button
						onClick={onClose}
						className='rounded-full p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200'
						aria-label='Закрыть'
					>
						<X className='h-6 w-6' />
					</button>
				</div>

				
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
							{commentTree.map(comment => (
								<CommentNode
									key={comment.id}
									comment={comment}
									onReply={handleReply}
									currentUser={user}
									onUpdate={handleUpdateComment}
									onDelete={handleDeleteRequest}
								/>
							))}
						</div>
					)}
				</div>

				
				<div className='border-t border-gray-200 p-4 dark:border-gray-700'>
					{replyTo && (
						<div className='mb-2 flex items-center justify-between rounded-md bg-indigo-50 p-2 text-xs text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'>
							<span>
								Ответ пользователю <b>{replyTo.author_name || 'User'}</b>
							</span>
							<button
								onClick={() => {
									setReplyTo(null)
									setNewComment('')
								}}
								className='hover:text-indigo-900 dark:hover:text-indigo-100'
								aria-label='Отменить ответ'
							>
								<X className='h-4 w-4' />
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
							disabled={!newComment.trim() || isCreating}
							className='rounded-full bg-indigo-600 p-2 text-white hover:bg-indigo-700 disabled:bg-indigo-400'
							aria-label='Отправить'
						>
							<Send className='h-5 w-5' />
						</button>
					</form>
				</div>
			</div>

			
			{adminDeleteComment && (
				<div className='fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4'>
					<div className='w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800'>
						<h3 className='mb-4 text-lg font-bold text-gray-900 dark:text-white'>
							Удаление комментария (Админ)
						</h3>
						<p className='mb-4 text-sm text-gray-600 dark:text-gray-300'>
							Вы собираетесь удалить комментарий пользователя{' '}
							<b>{adminDeleteComment.author_name}</b>. Укажите причину удаления:
						</p>
						<textarea
							value={deleteReason}
							onChange={e => setDeleteReason(e.target.value)}
							className='w-full rounded-md border border-gray-300 p-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white'
							placeholder='Причина удаления...'
							rows={3}
						/>
						<div className='mt-4 flex justify-end gap-2'>
							<button
								onClick={() => setAdminDeleteComment(null)}
								className='rounded-md bg-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200'
							>
								Отмена
							</button>
							<button
								onClick={() => performDelete(adminDeleteComment, deleteReason)}
								disabled={!deleteReason.trim()}
								className='rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50'
							>
								Удалить
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
