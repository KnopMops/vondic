'use client'

import { useAppSelector } from '@/lib/hooks'
import { usePosts } from '@/lib/hooks/usePosts'
import Composer from './Composer'
import Header from './Header'
import Post from './Post'
import RightPanel from './RightPanel'
import Sidebar from './Sidebar'

type Props = {
	email: string
	onLogout: () => void
}

export default function SocialFeed({ email, onLogout }: Props) {
	const { user } = useAppSelector(state => state.auth)
	const {
		data: posts = [],
		isLoading: loading,
		createPost,
		deletePost,
		updatePost,
	} = usePosts()

	const addPost = (text: string) => {
		createPost(text)
	}

	const handleDeletePost = (id: string | number, reason?: string) => {
		if (!user) return
		deletePost({ id, userId: user.id, reason })
	}

	const handleUpdatePost = (id: string | number, newText: string) => {
		updatePost({ id, newText })
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
								onDelete={handleDeletePost}
								onUpdate={handleUpdatePost}
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
