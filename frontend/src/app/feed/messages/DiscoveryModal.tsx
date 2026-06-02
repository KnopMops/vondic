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
	const [activeTab, setActiveTab] = useState<'channels' | 'communities'>('channels')
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
		<div className='fixed inset-0 bg-black/50 backdrop-blur-sm z-[99999] flex items-center justify-center p-4'>
			<div className='bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200 max-h-[80vh] flex flex-col'>
				<div className='flex items-center justify-between mb-4'>
					<h3 className='text-xl font-bold text-white'>Поиск</h3>
					<button
						onClick={onClose}
						className='p-1 text-gray-400 hover:text-white transition-colors'
					>
						<XIcon className='w-5 h-5' />
					</button>
				</div>

				<div className='flex gap-2 mb-4'>
					<button
						onClick={() => {
							setActiveTab('channels')
							setResults([])
							setHasSearched(false)
						}}
						className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
							activeTab === 'channels'
								? 'bg-blue-600 text-white'
								: 'bg-gray-800 text-gray-400 hover:text-white'
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
						className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
							activeTab === 'communities'
								? 'bg-blue-600 text-white'
								: 'bg-gray-800 text-gray-400 hover:text-white'
						}`}
					>
						Сообщества
					</button>
				</div>

				<div className='flex gap-2 mb-4'>
					<input
						type='text'
						value={query}
						onChange={e => setQuery(e.target.value)}
						onKeyDown={e => e.key === 'Enter' && handleSearch()}
						placeholder={`Поиск ${activeTab === 'channels' ? 'каналов' : 'сообществ'}...`}
						className='flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50'
					/>
					<button
						onClick={handleSearch}
						disabled={!query.trim() || isSearching}
						className='px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors disabled:opacity-50'
					>
						<SearchIcon className='w-4 h-4' />
					</button>
				</div>

				<div className='overflow-y-auto flex-1 space-y-2 min-h-0'>
					{isSearching ? (
						<div className='text-center text-gray-500 py-8'>Поиск...</div>
					) : hasSearched && results.length === 0 ? (
						<div className='text-center text-gray-500 py-8'>
							Ничего не найдено
						</div>
					) : (
						results.map(item => (
							<div
								key={item.id}
								className='flex items-center gap-3 p-3 rounded-xl bg-gray-800/50 border border-gray-800'
							>
								<div className='w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0'>
									{item.avatar_url ? (
										<img
											src={getAvatarUrl(item.avatar_url)}
											alt={item.name}
											className='w-10 h-10 rounded-full object-cover'
										/>
									) : activeTab === 'channels' ? (
										<HashIcon className='w-5 h-5 text-gray-400' />
									) : (
										<UsersIcon className='w-5 h-5 text-gray-400' />
									)}
								</div>
								<div className='flex-1 min-w-0'>
									<div className='font-medium text-gray-200 truncate'>
										{item.name}
									</div>
									{item.description && (
										<div className='text-xs text-gray-500 truncate'>
											{item.description}
										</div>
									)}
									<div className='text-xs text-gray-500'>
										{item.participants_count || 0} участников
									</div>
								</div>
								<button
									onClick={() => handleJoin(item)}
									disabled={joiningId === item.id}
									className='px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1'
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
