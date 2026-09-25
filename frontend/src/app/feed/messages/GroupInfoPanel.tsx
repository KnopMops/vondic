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
		<div className='w-80 border-l border-[#30363d] bg-[#161b22] flex flex-col h-full shrink-0 shadow-2xl z-20'>
			<div className='flex items-center justify-between p-4 border-b border-[#30363d]'>
				<h3 className='text-sm font-bold text-white truncate'>{group.name}</h3>
				<button onClick={onClose} className='p-1.5 text-[#8b949e] hover:text-[#e6edf3] rounded-lg hover:bg-[#21262d] transition-colors'>
					<XIcon className='w-4 h-4' />
				</button>
			</div>

			<div className='p-5 text-center border-b border-[#30363d] bg-[#0e1117]/40'>
				{group.avatar_url ? (
					<img src={getAvatarUrl(group.avatar_url)} alt={group.name}
						className='w-20 h-20 rounded-2xl object-cover mx-auto mb-3 ring-1 ring-[#30363d] shadow-lg' />
				) : (
					<div className='w-20 h-20 rounded-2xl bg-[#21262d] border border-[#30363d] flex items-center justify-center mx-auto mb-3 shadow-lg'>
						<UsersIcon className='w-10 h-10 text-[#0077FF]' />
					</div>
				)}
				<h4 className='text-lg font-bold text-white'>{group.name}</h4>
				{group.description && (
					<p className='text-xs text-[#8b949e] mt-1.5 px-2 leading-relaxed'>{group.description}</p>
				)}
				<p className='text-xs text-[#8b949e] mt-2'>
					{participants.length} {participants.length === 1 ? 'участник' : participants.length < 5 ? 'участника' : 'участников'}
				</p>
			</div>

			<div className='flex-1 overflow-y-auto custom-scrollbar'>
				<div className='p-3'>
					<h5 className='text-xs font-semibold text-[#8b949e] uppercase tracking-wider mb-2 px-2'>Участники</h5>
					{loading ? (
						<div className='space-y-2'>
							{[1, 2, 3].map(i => (
								<div key={i} className='flex items-center gap-2 animate-pulse p-2'>
									<div className='w-8 h-8 rounded-full bg-[#21262d]' />
									<div className='h-3 bg-[#21262d] rounded w-20' />
								</div>
							))}
						</div>
					) : (
						<div className='space-y-1'>
							{participants.map(p => (
								<div key={p.id} className='flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-[#21262d] transition-colors'>
									<img src={getAvatarUrl(p.avatar_url)} alt={p.username}
										className='w-8 h-8 rounded-full object-cover bg-[#0e1117] ring-1 ring-[#30363d]' />
									<div className='flex-1 min-w-0'>
										<div className='text-sm text-[#e6edf3] font-medium truncate'>{p.username}</div>
									</div>
									{p.id === userId && <span className='text-[10px] text-[#8b949e] bg-[#21262d] px-1.5 py-0.5 rounded'>Вы</span>}
									{p.role === 'admin' && <Crown className='w-3.5 h-3.5 text-amber-400' />}
									{p.role === 'moderator' && <Shield className='w-3.5 h-3.5 text-[#0077FF]' />}
								</div>
							))}
						</div>
					)}
				</div>
			</div>

			{onOpenSettings && (
				<div className='p-3 border-t border-[#30363d] bg-[#161b22]'>
					<button
						onClick={onOpenSettings}
						className='w-full rounded-xl bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-sm text-[#e6edf3] font-medium py-2.5 transition-colors'
					>
						Настройки группы
					</button>
				</div>
			)}
		</div>
	)
}
