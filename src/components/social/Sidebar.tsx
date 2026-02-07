'use client'

import { useState } from 'react'
import BrandLogo from './BrandLogo'
import { sidebarItems } from './sidebar.items'
import Link from 'next/link'

export default function Sidebar() {
	const [isExpanded, setIsExpanded] = useState(false)

	return (
		<aside
			className={`sticky top-0 flex h-screen flex-col border-r border-gray-800 bg-gray-900 py-6 transition-all duration-300 ${
				isExpanded ? 'w-64' : 'w-20'
			}`}
		>
			<div className='flex flex-col items-center gap-6 px-4'>
				{/* Logo & Toggle */}
				<div className='flex w-full items-center justify-between'>
					<div
						className={`${isExpanded ? 'block' : 'hidden'} transition-opacity`}
					>
						<BrandLogo size={32} />
					</div>
					{/* Logo centered when collapsed */}
					{!isExpanded && (
						<div className='w-full flex justify-center'>
							<BrandLogo size={32} />
						</div>
					)}

					{isExpanded && (
						<button
							onClick={() => setIsExpanded(!isExpanded)}
							className='rounded-full p-1 text-gray-400 hover:bg-gray-800 hover:text-white'
						>
							◀
						</button>
					)}
				</div>

				{!isExpanded && (
					<button
						onClick={() => setIsExpanded(!isExpanded)}
						className='mt-2 text-gray-400 hover:text-white'
						title='Expand'
					>
						▶
					</button>
				)}

				{/* Menu Items */}
				<nav className='flex w-full flex-col gap-2'>
					{sidebarItems.map(i => {
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
