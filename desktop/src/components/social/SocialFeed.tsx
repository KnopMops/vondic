'use client'

import { useAppSelector } from '@/lib/hooks'
import { usePosts } from '@/lib/hooks/usePosts'
import { Attachment } from '@/lib/types'
import { formatMskDateTime } from '@/lib/utils'
import { useState } from 'react'
import FeedPageShell from './FeedPageShell'
import Composer from './Composer'
import Post from './Post'
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
		<FeedPageShell email={email} onLogout={onLogout}>
			<div className='mx-auto max-w-2xl space-y-6'>
				<StoriesBar />
				<Composer onCreate={addPost} />

				
				<div className='glass-panel p-2 flex gap-2'>
					<button
						onClick={() => setFilter('all')}
						className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
							filter === 'all'
								? 'btn-accent shadow-lg'
								: 'text-[var(--app-muted)] hover:bg-white/5'
						}`}
					>
						Все
					</button>
					<button
						onClick={() => setFilter('subscriptions')}
						className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
							filter === 'subscriptions'
								? 'btn-accent shadow-lg'
								: 'text-[var(--app-muted)] hover:bg-white/5'
						}`}
					>
						Подписки
					</button>
					<button
						onClick={() => setFilter('blog')}
						className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
							filter === 'blog'
								? 'btn-accent shadow-lg'
								: 'text-[var(--app-muted)] hover:bg-white/5'
						}`}
					>
						БЛОГ ✍️
					</button>
				</div>

				{loading && (
					<div className='flex justify-center py-8'>
						<div className='h-8 w-8 animate-spin rounded-full border-2 border-[var(--app-accent)] border-t-transparent' />
					</div>
				)}

				{posts.map(p => (
					<Post
						key={p.id}
						id={p.id}
						author={
							p.author_name ||
							p.author?.username ||
							'Unknown User'
						}
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
							className='rounded-full border border-[var(--app-glass-border)] bg-[rgb(var(--app-surface-rgb)/0.3)] px-5 py-2 text-sm text-[var(--app-fg)] hover:bg-[rgb(var(--app-surface-rgb)/0.5)] disabled:opacity-50'
						>
							{isLoadingMore ? 'Загрузка...' : 'Показать ещё'}
						</button>
					</div>
				)}
			</div>
		</FeedPageShell>
	)
}
