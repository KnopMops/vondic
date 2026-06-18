'use client'

import Header from './Header'
import Sidebar from './Sidebar'

type Props = {
	children: React.ReactNode
	email?: string
	onLogout?: () => void
	/** false — без верхнего отступа под ленту (join и т.п.) */
	withTopPadding?: boolean
}

/** Общая оболочка ленты: как на главной /feed (чёрный фон + градиенты). */
export default function FeedPageShell({
	children,
	email,
	onLogout,
	withTopPadding = true,
}: Props) {
	return (
		<div className='relative min-h-screen overflow-x-hidden bg-black pb-20 text-white selection:bg-indigo-500 selection:text-white md:pb-0'>
			<div className='pointer-events-none fixed inset-0 z-0 overflow-hidden'>
				<div className='absolute -left-[10%] -top-[20%] h-[50%] w-[50%] rounded-full bg-indigo-900/20 blur-[120px]' />
				<div className='absolute -right-[10%] top-[40%] h-[60%] w-[40%] rounded-full bg-purple-900/20 blur-[120px]' />
				<div className='absolute bottom-[10%] left-[20%] h-[30%] w-[30%] rounded-full bg-emerald-900/10 blur-[100px]' />
			</div>

			<div className='relative z-20'>
				<Header email={email} onLogout={onLogout} />
			</div>

			<div
				className={`relative z-10 mx-auto flex max-w-7xl ${withTopPadding ? 'pt-20' : ''}`}
			>
				<Sidebar />
				{children}
			</div>
		</div>
	)
}
