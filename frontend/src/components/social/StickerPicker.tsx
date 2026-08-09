'use client'

import { useEffect, useRef, useState } from 'react'
import {
	LuSmile as SmileIcon,
	LuPlus as PlusIcon,
	LuTrash2 as TrashIcon,
	LuX as CloseIcon,
	LuUpload as UploadIcon,
} from 'react-icons/lu'

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
	const [uploading, setUploading] = useState(false)

	const stickerInputRef = useRef<HTMLInputElement>(null)
	const gifInputRef = useRef<HTMLInputElement>(null)

	const loadStickers = () => {
		setLoading(true)
		const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
		fetch('/api/v1/stickers', {
			headers: token ? { Authorization: `Bearer ${token}` } : {},
		})
			.then(res => res.json())
			.then(data => {
				if (data.success && data.categories) {
					setCategories(data.categories)
					if (data.categories.length > 0 && !activeCategory) {
						setActiveCategory(data.categories[0].category)
					}
				}
			})
			.catch(err => console.error('Failed to load stickers:', err))
			.finally(() => setLoading(false))
	}

	useEffect(() => {
		if (isOpen) {
			loadStickers()
		}
	}, [isOpen])

	const handleUploadFile = async (file: File, type: 'sticker' | 'gif') => {
		const token = localStorage.getItem('access_token')
		if (!token) return

		setUploading(true)
		const formData = new FormData()
		formData.append('file', file)
		formData.append('type', type)
		formData.append('name', file.name.rsplit ? file.name : file.name.split('.')[0])

		try {
			const res = await fetch('/api/v1/stickers/upload', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` },
				body: formData,
			})
			const data = await res.json()
			if (data.success) {
				loadStickers()
				setActiveCategory(type === 'sticker' ? 'Мои стикеры' : 'Мои GIF')
			}
		} catch (err) {
			console.error('Failed to upload sticker:', err)
		} finally {
			setUploading(false)
		}
	}

	const handleDeleteSticker = async (e: React.MouseEvent, stickerId: string) => {
		e.stopPropagation()
		const token = localStorage.getItem('access_token')
		if (!token) return

		try {
			const res = await fetch(`/api/v1/stickers/${stickerId}`, {
				method: 'DELETE',
				headers: { Authorization: `Bearer ${token}` },
			})
			const data = await res.json()
			if (data.success) {
				loadStickers()
			}
		} catch (err) {
			console.error('Failed to delete sticker:', err)
		}
	}

	if (!isOpen) return null

	const currentCat = categories.find(c => c.category === activeCategory)
	const isCustomCategory = activeCategory === 'Мои стикеры' || activeCategory === 'Мои GIF'

	return (
		<div className='absolute bottom-16 right-4 sm:right-12 z-[9999] w-80 sm:w-96 h-96 bg-[var(--app-surface)] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-2xl animate-in zoom-in-95 duration-150'>
			{/* Hidden Inputs */}
			<input
				ref={stickerInputRef}
				type='file'
				accept='.png,.jpg,.jpeg,.webp'
				className='hidden'
				onChange={e => {
					const file = e.target.files?.[0]
					if (file) handleUploadFile(file, 'sticker')
				}}
			/>
			<input
				ref={gifInputRef}
				type='file'
				accept='.gif,.mp4'
				className='hidden'
				onChange={e => {
					const file = e.target.files?.[0]
					if (file) handleUploadFile(file, 'gif')
				}}
			/>

			{/* Header */}
			<div className='flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/20'>
				<div className='flex items-center gap-2 text-sm font-semibold text-[var(--app-fg)]'>
					<SmileIcon className='w-4 h-4 text-[var(--app-accent)]' />
					<span>Стикеры & GIF</span>
				</div>
				<div className='flex items-center gap-1.5'>
					<button
						type='button'
						onClick={() => stickerInputRef.current?.click()}
						disabled={uploading}
						className='px-2 py-1 rounded-lg text-[10px] font-medium bg-[var(--app-accent)]/20 hover:bg-[var(--app-accent)]/30 text-[var(--app-accent)] border border-[var(--app-accent)]/30 transition-all flex items-center gap-1'
						title='Загрузить стикер (.png, .jpg ➔ .webp)'
					>
						<PlusIcon className='w-3 h-3' /> Стикер
					</button>
					<button
						type='button'
						onClick={() => gifInputRef.current?.click()}
						disabled={uploading}
						className='px-2 py-1 rounded-lg text-[10px] font-medium bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 transition-all flex items-center gap-1'
						title='Загрузить GIF (.gif, .mp4 ➔ .mp4)'
					>
						<PlusIcon className='w-3 h-3' /> GIF
					</button>
					<button
						type='button'
						onClick={onClose}
						className='p-1 rounded-lg text-[var(--app-muted)] hover:text-white hover:bg-white/10 transition-colors ml-1'
					>
						<CloseIcon className='w-4 h-4' />
					</button>
				</div>
			</div>

			{/* Category tabs */}
			<div className='flex items-center gap-1.5 px-3 py-2 border-b border-white/10 bg-black/10 overflow-x-auto custom-scrollbar shrink-0'>
				{categories.map(cat => (
					<button
						key={cat.category}
						type='button'
						onClick={() => setActiveCategory(cat.category)}
						className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
							activeCategory === cat.category
								? 'bg-[var(--app-accent)]/20 text-[var(--app-accent)] border border-[var(--app-accent)]/30 shadow-sm'
								: 'text-[var(--app-muted)] hover:text-white hover:bg-white/5'
						}`}
					>
						{cat.category}
					</button>
				))}
			</div>

			{/* Content Grid */}
			<div className='flex-1 p-3 overflow-y-auto custom-scrollbar bg-black/10 relative'>
				{uploading && (
					<div className='absolute inset-0 z-10 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center text-xs text-white gap-2'>
						<div className='w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin' />
						<span>Конвертация и загрузка...</span>
					</div>
				)}

				{loading ? (
					<div className='h-full flex items-center justify-center text-xs text-[var(--app-muted)]'>
						Загрузка каталога...
					</div>
				) : !currentCat || currentCat.items.length === 0 ? (
					<div className='h-full flex flex-col items-center justify-center text-center p-4 text-xs text-[var(--app-muted)] space-y-2'>
						<UploadIcon className='w-8 h-8 opacity-40' />
						<p>Здесь пока ничего нет</p>
						<p className='text-[10px] opacity-60'>Нажмите «+ Стикер» или «+ GIF» вверху для добавления</p>
					</div>
				) : (
					<div className='grid grid-cols-3 gap-2.5'>
						{currentCat.items.map(item => (
							<div
								key={item.id}
								onClick={() => {
									onSelectSticker(item)
									onClose()
								}}
								className='group relative aspect-square p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-transparent hover:border-[var(--app-accent)]/40 transition-all flex items-center justify-center overflow-hidden cursor-pointer active:scale-95'
								title={item.name}
							>
								{item.type === 'gif' || item.url.endsWith('.mp4') ? (
									<video
										src={item.url}
										autoPlay
										loop
										muted
										playsInline
										className='w-full h-full object-cover rounded-lg pointer-events-none'
									/>
								) : (
									<img
										src={item.url}
										alt={item.name}
										className='w-full h-full object-contain filter drop-shadow-md group-hover:scale-110 transition-transform duration-200 pointer-events-none'
										loading='lazy'
									/>
								)}

								{isCustomCategory && (
									<button
										type='button'
										onClick={e => handleDeleteSticker(e, item.id)}
										className='absolute top-1 right-1 p-1 bg-rose-500/80 hover:bg-rose-600 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-md'
										title='Удалить'
									>
										<TrashIcon className='w-3 h-3' />
									</button>
								)}

								<span className='absolute bottom-1 right-1 text-[8px] px-1 bg-black/60 rounded text-white font-mono opacity-0 group-hover:opacity-100 transition-opacity'>
									{item.type.toUpperCase()}
								</span>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	)
}
