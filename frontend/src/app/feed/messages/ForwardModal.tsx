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
				className='bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]'
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
						className='p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition'
					>
						<LuX className='w-5 h-5' />
					</button>
				</div>

				<div className='relative mb-3'>
					<LuSearch className='absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
					<input
						type='text'
						value={query}
						onChange={e => setQuery(e.target.value)}
						placeholder='Поиск чатов, групп, каналов...'
						autoFocus
						className='w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50'
					/>
				</div>

				{previewText && (
					<div className='mb-3 p-2.5 rounded-xl bg-gray-800/40 border border-gray-800 text-xs text-gray-300 truncate'>
						<span className='text-gray-500 uppercase tracking-wider block text-[10px] mb-0.5'>
							Содержимое
						</span>
						{previewText}
					</div>
				)}

				<div className='flex-1 overflow-y-auto space-y-1.5 custom-scrollbar pr-1'>
					{filtered.length === 0 ? (
						<div className='text-center py-8 text-sm text-gray-500'>
							Ничего не найдено
						</div>
					) : (
						filtered.map(target => (
							<button
								key={`${target.kind}:${target.id}`}
								onClick={() => {
									onForward(target)
								}}
								className='w-full flex items-center gap-3 p-3 rounded-xl bg-gray-800/30 hover:bg-gray-800 border border-transparent hover:border-gray-700 text-left transition group'
							>
								<div className='w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center shrink-0 text-gray-300 overflow-hidden'>
									{target.avatar_url ? (
										<img
											src={target.avatar_url}
											alt={target.label}
											className='w-full h-full object-cover'
										/>
									) : target.kind === 'channel' ? (
										<LuRadio className='w-5 h-5 text-sky-400' />
									) : target.kind === 'group' ? (
										<LuUsers className='w-5 h-5 text-indigo-400' />
									) : (
										<LuUser className='w-5 h-5 text-blue-400' />
									)}
								</div>
								<div className='flex-1 min-w-0'>
									<div className='text-sm font-medium text-white truncate group-hover:text-blue-400 transition-colors'>
										{target.label}
									</div>
									<div className='text-xs text-gray-500 uppercase tracking-wider text-[10px]'>
										{target.sub || (target.kind === 'user' ? 'Личный чат' : target.kind === 'group' ? 'Группа' : 'Канал')}
									</div>
								</div>
								<span className='text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity'>
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
