'use client'

import { useAuth } from '@/lib/AuthContext'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { sidebarItems } from './sidebar.items'

export default function Sidebar() {
	const [isExpanded, setIsExpanded] = useState(false)
	const { user } = useAuth()

	useEffect(() => {
		const saved = localStorage.getItem('sidebar_expanded')
		if (saved !== null) {
			setIsExpanded(saved === 'true')
		}
	}, [])

	const toggleSidebar = () => {
		const newState = !isExpanded
		setIsExpanded(newState)
		localStorage.setItem('sidebar_expanded', String(newState))
	}

	const items = sidebarItems.map(item => {
		if (item.href === '/feed/profile' && user?.id) {
			return { ...item, href: `/feed/profile/${user.id}` }
		}
		if (item.href === '/friends') {
			return { ...item, href: '/feed/friends' }
		}
		return item
	})

	return (
		<aside
			className={`sticky top-20 flex h-[calc(100vh-10rem)] flex-col rounded-xl border border-gray-800/50 bg-gray-900/40 backdrop-blur-md py-4 transition-all duration-300 ml-4 ${
				isExpanded ? 'w-44' : 'w-16'
			}`}
		>
			<div className='flex flex-col items-center gap-4 px-2'>
				<div className='flex w-full items-center justify-end'>
					{isExpanded && (
						<button
							onClick={toggleSidebar}
							className='rounded-full p-1 text-gray-400 hover:bg-gray-800/50 hover:text-white transition-colors'
						>
							◀
						</button>
					)}
				</div>

				{!isExpanded && (
					<button
						onClick={toggleSidebar}
						className='mt-2 text-gray-400 hover:text-white transition-colors'
						title='Expand'
					>
						▶
					</button>
				)}

				<nav className='flex w-full flex-col gap-2'>
					{items.map(i => {
						const content = (
							<>
								<span className='text-xl drop-shadow-lg'>{i.icon}</span>
								{isExpanded && (
									<span className='text-sm font-medium whitespace-nowrap overflow-hidden'>
										{i.label}
									</span>
								)}
							</>
						)

						const className = `flex items-center gap-4 rounded-xl px-2 py-2.5 text-gray-300 hover:bg-white/10 hover:text-white transition-all ${
							!isExpanded ? 'justify-center' : ''
						}`

						if (i.href) {
							return (
								<Link
									key={i.label}
									href={i.href}
									className={className}
									title={!isExpanded ? i.label : ''}
								>
									{content}
								</Link>
							)
						}

						return (
							<button
								key={i.label}
								className={className}
								title={!isExpanded ? i.label : ''}
							>
								{content}
							</button>
						)
					})}
				</nav>
			</div>
		</aside>
	)
}
