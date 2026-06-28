'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { FiDownload, FiPlay, FiSearch, FiX } from 'react-icons/fi'

export type BotGameItem = {
	id: string
	bot_id: string
	title: string
	description?: string | null
	scan_status?: string
	is_published?: boolean
	download_url?: string
}

type Props = {
	isOpen: boolean
	botId: string
	botName?: string
	onClose: () => void
	onPlay: (game: BotGameItem) => void
}

export default function BotGamesPlayModal({
	isOpen,
	botId,
	botName,
	onClose,
	onPlay,
}: Props) {
	const [games, setGames] = useState<BotGameItem[]>([])
	const [search, setSearch] = useState('')
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const load = useCallback(async () => {
		if (!botId) return
		setLoading(true)
		setError(null)
		try {
			const q = search.trim()
			const url = q
				? `/api/v1/bots/${botId}/games?q=${encodeURIComponent(q)}`
				: `/api/v1/bots/${botId}/games`
			const res = await fetch(url, { credentials: 'include' })
			const data = await res.json().catch(() => ({}))
			if (!res.ok) {
				throw new Error(data.error || 'Не удалось загрузить игры')
			}
			setGames(Array.isArray(data.games) ? data.games : [])
		} catch (e: unknown) {
			setError(e instanceof Error ? e.message : 'Ошибка')
			setGames([])
		} finally {
			setLoading(false)
		}
	}, [botId, search])

	useEffect(() => {
		if (!isOpen) return
		const t = setTimeout(load, search ? 350 : 0)
		return () => clearTimeout(t)
	}, [isOpen, load, search])

	const filtered = useMemo(() => {
		if (!search.trim()) return games
		const q = search.toLowerCase()
		return games.filter(
			g =>
				g.title?.toLowerCase().includes(q) ||
				g.description?.toLowerCase().includes(q),
		)
	}, [games, search])

	return (
		<AnimatePresence>
			{isOpen && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					className='fixed inset-0 z-[100001] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4'
					onClick={onClose}
				>
					<motion.div
						initial={{ opacity: 0, scale: 0.96, y: 10 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.96, y: 10 }}
						className='w-full max-w-lg rounded-2xl border border-white/10 bg-gradient-to-br from-[#0b1220] to-[#151030] shadow-2xl overflow-hidden'
						onClick={e => e.stopPropagation()}
					>
						<div className='flex items-center justify-between p-5 border-b border-white/10'>
							<div>
								<h2 className='text-lg font-semibold text-white'>Игры</h2>
								{botName && (
									<p className='text-xs text-gray-400 mt-0.5'>{botName}</p>
								)}
							</div>
							<button
								type='button'
								onClick={onClose}
								className='p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10'
							>
								<FiX />
							</button>
						</div>

						<div className='p-4 border-b border-white/10'>
							<div className='relative'>
								<FiSearch className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4' />
								<input
									value={search}
									onChange={e => setSearch(e.target.value)}
									placeholder='Поиск игр…'
									className='w-full rounded-xl bg-black/40 border border-white/10 pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-indigo-500 outline-none'
								/>
							</div>
						</div>

						<div className='max-h-[50vh] overflow-y-auto p-3 space-y-2'>
							{loading && (
								<p className='text-center text-sm text-gray-400 py-8'>
									Загрузка…
								</p>
							)}
							{error && (
								<p className='text-center text-sm text-red-400 py-4'>
									{error}
								</p>
							)}
							{!loading && !error && filtered.length === 0 && (
								<p className='text-center text-sm text-gray-500 py-8'>
									Пока нет опубликованных игр
								</p>
							)}
							{filtered.map(game => (
								<div
									key={game.id}
									className='rounded-xl border border-white/10 bg-white/5 p-3 flex items-center gap-3'
								>
									<div className='flex-1 min-w-0'>
										<p className='font-medium text-white truncate'>
											{game.title}
										</p>
										{game.description && (
											<p className='text-xs text-gray-400 truncate mt-0.5'>
												{game.description}
											</p>
										)}
									</div>
									<div className='flex gap-1 shrink-0'>
										<button
											type='button'
											onClick={() => onPlay(game)}
											className='rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-2 text-xs font-medium text-white flex items-center gap-1'
										>
											<FiPlay className='w-3.5 h-3.5' />
											Играть
										</button>
										<a
											href={`/api/v1/bots/${botId}/games/${game.id}/download`}
											className='rounded-lg border border-white/15 hover:bg-white/10 px-3 py-2 text-xs text-gray-200 flex items-center gap-1'
										>
											<FiDownload className='w-3.5 h-3.5' />
										</a>
									</div>
								</div>
							))}
						</div>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	)
}
