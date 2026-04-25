'use client'

import { useAuth } from '@/lib/AuthContext'
import { formatBytes } from '@/lib/utils'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import MemoryModal from './MemoryModal'
import { sidebarItems } from './sidebar.items'

export default function Sidebar() {
	const [isExpanded, setIsExpanded] = useState(false)
	const { user } = useAuth()
	const pathname = usePathname()
	const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false)

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

	// Add Admin panel for Support role
	if (user?.role === 'Support' || user?.role === 'Admin') {
		items.push({ label: 'Админка', icon: '🛠️', href: '/feed/admin' })
	}

	return (
		<>
			<aside
				className={`sticky top-20 flex h-[calc(100vh-10rem)] flex-col rounded-xl border border-white/10 bg-gray-900/40 backdrop-blur-md py-4 transition-all duration-300 ml-4 ${
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
							const isActive =
								!!i.href &&
								(pathname === i.href ||
									(pathname?.startsWith(i.href) &&
										(i.href === '/feed/profile' ||
											i.href === '/feed/messages' ||
											i.href === '/feed/admin' ||
											i.href === '/feed/support' ||
											i.href === '/feed/friends' ||
											i.href === '/feed/settings')))
							const activeClass = isActive ? 'bg-white/15 text-white' : ''
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

							const className = `flex items-center gap-4 rounded-xl px-2 py-2.5 text-gray-300 hover:bg-white/10 hover:text-white transition-all ${activeClass} ${
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

					{isExpanded && user && (
						<div className='mt-auto w-full'>
							<button
								onClick={() => setIsMemoryModalOpen(true)}
								className='w-full'
							>
								<div className='rounded-xl bg-white/5 border border-white/10 p-3 hover:bg-white/10 transition-colors cursor-pointer'>
									<div className='flex justify-between text-[10px] mb-1.5'>
										<span className='text-gray-400'>Память</span>
										<span className='text-white font-mono'>
											{formatBytes(user.disk_usage || 0)}
										</span>
									</div>
									<div className='h-1.5 bg-gray-700/50 rounded-full overflow-hidden mb-1.5'>
										<div
											className='h-full bg-gradient-to-r from-indigo-500 to-purple-500'
											style={{
												width: `${Math.min(
													((user.disk_usage || 0) /
														(user.disk_limit || 1073741824)) *
														100,
													100,
												)}%`,
											}}
										/>
									</div>
									<p className='text-[10px] text-gray-500 leading-tight'>
										{user.premium ? 'Доступно 5 ГБ' : 'Лимит 1 ГБ'}
									</p>
								</div>
							</button>
						</div>
					)}
				</div>
			</aside>
			<MemoryModal
				isOpen={isMemoryModalOpen}
				onClose={() => setIsMemoryModalOpen(false)}
			/>
		</>
	)
}
