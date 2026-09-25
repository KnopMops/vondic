'use client'

import Header from '@/components/social/Header'
import { useAuth } from '@/lib/AuthContext'
import Link from 'next/link'
import { useEffect, useState } from 'react'

function generateUUID(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID()
	}
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0
		const v = c === 'x' ? r : (r & 0x3) | 0x8
		return v.toString(16)
	})
}

type Playlist = { id: string; name: string; videos: string[] }

function loadPlaylists(): Playlist[] {
	try {
		const raw = localStorage.getItem('vondic_playlists') || '[]'
		const arr = JSON.parse(raw)
		return Array.isArray(arr) ? arr : []
	} catch {
		return []
	}
}
function savePlaylists(items: Playlist[]) {
	localStorage.setItem('vondic_playlists', JSON.stringify(items))
}

export default function PlaylistsPage() {
	const { user, logout } = useAuth()
	const [playlists, setPlaylists] = useState<Playlist[]>([])
	const [name, setName] = useState('')
	useEffect(() => {
		setPlaylists(loadPlaylists())
	}, [])

	const create = () => {
		const n = name.trim()
		if (!n) return
		const p: Playlist = { id: generateUUID(), name: n, videos: [] }
		const next = [p, ...playlists]
		setPlaylists(next)
		savePlaylists(next)
		setName('')
	}
	const remove = (id: string) => {
		const next = playlists.filter(p => p.id !== id)
		setPlaylists(next)
		savePlaylists(next)
	}

	return (
		<div className='min-h-screen bg-[#0e1117] text-[#e6edf3] selection:bg-[#0077FF] selection:text-white overflow-x-hidden relative font-sans'>
			<div className='fixed inset-0 z-0 overflow-hidden pointer-events-none'>
				<div className='absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-[#0077FF]/10 blur-[140px] rounded-full' />
			</div>
			<div className='relative z-20'>
				<Header email={user?.email || ''} onLogout={logout} />
			</div>
			<div className='relative z-10 mx-auto flex max-w-7xl pt-6'>
				<main className='flex-1 px-4 sm:px-6 lg:px-8 pb-20'>
					<div className='mb-4'>
						<Link
							href='/video'
							className='inline-flex items-center rounded-xl border border-[#30363d] bg-[#161b22] px-3.5 py-1.5 text-xs text-[#e6edf3] hover:bg-[#21262d] transition-colors'
						>
							← Назад к видео
						</Link>
					</div>
					<div className='flex gap-2 mb-4'>
						<input
							value={name}
							onChange={e => setName(e.target.value)}
							placeholder='Название плейлиста'
							className='h-9 rounded-lg border border-gray-800 bg-[#0f0f0f] px-3 text-xs text-gray-200 outline-none flex-1'
						/>
						<button
							onClick={create}
							className='h-9 rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-700'
						>
							Создать
						</button>
					</div>
					<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
						{playlists.map(p => (
							<div
								key={p.id}
								className='rounded-2xl border border-gray-800/60 bg-gray-900/30 p-3'
							>
								<div className='flex items-center justify-between'>
									<div className='text-sm font-semibold'>{p.name}</div>
									<button
										onClick={() => remove(p.id)}
										className='text-[11px] text-gray-400 hover:text-red-400'
									>
										Удалить
									</button>
								</div>
								<div className='text-[11px] text-gray-500 mt-1'>
									{p.videos.length} видео
								</div>
							</div>
						))}
					</div>
					<div className='text-[11px] text-gray-500 mt-6'>
						Добавление видео в плейлист доступно со страницы просмотра.
					</div>
				</main>
			</div>
		</div>
	)
}
