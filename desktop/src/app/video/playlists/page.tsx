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
		<div className='min-h-screen bg-black text-white selection:bg-indigo-500 selection:text-white overflow-x-hidden relative'>
			<div className='fixed inset-0 z-0 overflow-hidden pointer-events-none'>
				<div className='absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-indigo-900/20 blur-[120px]' />
				<div className='absolute top-[40%] -right-[10%] w-[40%] h-[60%] rounded-full bg-purple-900/20 blur-[120px]' />
				<div className='absolute bottom-[10%] left-[20%] w-[30%] h-[30%] rounded-full bg-emerald-900/10 blur-[100px]' />
			</div>
			<div className='relative z-20'>
				<Header email={user?.email || ''} onLogout={logout} />
			</div>
			<div className='relative z-10 mx-auto flex max-w-7xl pt-6'>
				<main className='flex-1 px-4 sm:px-6 lg:px-8 pb-20'>
					<div className='mb-4'>
						<Link
							href='/video'
							className='inline-flex items-center rounded-full border border-gray-800/60 bg-gray-900/40 px-3 py-1.5 text-xs text-gray-200 hover:bg-white/10'
						>
							Плейлисты
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
