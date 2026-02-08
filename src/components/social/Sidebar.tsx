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
			className={`sticky top-0 flex h-screen flex-col border-r border-gray-800 bg-gray-900 py-4 transition-all duration-300 ${
				isExpanded ? 'w-44' : 'w-14'
			}`}
		>
			<div className='flex flex-col items-center gap-4 px-2'>
				{/* Logo & Toggle */}
				<div className='flex w-full items-center justify-end'>
					{isExpanded && (
						<button
							onClick={toggleSidebar}
							className='rounded-full p-1 text-gray-400 hover:bg-gray-800 hover:text-white'
						>
							◀
						</button>
					)}
				</div>

				{!isExpanded && (
					<button
						onClick={toggleSidebar}
						className='mt-2 text-gray-400 hover:text-white'
						title='Expand'
					>
						▶
					</button>
				)}

				{/* Menu Items */}
				<nav className='flex w-full flex-col gap-2'>
					{items.map(i => {
						const content = (
							<>
								<span className='text-xl'>{i.icon}</span>
								{isExpanded && (
									<span className='text-sm font-medium whitespace-nowrap overflow-hidden'>
										{i.label}
									</span>
								)}
							</>
						)

						const className = `flex items-center gap-4 rounded-lg px-2 py-2 text-gray-300 hover:bg-gray-800 hover:text-white ${
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
