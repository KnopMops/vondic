'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { FormEvent, useState } from 'react'
import { FiUpload, FiX } from 'react-icons/fi'

type Props = {
	isOpen: boolean
	botId: string
	botName?: string
	onClose: () => void
	onUploaded?: () => void
}

export default function BotGameUploadModal({
	isOpen,
	botId,
	botName,
	onClose,
	onUploaded,
}: Props) {
	const [title, setTitle] = useState('')
	const [description, setDescription] = useState('')
	const [file, setFile] = useState<File | null>(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [note, setNote] = useState<string | null>(null)

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault()
		if (!file) {
			setError('Выберите ZIP-архив с index.html')
			return
		}
		setLoading(true)
		setError(null)
		setNote(null)
		try {
			const form = new FormData()
			form.append('file', file)
			form.append('title', title.trim() || file.name.replace(/\.zip$/i, ''))
			if (description.trim()) form.append('description', description.trim())

			const res = await fetch(`/api/v1/bots/${botId}/games`, {
				method: 'POST',
				credentials: 'include',
				body: form,
			})
			const data = await res.json().catch(() => ({}))
			if (!res.ok) {
				throw new Error(data.error || data.game?.scan_error || 'Ошибка загрузки')
			}
			const warning = data.game?.warning || data.warning
			if (warning) {
				setNote(String(warning))
			} else {
				setNote('Игра загружена и проверена. После одобления она появится в списке.')
			}
			onUploaded?.()
			setFile(null)
			setTitle('')
			setDescription('')
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : 'Ошибка')
		} finally {
			setLoading(false)
		}
	}

	return (
		<AnimatePresence>
			{isOpen && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					className='fixed inset-0 z-[100001] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4'
					onClick={onClose}
				>
					<motion.form
						initial={{ opacity: 0, scale: 0.96, y: 10 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.96, y: 10 }}
						onSubmit={handleSubmit}
						className='w-full max-w-md rounded-2xl border border-white/10 bg-gradient-to-br from-[#0b1220] to-[#1a1035] shadow-2xl overflow-hidden'
						onClick={e => e.stopPropagation()}
					>
						<div className='flex items-center justify-between p-5 border-b border-white/10'>
							<div>
								<h2 className='text-lg font-semibold text-white'>
									Загрузить игру
								</h2>
								<p className='text-xs text-gray-400 mt-0.5'>
									{botName || 'HTML/CSS/JS в ZIP, с index.html'}
								</p>
							</div>
							<button
								type='button'
								onClick={onClose}
								className='p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10'
							>
								<FiX />
							</button>
						</div>

						<div className='p-5 space-y-3'>
							<input
								value={title}
								onChange={e => setTitle(e.target.value)}
								placeholder='Название игры'
								className='w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-indigo-500 outline-none'
							/>
							<textarea
								value={description}
								onChange={e => setDescription(e.target.value)}
								placeholder='Описание (необязательно)'
								rows={2}
								className='w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-indigo-500 outline-none resize-none'
							/>
							<label className='flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-indigo-500/40 bg-indigo-500/5 px-4 py-8 cursor-pointer hover:bg-indigo-500/10 transition-colors'>
								<FiUpload className='w-8 h-8 text-indigo-400' />
								<span className='text-sm text-gray-300'>
									{file ? file.name : 'ZIP с index.html, css, js'}
								</span>
								<input
									type='file'
									accept='.zip,application/zip'
									className='hidden'
									onChange={e =>
										setFile(e.target.files?.[0] || null)
									}
								/>
							</label>
							{error && (
								<p className='text-sm text-red-400 text-center'>{error}</p>
							)}
							{note && (
								<p className='text-sm text-emerald-400 text-center'>{note}</p>
							)}
							<button
								type='submit'
								disabled={loading}
								className='w-full rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 py-3 text-sm font-semibold text-white disabled:opacity-50'
							>
								{loading ? 'Проверка…' : 'Загрузить и проверить'}
							</button>
						</div>
					</motion.form>
				</motion.div>
			)}
		</AnimatePresence>
	)
}
