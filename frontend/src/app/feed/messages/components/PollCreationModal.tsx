'use client'

import { useState } from 'react'
import { createPoll } from '@/lib/api/polls'
import { LuX as X, LuPlus as Plus, LuTrash2 as Trash2 } from 'react-icons/lu'

interface PollCreationModalProps {
	isOpen: boolean
	onClose: () => void
	onCreated: (pollId: string) => void
}

export default function PollCreationModal({
	isOpen,
	onClose,
	onCreated,
}: PollCreationModalProps) {
	const [question, setQuestion] = useState('')
	const [options, setOptions] = useState(['', ''])
	const [isAnonymous, setIsAnonymous] = useState(true)
	const [multipleChoice, setMultipleChoice] = useState(false)
	const [creating, setCreating] = useState(false)

	if (!isOpen) return null

	const addOption = () => {
		if (options.length < 4) {
			setOptions([...options, ''])
		}
	}

	const removeOption = (index: number) => {
		if (options.length > 2) {
			setOptions(options.filter((_, i) => i !== index))
		}
	}

	const updateOption = (index: number, value: string) => {
		const newOptions = [...options]
		newOptions[index] = value
		setOptions(newOptions)
	}

	const handleCreate = async () => {
		const trimmedQuestion = question.trim()
		const trimmedOptions = options.map(o => o.trim()).filter(o => o.length > 0)

		if (!trimmedQuestion) return
		if (trimmedOptions.length < 2) return

		setCreating(true)
		try {
			const poll = await createPoll({
				question: trimmedQuestion,
				options: trimmedOptions,
				is_anonymous: isAnonymous,
				multiple_choice: multipleChoice,
			})
			onCreated(poll.id)
			// Reset form
			setQuestion('')
			setOptions(['', ''])
			setIsAnonymous(true)
			setMultipleChoice(false)
		} catch (e) {
			console.error('Failed to create poll:', e)
		} finally {
			setCreating(false)
		}
	}

	const canCreate =
		question.trim().length > 0 &&
		options.filter(o => o.trim().length > 0).length >= 2 &&
		!creating

	return (
		<div className='fixed inset-0 bg-black/50 backdrop-blur-sm z-[99999] flex items-center justify-center p-4'>
			<div className='bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200'>
				<div className='flex items-center justify-between mb-5'>
					<h3 className='text-xl font-bold text-white'>Создать опрос</h3>
					<button
						onClick={onClose}
						className='p-1 text-gray-400 hover:text-white transition-colors'
					>
						<X className='w-5 h-5' />
					</button>
				</div>

				{/* Question */}
				<div className='mb-4'>
					<label className='block text-xs text-gray-400 mb-1.5 uppercase tracking-wider'>
						Вопрос
					</label>
					<input
						type='text'
						value={question}
						onChange={e => setQuestion(e.target.value)}
						className='w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 placeholder-gray-500'
						placeholder='Что вы хотите спросить?'
						autoFocus
					/>
				</div>

				{/* Options */}
				<div className='mb-4'>
					<label className='block text-xs text-gray-400 mb-1.5 uppercase tracking-wider'>
						Варианты
					</label>
					<div className='space-y-2'>
						{options.map((opt, i) => (
							<div key={i} className='flex items-center gap-2'>
								<input
									type='text'
									value={opt}
									onChange={e => updateOption(i, e.target.value)}
									className='flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 placeholder-gray-500'
									placeholder={`Вариант ${i + 1}`}
								/>
								{options.length > 2 && (
									<button
										onClick={() => removeOption(i)}
										className='p-2 text-gray-500 hover:text-rose-400 hover:bg-gray-800 rounded-full transition-colors'
									>
										<Trash2 className='w-4 h-4' />
									</button>
								)}
							</div>
						))}
					</div>
					{options.length < 4 && (
						<button
							onClick={addOption}
							className='mt-2 flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors'
						>
							<Plus className='w-3.5 h-3.5' />
							Добавить вариант
						</button>
					)}
				</div>

				{/* Toggles */}
				<div className='space-y-3 mb-5'>
					<label className='flex items-center justify-between cursor-pointer'>
						<span className='text-sm text-gray-300'>Анонимный</span>
						<div
							onClick={() => setIsAnonymous(!isAnonymous)}
							className={`relative w-10 h-5 rounded-full transition-colors ${
								isAnonymous ? 'bg-indigo-500' : 'bg-gray-700'
							}`}
						>
							<div
								className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
									isAnonymous ? 'translate-x-5' : ''
								}`}
							/>
						</div>
					</label>
					<label className='flex items-center justify-between cursor-pointer'>
						<span className='text-sm text-gray-300'>Несколько вариантов</span>
						<div
							onClick={() => setMultipleChoice(!multipleChoice)}
							className={`relative w-10 h-5 rounded-full transition-colors ${
								multipleChoice ? 'bg-indigo-500' : 'bg-gray-700'
							}`}
						>
							<div
								className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
									multipleChoice ? 'translate-x-5' : ''
								}`}
							/>
						</div>
					</label>
				</div>

				{/* Actions */}
				<div className='flex items-center justify-end gap-3'>
					<button
						onClick={onClose}
						className='px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors'
					>
						Отмена
					</button>
					<button
						onClick={handleCreate}
						disabled={!canCreate}
						className='px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors'
					>
						{creating ? 'Создание...' : 'Создать'}
					</button>
				</div>
			</div>
		</div>
	)
}
