'use client'

import { getAttachmentUrl } from '@/lib/utils'
import { AnimatePresence, motion } from 'framer-motion'
import {
	LuArchive as Archive,
	LuArrowDownAZ as ArrowDownAZ,
	LuArrowDownZA as ArrowDownZA,
	LuCheck as Check,
	LuClipboard as Clipboard,
	LuFileText as FileText,
	LuFolder as Folder,
	LuImage as Image,
	LuMic as Mic,
	LuMusic as Music,
	LuUpload as Upload,
	LuTrash2 as Trash2,
	LuVideo as Video,
	LuX as X,
} from 'react-icons/lu'
import { useEffect, useMemo, useRef, useState } from 'react'

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
	const [isUploading, setIsUploading] = useState(false)
	const [sortKey, setSortKey] = useState<'created_at' | 'name' | 'size'>(
		'created_at',
	)
	const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
	const [copiedFileId, setCopiedFileId] = useState<string | null>(null)
	const uploadInputRef = useRef<HTMLInputElement>(null)
	const perPage = 20

	useEffect(() => {
		if (isOpen) {
			fetchFiles(currentPage)
		}
	}, [isOpen, currentPage])

	const fetchFiles = async (page: number) => {
		setIsLoading(true)
		try {
			const res = await fetch('/api/files/list', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ page, per_page: perPage }),
			})
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

	const getExt = (filename: string) =>
		(filename.split('.').pop() || '').toLowerCase()

	const isAudio = (filename: string) => {
		const ext = getExt(filename)
		return ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'webm'].includes(ext)
	}

	const isVideo = (filename: string) => {
		const ext = getExt(filename)
		return ['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext)
	}

	const isDoc = (filename: string) => {
		const ext = getExt(filename)
		return ['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(ext)
	}

	const isArchive = (filename: string) => {
		const ext = getExt(filename)
		return ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)
	}

	const getFileIcon = (filename: string) => {
		const ext = filename.split('.').pop()?.toLowerCase() || ''
		if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
			return <Image className='h-10 w-10 text-indigo-300' />
		}
		if (isVideo(filename)) {
			return <Video className='h-10 w-10 text-rose-300' />
		}
		if (isAudio(filename)) {
			// Prefer mic icon for voice messages; most voice notes are ogg/webm/mp3
			return <Mic className='h-10 w-10 text-emerald-300' />
		}
		if (isDoc(filename)) {
			return <FileText className='h-10 w-10 text-sky-300' />
		}
		if (isArchive(filename)) {
			return <Archive className='h-10 w-10 text-amber-300' />
		}
		return <Folder className='h-10 w-10 text-gray-300' />
	}

	const isImage = (filename: string) => {
		const ext = filename.split('.').pop()?.toLowerCase() || ''
		return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)
	}

	const openFile = (url: string) => {
		const href = getAttachmentUrl(url)
		window.open(href, '_blank', 'noopener,noreferrer')
	}

	const copyFileLink = async (file: FileItem) => {
		try {
			await navigator.clipboard.writeText(getAttachmentUrl(file.url))
			setCopiedFileId(file.id)
			window.setTimeout(() => setCopiedFileId(null), 1200)
		} catch {
			alert('Не удалось скопировать ссылку')
		}
	}

	const uploadFileToStorage = async (file: File) => {
		if (!file) return
		if (file.size > 100 * 1024 * 1024) {
			alert('Файл слишком большой (макс 100МБ)')
			return
		}
		setIsUploading(true)
		try {
			const base64 = await new Promise<string>((resolve, reject) => {
				const reader = new FileReader()
				reader.onerror = () => reject(new Error('read_error'))
				reader.onload = () => resolve(String(reader.result || ''))
				reader.readAsDataURL(file)
			})
			const res = await fetch('/api/upload/file', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ file: base64, filename: file.name }),
			})
			const data = await res.json().catch(() => ({}))
			if (!res.ok) {
				throw new Error(data?.error || data?.details || 'Ошибка загрузки файла')
			}
			// refresh current page (newest will appear on page 1)
			setCurrentPage(1)
			await fetchFiles(1)
		} catch (e: any) {
			alert(e?.message || 'Ошибка загрузки файла')
		} finally {
			setIsUploading(false)
			if (uploadInputRef.current) uploadInputRef.current.value = ''
		}
	}

	const sortedFiles = useMemo(() => {
		const dir = sortDir === 'asc' ? 1 : -1
		const arr = [...files]
		arr.sort((a, b) => {
			if (sortKey === 'size') {
				return (Number(a.size || 0) - Number(b.size || 0)) * dir
			}
			if (sortKey === 'name') {
				return a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }) * dir
			}
			const at = new Date(a.created_at).getTime() || 0
			const bt = new Date(b.created_at).getTime() || 0
			return (at - bt) * dir
		})
		return arr
	}, [files, sortDir, sortKey])

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
							<div className='flex flex-col gap-1'>
								<h2 className='text-2xl font-bold text-white'>Мои файлы</h2>
								<div className='flex flex-wrap items-center gap-2'>
									<div className='text-xs text-gray-400'>Сортировка:</div>
									<select
										value={sortKey}
										onChange={e =>
											setSortKey(e.target.value as 'created_at' | 'name' | 'size')
										}
										className='rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-gray-200'
									>
										<option value='created_at'>По дате</option>
										<option value='name'>По имени</option>
										<option value='size'>По размеру</option>
									</select>
									<button
										type='button'
										onClick={() => setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))}
										className='inline-flex items-center gap-1 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-gray-200 hover:bg-white/5 transition'
										title='Поменять порядок'
									>
										{sortDir === 'asc' ? (
											<ArrowDownAZ className='h-4 w-4' />
										) : (
											<ArrowDownZA className='h-4 w-4' />
										)}
										<span>{sortDir === 'asc' ? 'По возрастанию' : 'По убыванию'}</span>
									</button>
								</div>
							</div>
							<div className='flex items-center gap-2'>
								<input
									ref={uploadInputRef}
									type='file'
									className='hidden'
									onChange={e => {
										const f = e.target.files?.[0]
										if (f) uploadFileToStorage(f)
									}}
								/>
								<button
									type='button'
									disabled={isUploading}
									onClick={() => uploadInputRef.current?.click()}
									className='rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition inline-flex items-center gap-2'
								>
									{isUploading ? (
										<div className='h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent' />
									) : (
										<Upload className='h-4 w-4' />
									)}
									<span>Загрузить</span>
								</button>
								<button
									onClick={onClose}
									className='rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white transition-colors cursor-pointer'
									type='button'
								>
									<X className='w-6 h-6' />
								</button>
							</div>
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
									{sortedFiles.map(file => (
										<div
											key={file.id}
											className='group relative rounded-xl bg-gray-800/50 border border-gray-700/50 p-3 hover:bg-gray-800 hover:border-gray-600 transition-all'
										>
											<button
												onClick={e => {
													e.stopPropagation()
													copyFileLink(file)
												}}
												className='absolute top-2 left-2 z-30 p-1.5 rounded-lg bg-black/40 text-white opacity-0 group-hover:opacity-100 hover:bg-black/60 transition-all'
												title='Скопировать ссылку'
												type='button'
											>
												{copiedFileId === file.id ? (
													<Check className='w-4 h-4 text-emerald-300' />
												) : (
													<Clipboard className='w-4 h-4' />
												)}
											</button>
											<button
												onClick={e => {
													e.stopPropagation()
													deleteFile(file.id)
												}}
												disabled={isDeleting === file.id}
												className='absolute top-2 right-2 z-20 p-1.5 rounded-lg bg-red-500/80 text-white opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all disabled:opacity-50'
												title='Удалить файл'
												type='button'
											>
												{isDeleting === file.id ? (
													<div className='w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent' />
												) : (
													<Trash2 className='w-4 h-4' />
												)}
											</button>

											<button
												type='button'
												onClick={() => openFile(file.url)}
												className='w-full text-left'
												title='Открыть файл'
											>
												<div className='aspect-square flex flex-col items-center justify-center gap-2 mb-2 overflow-hidden rounded-lg bg-black/20 p-2'>
												{isImage(file.name) ? (
													<img
														src={getAttachmentUrl(file.url)}
														alt={file.name}
														className='w-full h-full object-cover group-hover:scale-110 transition-transform duration-500'
													/>
												) : isVideo(file.name) ? (
													<video
														controls
														preload='metadata'
														src={getAttachmentUrl(file.url)}
														className='w-full h-full object-cover group-hover:scale-110 transition-transform duration-500'
													/>
												) : isAudio(file.name) ? (
													<>
														<div className='flex items-center justify-center'>
															<Mic className='h-8 w-8 text-emerald-300' />
														</div>
														<audio
															controls
															preload='none'
															src={getAttachmentUrl(file.url)}
															className='w-full h-8'
														/>
													</>
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
											</button>
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
