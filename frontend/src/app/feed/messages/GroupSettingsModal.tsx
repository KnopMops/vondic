'use client'

import { getAvatarUrl } from '@/lib/utils'
import { useState } from 'react'
import {
	LuImage as ImageIcon,
	LuSave as SaveIcon,
	LuUsers as UsersIcon,
	LuX as XIcon,
} from 'react-icons/lu'

interface GroupSettingsModalProps {
	isOpen: boolean
	onClose: () => void
	group: any
	onUpdate: (id: string, data: { name?: string; description?: string; avatar_url?: string }) => Promise<any>
}

export default function GroupSettingsModal({
	isOpen,
	onClose,
	group,
	onUpdate,
}: GroupSettingsModalProps) {
	const [name, setName] = useState(group?.name || '')
	const [description, setDescription] = useState(group?.description || '')
	const [avatarUrl, setAvatarUrl] = useState(group?.avatar_url || '')
	const [isSaving, setIsSaving] = useState(false)

	if (!isOpen || !group) return null

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setIsSaving(true)
		try {
			await onUpdate(group.id, {
				name: name.trim() || undefined,
				description: description.trim() || undefined,
				avatar_url: avatarUrl.trim() || undefined,
			})
			onClose()
		} catch (err: any) {
			alert(err.message || 'Не удалось сохранить')
		} finally {
			setIsSaving(false)
		}
	}

	return (
		<div className='fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4'>
			<div className='bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200'>
				<div className='flex items-center justify-between mb-6'>
					<h3 className='text-lg font-bold text-[#e6edf3]'>Настройки группы</h3>
					<button
						onClick={onClose}
						className='p-1.5 text-[#8b949e] hover:text-white hover:bg-[#21262d] rounded-lg transition-colors'
					>
						<XIcon className='w-5 h-5' />
					</button>
				</div>

				<form onSubmit={handleSubmit} className='space-y-4'>
					<div className='flex justify-center mb-4'>
						<div className='relative'>
							<div className='w-20 h-20 rounded-full bg-[#0e1117] border border-[#30363d] flex items-center justify-center overflow-hidden'>
								{avatarUrl ? (
									<img
										src={getAvatarUrl(avatarUrl)}
										alt='Avatar'
										className='w-full h-full object-cover'
									/>
								) : (
									<UsersIcon className='w-10 h-10 text-[#8b949e]' />
								)}
							</div>
						</div>
					</div>

					<div>
						<label className='block text-xs font-semibold text-[#8b949e] uppercase tracking-wider mb-1.5'>
							URL аватарки
						</label>
						<div className='flex gap-2'>
							<input
								type='text'
								value={avatarUrl}
								onChange={e => setAvatarUrl(e.target.value)}
								placeholder='https://...'
								className='flex-1 bg-[#0e1117] border border-[#30363d] rounded-xl px-4 py-2.5 text-[#e6edf3] placeholder-[#8b949e] focus:outline-none focus:border-[#0077FF] text-sm'
							/>
						</div>
					</div>

					<div>
						<label className='block text-xs font-semibold text-[#8b949e] uppercase tracking-wider mb-1.5'>
							Название
						</label>
						<input
							type='text'
							value={name}
							onChange={e => setName(e.target.value)}
							required
							className='w-full bg-[#0e1117] border border-[#30363d] rounded-xl px-4 py-2.5 text-[#e6edf3] placeholder-[#8b949e] focus:outline-none focus:border-[#0077FF] text-sm'
						/>
					</div>

					<div>
						<label className='block text-xs font-semibold text-[#8b949e] uppercase tracking-wider mb-1.5'>
							Описание
						</label>
						<textarea
							value={description}
							onChange={e => setDescription(e.target.value)}
							rows={3}
							className='w-full bg-[#0e1117] border border-[#30363d] rounded-xl px-4 py-2.5 text-[#e6edf3] placeholder-[#8b949e] focus:outline-none focus:border-[#0077FF] text-sm resize-none'
						/>
					</div>

					<button
						type='submit'
						disabled={isSaving || !name.trim()}
						className='w-full bg-[#0077FF] hover:bg-[#0066dd] text-white font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md shadow-[#0077FF]/20 text-sm'
					>
						<SaveIcon className='w-4 h-4' />
						{isSaving ? 'Сохранение...' : 'Сохранить'}
					</button>
				</form>
			</div>
		</div>
	)
}
