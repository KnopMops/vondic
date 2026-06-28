'use client'

import Header from './Header'
import Sidebar from './Sidebar'
import RightPanel from './RightPanel'

type Props = {
	children: React.ReactNode
	email?: string
	onLogout?: () => void
	/** false — без верхнего отступа под ленту (join и т.п.) */
	withTopPadding?: boolean
}

/** Общая оболочка ленты с фиксированным Sidebar, Header и RightPanel */
export default function FeedPageShell({
	children,
	email,
	onLogout,
	withTopPadding = true,
}: Props) {
	return (
		<div className='relative min-h-screen bg-[var(--app-bg)] text-[var(--app-fg)] selection:bg-[var(--app-accent)]'>
			<div className='feed-bg-glow' />

			<div className='relative z-30'>
				<Header email={email || ''} onLogout={onLogout || (() => {})} />
			</div>

			<div
				className={`relative z-10 mx-auto flex max-w-7xl ${withTopPadding ? 'pt-20' : ''}`}
			>
				<Sidebar />
				<main className='flex-1 px-4 sm:px-6 lg:pl-20 lg:pr-80 lg:pt-6 min-w-0 min-h-[calc(100vh-5rem)]'>
					{children}
				</main>
				<div className='hidden lg:block fixed top-20 right-0 h-auto max-h-[calc(100vh-5rem)] w-80 overflow-y-auto p-6 z-20 custom-scrollbar'>
					<RightPanel />
				</div>
			</div>
		</div>
	)
}
