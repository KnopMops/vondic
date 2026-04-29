'use client'

import { useAppSelector } from '@/lib/hooks'
import { useComments } from '@/lib/hooks/useComments'
import { useToast } from '@/lib/ToastContext'
import { Attachment } from '@/lib/types'
import { getAttachmentUrl, getAvatarUrl } from '@/lib/utils'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import PostDetailsModal from './PostDetailsModal'
import ShareModal from './ShareModal'
import VideoPlayer from './VideoPlayer'
import {
	LuHeart as Heart,
	LuMessageCircle as MessageCircle,
	LuSend as Send,
	LuShare2 as Share2,
	LuStickyNote as StickyNote,
	LuX as X,
} from 'react-icons/lu'

type Props = {
	id: string | number
	author: string
	author_id: string | number
	author_avatar?: string | null
	author_premium?: boolean
	time: string
	text: string
	likes?: number
	comments_count?: number
	image?: string
	attachments?: Attachment[]
	currentUserId?: string
	userRole?: string
	isLikedByCurrentUser?: boolean
	isBlog?: boolean
	onDelete?: (id: string | number, reason?: string) => void
	onUpdate?: (id: string | number, newText?: string, isBlog?: boolean) => void
}

export default function Post({
	id,
	author,
	author_id,
	author_avatar,
	author_premium,
	time,
	text,
	likes = 0,
	comments_count = 0,
	image,
	attachments,
	currentUserId,
	userRole,
	isLikedByCurrentUser = false,
	isBlog = false,
	onDelete,
	onUpdate,
}: Props) {
	const [isMenuOpen, setIsMenuOpen] = useState(false)
	const [isEditing, setIsEditing] = useState(false)
	const [editText, setEditText] = useState(text)
	const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
	const [deleteReason, setDeleteReason] = useState('')
	const [isReportModalOpen, setIsReportModalOpen] = useState(false)
	const [reportDescription, setReportDescription] = useState('')
	const [reportUploading, setReportUploading] = useState(false)
	const [reportAttachments, setReportAttachments] = useState<
		{ url: string; name: string; ext?: string }[]
	>([])
	const reportFileInputRef = useRef<HTMLInputElement | null>(null)
	const [mounted, setMounted] = useState(false)

	const [likeCount, setLikeCount] = useState(likes)
	const [isLiked, setIsLiked] = useState(isLikedByCurrentUser)
	const [isLiking, setIsLiking] = useState(false)
	const [showComments, setShowComments] = useState(false)
	const [commentCount, setCommentCount] = useState(comments_count)
	const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
	const [isShareModalOpen, setIsShareModalOpen] = useState(false)

	const { user } = useAppSelector(state => state.auth)
	const { showToast } = useToast()
	const {
		data: comments = [],
		isLoading: commentsLoading,
		createComment,
		updateComment,
		deleteComment,
		isCreating: isCreatingComment,
	} = useComments(id)

	const [newComment, setNewComment] = useState('')
	const [replyTo, setReplyTo] = useState<any>(null)

	useEffect(() => {
		setMounted(true)
	}, [])

	useEffect(() => {
		setCommentCount(comments_count)
	}, [comments_count])

	const isImageAttachment = (a: Attachment) => {
		const ext = (a.ext || '').toLowerCase()
		return (
			ext === 'png' ||
			ext === 'jpg' ||
			ext === 'jpeg' ||
			ext === 'gif' ||
			ext === 'webp' ||
			ext === 'bmp' ||
			ext === 'svg'
		)
	}

	const isVideoAttachment = (a: Attachment) => {
		const ext = (a.ext || '').toLowerCase()
		return ext === 'mp4' || ext === 'mov' || ext === 'webm' || ext === 'ogg'
	}

	const isOwner = String(currentUserId) === String(author_id)
	const isAdmin = userRole === 'Admin'
	const canDelete = isOwner || isAdmin
	const canEdit = isOwner
	const isBlogPost = !!isBlog

	const handleUpdate = () => {
		if (onUpdate) {
			onUpdate(id, editText)
			setIsEditing(false)
		}
	}

	const handleLike = async () => {
		if (isBlogPost) return
		if (isLiking) return
		setIsLiking(true)

		const newIsLiked = !isLiked
		const newCount = newIsLiked ? likeCount + 1 : likeCount - 1

		setIsLiked(newIsLiked)
		setLikeCount(newCount)

		try {
			const res = await fetch(`/api/posts/${id}/like`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: newIsLiked ? 'like' : 'unlike' }),
			})

			if (!res.ok) {
				// Если ошибка, возвращаем состояние назад
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

	const handleDeleteClick = () => {
		if (isOwner) {
			if (onDelete) onDelete(id)
			setIsMenuOpen(false)
		} else if (isAdmin) {
			setIsDeleteModalOpen(true)
			setIsMenuOpen(false)
		}
	}

	const handleConfirmDelete = () => {
		if (onDelete) {
			onDelete(id, deleteReason)
		}
		setIsDeleteModalOpen(false)
		setDeleteReason('')
	}

	const handleSubmitComment = async (e: React.FormEvent) => {
		e.preventDefault()
		if (isBlogPost) return
		if (!newComment.trim() || !user) return

		createComment(
			{ content: newComment, replyToId: replyTo?.id },
			{
				onSuccess: () => {
					setNewComment('')
					setReplyTo(null)
					setCommentCount(prev => prev + 1)
				},
			},
		)
	}

	const handleOpenReport = () => {
		setIsReportModalOpen(true)
		setIsMenuOpen(false)
		setReportDescription('')
		setReportAttachments([])
	}

	const handleReportFileSelect = async (
		e: React.ChangeEvent<HTMLInputElement>,
	) => {
		const files = Array.from(e.target.files || [])
		if (!files.length) return
		setReportUploading(true)
		for (const file of files) {
			if (file.size > 20 * 1024 * 1024) {
				showToast('Файл слишком большой (макс 20МБ)', 'error')
				continue
			}
			try {
				const base64 = await new Promise<string>((resolve, reject) => {
					const reader = new FileReader()
					reader.onload = () => resolve(reader.result as string)
					reader.onerror = () => reject(new Error('read_error'))
					reader.readAsDataURL(file)
				})
				const res = await fetch('/api/v1/upload/file', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ file: base64, filename: file.name }),
				})
				const data = await res.json().catch(() => ({}))
				if (!res.ok || !data.url) {
					showToast(data.error || 'Ошибка загрузки файла', 'error')
					continue
				}
				setReportAttachments(prev => [
					...prev,
					{ url: data.url, name: file.name, ext: data.ext },
				])
			} catch {
				showToast('Ошибка загрузки файла', 'error')
			}
		}
		setReportUploading(false)
		if (reportFileInputRef.current) {
			reportFileInputRef.current.value = ''
		}
	}

	const handleRemoveReportAttachment = (url: string) => {
		setReportAttachments(prev => prev.filter(a => a.url !== url))
	}

	const handleSubmitReport = async () => {
		if (!user) return
		const description = reportDescription.trim()
		if (!description) {
			showToast('Опишите нарушение', 'error')
			return
		}
		try {
			const res = await fetch('/api/support/post-reports', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					post_id: id,
					post_author_login: author,
					description,
					attachments: reportAttachments.map(a => a.url),
				}),
			})
			const data = await res.json().catch(() => ({}))
			if (!res.ok) {
				throw new Error(data.error || 'Не удалось отправить жалобу')
			}
			showToast('Жалоба отправлена', 'success')
			setIsReportModalOpen(false)
		} catch (e: any) {
			showToast(e.message || 'Не удалось отправить жалобу', 'error')
		}
	}

	const handleReply = (comment: any) => {
		setReplyTo(comment)
		setNewComment(`@${comment.author_name || 'User'} `)
	}

	const handleUpdateComment = async (commentId: string, content: string) => {
		updateComment({ id: commentId, content })
	}

	const handleToggleBlog = () => {
		if (!onUpdate || !isAdmin) return
		onUpdate(id, undefined, !isBlogPost)
		setIsMenuOpen(false)
	}

	const handleDeleteRequest = (comment: any) => {
		if (user?.role === 'admin' || user?.role === 'Admin') {
			if (window.confirm('Вы уверены, что хотите удалить этот комментарий?')) {
				deleteComment(
					{ id: comment.id, userId: user.id, isAdmin: true },
					{
						onSuccess: () => {
							setCommentCount(prev => prev - 1)
						},
					},
				)
			}
		} else {
			if (window.confirm('Вы уверены, что хотите удалить этот комментарий?')) {
				deleteComment(
					{ id: comment.id, userId: user.id },
					{
						onSuccess: () => {
							setCommentCount(prev => prev - 1)
						},
					},
				)
			}
		}
	}

	const commentTree = useMemo(() => {
		const map = new Map<string, any>()
		const roots: any[] = []
		const commentsCopy = comments.map((comment: any) => ({
			...comment,
			children: [],
		}))

		commentsCopy.forEach(comment => {
			map.set(comment.id, comment)
		})

		commentsCopy.forEach(comment => {
			if (comment.parent_id && map.has(comment.parent_id)) {
				map.get(comment.parent_id).children.push(comment)
			} else {
				roots.push(comment)
			}
		})

		return roots
	}, [comments])

	const renderComment = (comment: any, depth = 0) => {
		const isOwner = user && String(user.id) === String(comment.user_id)
		const canDelete =
			isOwner || user?.role === 'admin' || user?.role === 'Admin'

		return (
			<div
				key={comment.id}
				className={`${depth > 0 ? 'ml-8 border-l-2 border-gray-700 pl-4' : ''}`}
			>
				<div className='flex gap-3 mb-3'>
					<Link href={`/feed/profile/${comment.user_id}`}>
						<img
							src={getAvatarUrl(comment.author_avatar)}
							alt={comment.author_name || 'User'}
							className='h-8 w-8 rounded-full object-cover'
						/>
					</Link>
					<div className='flex-1'>
						<div className='relative rounded-lg bg-gray-800/50 p-3'>
							<div className='flex items-center justify-between mb-1'>
								<div className='flex items-center gap-2'>
									<Link
										href={`/feed/profile/${comment.user_id}`}
										className='text-sm font-semibold text-gray-200 hover:underline'
									>
										{comment.author_name || 'User'}
									</Link>
									{comment.author_premium && (
										<span className='text-amber-400'>★</span>
									)}
								</div>
								{canDelete && (
									<button
										onClick={() => handleDeleteRequest(comment)}
										className='text-xs text-gray-500 hover:text-red-400 transition-colors'
									>
										Удалить
									</button>
								)}
							</div>
							<p className='text-sm text-gray-300 leading-relaxed'>
								{comment.content}
							</p>
						</div>
						<div className='mt-1 flex items-center gap-3 text-xs text-gray-500'>
							<span>
								{new Date(
									comment.created_at || Date.now(),
								).toLocaleDateString()}
							</span>
							<button
								onClick={() => handleReply(comment)}
								className='hover:text-indigo-400 transition-colors'
							>
								Ответить
							</button>
						</div>
					</div>
				</div>
				{comment.children && comment.children.length > 0 && (
					<div className='mt-2'>
						{comment.children.map(child => renderComment(child, depth + 1))}
					</div>
				)}
			</div>
		)
	}

	return (
		<article className='rounded-xl bg-gray-900/40 backdrop-blur-md border border-gray-800/50 p-4 shadow-sm relative group'>
			<div className='flex items-start gap-3'>
				<Link href={`/feed/profile/${author_id}`}>
					{author_avatar ? (
						<img
							src={getAttachmentUrl(author_avatar)}
							alt={author}
							className='h-10 w-10 rounded-full object-cover hover:opacity-80 transition-opacity ring-2 ring-transparent group-hover:ring-indigo-500/50'
						/>
					) : (
						<div className='h-10 w-10 rounded-full bg-indigo-900/50 hover:opacity-80 transition-opacity ring-2 ring-transparent group-hover:ring-indigo-500/50' />
					)}
				</Link>
				<div className='flex-1'>
					<div className='flex items-center justify-between'>
						<div className='flex items-center gap-2'>
							<Link
								href={`/feed/profile/${author_id}`}
								className='hover:underline decoration-indigo-500/50'
							>
								<span className='text-sm font-semibold text-gray-200'>
									{author}
								</span>
							</Link>
							{author_premium && <span className='text-amber-400'>★</span>}
							<span className='text-xs text-gray-500'>{time}</span>
						</div>
						{user && (
							<div className='relative'>
								<button
									onClick={() => setIsMenuOpen(!isMenuOpen)}
									className='text-gray-500 hover:text-gray-200 transition-colors rounded-full p-1 hover:bg-white/5'
								>
									•••
								</button>
								{isMenuOpen && (
									<div className='absolute right-0 top-6 z-10 w-48 rounded-xl bg-gray-900/90 backdrop-blur-xl shadow-2xl ring-1 ring-white/10 overflow-hidden'>
										<div className='py-1'>
											<button
												onClick={() => {
													setIsDetailsModalOpen(true)
													setIsMenuOpen(false)
												}}
												className='block w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors'
											>
												Подробнее
											</button>
											{!isOwner && (
												<button
													onClick={handleOpenReport}
													className='block w-full px-4 py-2.5 text-left text-sm text-amber-300 hover:bg-amber-500/10 hover:text-amber-200 transition-colors'
												>
													Пожаловаться
												</button>
											)}
											{canEdit && (
												<button
													onClick={() => {
														setIsEditing(true)
														setIsMenuOpen(false)
													}}
													className='block w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors'
												>
													Редактировать
												</button>
											)}
											{isAdmin && (
												<button
													onClick={handleToggleBlog}
													className='block w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors'
												>
													{isBlogPost ? 'В ленту' : 'В блог'}
												</button>
											)}
											{canDelete && (
												<button
													onClick={handleDeleteClick}
													className='block w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors'
												>
													Удалить
												</button>
											)}
										</div>
									</div>
								)}
							</div>
						)}
					</div>

					{isEditing ? (
						<div className='mt-2'>
							<textarea
								className='w-full rounded-xl border border-gray-700/50 bg-gray-800/50 p-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all'
								value={editText}
								onChange={e => setEditText(e.target.value)}
							/>
							<div className='mt-2 flex gap-2'>
								<button
									onClick={handleUpdate}
									className='rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20'
								>
									Сохранить
								</button>
								<button
									onClick={() => setIsEditing(false)}
									className='rounded-lg bg-gray-800/50 px-4 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors'
								>
									Отмена
								</button>
							</div>
						</div>
					) : (
						<>
							<p className='mt-1 text-sm text-gray-300 leading-relaxed'>
								{text}
							</p>
						</>
					)}

					{image && (
						<img
							src={getAttachmentUrl(image)}
							alt=''
							className='mt-3 w-full rounded-xl border border-gray-800/50'
						/>
					)}

					{attachments && attachments.length > 0 && (
						<div className='mt-3 grid grid-cols-1 gap-2'>
							{attachments
								.filter(a => a && a.url && (!image || a.url !== image))
								.map(a =>
									isImageAttachment(a) ? (
										<img
											key={a.url}
											src={getAttachmentUrl(a.url)}
											alt={a.name}
											className='w-full rounded-xl border border-gray-800/50 object-cover'
										/>
									) : isVideoAttachment(a) ? (
										<VideoPlayer key={a.url} src={a.url} />
									) : (
										<a
											key={a.url}
											href={getAttachmentUrl(a.url)}
											target='_blank'
											rel='noreferrer'
											className='flex items-center justify-between rounded-xl border border-gray-800/50 bg-gray-900/30 px-4 py-3 text-sm text-gray-200 hover:bg-gray-900/50 transition-colors'
										>
											<span className='truncate'>{a.name}</span>
											<span className='ml-4 text-xs text-gray-400'>
												{a.ext ? a.ext.toUpperCase() : 'FILE'}
											</span>
										</a>
									),
								)}
						</div>
					)}

					<div className='mt-4 flex items-center gap-6'>
						{!isBlogPost && (
							<>
								<button
									onClick={handleLike}
									disabled={isLiking}
									className={`flex items-center gap-2 transition-all ${isLiked ? 'text-red-500 scale-105' : 'text-gray-500 hover:text-red-400 hover:scale-105'} ${isLiking ? 'opacity-50 cursor-not-allowed' : ''}`}
								>
									<Heart className='h-5 w-5' fill={isLiked ? 'currentColor' : 'none'} />
									<span className='text-sm font-medium'>{likeCount}</span>
								</button>
								<button
									onClick={() => setShowComments(!showComments)}
									className='flex items-center gap-2 text-gray-500 transition-all hover:text-indigo-400 hover:scale-105'
								>
									<MessageCircle className='h-5 w-5' />
									<span className='text-sm font-medium'>{commentCount}</span>
								</button>
							</>
						)}
						{isBlogPost && (
							<div className='flex items-center gap-2 text-amber-400 text-xs'>
								<StickyNote className='h-4 w-4' />
								<span>Только пересылка</span>
							</div>
						)}
						<button
							onClick={() => setIsShareModalOpen(true)}
							className='flex items-center gap-2 text-gray-500 transition-all hover:text-indigo-400 hover:scale-105'
							title={isBlogPost ? 'Поделиться (переслать)' : 'Поделиться'}
						>
							<Share2 className='h-5 w-5' />
						</button>
					</div>

					{showComments && !isBlogPost && (
						<div className='mt-4 pt-4 border-t border-gray-800/50'>
							<div className='space-y-4 max-h-96 overflow-y-auto'>
								{commentsLoading ? (
									<div className='flex justify-center py-4'>
										<div className='h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent' />
									</div>
								) : comments.length === 0 ? (
									<div className='text-center text-gray-500 py-4'>
										Нет комментариев. Будьте первым!
									</div>
								) : (
									commentTree.map(comment => renderComment(comment))
								)}
							</div>

							<form onSubmit={handleSubmitComment} className='mt-4 flex gap-2'>
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
								<input
									type='text'
									value={newComment}
									onChange={e => setNewComment(e.target.value)}
									placeholder='Написать комментарий...'
									className='flex-1 rounded-full border border-gray-300 bg-gray-50 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400'
								/>
								<button
									type='submit'
									disabled={!newComment.trim() || isCreatingComment}
									className='rounded-full bg-indigo-600 p-2 text-white hover:bg-indigo-700 disabled:bg-indigo-400'
									aria-label='Отправить комментарий'
								>
									<Send className='h-5 w-5' />
								</button>
							</form>
						</div>
					)}
				</div>
			</div>

			<PostDetailsModal
				isOpen={isDetailsModalOpen}
				onClose={() => setIsDetailsModalOpen(false)}
				post={{
					id,
					author,
					author_id,
					author_avatar,
					time,
					text,
					likes: likeCount,
					comments_count: commentCount,
					image,
					attachments,
					isLiked,
				}}
				onLike={handleLike}
			/>

			{isShareModalOpen && (
				<ShareModal
					isOpen={isShareModalOpen}
					onClose={() => setIsShareModalOpen(false)}
					post={{
						id,
						author,
						author_avatar,
						text,
						image,
						isBlog: isBlogPost,
					}}
				/>
			)}

			{isDeleteModalOpen && (
				<div className='fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4'>
					<div className='w-full max-w-md rounded-2xl bg-gray-900 border border-gray-800 p-6 shadow-2xl'>
						<h3 className='text-xl font-bold text-white mb-2'>
							Удалить публикацию?
						</h3>
						<p className='text-gray-400 mb-6'>
							Это действие нельзя отменить. Публикация будет удалена
							безвозвратно.
						</p>

						{isAdmin && !isOwner && (
							<div className='mb-6'>
								<label className='block text-sm font-medium text-gray-300 mb-2'>
									Причина удаления (для автора)
								</label>
								<textarea
									className='w-full rounded-xl border border-gray-700 bg-gray-800 p-3 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50'
									rows={3}
									placeholder='Нарушение правил сообщества...'
									value={deleteReason}
									onChange={e => setDeleteReason(e.target.value)}
								/>
							</div>
						)}

						<div className='flex gap-3 justify-end'>
							<button
								onClick={() => setIsDeleteModalOpen(false)}
								className='px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors'
							>
								Отмена
							</button>
							<button
								onClick={handleConfirmDelete}
								className='px-4 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors border border-red-500/20'
							>
								Удалить
							</button>
						</div>
					</div>
				</div>
			)}
			{isReportModalOpen &&
				mounted &&
				createPortal(
					<div className='fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4'>
						<div className='w-full max-w-md rounded-lg border border-white/10 bg-black/80 backdrop-blur p-6 shadow-xl'>
							<h3 className='text-xl font-bold text-white mb-2'>
								Пожаловаться на публикацию
							</h3>
							<div className='space-y-4'>
								<div>
									<label className='block text-sm font-medium text-gray-300 mb-2'>
										Идентификатор пользователя (логин)
									</label>
									<input
										value={author}
										readOnly
										className='w-full rounded-xl border border-gray-700 bg-gray-800 p-3 text-white'
									/>
								</div>
								<div>
									<label className='block text-sm font-medium text-gray-300 mb-2'>
										Ссылка на страницу (id)
									</label>
									<input
										value={id}
										readOnly
										className='w-full rounded-xl border border-gray-700 bg-gray-800 p-3 text-white'
									/>
								</div>
								<div>
									<label className='block text-sm font-medium text-gray-300 mb-2'>
										Описание нарушения
									</label>
									<textarea
										className='w-full rounded-xl border border-gray-700 bg-gray-800 p-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40'
										rows={4}
										placeholder='Опишите нарушение...'
										value={reportDescription}
										onChange={e => setReportDescription(e.target.value)}
									/>
								</div>
								<div className='space-y-2'>
									<div className='flex items-center justify-between'>
										<label className='block text-sm font-medium text-gray-300'>
											Вложения (фото или видео)
										</label>
										<input
											ref={reportFileInputRef}
											type='file'
											accept='image/*,video/*'
											multiple
											className='hidden'
											onChange={handleReportFileSelect}
										/>
										<button
											type='button'
											onClick={() => reportFileInputRef.current?.click()}
											disabled={reportUploading}
											className='text-xs text-amber-300 hover:text-amber-200 disabled:opacity-60'
										>
											{reportUploading ? 'Загрузка...' : 'Добавить файл'}
										</button>
									</div>
									{reportAttachments.length > 0 && (
										<div className='space-y-2'>
											{reportAttachments.map(a => (
												<div
													key={a.url}
													className='flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/50 px-3 py-2 text-xs text-gray-200'
												>
													<span className='truncate'>{a.name}</span>
													<button
														type='button'
														onClick={() => handleRemoveReportAttachment(a.url)}
														className='text-red-400 hover:text-red-300'
													>
														Удалить
													</button>
												</div>
											))}
										</div>
									)}
								</div>
							</div>
							<div className='mt-6 flex gap-3 justify-end'>
								<button
									onClick={() => setIsReportModalOpen(false)}
									className='px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors'
								>
									Отмена
								</button>
								<button
									onClick={handleSubmitReport}
									className='px-4 py-2 rounded-lg bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-colors border border-amber-500/20'
								>
									Отправить
								</button>
							</div>
						</div>
					</div>,
					document.body,
				)}
		</article>
	)
}
