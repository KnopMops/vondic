'use client'

import { getAttachmentUrl } from '@/lib/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'

type FileItem = {
	id: string
	name: string
	url: string
	size: number
	created_at: string
}

type Props = {
	isOpen: boolean
	onClose: () => void
}

export default function MemoryModal({ isOpen, onClose }: Props) {
	const [files, setFiles] = useState<FileItem[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [currentPage, setCurrentPage] = useState(1)
	const [totalPages, setTotalPages] = useState(1)
	const [isDeleting, setIsDeleting] = useState<string | null>(null)
	const perPage = 20

	useEffect(() => {
		if (isOpen) {
			fetchFiles(currentPage)
		}
	}, [isOpen, currentPage])

	const fetchFiles = async (page: number) => {
		setIsLoading(true)
		try {
			const res = await fetch(
				`/api/files/list?page=${page}&per_page=${perPage}`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
				},
			)
			if (res.ok) {
				const data = await res.json()
				const items = Array.isArray(data)
					? data
					: data.items || data.files || []
				setFiles(items)
				setTotalPages(data.pages || 1)
			} else {
				setFiles([])
			}
		} catch (e) {
			console.error('Failed to fetch files', e)
			setFiles([])
		} finally {
			setIsLoading(false)
		}
	}

	const deleteFile = async (fileId: string) => {
		if (!confirm('Вы уверены, что хотите удалить этот файл?')) return

		setIsDeleting(fileId)
		try {
			const res = await fetch('/api/files/delete', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ file_id: fileId }),
			})
			if (res.ok) {
				// Remove from list
				setFiles(prev => prev.filter(f => f.id !== fileId))
			} else {
				const errorText = await res.text()
				alert('Ошибка при удалении: ' + errorText)
			}
		} catch (e) {
			console.error('Failed to delete file', e)
			alert('Ошибка при удалении файла')
		} finally {
			setIsDeleting(null)
		}
	}

	const formatFileSize = (bytes: number) => {
		if (bytes === 0) return '0 B'
		const k = 1024
		const sizes = ['B', 'KB', 'MB', 'GB']
		const i = Math.floor(Math.log(bytes) / Math.log(k))
		return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
	}

	const getFileIcon = (filename: string) => {
		const ext = filename.split('.').pop()?.toLowerCase() || ''
		if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
			return '🖼️'
		}
		if (['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext)) {
			return '🎬'
		}
		if (['mp3', 'wav', 'ogg', 'flac'].includes(ext)) {
			return '🎵'
		}
		if (['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(ext)) {
			return '📄'
		}
		if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
			return '📦'
		}
		return '📁'
	}

	const isImage = (filename: string) => {
		const ext = filename.split('.').pop()?.toLowerCase() || ''
		return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)
	}

	return (
		<AnimatePresence>
			{isOpen && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					className='fixed inset-0 z-[100000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4'
					onClick={onClose}
					style={{ pointerEvents: 'auto' }}
				>
					<motion.div
						initial={{ scale: 0.9, opacity: 0, y: 20 }}
						animate={{ scale: 1, opacity: 1, y: 0 }}
						exit={{ scale: 0.9, opacity: 0, y: 20 }}
						className='w-full max-w-4xl space-y-6 rounded-2xl bg-gray-900/90 border border-white/10 p-6 shadow-2xl backdrop-blur-xl relative'
						onClick={e => e.stopPropagation()}
						style={{ pointerEvents: 'auto', zIndex: 100001 }}
					>
						<div
							className='flex items-center justify-between'
							style={{ pointerEvents: 'auto' }}
						>
							<h2 className='text-2xl font-bold text-white'>Мои файлы</h2>
							<button
								onClick={onClose}
								className='rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white transition-colors cursor-pointer'
								type='button'
							>
								<X className='w-6 h-6' />
							</button>
						</div>

						{isLoading ? (
							<div className='flex justify-center py-12'>
								<div className='h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent' />
							</div>
						) : files.length === 0 ? (
							<div className='text-center py-12 text-gray-400'>
								Нет загруженных файлов
							</div>
						) : (
							<>
								<div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-96 overflow-y-auto custom-scrollbar'>
									{files.map(file => (
										<div
											key={file.id}
											className='group relative rounded-xl bg-gray-800/50 border border-gray-700/50 p-3 hover:bg-gray-800 hover:border-gray-600 transition-all'
										>
											<button
												onClick={e => {
													e.stopPropagation()
													deleteFile(file.id)
												}}
												disabled={isDeleting === file.id}
												className='absolute top-2 right-2 p-1.5 rounded-lg bg-red-500/80 text-white opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all disabled:opacity-50'
												title='Удалить файл'
												type='button'
											>
												{isDeleting === file.id ? (
													<div className='w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent' />
												) : (
													<Trash2 className='w-4 h-4' />
												)}
											</button>

											<div className='aspect-square flex items-center justify-center text-4xl mb-2 overflow-hidden rounded-lg bg-black/20'>
												{isImage(file.name) ? (
													<img
														src={getAttachmentUrl(file.url)}
														alt={file.name}
														className='w-full h-full object-cover group-hover:scale-110 transition-transform duration-500'
													/>
												) : (
													getFileIcon(file.name)
												)}
											</div>

											<div
												className='text-xs text-gray-300 truncate text-center'
												title={file.name}
											>
												{file.name}
											</div>

											<div className='text-[10px] text-gray-500 text-center mt-1'>
												{formatFileSize(file.size)}
											</div>

											<a
												href={getAttachmentUrl(file.url)}
												target='_blank'
												rel='noopener noreferrer'
												className='absolute inset-0 cursor-pointer'
												onClick={e => e.stopPropagation()}
												title='Открыть файл'
											/>
										</div>
									))}
								</div>

								{totalPages > 1 && (
									<div className='flex items-center justify-center gap-2 pt-2'>
										<button
											onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
											disabled={currentPage === 1}
											className='rounded-lg px-3 py-1.5 text-sm text-gray-300 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
										>
											← Назад
										</button>
										<span className='text-sm text-gray-400'>
											Страница {currentPage} из {totalPages}
										</span>
										<button
											onClick={() =>
												setCurrentPage(p => Math.min(totalPages, p + 1))
											}
											disabled={currentPage === totalPages}
											className='rounded-lg px-3 py-1.5 text-sm text-gray-300 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
										>
											Вперед →
										</button>
									</div>
								)}
							</>
						)}
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	)
}
