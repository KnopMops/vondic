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
		<div className='fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4'>
			<div className='bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200'>
				<div className='flex items-center justify-between mb-5'>
					<h3 className='text-lg font-bold text-[#e6edf3]'>Создать опрос</h3>
					<button
						onClick={onClose}
						className='p-1.5 text-[#8b949e] hover:text-white hover:bg-[#21262d] rounded-lg transition-colors'
					>
						<X className='w-5 h-5' />
					</button>
				</div>

				{/* Question */}
				<div className='mb-4'>
					<label className='block text-xs font-semibold text-[#8b949e] mb-1.5 uppercase tracking-wider'>
						Вопрос
					</label>
					<input
						type='text'
						value={question}
						onChange={e => setQuestion(e.target.value)}
						className='w-full bg-[#0e1117] border border-[#30363d] rounded-xl px-4 py-2.5 text-[#e6edf3] text-sm focus:outline-none focus:border-[#0077FF] placeholder-[#8b949e]'
						placeholder='Что вы хотите спросить?'
						autoFocus
					/>
				</div>

				{/* Options */}
				<div className='mb-4'>
					<label className='block text-xs font-semibold text-[#8b949e] mb-1.5 uppercase tracking-wider'>
						Варианты
					</label>
					<div className='space-y-2'>
						{options.map((opt, i) => (
							<div key={i} className='flex items-center gap-2'>
								<input
									type='text'
									value={opt}
									onChange={e => updateOption(i, e.target.value)}
									className='flex-1 bg-[#0e1117] border border-[#30363d] rounded-xl px-4 py-2 text-[#e6edf3] text-sm focus:outline-none focus:border-[#0077FF] placeholder-[#8b949e]'
									placeholder={`Вариант ${i + 1}`}
								/>
								{options.length > 2 && (
									<button
										onClick={() => removeOption(i)}
										className='p-2 text-[#8b949e] hover:text-rose-400 hover:bg-[#21262d] rounded-xl transition-colors'
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
							className='mt-2 flex items-center gap-1.5 text-xs text-[#0077FF] hover:underline transition-colors font-medium'
						>
							<Plus className='w-3.5 h-3.5' />
							Добавить вариант
						</button>
					)}
				</div>

				{/* Toggles */}
				<div className='space-y-3 mb-5 bg-[#0e1117] p-3 rounded-xl border border-[#30363d]'>
					<label className='flex items-center justify-between cursor-pointer'>
						<span className='text-xs font-medium text-[#e6edf3]'>Анонимный опрос</span>
						<div
							onClick={() => setIsAnonymous(!isAnonymous)}
							className={`relative w-10 h-5 rounded-full transition-colors ${
								isAnonymous ? 'bg-[#0077FF]' : 'bg-[#21262d] border border-[#30363d]'
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
						<span className='text-xs font-medium text-[#e6edf3]'>Несколько вариантов</span>
						<div
							onClick={() => setMultipleChoice(!multipleChoice)}
							className={`relative w-10 h-5 rounded-full transition-colors ${
								multipleChoice ? 'bg-[#0077FF]' : 'bg-[#21262d] border border-[#30363d]'
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
				<div className='flex items-center justify-end gap-2'>
					<button
						onClick={onClose}
						className='px-4 py-2 text-xs font-medium text-[#8b949e] hover:text-white hover:bg-[#21262d] rounded-xl transition-colors border border-[#30363d]'
					>
						Отмена
					</button>
					<button
						onClick={handleCreate}
						disabled={!canCreate}
						className='px-5 py-2 bg-[#0077FF] hover:bg-[#0066dd] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl shadow-md shadow-[#0077FF]/20 transition-colors'
					>
						{creating ? 'Создание...' : 'Создать опрос'}
					</button>
				</div>
			</div>
		</div>
	)
}
