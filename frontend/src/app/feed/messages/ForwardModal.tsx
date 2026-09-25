'use client'

import React, { useState } from 'react'
import { LuX, LuSearch, LuUser, LuUsers, LuRadio } from 'react-icons/lu'

export interface ForwardTarget {
	id: string
	kind: 'user' | 'group' | 'channel' | 'community'
	label: string
	sub?: string
	avatar_url?: string
}

interface ForwardModalProps {
	isOpen: boolean
	onClose: () => void
	onForward: (target: ForwardTarget) => void
	targets: ForwardTarget[]
	previewText?: string
	count?: number
}

export default function ForwardModal({
	isOpen,
	onClose,
	onForward,
	targets,
	previewText,
	count = 1,
}: ForwardModalProps) {
	const [query, setQuery] = useState('')

	if (!isOpen) return null

	const filtered = targets.filter(t =>
		t.label.toLowerCase().includes(query.toLowerCase())
	)

	return (
		<div
			className='fixed inset-0 bg-black/70 backdrop-blur-sm z-[99999] flex items-center justify-center p-4'
			onClick={onClose}
		>
			<div
				className='bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]'
				onClick={e => e.stopPropagation()}
			>
				<div className='flex items-center justify-between mb-4'>
					<h3 className='text-lg font-bold text-white'>
						Переслать{' '}
						{count > 1
							? `${count} сообще${count % 10 === 1 && count % 100 !== 11 ? 'ние' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'ния' : 'ний'}`
							: 'сообщение'}
					</h3>
					<button
						onClick={onClose}
						className='p-1.5 text-[#8b949e] hover:text-[#e6edf3] rounded-lg hover:bg-[#21262d] transition'
					>
						<LuX className='w-5 h-5' />
					</button>
				</div>

				<div className='relative mb-3'>
					<LuSearch className='absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8b949e]' />
					<input
						type='text'
						value={query}
						onChange={e => setQuery(e.target.value)}
						placeholder='Поиск чатов, групп, каналов...'
						autoFocus
						className='w-full bg-[#0e1117] border border-[#30363d] rounded-xl pl-10 pr-4 py-2.5 text-[#e6edf3] placeholder-[#8b949e] text-sm focus:outline-none focus:border-[#0077FF] focus:ring-1 focus:ring-[#0077FF]/40'
					/>
				</div>

				{previewText && (
					<div className='mb-3 p-3 rounded-xl bg-[#0e1117] border border-[#30363d] text-xs text-[#e6edf3] truncate'>
						<span className='text-[#8b949e] uppercase tracking-wider block text-[10px] mb-1 font-semibold'>
							Содержимое
						</span>
						{previewText}
					</div>
				)}

				<div className='flex-1 overflow-y-auto space-y-1.5 custom-scrollbar pr-1'>
					{filtered.length === 0 ? (
						<div className='text-center py-8 text-sm text-[#8b949e]'>
							Ничего не найдено
						</div>
					) : (
						filtered.map(target => (
							<button
								key={`${target.kind}:${target.id}`}
								onClick={() => {
									onForward(target)
								}}
								className='w-full flex items-center gap-3 p-3 rounded-xl bg-[#0e1117]/60 hover:bg-[#21262d] border border-transparent hover:border-[#30363d] text-left transition group'
							>
								<div className='w-10 h-10 rounded-full bg-[#21262d] flex items-center justify-center shrink-0 text-[#8b949e] overflow-hidden ring-1 ring-[#30363d]'>
									{target.avatar_url ? (
										<img
											src={target.avatar_url}
											alt={target.label}
											className='w-full h-full object-cover'
										/>
									) : target.kind === 'channel' ? (
										<LuRadio className='w-5 h-5 text-[#0077FF]' />
									) : target.kind === 'group' ? (
										<LuUsers className='w-5 h-5 text-[#0077FF]' />
									) : (
										<LuUser className='w-5 h-5 text-[#0077FF]' />
									)}
								</div>
								<div className='flex-1 min-w-0'>
									<div className='text-sm font-semibold text-white truncate group-hover:text-[#0077FF] transition-colors'>
										{target.label}
									</div>
									<div className='text-[#8b949e] uppercase tracking-wider text-[10px]'>
										{target.sub || (target.kind === 'user' ? 'Личный чат' : target.kind === 'group' ? 'Группа' : 'Канал')}
									</div>
								</div>
								<span className='text-xs font-semibold text-[#0077FF] opacity-0 group-hover:opacity-100 transition-opacity'>
									Отправить
								</span>
							</button>
						))
					)}
				</div>
			</div>
		</div>
	)
}
