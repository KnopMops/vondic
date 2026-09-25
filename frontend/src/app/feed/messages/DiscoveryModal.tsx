'use client'

import { getAvatarUrl } from '@/lib/utils'
import { useState } from 'react'
import {
	LuHash as HashIcon,
	LuLogIn as LogInIcon,
	LuSearch as SearchIcon,
	LuUsers as UsersIcon,
	LuX as XIcon,
} from 'react-icons/lu'

interface DiscoveryModalProps {
	isOpen: boolean
	onClose: () => void
	searchChannels: (query: string) => Promise<any[]>
	searchCommunities: (query: string) => Promise<any[]>
	joinChannel: (inviteCode: string) => Promise<any>
	joinCommunity: (inviteCode: string) => Promise<any>
}

export default function DiscoveryModal({
	isOpen,
	onClose,
	searchChannels,
	searchCommunities,
	joinChannel,
	joinCommunity,
}: DiscoveryModalProps) {
	const [query, setQuery] = useState('')
	const [activeTab, setActiveTab] = useState<'channels' | 'communities'>(
		'communities',
	)
	const [results, setResults] = useState<any[]>([])
	const [isSearching, setIsSearching] = useState(false)
	const [joiningId, setJoiningId] = useState<string | null>(null)
	const [hasSearched, setHasSearched] = useState(false)

	const handleSearch = async () => {
		if (!query.trim()) return
		setIsSearching(true)
		setHasSearched(true)
		try {
			const data =
				activeTab === 'channels'
					? await searchChannels(query.trim())
					: await searchCommunities(query.trim())
			setResults(data)
		} catch (e) {
			console.error(e)
			setResults([])
		} finally {
			setIsSearching(false)
		}
	}

	const handleJoin = async (item: any) => {
		setJoiningId(item.id)
		try {
			if (activeTab === 'channels') {
				await joinChannel(item.invite_code)
			} else {
				await joinCommunity(item.invite_code)
			}
			setResults(prev => prev.filter(r => r.id !== item.id))
		} catch (e: any) {
			alert(e.message || 'Не удалось вступить')
		} finally {
			setJoiningId(null)
		}
	}

	if (!isOpen) return null

	return (
		<div className='fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4'>
			<div className='bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[80vh] flex flex-col'>
				<div className='flex items-center justify-between mb-4'>
					<h3 className='text-lg font-bold text-[#e6edf3]'>Поиск каналов и серверов</h3>
					<button
						onClick={onClose}
						className='p-1.5 text-[#8b949e] hover:text-white hover:bg-[#21262d] rounded-lg transition-colors'
					>
						<XIcon className='w-5 h-5' />
					</button>
				</div>

				<div className='flex gap-2 mb-4 bg-[#0e1117] p-1 rounded-xl border border-[#30363d]'>
					<button
						onClick={() => {
							setActiveTab('channels')
							setResults([])
							setHasSearched(false)
						}}
						className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
							activeTab === 'channels'
								? 'bg-[#21262d] text-white shadow-sm border border-[#30363d]'
								: 'text-[#8b949e] hover:text-[#e6edf3]'
						}`}
					>
						Каналы
					</button>
					<button
						onClick={() => {
							setActiveTab('communities')
							setResults([])
							setHasSearched(false)
						}}
						className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
							activeTab === 'communities'
								? 'bg-[#21262d] text-white shadow-sm border border-[#30363d]'
								: 'text-[#8b949e] hover:text-[#e6edf3]'
						}`}
					>
						Серверы
					</button>
				</div>

				<div className='flex gap-2 mb-4'>
					<input
						type='text'
						value={query}
						onChange={e => setQuery(e.target.value)}
						onKeyDown={e => e.key === 'Enter' && handleSearch()}
						placeholder={`Поиск ${activeTab === 'channels' ? 'каналов' : 'серверов'}...`}
						className='flex-1 bg-[#0e1117] border border-[#30363d] rounded-xl px-4 py-2.5 text-[#e6edf3] placeholder-[#8b949e] focus:outline-none focus:border-[#0077FF] text-sm'
					/>
					<button
						onClick={handleSearch}
						disabled={!query.trim() || isSearching}
						className='px-4 py-2.5 bg-[#0077FF] hover:bg-[#0066dd] text-white rounded-xl transition-colors disabled:opacity-50 shadow-md shadow-[#0077FF]/20 flex items-center justify-center'
					>
						<SearchIcon className='w-4 h-4' />
					</button>
				</div>

				<div className='overflow-y-auto flex-1 space-y-2 min-h-0 custom-scrollbar'>
					{isSearching ? (
						<div className='text-center text-[#8b949e] py-8 text-sm'>Поиск...</div>
					) : hasSearched && results.length === 0 ? (
						<div className='text-center text-[#8b949e] py-8 text-sm'>
							Ничего не найдено
						</div>
					) : (
						results.map(item => (
							<div
								key={item.id}
								className='flex items-center gap-3 p-3 rounded-xl bg-[#0e1117] border border-[#30363d] hover:border-[#0077FF]/40 transition-colors'
							>
								<div className='w-10 h-10 rounded-full bg-[#161b22] border border-[#30363d] flex items-center justify-center flex-shrink-0'>
									{item.avatar_url ? (
										<img
											src={getAvatarUrl(item.avatar_url)}
											alt={item.name}
											className='w-10 h-10 rounded-full object-cover'
										/>
									) : activeTab === 'channels' ? (
										<HashIcon className='w-5 h-5 text-[#8b949e]' />
									) : (
										<UsersIcon className='w-5 h-5 text-[#8b949e]' />
									)}
								</div>
								<div className='flex-1 min-w-0'>
									<div className='font-medium text-sm text-[#e6edf3] truncate'>
										{item.name}
									</div>
									{item.description && (
										<div className='text-xs text-[#8b949e] truncate'>
											{item.description}
										</div>
									)}
									<div className='text-xs text-[#8b949e]/80'>
										{item.participants_count || 0} участников
									</div>
								</div>
								<button
									onClick={() => handleJoin(item)}
									disabled={joiningId === item.id}
									className='px-3.5 py-1.5 bg-[#0077FF] hover:bg-[#0066dd] text-white text-xs font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm shadow-[#0077FF]/20'
								>
									<LogInIcon className='w-3 h-3' />
									{joiningId === item.id ? 'Вступаем...' : 'Вступить'}
								</button>
							</div>
						))
					)}
				</div>
			</div>
		</div>
	)
}
