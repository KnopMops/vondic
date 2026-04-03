'use client'

import { useState, useEffect } from 'react'
import { X, Upload, Image as ImageIcon, Video as VideoIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { createPortal } from 'react-dom'

interface CreateStoryModalProps {
	isOpen: boolean
	onClose: () => void
	onUpload: (file: File, text: string) => Promise<void>
	isUploading: boolean
}

export default function CreateStoryModal({
	isOpen,
	onClose,
	onUpload,
	isUploading,
}: CreateStoryModalProps) {
	const [selectedFile, setSelectedFile] = useState<File | null>(null)
	const [previewUrl, setPreviewUrl] = useState<string>('')
	const [storyText, setStoryText] = useState('')
	const [mounted, setMounted] = useState(false)

	useEffect(() => {
		setMounted(true)
	}, [])

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (file) {
			const maxSize = 50 * 1024 * 1024 // 50MB
			if (file.size > maxSize) {
				alert('Файл слишком большой. Максимальный размер 50MB')
				return
			}
			setSelectedFile(file)
			const preview = URL.createObjectURL(file)
			setPreviewUrl(preview)
		}
	}

	const handleUpload = async () => {
		if (!selectedFile) return
		await onUpload(selectedFile, storyText)
		resetState()
	}

	const resetState = () => {
		setSelectedFile(null)
		setPreviewUrl('')
		setStoryText('')
	}

	const handleClose = () => {
		resetState()
		onClose()
	}

	if (!isOpen) return null

	if (!mounted) return null

	return createPortal(
		<AnimatePresence>
			<div className='fixed inset-0 z-[100000] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4'>
				<motion.div
					initial={{ opacity: 0, scale: 0.9, y: 20 }}
					animate={{ opacity: 1, scale: 1, y: 0 }}
					exit={{ opacity: 0, scale: 0.9, y: 20 }}
					className='w-full max-w-lg space-y-6 rounded-3xl bg-gray-900/90 border border-white/10 p-8 shadow-2xl relative'
					onClick={e => e.stopPropagation()}
				>
					<div className='flex items-center justify-between'>
						<h2 className='text-2xl font-bold text-white flex items-center gap-2'>
							<div className='w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center'>
								<Upload className='w-4 h-4 text-indigo-400' />
							</div>
							Новая история
						</h2>
						<button
							onClick={handleClose}
							className='rounded-full p-2 text-gray-400 hover:bg-white/5 hover:text-white transition-all'
						>
							<X className='w-6 h-6' />
						</button>
					</div>

					{!selectedFile ? (
						<label className='relative group flex flex-col items-center justify-center aspect-[9/16] max-h-[40vh] rounded-2xl border-2 border-dashed border-gray-700 bg-gray-800/50 hover:border-indigo-500/50 hover:bg-gray-800 transition-all cursor-pointer overflow-hidden'>
							<input
								type='file'
								accept='image/*,video/*'
								className='hidden'
								onChange={handleFileChange}
							/>
							<div className='flex flex-col items-center gap-3'>
								<div className='w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center group-hover:scale-110 transition-transform'>
									<ImageIcon className='w-6 h-6 text-indigo-400' />
								</div>
								<div className='text-center'>
									<p className='text-white font-medium'>Выберите фото или видео</p>
									<p className='text-sm text-gray-500 mt-1'>До 50 МБ</p>
								</div>
							</div>
						</label>
					) : (
						<div className='space-y-6'>
							<div className='relative aspect-[9/16] max-h-[40vh] rounded-2xl overflow-hidden bg-black mx-auto shadow-xl ring-1 ring-white/10'>
								{selectedFile.type.startsWith('video/') ? (
									<video
										src={previewUrl}
										className='w-full h-full object-contain'
										controls
										autoPlay
										loop
										muted
									/>
								) : (
									<img
										src={previewUrl}
										alt='Preview'
										className='w-full h-full object-contain'
									/>
								)}
								<button
									onClick={() => {
										setSelectedFile(null)
										setPreviewUrl('')
									}}
									className='absolute top-3 right-3 p-2 bg-black/60 backdrop-blur-md rounded-full text-white hover:bg-black/80 transition-colors'
								>
									<X className='w-4 h-4' />
								</button>
							</div>

							<div className='space-y-2'>
								<label className='text-sm font-medium text-gray-400 px-1'>
									Текст истории
								</label>
								<textarea
									value={storyText}
									onChange={e => setStoryText(e.target.value)}
									placeholder='Добавьте описание к вашей истории...'
									className='w-full rounded-2xl border border-gray-700 bg-gray-800/50 px-5 py-4 text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all resize-none'
									rows={3}
								/>
							</div>

							<div className='flex gap-3'>
								<button
									onClick={handleClose}
									className='flex-1 rounded-2xl border border-gray-700 bg-gray-800/50 px-6 py-3.5 text-sm font-semibold text-gray-300 hover:bg-gray-800 transition-all active:scale-[0.98]'
									disabled={isUploading}
								>
									Отмена
								</button>
								<button
									onClick={handleUpload}
									disabled={isUploading}
									className='flex-1 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3.5 text-sm font-semibold text-white hover:shadow-lg hover:shadow-indigo-500/25 transition-all active:scale-[0.98] disabled:opacity-50'
								>
									{isUploading ? 'Публикация...' : 'Опубликовать'}
								</button>
							</div>
						</div>
					)}
				</motion.div>
			</div>
		</AnimatePresence>,
		document.body
	)
}
