'use client'

import { useCallback, useEffect, useState } from 'react'
import { PollData, getPoll, votePoll, unvotePoll } from '@/lib/api/polls'
import { getAvatarUrl } from '@/lib/utils'
import { LuChartBar as BarChart } from 'react-icons/lu'

interface PollCardProps {
	pollId: string
	currentUserId?: string
}

function VoterAvatars({ userIds }: { userIds: string[] }) {
	if (userIds.length === 0) return null
	if (userIds.length <= 4) {
		return (
			<div className='flex -space-x-1.5'>
				{userIds.slice(0, 4).map(uid => (
					<img
						key={uid}
						src={getAvatarUrl('')}
						alt=''
						className='w-5 h-5 rounded-full border border-gray-800 object-cover'
						onError={(e) => { (e.target as HTMLImageElement).src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" rx="10" fill="%236366f1"/><text x="10" y="14" text-anchor="middle" fill="white" font-size="10">${uid[0]?.toUpperCase()}</text></svg>` }}
					/>
				))}
			</div>
		)
	}
	return (
		<span className='text-xs text-gray-400 tabular-nums'>{userIds.length}</span>
	)
}

export default function PollCard({ pollId, currentUserId }: PollCardProps) {
	const [poll, setPoll] = useState<PollData | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [myVotes, setMyVotes] = useState<Set<string>>(new Set())
	const [voting, setVoting] = useState(false)

	const fetchPoll = useCallback(async () => {
		try {
			const data = await getPoll(pollId)
			setPoll(data)
			setError(null)
		} catch {
			setError('Ошибка загрузки опроса')
		} finally {
			setLoading(false)
		}
	}, [pollId])

	useEffect(() => { fetchPoll() }, [fetchPoll])

	useEffect(() => {
		if (!poll || !currentUserId) return
		const key = `poll_votes_${poll.id}_${currentUserId}`
		try {
			const saved = localStorage.getItem(key)
			if (saved) {
				const arr = JSON.parse(saved)
				if (Array.isArray(arr)) setMyVotes(new Set(arr))
			}
		} catch {}
	}, [poll, currentUserId])

	const persistVotes = (ids: Set<string>) => {
		if (!poll || !currentUserId) return
		localStorage.setItem(`poll_votes_${poll.id}_${currentUserId}`, JSON.stringify([...ids]))
	}

	const handleVote = async (optionId: string) => {
		if (!poll || voting) return
		setVoting(true)
		try {
			const isToggle = myVotes.has(optionId)
			if (isToggle) {
				const nv = new Set(myVotes); nv.delete(optionId)
				setMyVotes(nv); persistVotes(nv)
				setPoll(await unvotePoll(poll.id))
			} else {
				const nv = poll.multiple_choice ? new Set([...myVotes, optionId]) : new Set([optionId])
				setMyVotes(nv); persistVotes(nv)
				setPoll(await votePoll(poll.id, optionId))
			}
		} catch { fetchPoll() }
		finally { setVoting(false) }
	}

	if (loading) return (
		<div className='rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4'>
			<div className='animate-pulse space-y-3'>
				<div className='h-4 bg-white/10 rounded w-3/4' />
				<div className='h-3 bg-white/5 rounded w-1/2' />
			</div>
		</div>
	)

	if (error || !poll) return (
		<div className='rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-300/80'>
			{error || 'Опрос недоступен'}
		</div>
	)

	const maxVotes = Math.max(1, ...Object.values(poll.votes))
	const voterIds: Record<string, string[]> = (poll as any).voter_ids || {}

	return (
		<div className='rounded-xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 to-purple-500/5 p-4 min-w-[260px] max-w-[380px]'>
			<div className='flex items-start gap-2 mb-3'>
				<BarChart className='w-4 h-4 text-indigo-400 mt-0.5 shrink-0' />
				<div className='text-sm font-semibold text-white leading-snug'>{poll.question}</div>
			</div>
			<div className='space-y-2'>
				{poll.options.map(option => {
					const count = poll.votes[option.id] || 0
					const pct = poll.total_votes > 0 ? (count / poll.total_votes) * 100 : 0
					const isSelected = myVotes.has(option.id)
					const isLeading = count === maxVotes && count > 0
					const optionVoters = voterIds[option.id] || []
					return (
						<button key={option.id} onClick={() => handleVote(option.id)} disabled={voting}
							className='relative w-full text-left rounded-lg overflow-hidden transition-all duration-200 group'>
							<div className={`absolute inset-0 transition-all duration-500 ease-out ${isSelected ? 'bg-gradient-to-r from-indigo-500/40 to-indigo-600/30' : 'bg-white/5 group-hover:bg-white/10'}`}
								style={{ width: `${pct}%` }} />
							<div className='relative flex items-center justify-between px-3 py-2.5'>
								<div className='flex items-center gap-2 min-w-0'>
									<div className={`w-2.5 h-2.5 rounded-full shrink-0 transition-colors ${isSelected ? 'bg-indigo-400 shadow-sm shadow-indigo-400/50' : 'bg-white/20 group-hover:bg-white/30'}`} />
									<span className={`text-sm truncate ${isSelected ? 'text-white font-medium' : 'text-gray-200'}`}>{option.text}</span>
								</div>
								<div className='flex items-center gap-1.5 shrink-0 ml-2'>
									{!poll.is_anonymous && optionVoters.length > 0 ? (
										<VoterAvatars userIds={optionVoters} />
									) : (
										<span className={`text-xs tabular-nums ${isLeading ? 'text-indigo-300 font-semibold' : 'text-gray-400'}`}>
											{count}
										</span>
									)}
									{poll.total_votes > 0 && (
										<span className='text-[10px] text-gray-500 tabular-nums'>{Math.round(pct)}%</span>
									)}
								</div>
							</div>
						</button>
					)
				})}
			</div>
			<div className='mt-3 flex items-center justify-between text-[11px] text-gray-500'>
				<span>
					{poll.total_votes}{' '}
					{poll.total_votes % 10 === 1 && poll.total_votes % 100 !== 11 ? 'голос'
						: [2, 3, 4].includes(poll.total_votes % 10) && ![12, 13, 14].includes(poll.total_votes % 100) ? 'голоса'
						: 'голосов'}
				</span>
				{poll.is_anonymous && <span>Анонимный</span>}
				{poll.multiple_choice && <span>Несколько вариантов</span>}
			</div>
		</div>
	)
}
