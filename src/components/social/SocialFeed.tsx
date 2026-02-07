'use client'

import { useAppSelector } from '@/lib/hooks'
import { useEffect, useState } from 'react'
import Composer from './Composer'
import Header from './Header'
import Post from './Post'
import RightPanel from './RightPanel'
import Sidebar from './Sidebar'

type Props = {
	email: string
	onLogout: () => void
}

type PostData = {
	id: string
	posted_by: string
	author_name: string
	author_avatar: string | null
	content: string
	created_at: string
	likes?: number
	comments_count?: number
	is_liked?: boolean
	image?: string
	attachments?: string[] | null
}

export default function SocialFeed({ email, onLogout }: Props) {
	const { user } = useAppSelector(state => state.auth)
	const [posts, setPosts] = useState<PostData[]>([])
	const [loading, setLoading] = useState(false)

	const fetchPosts = async () => {
		setLoading(true)
		try {
			const res = await fetch('/api/posts')
			if (res.ok) {
				const data = await res.json()
				setPosts(Array.isArray(data) ? data : [])
			}
		} catch (e) {
			console.error(e)
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		fetchPosts()
	}, [])

	const addPost = async (text: string) => {
		try {
			const res = await fetch('/api/posts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title: 'New Post', content: text }),
			})
			if (res.ok) {
				fetchPosts()
			}
		} catch (e) {
			console.error(e)
		}
	}

	const deletePost = async (id: string | number, reason?: string) => {
		if (!user) return
		try {
			const res = await fetch(`/api/posts/${id}`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ user_id: user.id, reason }),
			})
			if (res.ok) {
				setPosts(posts.filter(p => p.id !== id))
			}
		} catch (e) {
			console.error(e)
		}
	}

	const updatePost = async (id: string | number, newText: string) => {
		try {
			const res = await fetch(`/api/posts/${id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title: 'Updated Post', content: newText }),
			})
			if (res.ok) {
				fetchPosts()
			}
		} catch (e) {
			console.error(e)
		}
	}

	return (
		<div className='min-h-screen bg-gray-900 text-gray-100'>
			<Header email={email} onLogout={onLogout} />
			<div className='mx-auto flex max-w-7xl'>
				<Sidebar />
				<main className='flex-1 p-4 sm:p-6 lg:p-8'>
					<div className='mx-auto max-w-3xl space-y-6'>
						<Composer onCreate={addPost} />
						<div className='rounded-xl bg-gray-800 p-3'>
							<div className='flex gap-6 text-sm'>
								<button className='border-b-2 border-indigo-500 pb-2 font-semibold'>
									Популярное
								</button>
								<button className='pb-2 text-gray-400'>Подписки</button>
							</div>
						</div>

						{loading && (
							<div className='text-center text-gray-400'>Загрузка...</div>
						)}

						{posts.map(p => (
							<Post
								key={p.id}
								id={p.id}
								author={p.author_name || 'Unknown User'}
								author_id={p.posted_by}
								author_avatar={p.author_avatar}
								time={
									p.created_at
										? new Date(p.created_at).toLocaleString('ru-RU', {
												day: 'numeric',
												month: 'short',
												hour: '2-digit',
												minute: '2-digit',
											})
										: 'недавно'
								}
								text={p.content}
								likes={p.likes || 0}
								comments_count={p.comments_count || 0}
								isLikedByCurrentUser={p.is_liked || false}
								image={
									p.image ||
									(p.attachments && p.attachments.length > 0
										? p.attachments[0]
										: undefined)
								}
								currentUserId={user?.id}
								userRole={user?.role}
								onDelete={deletePost}
								onUpdate={updatePost}
							/>
						))}
					</div>
				</main>
				<div className='hidden w-80 p-6 lg:block'>
					<RightPanel />
				</div>
			</div>
		</div>
	)
}
