'use client'

import { useEffect, useState } from 'react'
import { XIcon } from 'lucide-react'

type ScheduleMessageModalProps = {
	isOpen: boolean
	onClose: () => void
	onConfirm: (scheduledAt: string) => void
	chatLabel?: string
}

function getDefaultDatetimeLocal(): string {
	const d = new Date(Date.now() + 60 * 60 * 1000)
	d.setSeconds(0, 0)
	const pad = (n: number) => String(n).padStart(2, '0')
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function ScheduleMessageModal({
	isOpen,
	onClose,
	onConfirm,
	chatLabel,
}: ScheduleMessageModalProps) {
	const [value, setValue] = useState('')
	const [error, setError] = useState('')

	useEffect(() => {
		if (isOpen) {
			setValue(getDefaultDatetimeLocal())
			setError('')
		}
	}, [isOpen])

	if (!isOpen) return null

	const handleConfirm = () => {
		if (!value) {
			setError('Укажите дату и время')
			return
		}
		const at = new Date(value).getTime()
		if (!Number.isFinite(at)) {
			setError('Неверная дата')
			return
		}
		if (at <= Date.now()) {
			setError('Время должно быть в будущем')
			return
		}
		onConfirm(new Date(value).toISOString())
	}

	return (
		<div
			className='fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4'
			onClick={onClose}
		>
			<div
				className='bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl'
				onClick={e => e.stopPropagation()}
			>
				<div className='flex items-center justify-between p-4 border-b border-gray-800'>
					<h3 className='text-lg font-bold text-white'>Отложенная отправка</h3>
					<button onClick={onClose} className='p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg'>
						<XIcon className='w-5 h-5' />
					</button>
				</div>
				<div className='p-4 space-y-4'>
					{chatLabel && (
						<p className='text-sm text-gray-400'>
							Чат: <span className='text-gray-200'>{chatLabel}</span>
						</p>
					)}
					<div>
						<label className='text-xs text-gray-500 mb-2 block uppercase tracking-wider'>Дата и время</label>
						<input
							type='datetime-local'
							value={value}
							onChange={e => { setValue(e.target.value); setError('') }}
							className='w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50'
						/>
						{error && <p className='mt-1 text-xs text-red-400'>{error}</p>}
					</div>
					<div className='flex gap-2'>
						<button type='button' onClick={onClose} className='flex-1 py-2.5 text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-xl'>Отмена</button>
						<button type='button' onClick={handleConfirm} className='flex-1 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl'>Запланировать</button>
					</div>
				</div>
			</div>
		</div>
	)
}
