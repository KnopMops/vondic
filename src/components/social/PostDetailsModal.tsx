'use client'

import { useAppSelector } from '@/lib/hooks'
import { useEffect, useState } from 'react'
import Link from 'next/link'

type PostData = {
	id: string
	content: string
	created_at: string
	author_name?: string
	author_avatar?: string
    posted_by?: string
    image?: string
    attachments?: string[]
    likes?: number
    comments_count?: number
    is_liked?: boolean
}

type Props = {
	postId: string | number
	isOpen: boolean
	onClose: () => void
}

export default function PostDetailsModal({ postId, isOpen, onClose }: Props) {
	const { user } = useAppSelector(state => state.auth)
	const [post, setPost] = useState<PostData | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')

	useEffect(() => {
		if (!isOpen) return

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

		fetchPost()
	}, [postId, isOpen])

	if (!isOpen) return null

	return (
		<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm'>
			<div className='w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800 flex flex-col max-h-[90vh]'>
                {/* Header */}
				<div className='flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700'>
					<h2 className='text-lg font-bold text-gray-900 dark:text-white'>
						Просмотр поста
					</h2>
					<button
						onClick={onClose}
						className='rounded-full p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200'
					>
						<svg
							xmlns='http://www.w3.org/2000/svg'
							className='h-6 w-6'
							fill='none'
							viewBox='0 0 24 24'
							stroke='currentColor'
						>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth={2}
								d='M6 18L18 6M6 6l12 12'
							/>
						</svg>
					</button>
				</div>

                {/* Content */}
				<div className='overflow-y-auto p-6'>
					{loading ? (
						<div className='flex justify-center py-10'>
							<div className='h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent'></div>
						</div>
					) : error ? (
						<div className='text-center text-red-500 py-10'>{error}</div>
					) : post ? (
						<div className='space-y-4'>
                            {/* Author Info */}
							<div className='flex items-center gap-3'>
                                <Link href={`/feed/profile/${post.posted_by || post.id}`} className='flex items-center gap-3'>
                                    {post.author_avatar ? (
                                        <img
                                            src={post.author_avatar}
                                            alt={post.author_name || 'User'}
                                            className='h-12 w-12 rounded-full object-cover'
                                        />
                                    ) : (
                                        <div className='h-12 w-12 rounded-full bg-indigo-200 dark:bg-indigo-900/50' />
                                    )}
                                    <div>
                                        <div className='font-bold text-gray-900 dark:text-white hover:underline'>
                                            {post.author_name || 'Unknown User'}
                                        </div>
                                        <div className='text-sm text-gray-500 dark:text-gray-400'>
                                            {new Date(post.created_at).toLocaleString('ru-RU', {
                                                day: 'numeric',
                                                month: 'long',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </div>
                                    </div>
                                </Link>
							</div>

                            {/* Post Text */}
							<div className='text-lg text-gray-800 dark:text-gray-200 whitespace-pre-wrap'>
								{post.content}
							</div>

                            {/* Image/Attachments */}
                            {(post.image || (post.attachments && post.attachments.length > 0)) && (
                                <div className='mt-4 overflow-hidden rounded-lg'>
                                    <img
                                        src={post.image || post.attachments?.[0]}
                                        alt='Post attachment'
                                        className='w-full object-cover max-h-[500px]'
                                    />
                                </div>
                            )}
                            
                            {/* Stats */}
                            <div className='mt-6 flex items-center gap-6 border-t border-gray-200 pt-4 dark:border-gray-700 text-gray-500 dark:text-gray-400'>
                                <div className='flex items-center gap-2'>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill={post.is_liked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={post.is_liked ? 0 : 1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                    </svg>
                                    <span>{post.likes || 0}</span>
                                </div>
                                <div className='flex items-center gap-2'>
                                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                                    </svg>
                                    <span>{post.comments_count || 0}</span>
                                </div>
                            </div>

						</div>
					) : null}
				</div>
			</div>
		</div>
	)
}
