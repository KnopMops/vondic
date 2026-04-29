'use client'

import { useAppSelector } from '@/lib/hooks'
import { Attachment } from '@/lib/types'
import { formatMskDateTime, getAttachmentUrl } from '@/lib/utils'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { LuHeart as Heart, LuMessageCircle as MessageCircle, LuX as X } from 'react-icons/lu'

type PostData = {
	id: string
	content: string
	created_at: string
	author_name?: string
	author_avatar?: string
	author_premium?: boolean
	posted_by?: string
	image?: string
	attachments?: Attachment[]
	likes?: number
	comments_count?: number
	is_liked?: boolean
}

type Props =
	| {
			postId: string | number
			isOpen: boolean
			onClose: () => void
	  }
	| {
			post: any
			isOpen: boolean
			onClose: () => void
			onLike?: () => void
	  }

export default function PostDetailsModal(props: Props) {
	const isOpen = props.isOpen
	const onClose = props.onClose
	const postId = 'postId' in props ? props.postId : props.post?.id
	const { user } = useAppSelector(state => state.auth)
	const [post, setPost] = useState<PostData | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const [mounted, setMounted] = useState(false)

	useEffect(() => {
		setMounted(true)
	}, [])

	useEffect(() => {
		if (!isOpen) return

		if (!('postId' in props) && props.post) {
			setPost(props.post)
			setLoading(false)
			setError('')
			return
		}

		const fetchPost = async () => {
			setLoading(true)
			setError('')
			try {
				const res = await fetch(`/api/posts/${postId}`)
				if (!res.ok) throw new Error('Failed to fetch post')
				const data = await res.json()
				setPost(data)
			} catch (err) {
				console.error(err)
				setError('Ошибка загрузки поста')
			} finally {
				setLoading(false)
			}
		}

		if (postId) {
			fetchPost()
		}
	}, [postId, isOpen, props])

	if (!isOpen || !mounted) return null

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

	return createPortal(
		<div className='fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4'>
			<div className='flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-white/10 bg-black/80 backdrop-blur shadow-xl'>
				
				<div className='flex items-center justify-between border-b border-white/10 px-4 py-3'>
					<h2 className='text-lg font-bold text-white'>Просмотр поста</h2>
					<button
						onClick={onClose}
						className='rounded-full p-1 text-gray-300 hover:bg-white/10 hover:text-white'
						aria-label='Закрыть'
					>
						<X className='h-6 w-6' />
					</button>
				</div>

				
				<div className='overflow-y-auto p-6 text-gray-200'>
					{loading ? (
						<div className='flex justify-center py-10'>
							<div className='h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent'></div>
						</div>
					) : error ? (
						<div className='text-center text-red-400 py-10'>{error}</div>
					) : post ? (
						<div className='space-y-4'>
							
							<div className='flex items-center gap-3'>
								<Link
									href={`/feed/profile/${post.posted_by || post.id}`}
									className='flex items-center gap-3'
								>
									{post.author_avatar ? (
										<img
											src={getAttachmentUrl(post.author_avatar)}
											alt={post.author_name || 'User'}
											className='h-12 w-12 rounded-full object-cover'
										/>
									) : (
										<div className='h-12 w-12 rounded-full bg-indigo-900/50' />
									)}
									<div>
										<div className='font-bold text-white hover:underline'>
											{post.author_name || 'Unknown User'}
											{post.author_premium && (
												<span className='ml-1 text-amber-400'>★</span>
											)}
										</div>
										<div className='text-sm text-gray-400'>
											{formatMskDateTime(post.created_at, {
												month: 'long',
											})}
										</div>
									</div>
								</Link>
							</div>

							
							<div className='text-lg text-gray-200 whitespace-pre-wrap'>
								{post.content}
							</div>

							
							{post.image && (
								<div className='mt-4 overflow-hidden rounded-lg'>
									<img
										src={getAttachmentUrl(post.image)}
										alt='Post attachment'
										className='w-full object-cover max-h-[500px]'
									/>
								</div>
							)}

							{post.attachments && post.attachments.length > 0 && (
								<div className='mt-4 grid grid-cols-1 gap-2'>
									{post.attachments
										.filter(
											a => a && a.url && (!post.image || a.url !== post.image),
										)
										.map(a =>
											isImageAttachment(a) ? (
												<img
													key={a.url}
													src={getAttachmentUrl(a.url)}
													alt={a.name}
													className='w-full rounded-lg object-cover max-h-[500px]'
												/>
											) : (
												<a
													key={a.url}
													href={getAttachmentUrl(a.url)}
													target='_blank'
													rel='noreferrer'
													className='flex items-center justify-between rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-sm text-gray-200 hover:bg-white/5 transition-colors'
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

							
							<div className='mt-6 flex items-center gap-6 border-t border-white/10 pt-4 text-gray-400'>
								<div className='flex items-center gap-2'>
									<Heart
										className='h-5 w-5'
										fill={post.is_liked ? 'currentColor' : 'none'}
									/>
									<span>{post.likes || 0}</span>
								</div>
								<div className='flex items-center gap-2'>
									<MessageCircle className='h-5 w-5' />
									<span>{post.comments_count || 0}</span>
								</div>
							</div>
						</div>
					) : null}
				</div>
			</div>
		</div>,
		document.body,
	)
}
