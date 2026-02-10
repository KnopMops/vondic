'use client'

import { Attachment } from '@/lib/types'
import { useRef, useState } from 'react'

type Props = {
	onCreate: (text: string, attachments?: Attachment[]) => void
}

export default function Composer({ onCreate }: Props) {
	const [text, setText] = useState('')
	const [files, setFiles] = useState<File[]>([])
	const [isUploading, setIsUploading] = useState(false)
	const fileInputRef = useRef<HTMLInputElement>(null)

	const fileToDataUrl = (file: File) =>
		new Promise<string>((resolve, reject) => {
			const reader = new FileReader()
			reader.onload = () => resolve(String(reader.result))
			reader.onerror = () => reject(new Error('File read error'))
			reader.readAsDataURL(file)
		})

	const uploadFile = async (file: File): Promise<Attachment> => {
		const dataUrl = await fileToDataUrl(file)
		const res = await fetch('/api/v1/upload/file', {
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
			const attachments =
				files.length > 0 ? await Promise.all(files.map(uploadFile)) : undefined
			onCreate(text.trim(), attachments)
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

	const removeFile = (index: number) => {
		setFiles(prev => prev.filter((_, i) => i !== index))
		setText('')
	}

	return (
		<div className='rounded-xl bg-gray-900/40 backdrop-blur-md border border-gray-800/50 p-4 shadow-sm'>
			<input
				ref={fileInputRef}
				type='file'
				multiple
				onChange={handleFilesSelected}
				className='hidden'
			/>

			<input
				value={text}
				onChange={e => setText(e.target.value)}
				placeholder='Что у вас нового?'
				className='w-full rounded-xl border border-gray-700/50 bg-gray-800/50 px-4 py-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all'
			/>

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

			<div className='mt-3 flex items-center gap-3'>
				<button
					onClick={submit}
					type='button'
					disabled={isUploading}
					className='rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/20 disabled:opacity-60 disabled:cursor-not-allowed'
				>
					{isUploading ? 'Загрузка...' : 'Опубликовать'}
				</button>

				<button
					onClick={handlePickFiles}
					type='button'
					disabled={isUploading}
					className='rounded-lg bg-gray-800/50 px-4 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed'
				>
					Прикрепить
				</button>
			</div>
		</div>
	)
}
