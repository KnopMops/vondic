'use client'

import { useEffect, useState } from 'react'
import { getAvatarUrl } from '@/lib/utils'
import { XIcon, UsersIcon, Shield, Crown } from 'lucide-react'

type Participant = {
	id: string
	username: string
	avatar_url?: string
	role?: string
}

type Props = {
	group: {
		id: string
		name: string
		avatar_url?: string
		description?: string
	}
	userId: string
	onClose: () => void
	onOpenSettings?: () => void
}

export default function GroupInfoPanel({ group, userId, onClose, onOpenSettings }: Props) {
	const [participants, setParticipants] = useState<Participant[]>([])
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		fetch(`/api/v1/users/groups/${group.id}/participants`)
			.then(r => r.json())
			.then(data => {
				if (Array.isArray(data)) setParticipants(data)
			})
			.catch(() => {})
			.finally(() => setLoading(false))
	}, [group.id])

	return (
		<div className='w-80 border-l border-white/10 bg-black/30 backdrop-blur-md flex flex-col h-full shrink-0'>
			<div className='flex items-center justify-between p-4 border-b border-white/10'>
				<h3 className='text-sm font-bold text-white truncate'>{group.name}</h3>
				<button onClick={onClose} className='p-1 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors'>
					<XIcon className='w-4 h-4' />
				</button>
			</div>

			<div className='p-4 text-center border-b border-white/10'>
				{group.avatar_url ? (
					<img src={getAvatarUrl(group.avatar_url)} alt={group.name}
						className='w-20 h-20 rounded-2xl object-cover mx-auto mb-3 ring-2 ring-white/10' />
				) : (
					<div className='w-20 h-20 rounded-2xl bg-indigo-900/50 flex items-center justify-center mx-auto mb-3 ring-2 ring-white/10'>
						<UsersIcon className='w-10 h-10 text-indigo-400' />
					</div>
				)}
				<h4 className='text-lg font-bold text-white'>{group.name}</h4>
				{group.description && (
					<p className='text-xs text-gray-400 mt-1 px-2'>{group.description}</p>
				)}
				<p className='text-xs text-gray-500 mt-2'>
					{participants.length} {participants.length === 1 ? 'участник' : participants.length < 5 ? 'участника' : 'участников'}
				</p>
			</div>

			<div className='flex-1 overflow-y-auto'>
				<div className='p-3'>
					<h5 className='text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2'>Участники</h5>
					{loading ? (
						<div className='space-y-2'>
							{[1, 2, 3].map(i => (
								<div key={i} className='flex items-center gap-2 animate-pulse'>
									<div className='w-8 h-8 rounded-full bg-white/5' />
									<div className='h-3 bg-white/5 rounded w-20' />
								</div>
							))}
						</div>
					) : (
						<div className='space-y-1'>
							{participants.map(p => (
								<div key={p.id} className='flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors'>
									<img src={getAvatarUrl(p.avatar_url)} alt={p.username}
										className='w-8 h-8 rounded-full object-cover bg-white/5 ring-1 ring-white/10' />
									<div className='flex-1 min-w-0'>
										<div className='text-sm text-gray-200 truncate'>{p.username}</div>
									</div>
									{p.id === userId && <span className='text-[10px] text-gray-500'>Вы</span>}
									{p.role === 'admin' && <Crown className='w-3.5 h-3.5 text-amber-400' />}
									{p.role === 'moderator' && <Shield className='w-3.5 h-3.5 text-blue-400' />}
								</div>
							))}
						</div>
					)}
				</div>
			</div>

			{onOpenSettings && (
				<div className='p-3 border-t border-white/10'>
					<button
						onClick={onOpenSettings}
						className='w-full rounded-xl bg-white/5 hover:bg-white/10 text-sm text-gray-300 py-2.5 transition-colors'
					>
						Настройки группы
					</button>
				</div>
			)}
		</div>
	)
}
