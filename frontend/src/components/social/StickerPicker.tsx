'use client'

import { useEffect, useState } from 'react'
import { LuSmile as SmileIcon, LuFlame as FlameIcon, LuX as CloseIcon } from 'react-icons/lu'

type StickerItem = {
	id: string
	name: string
	url: string
	type: 'sticker' | 'gif'
}

type StickerCategory = {
	category: string
	items: StickerItem[]
}

type Props = {
	isOpen: boolean
	onClose: () => void
	onSelectSticker: (item: StickerItem) => void
}

export default function StickerPicker({ isOpen, onClose, onSelectSticker }: Props) {
	const [categories, setCategories] = useState<StickerCategory[]>([])
	const [activeCategory, setActiveCategory] = useState<string>('')
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		if (!isOpen) return
		setLoading(true)
		fetch('/api/v1/stickers')
			.then(res => res.json())
			.then(data => {
				if (data.success && data.categories) {
					setCategories(data.categories)
					if (data.categories.length > 0) {
						setActiveCategory(data.categories[0].category)
					}
				}
			})
			.catch(err => console.error('Failed to load stickers:', err))
			.finally(() => setLoading(false))
	}, [isOpen])

	if (!isOpen) return null

	return (
		<div className='absolute bottom-16 right-4 sm:right-12 z-[9999] w-80 sm:w-96 h-80 bg-[var(--app-surface)] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-2xl animate-in zoom-in-95 duration-150'>
			{/* Header */}
			<div className='flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/20'>
				<div className='flex items-center gap-2 text-sm font-semibold text-[var(--app-fg)]'>
					<SmileIcon className='w-4 h-4 text-[var(--app-accent)]' />
					<span>Стикеры & GIF</span>
				</div>
				<button
					type='button'
					onClick={onClose}
					className='p-1 rounded-lg text-[var(--app-muted)] hover:text-white hover:bg-white/10 transition-colors'
				>
					<CloseIcon className='w-4 h-4' />
				</button>
			</div>

			{/* Category tabs */}
			<div className='flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-black/10 overflow-x-auto custom-scrollbar'>
				{categories.map(cat => (
					<button
						key={cat.category}
						type='button'
						onClick={() => setActiveCategory(cat.category)}
						className={`shrink-0 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
							activeCategory === cat.category
								? 'bg-[var(--app-accent)]/20 text-[var(--app-accent)] border border-[var(--app-accent)]/30'
								: 'text-[var(--app-muted)] hover:text-white hover:bg-white/5'
						}`}
					>
						{cat.category}
					</button>
				))}
			</div>

			{/* Content Grid */}
			<div className='flex-1 p-3 overflow-y-auto custom-scrollbar bg-black/10'>
				{loading ? (
					<div className='h-full flex items-center justify-center text-xs text-[var(--app-muted)]'>
						Загрузка стикеров...
					</div>
				) : (
					<div className='grid grid-cols-3 gap-2.5'>
						{categories
							.find(c => c.category === activeCategory)
							?.items.map(item => (
								<button
									key={item.id}
									type='button'
									onClick={() => {
										onSelectSticker(item)
										onClose()
									}}
									className='group relative aspect-square p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-transparent hover:border-[var(--app-accent)]/40 transition-all flex items-center justify-center overflow-hidden active:scale-95'
									title={item.name}
								>
									{item.type === 'gif' ? (
										<img
											src={item.url}
											alt={item.name}
											className='w-full h-full object-cover rounded-lg'
											loading='lazy'
										/>
									) : (
										<img
											src={item.url}
											alt={item.name}
											className='w-full h-full object-contain filter drop-shadow-md group-hover:scale-110 transition-transform duration-200'
											loading='lazy'
										/>
									)}
									<span className='absolute bottom-1 right-1 text-[9px] px-1 bg-black/60 rounded text-white font-mono opacity-0 group-hover:opacity-100 transition-opacity'>
										{item.type.toUpperCase()}
									</span>
								</button>
							))}
					</div>
				)}
			</div>
		</div>
	)
}
