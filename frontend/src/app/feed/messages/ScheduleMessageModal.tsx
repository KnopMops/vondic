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
				className='bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200'
				onClick={e => e.stopPropagation()}
			>
				<div className='flex items-center justify-between p-4 border-b border-[#30363d]'>
					<h3 className='text-base font-bold text-[#e6edf3]'>Отложенная отправка</h3>
					<button onClick={onClose} className='p-1.5 text-[#8b949e] hover:text-white hover:bg-[#21262d] rounded-lg transition-colors'>
						<XIcon className='w-5 h-5' />
					</button>
				</div>
				<div className='p-4 space-y-4'>
					{chatLabel && (
						<p className='text-xs text-[#8b949e]'>
							Чат: <span className='text-[#e6edf3] font-medium'>{chatLabel}</span>
						</p>
					)}
					<div>
						<label className='text-xs font-semibold text-[#8b949e] mb-1.5 block uppercase tracking-wider'>Дата и время</label>
						<input
							type='datetime-local'
							value={value}
							onChange={e => { setValue(e.target.value); setError('') }}
							className='w-full px-4 py-2.5 bg-[#0e1117] border border-[#30363d] rounded-xl text-[#e6edf3] focus:outline-none focus:border-[#0077FF] text-sm'
						/>
						{error && <p className='mt-1 text-xs text-rose-400'>{error}</p>}
					</div>
					<div className='flex gap-2 pt-1'>
						<button type='button' onClick={onClose} className='flex-1 py-2.5 text-xs font-medium text-[#8b949e] hover:text-white bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] rounded-xl transition-colors'>Отмена</button>
						<button type='button' onClick={handleConfirm} className='flex-1 py-2.5 text-xs font-medium text-white bg-[#0077FF] hover:bg-[#0066dd] rounded-xl shadow-md shadow-[#0077FF]/20 transition-colors'>Запланировать</button>
					</div>
				</div>
			</div>
		</div>
	)
}
