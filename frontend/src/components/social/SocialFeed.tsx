'use client'

import { useAppSelector } from '@/lib/hooks'
import { usePosts } from '@/lib/hooks/usePosts'
import { Attachment } from '@/lib/types'
import { formatMskDateTime } from '@/lib/utils'
import { useState } from 'react'
import Composer from './Composer'
import Header from './Header'
import Post from './Post'
import RightPanel from './RightPanel'
import Sidebar from './Sidebar'
import StoriesBar from './StoriesBar'

type Props = {
	email: string
	onLogout: () => void
	mode?: 'feed' | 'blog'
}

type FilterMode = 'all' | 'subscriptions' | 'blog'

export default function SocialFeed({ email, onLogout, mode = 'feed' }: Props) {
	const { user } = useAppSelector(state => state.auth)
	const [filter, setFilter] = useState<FilterMode>('all')
	
	
	const kind = filter === 'blog' ? 'blog' : 'feed'
	const {
		posts,
		isLoading: loading,
		isLoadingMore,
		hasMore,
		loadMore,
		createPost,
		deletePost,
		updatePost,
	} = usePosts({ perPage: 5, kind, filter })

	const addPost = (text: string, attachments?: Attachment[], isBlog?: boolean) => {
		createPost({ text, attachments, is_blog: isBlog || mode === 'blog' })
	}

	const handleDeletePost = (id: string | number, reason?: string) => {
		if (!user) return
		deletePost({ id, userId: user.id, reason })
	}

	const handleUpdatePost = (
		id: string | number,
		newText?: string,
		isBlog?: boolean,
	) => {
		updatePost({ id, newText, isBlog })
	}

	return (
		<div className='min-h-screen bg-black text-white selection:bg-indigo-500 selection:text-white overflow-x-hidden relative'>
			<div className='fixed inset-0 z-0 overflow-hidden pointer-events-none'>
				<div className='absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-indigo-900/20 blur-[120px]' />
				<div className='absolute top-[40%] -right-[10%] w-[40%] h-[60%] rounded-full bg-purple-900/20 blur-[120px]' />
				<div className='absolute bottom-[10%] left-[20%] w-[30%] h-[30%] rounded-full bg-emerald-900/10 blur-[100px]' />
			</div>

			<div className='relative z-20'>
				<Header email={email} onLogout={onLogout} />
			</div>

			<div className='relative z-10 mx-auto flex max-w-7xl pt-6'>
				<Sidebar />
				<main className='flex-1 px-4 sm:px-6 lg:px-8'>
					<div className='mx-auto max-w-2xl space-y-6'>
						<StoriesBar />
						<Composer onCreate={addPost} />

						
						<div className='rounded-xl bg-gray-900/40 backdrop-blur-md border border-gray-800/50 p-2 shadow-sm flex gap-2'>
							<button
								onClick={() => setFilter('all')}
								className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
									filter === 'all'
										? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
										: 'text-gray-400 hover:bg-white/5 hover:text-white'
								}`}
							>
								Все
							</button>
							<button
								onClick={() => setFilter('subscriptions')}
								className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
									filter === 'subscriptions'
										? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
										: 'text-gray-400 hover:bg-white/5 hover:text-white'
								}`}
							>
								Подписки
							</button>
							<button
								onClick={() => setFilter('blog')}
								className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
									filter === 'blog'
										? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
										: 'text-gray-400 hover:bg-white/5 hover:text-white'
								}`}
							>
								БЛОГ ✍️
							</button>
						</div>

						{loading && (
							<div className='flex justify-center py-8'>
								<div className='h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent' />
							</div>
						)}

						{posts.map(p => (
							<Post
								key={p.id}
								id={p.id}
								author={p.author_name || 'Unknown User'}
								author_id={p.posted_by}
								author_avatar={p.author_avatar}
								author_premium={p.author_premium}
								time={
									p.created_at ? formatMskDateTime(p.created_at) : 'недавно'
								}
								text={p.content}
								likes={p.likes || 0}
								comments_count={p.comments_count || 0}
								isLikedByCurrentUser={p.is_liked || false}
								isBlog={p.is_blog || false}
								image={p.image}
								attachments={p.attachments}
								currentUserId={user?.id}
								userRole={user?.role}
								onDelete={handleDeletePost}
								onUpdate={handleUpdatePost}
							/>
						))}
						{hasMore && (
							<div className='flex justify-center pt-4'>
								<button
									onClick={() => loadMore()}
									disabled={isLoadingMore}
									className='rounded-full border border-gray-700 bg-white/5 px-5 py-2 text-sm text-white hover:bg-white/10 disabled:opacity-50'
								>
									{isLoadingMore ? 'Загрузка...' : 'Показать ещё'}
								</button>
							</div>
						)}
					</div>
				</main>
				<div className='hidden w-80 p-6 lg:block'>
					<RightPanel />
				</div>
			</div>
		</div>
	)
}
