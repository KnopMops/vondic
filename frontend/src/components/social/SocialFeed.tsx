'use client'

import { useAppSelector } from '@/lib/hooks'
import { usePosts } from '@/lib/hooks/usePosts'
import { Attachment } from '@/lib/types'
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

	const addPost = (text: string, attachments?: Attachment[]) => {
		createPost({ text, attachments })
	}

	const handleDeletePost = (id: string | number, reason?: string) => {
		if (!user) return
		deletePost({ id, userId: user.id, reason })
	}

	const handleUpdatePost = (id: string | number, newText: string) => {
		updatePost({ id, newText })
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
						<Composer onCreate={addPost} />
						<div className='rounded-xl bg-gray-900/40 backdrop-blur-md border border-gray-800/50 p-1'>
							<div className='grid grid-cols-2 p-1 gap-2'>
								<button className='rounded-lg bg-gray-800/50 py-2.5 text-sm font-medium text-white shadow-sm transition-all'>
									Популярное
								</button>
								<button className='rounded-lg py-2.5 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800/30 transition-all'>
									Подписки
								</button>
							</div>
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
								image={p.image}
								attachments={p.attachments}
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
