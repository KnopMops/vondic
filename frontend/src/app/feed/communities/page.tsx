'use client'

import FeedPageShell from '@/components/social/FeedPageShell'
import { useAuth } from '@/lib/AuthContext'
import { useSocialCommunities } from '@/lib/hooks/useSocialCommunities'
import { getAvatarUrl } from '@/lib/utils'
import Link from 'next/link'
import { parseInviteToken } from '@/lib/inviteLinks'
import { useState } from 'react'
import { LuPlus as Plus, LuUsers as Users } from 'react-icons/lu'

export default function CommunitiesPage() {
	const { user, logout } = useAuth()
	const { communities, isLoading, createCommunity, joinCommunity, fetchMyCommunities } =
		useSocialCommunities()
	const [showCreate, setShowCreate] = useState(false)
	const [showJoin, setShowJoin] = useState(false)
	const [name, setName] = useState('')
	const [description, setDescription] = useState('')
	const [inviteCode, setInviteCode] = useState('')
	const [error, setError] = useState('')
	const [busy, setBusy] = useState(false)

	const handleCreate = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!name.trim()) return
		setBusy(true)
		setError('')
		try {
			const created = await createCommunity(name.trim(), description.trim() || undefined)
			setShowCreate(false)
			setName('')
			setDescription('')
			window.location.href = `/feed/communities/${created.id}`
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : 'Ошибка')
		} finally {
			setBusy(false)
		}
	}

	const handleJoin = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!inviteCode.trim()) return
		setBusy(true)
		setError('')
		try {
			const joined = await joinCommunity(parseInviteToken(inviteCode))
			setShowJoin(false)
			setInviteCode('')
			window.location.href = `/feed/communities/${joined.id}`
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : 'Ошибка')
		} finally {
			setBusy(false)
		}
	}

	return (
		<FeedPageShell email={user?.email} onLogout={logout}>
				<main className='flex-1 p-4 sm:p-6 lg:p-8'>
					<div className='mb-6 flex flex-wrap items-center justify-between gap-4'>
						<div>
							<h1 className='text-2xl font-bold'>Сообщества</h1>
							<p className='text-sm text-gray-400'>
								Публичные страницы с лентой записей, как во ВКонтакте
							</p>
						</div>
						<div className='flex gap-2'>
							<button
								type='button'
								onClick={() => {
									setShowJoin(v => !v)
									setShowCreate(false)
								}}
								className='rounded-xl border border-gray-700 px-4 py-2 text-sm hover:bg-white/5'
							>
								Вступить
							</button>
							<button
								type='button'
								onClick={() => {
									setShowCreate(v => !v)
									setShowJoin(false)
								}}
								className='flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500'
							>
								<Plus className='h-4 w-4' />
								Создать
							</button>
						</div>
					</div>

					{error && (
						<p className='mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300'>
							{error}
						</p>
					)}

					{showCreate && (
						<form
							onSubmit={handleCreate}
							className='mb-6 rounded-xl border border-gray-800 bg-gray-900/50 p-4'
						>
							<input
								value={name}
								onChange={e => setName(e.target.value)}
								placeholder='Название сообщества'
								className='mb-3 w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-2'
							/>
							<textarea
								value={description}
								onChange={e => setDescription(e.target.value)}
								placeholder='Описание'
								rows={3}
								className='mb-3 w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-2'
							/>
							<button
								type='submit'
								disabled={busy}
								className='rounded-lg bg-indigo-600 px-4 py-2 text-sm disabled:opacity-50'
							>
								{busy ? 'Создание…' : 'Создать сообщество'}
							</button>
						</form>
					)}

					{showJoin && (
						<form
							onSubmit={handleJoin}
							className='mb-6 rounded-xl border border-gray-800 bg-gray-900/50 p-4'
						>
							<label className='mb-1 block text-sm text-gray-400'>
								Ссылка-приглашение
							</label>
							<input
								value={inviteCode}
								onChange={e => setInviteCode(e.target.value)}
								placeholder='https://…/feed/communities/join/…'
								className='mb-3 w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-2'
							/>
							<p className='mb-3 text-xs text-gray-500'>
								Можно вставить полную ссылку или путь /feed/communities/join/…
							</p>
							<button
								type='submit'
								disabled={busy}
								className='rounded-lg bg-indigo-600 px-4 py-2 text-sm disabled:opacity-50'
							>
								{busy ? 'Вступление…' : 'Вступить'}
							</button>
						</form>
					)}

					{isLoading ? (
						<p className='text-gray-400'>Загрузка…</p>
					) : communities.length === 0 ? (
						<div className='rounded-xl border border-dashed border-gray-700 p-12 text-center text-gray-500'>
							<Users className='mx-auto mb-3 h-10 w-10 opacity-50' />
							<p>Вы ещё не состоите ни в одном сообществе</p>
							<button
								type='button'
								onClick={() => fetchMyCommunities()}
								className='mt-3 text-sm text-indigo-400 hover:text-indigo-300'
							>
								Обновить
							</button>
						</div>
					) : (
						<div className='grid gap-3 sm:grid-cols-2'>
							{communities.map(c => (
								<Link
									key={c.id}
									href={`/feed/communities/${c.id}`}
									className='flex items-center gap-4 rounded-xl border border-gray-800 bg-gray-900/40 p-4 hover:border-indigo-500/40 hover:bg-gray-900/70'
								>
									{c.avatar_url ? (
										<img
											src={getAvatarUrl(c.avatar_url)}
											alt=''
											className='h-14 w-14 rounded-full object-cover'
										/>
									) : (
										<div className='flex h-14 w-14 items-center justify-center rounded-full bg-indigo-900/50 text-xl font-bold text-indigo-200'>
											{c.name.charAt(0).toUpperCase()}
										</div>
									)}
									<div className='min-w-0'>
										<div className='truncate font-semibold'>{c.name}</div>
										{c.description && (
											<div className='truncate text-sm text-gray-400'>
												{c.description}
											</div>
										)}
										{c.members_count != null && (
											<div className='text-xs text-gray-500'>
												{c.members_count} подписчиков
											</div>
										)}
									</div>
								</Link>
							))}
						</div>
					)}
				</main>
		</FeedPageShell>
	)
}
