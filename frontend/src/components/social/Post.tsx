'use client'

import { Attachment } from '@/lib/types'
import { getAttachmentUrl } from '@/lib/utils'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import CommentsModal from './CommentsModal'
import PostDetailsModal from './PostDetailsModal'
import ShareModal from './ShareModal'

type Props = {
	id: string | number
	author: string
	author_id: string | number
	author_avatar?: string | null
	time: string
	text: string
	likes?: number
	comments_count?: number
	image?: string
	attachments?: Attachment[]
	currentUserId?: string
	userRole?: string
	isLikedByCurrentUser?: boolean
	onDelete?: (id: string | number, reason?: string) => void
	onUpdate?: (id: string | number, newText: string) => void
}

export default function Post({
	id,
	author,
	author_id,
	author_avatar,
	time,
	text,
	likes = 0,
	comments_count = 0,
	image,
	attachments,
	currentUserId,
	userRole,
	isLikedByCurrentUser = false,
	onDelete,
	onUpdate,
}: Props) {
	const [isMenuOpen, setIsMenuOpen] = useState(false)
	const [isEditing, setIsEditing] = useState(false)
	const [editText, setEditText] = useState(text)
	const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
	const [deleteReason, setDeleteReason] = useState('')

	const [likeCount, setLikeCount] = useState(likes)
	const [isLiked, setIsLiked] = useState(isLikedByCurrentUser)
	const [isLiking, setIsLiking] = useState(false)
	const [showComments, setShowComments] = useState(false)
	const [commentCount, setCommentCount] = useState(comments_count)
	const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
	const [isShareModalOpen, setIsShareModalOpen] = useState(false)

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

	const isOwner = String(currentUserId) === String(author_id)
	const isAdmin = userRole === 'Admin'
	const canDelete = isOwner || isAdmin
	const canEdit = isOwner

	const handleUpdate = () => {
		if (onUpdate) {
			onUpdate(id, editText)
			setIsEditing(false)
		}
	}

	const handleLike = async () => {
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
				if (res.status === 400 && newIsLiked) {
					try {
						const resDislike = await fetch(`/api/posts/${id}/like`, {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ action: 'unlike' }),
						})

						if (resDislike.ok) {
							setIsLiked(false)
							setLikeCount(likeCount)
						} else {
							setIsLiked(!newIsLiked)
							setLikeCount(likeCount)
						}
					} catch (e) {
						setIsLiked(!newIsLiked)
						setLikeCount(likeCount)
					}
				} else {
					setIsLiked(!newIsLiked)
					setLikeCount(likeCount)
				}
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
							<span className='text-xs text-gray-500'>{time}</span>
						</div>
						{(canEdit || canDelete) && (
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
						<button
							onClick={handleLike}
							disabled={isLiking}
							className={`flex items-center gap-2 transition-all ${isLiked ? 'text-red-500 scale-105' : 'text-gray-500 hover:text-indigo-400 hover:scale-105'} ${isLiking ? 'opacity-50 cursor-not-allowed' : ''}`}
						>
							<svg
								xmlns='http://www.w3.org/2000/svg'
								fill={isLiked ? 'currentColor' : 'none'}
								viewBox='0 0 24 24'
								strokeWidth={1.5}
								stroke='currentColor'
								className='h-5 w-5'
							>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									d='M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a2.25 2.25 0 012.25 2.25c0 1.152-.26 2.247-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904M14.25 9h2.25M5.904 18.75c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 01-.521-3.507c0-1.553.295-3.036.831-4.398C3.287 9.483 4.122 9 5.01 9h.918c.445 0 .72.498.523.898a8.932 8.932 0 00-.27.602'
								/>
							</svg>
							<span className='text-sm font-medium'>{likeCount}</span>
						</button>
						<button
							onClick={() => setShowComments(true)}
							className='flex items-center gap-2 text-gray-500 transition-all hover:text-indigo-400 hover:scale-105'
						>
							<svg
								xmlns='http://www.w3.org/2000/svg'
								fill='none'
								viewBox='0 0 24 24'
								strokeWidth={1.5}
								stroke='currentColor'
								className='h-5 w-5'
							>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									d='M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z'
								/>
							</svg>
							<span className='text-sm font-medium'>{commentCount}</span>
						</button>
						<button
							onClick={() => setIsShareModalOpen(true)}
							className='flex items-center gap-2 text-gray-500 transition-all hover:text-indigo-400 hover:scale-105'
						>
							<svg
								xmlns='http://www.w3.org/2000/svg'
								fill='none'
								viewBox='0 0 24 24'
								strokeWidth={1.5}
								stroke='currentColor'
								className='h-5 w-5'
							>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									d='M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z'
								/>
							</svg>
						</button>
					</div>
				</div>
			</div>

			<CommentsModal
				isOpen={showComments}
				onClose={() => setShowComments(false)}
				postId={id}
				postAuthorId={author_id}
			/>

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
					postUrl={`${window.location.origin}/feed/post/${id}`}
				/>
			)}

			{isDeleteModalOpen && (
				<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4'>
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
		</article>
	)
}
