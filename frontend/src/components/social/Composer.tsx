'use client'

import { useAppSelector } from '@/lib/hooks'
import { useFileDrop } from '@/lib/hooks/useFileDrop'
import { Attachment } from '@/lib/types'
import { useCallback, useRef, useState } from 'react'

type Props = {
	onCreate: (text: string, attachments?: Attachment[], isBlog?: boolean) => void
	mode?: 'feed' | 'blog'
}

export default function Composer({ onCreate, mode = 'feed' }: Props) {
	const [text, setText] = useState('')
	const [files, setFiles] = useState<File[]>([])
	const [isUploading, setIsUploading] = useState(false)
	const fileInputRef = useRef<HTMLInputElement>(null)
	const { user } = useAppSelector(state => state.auth)

	
	const isBlogPost = user?.role === 'Admin' && (text.trim().startsWith('# ') || text.trim().startsWith('#'))

	const fileToDataUrl = (file: File) =>
		new Promise<string>((resolve, reject) => {
			const reader = new FileReader()
			reader.onload = () => resolve(String(reader.result))
			reader.onerror = () => reject(new Error('File read error'))
			reader.readAsDataURL(file)
		})

	const uploadFile = async (file: File): Promise<Attachment> => {
		const maxSize = (user?.premium ? 100 : 20) * 1024 * 1024
		if (file.size > maxSize) {
			throw new Error(
				`Файл превышает лимит ${user?.premium ? '100' : '20'} МБ: ${file.name}`,
			)
		}
		const THROTTLE_BPS = 1750000
		if (!user?.premium) {
			const delayMs = Math.ceil((file.size / THROTTLE_BPS) * 1000)
			await new Promise(resolve => setTimeout(resolve, delayMs))
		}
		const dataUrl = await fileToDataUrl(file)
		const res = await fetch('/api/upload/file', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				file: dataUrl,
				filename: file.name,
			}),
		})

		if (!res.ok) {
			const text = await res.text()
			throw new Error(text || 'Upload failed')
		}

		const data: any = await res.json().catch(() => ({}))
		const url = data?.url || data?.file_url || data?.path
		if (!url) {
			throw new Error('Invalid upload response')
		}

		const ext = file.name.includes('.')
			? file.name.split('.').pop()!.toLowerCase()
			: ''

		return {
			url,
			name: file.name,
			ext,
			size: file.size,
		}
	}

	const submit = async () => {
		if (!text.trim() && files.length === 0) return
		if (isUploading) return

		setIsUploading(true)
		try {
			let attachments: Attachment[] | undefined = undefined
			if (files.length > 0) {
				if (user?.premium) {
					attachments = await Promise.all(files.map(uploadFile))
				} else {
					const list: Attachment[] = []
					for (const f of files) {
						const a = await uploadFile(f)
						list.push(a)
					}
					attachments = list
				}
			}
	// Pass is_blog flag for admin posts starting with "#", but don't show "#" in UI.
	const raw = text.trim()
	const clean = isBlogPost ? raw.replace(/^#\s?/, '') : raw
	onCreate(clean, attachments, isBlogPost)
			setText('')
			setFiles([])
		} finally {
			setIsUploading(false)
		}
	}

	const handlePickFiles = () => {
		fileInputRef.current?.click()
	}

	const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
		const list = e.target.files ? Array.from(e.target.files) : []
		if (list.length === 0) return
		setFiles(prev => [...prev, ...list])
		e.target.value = ''
	}

	const addFiles = useCallback((list: File[]) => {
		if (list.length === 0) return
		setFiles(prev => [...prev, ...list])
	}, [])

	const { dragOver, dropHandlers } = useFileDrop(addFiles)

	const removeFile = (index: number) => {
		setFiles(prev => prev.filter((_, i) => i !== index))
		setText('')
	}

	return (
		<div
			className={`glass-panel p-4 transition-all ${
				dragOver
					? 'ring-2 ring-[var(--app-accent)]'
					: ''
			}`}
			{...dropHandlers}
		>
			{dragOver && (
				<div className='pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-[rgb(var(--app-accent-rgb)/0.1)] backdrop-blur-[1px]'>
					<p className='text-sm font-medium text-[var(--app-accent-2)]'>
						Отпустите файлы для прикрепления
					</p>
				</div>
			)}
			<input
				ref={fileInputRef}
				type='file'
				accept='image/*,video/*,audio/*'
				multiple
				onChange={handleFilesSelected}
				className='hidden'
			/>

			<input
				value={text}
				onChange={e => setText(e.target.value)}
				placeholder={isBlogPost ? 'Пост для блога разработчика...' : 'Что у вас нового?'}
				className='w-full rounded-2xl border border-[var(--app-glass-border)] bg-[rgb(var(--app-surface-rgb)/0.4)] px-4 py-3 text-sm text-[var(--app-fg)] placeholder-[var(--app-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--app-accent)]/50 transition-all'
			/>

			{isBlogPost && (
				<div className='mt-2 flex items-center gap-2 text-amber-400 text-xs'>
					<span>📝</span>
					<span>
						Пост будет опубликован как <strong>блог разработчика</strong>
					</span>
				</div>
			)}

			{files.length > 0 && (
				<div className='mt-3 flex flex-wrap gap-2'>
					{files.map((f, idx) => (
						<div
							key={`${f.name}-${f.size}-${idx}`}
							className='flex items-center gap-2 rounded-lg border border-gray-700/50 bg-gray-800/40 px-3 py-2 text-xs text-gray-200'
						>
							<span className='max-w-[180px] truncate'>{f.name}</span>
							<button
								onClick={() => removeFile(idx)}
								className='rounded-md px-2 py-1 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors'
								type='button'
							>
								✕
							</button>
						</div>
					))}
				</div>
			)}

			<div className='mt-3 flex flex-wrap items-center gap-3'>
				<button
					onClick={submit}
					type='button'
					disabled={isUploading}
					className='btn-accent px-4 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed'
				>
					{isUploading ? 'Загрузка...' : 'Опубликовать'}
				</button>

				<button
					onClick={handlePickFiles}
					type='button'
					disabled={isUploading}
					className='rounded-lg border border-[var(--app-glass-border)] bg-[rgb(var(--app-surface-rgb)/0.3)] px-4 py-2 text-sm text-[var(--app-muted)] hover:text-[var(--app-fg)] hover:bg-[rgb(var(--app-surface-rgb)/0.5)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed'
				>
					Прикрепить
				</button>
			</div>
		</div>
	)
}
