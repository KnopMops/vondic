'use client'

import { useState } from 'react'
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
	const [posts, setPosts] = useState<
		Array<{ author: string; time: string; text: string; image?: string }>
	>([
		{
			author: 'Алексей Иванов',
			time: 'час назад',
			text: 'Отличный день на природе! 😊',
			image: '/window.svg',
		},
		{
			author: 'Новости',
			time: '2 часа назад',
			text: 'Компания представила новый смартфон с топовыми характеристиками.',
			image: '/next.svg',
		},
	])

	const addPost = (text: string) => {
		setPosts([{ author: email, time: 'только что', text }, ...posts])
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
						<div className='rounded-xl bg-gray-800 p-4'>
							<div className='flex flex-wrap gap-2'>
								{[
									'🦎 16.1K',
									'🎭 8.1K',
									'👀 5.7K',
									'💀 4.8K',
									'😎 4.4K',
									'🕷️ 4.1K',
								].map((c, i) => (
									<span
										key={i}
										className='rounded-full bg-gray-700 px-3 py-1 text-xs text-gray-200'
									>
										{c}
									</span>
								))}
							</div>
						</div>
						{posts.map((p, i) => (
							<Post
								key={i}
								author={p.author}
								time={p.time}
								text={p.text}
								image={p.image}
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
