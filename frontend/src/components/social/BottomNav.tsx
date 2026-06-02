'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { useAppSelector } from '@/lib/hooks'
import { sidebarItems } from './sidebar.items'
import {
	LuNewspaper as Newspaper,
	LuMessageCircle as MessageCircle,
	LuMusic as Music,
	LuClapperboard as Clapperboard,
	LuUser as User,
	LuMenu as MenuIcon,
	LuX as CloseIcon,
} from 'react-icons/lu'

const navItems = [
	{ label: 'Лента', icon: Newspaper, href: '/feed' },
	{ label: 'Чаты', icon: MessageCircle, href: '/feed/messages' },
	{ label: 'Музыка', icon: Music, href: '/feed/music' },
	{ label: 'Видео', icon: Clapperboard, href: '/video' },
]

export default function BottomNav() {
	const pathname = usePathname()
	const { user } = useAppSelector(state => state.auth)
	const [isMenuOpen, setIsMenuOpen] = useState(false)

	if (!pathname?.startsWith('/feed') && pathname !== '/video' && !pathname?.startsWith('/video/')) {
		return null
	}

	const profileHref = user?.id ? `/feed/profile/${user.id}` : '/feed/profile'

	const isActive = (href: string) => {
		if (href === '/feed') {
			return pathname === '/feed' || pathname === '/feed/'
		}
		if (href === '/video') {
			return pathname === '/video' || pathname?.startsWith('/video/')
		}
		return pathname?.startsWith(href)
	}

	return (
		<>
			<nav className='fixed bottom-0 left-0 right-0 z-[9998] border-t border-white/10 bg-black/80 backdrop-blur-xl md:hidden pb-[env(safe-area-inset-bottom)]'>
				<div className='flex items-center justify-around px-1 py-2'>
					{navItems.map(item => {
						const Icon = item.icon
						const active = isActive(item.href)
						return (
							<Link
								key={item.href}
								href={item.href}
								className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 transition-colors ${
									active
										? 'text-indigo-400'
										: 'text-gray-400 hover:text-white'
								}`}
							>
								<Icon className='h-5 w-5' />
								<span className='text-[10px] font-medium'>{item.label}</span>
							</Link>
						)
					})}
					<Link
						href={profileHref}
						className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 transition-colors ${
							isActive(profileHref)
								? 'text-indigo-400'
								: 'text-gray-400 hover:text-white'
						}`}
					>
						<User className='h-5 w-5' />
						<span className='text-[10px] font-medium'>Профиль</span>
					</Link>
					<button
						onClick={() => setIsMenuOpen(true)}
						className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 transition-colors ${
							isMenuOpen
								? 'text-indigo-400'
								: 'text-gray-400 hover:text-white'
						}`}
					>
						<MenuIcon className='h-5 w-5' />
						<span className='text-[10px] font-medium'>Меню</span>
					</button>
				</div>
			</nav>

			{isMenuOpen && (
				<div className='fixed inset-0 z-[9999] md:hidden'>
					<div
						className='absolute inset-0 bg-black/60 backdrop-blur-sm'
						onClick={() => setIsMenuOpen(false)}
					/>
					<div className='absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-gray-950 border-r border-white/10 p-5 flex flex-col animate-in slide-in-from-left duration-200'>
						<div className='flex items-center justify-between mb-8'>
							<h2 className='text-lg font-bold text-white'>Навигация</h2>
							<button
								onClick={() => setIsMenuOpen(false)}
								className='p-2 text-gray-400 hover:text-white transition-colors'
								aria-label='Закрыть'
							>
								<CloseIcon className='h-5 w-5' />
							</button>
						</div>
						<nav className='flex flex-col gap-1'>
							{sidebarItems.map(item => {
								const Icon = (item as any).icon
								let href = item.href
								if (href === '/feed/profile' && user?.id) {
									href = `/feed/profile/${user.id}`
								}
								if (href === '/friends') {
									href = '/feed/friends'
								}
								return (
									<Link
										key={item.label}
										href={href}
										onClick={() => setIsMenuOpen(false)}
										className={`flex items-center gap-4 rounded-xl px-3 py-3 text-gray-300 hover:bg-white/10 hover:text-white transition-colors ${
											pathname?.startsWith(href) ? 'bg-white/15 text-white' : ''
										}`}
									>
										<Icon className='h-5 w-5' />
										<span className='text-sm font-medium'>{item.label}</span>
									</Link>
								)
							})}
							{(user?.role === 'Support' || user?.role === 'Admin') && (
								<Link
									href='/feed/admin'
									onClick={() => setIsMenuOpen(false)}
									className={`flex items-center gap-4 rounded-xl px-3 py-3 text-gray-300 hover:bg-white/10 hover:text-white transition-colors ${
										pathname?.startsWith('/feed/admin') ? 'bg-white/15 text-white' : ''
									}`}
								>
									<span className='text-sm font-medium'>Админка</span>
								</Link>
							)}
						</nav>
					</div>
				</div>
			)}
		</>
	)
}
