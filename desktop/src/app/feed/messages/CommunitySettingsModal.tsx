'use client'

import { getAvatarUrl } from '@/lib/utils'
import { useState } from 'react'
import {
	LuImage as ImageIcon,
	LuSave as SaveIcon,
	LuUsers as UsersIcon,
	LuX as XIcon,
} from 'react-icons/lu'

interface CommunitySettingsModalProps {
	isOpen: boolean
	onClose: () => void
	community: any
	onUpdate: (id: string, data: { name?: string; description?: string; avatar_url?: string }) => Promise<any>
}

export default function CommunitySettingsModal({
	isOpen,
	onClose,
	community,
	onUpdate,
}: CommunitySettingsModalProps) {
	const [name, setName] = useState(community?.name || '')
	const [description, setDescription] = useState(community?.description || '')
	const [avatarUrl, setAvatarUrl] = useState(community?.avatar_url || '')
	const [isSaving, setIsSaving] = useState(false)

	if (!isOpen || !community) return null

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setIsSaving(true)
		try {
			await onUpdate(community.id, {
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
		<div className='fixed inset-0 bg-black/50 backdrop-blur-sm z-[99999] flex items-center justify-center p-4'>
			<div className='bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200'>
				<div className='flex items-center justify-between mb-6'>
					<h3 className='text-xl font-bold text-white'>Настройки сообщества</h3>
					<button
						onClick={onClose}
						className='p-1 text-gray-400 hover:text-white transition-colors'
					>
						<XIcon className='w-5 h-5' />
					</button>
				</div>

				<form onSubmit={handleSubmit} className='space-y-4'>
					<div className='flex justify-center mb-4'>
						<div className='relative'>
							<div className='w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center ring-4 ring-gray-800/50 overflow-hidden'>
								{avatarUrl ? (
									<img
										src={getAvatarUrl(avatarUrl)}
										alt='Avatar'
										className='w-full h-full object-cover'
									/>
								) : (
									<UsersIcon className='w-10 h-10 text-gray-400' />
								)}
							</div>
						</div>
					</div>

					<div>
						<label className='block text-sm font-medium text-gray-400 mb-1'>
							URL аватарки
						</label>
						<div className='flex gap-2'>
							<input
								type='text'
								value={avatarUrl}
								onChange={e => setAvatarUrl(e.target.value)}
								placeholder='https://...'
								className='flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50'
							/>
						</div>
					</div>

					<div>
						<label className='block text-sm font-medium text-gray-400 mb-1'>
							Название
						</label>
						<input
							type='text'
							value={name}
							onChange={e => setName(e.target.value)}
							required
							className='w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50'
						/>
					</div>

					<div>
						<label className='block text-sm font-medium text-gray-400 mb-1'>
							Описание
						</label>
						<textarea
							value={description}
							onChange={e => setDescription(e.target.value)}
							rows={3}
							className='w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none'
						/>
					</div>

					<button
						type='submit'
						disabled={isSaving || !name.trim()}
						className='w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2'
					>
						<SaveIcon className='w-4 h-4' />
						{isSaving ? 'Сохранение...' : 'Сохранить'}
					</button>
				</form>
			</div>
		</div>
	)
}
