'use client'

import FeedPageShell from '@/components/social/FeedPageShell'
import { useAuth } from '@/lib/AuthContext'
import { useSocialCommunities, type SocialCommunity } from '@/lib/hooks/useSocialCommunities'
import { parseInviteToken } from '@/lib/inviteLinks'
import { getAvatarUrl } from '@/lib/utils'
import Link from 'next/link'
import { useEffect, useState, useCallback } from 'react'
import { LuLink, LuPlus as Plus, LuSearch, LuUserCheck, LuUsers as Users, LuX } from 'react-icons/lu'

export default function CommunitiesPage() {
	const { user, logout } = useAuth()
	const {
		communities,
		isLoading,
		createCommunity,
		joinCommunity,
		fetchMyCommunities,
		searchCommunities,
	} = useSocialCommunities()

	const [activeTab, setActiveTab] = useState<'my' | 'search'>('my')
	const [searchQuery, setSearchQuery] = useState('')
	const [searchResults, setSearchResults] = useState<SocialCommunity[]>([])
	const [isSearching, setIsSearching] = useState(false)

	const [showCreate, setShowCreate] = useState(false)
	const [showJoinLink, setShowJoinLink] = useState(false)
	const [name, setName] = useState('')
	const [description, setDescription] = useState('')
	const [inviteCode, setInviteCode] = useState('')
	const [error, setError] = useState('')
	const [busyId, setBusyId] = useState<string | null>(null)
	const [busy, setBusy] = useState(false)

	// Live search handler
	const handleSearch = useCallback(
		async (query: string) => {
			setIsSearching(true)
			try {
				const results = await searchCommunities(query)
				setSearchResults(results)
			} catch (e) {
				console.error(e)
			} finally {
				setIsSearching(false)
			}
		},
		[searchCommunities],
	)

	// Trigger search on query change or tab change
	useEffect(() => {
		if (activeTab === 'search') {
			const timer = setTimeout(() => {
				handleSearch(searchQuery)
			}, 250)
			return () => clearTimeout(timer)
		}
	}, [searchQuery, activeTab, handleSearch])

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
			setError(err instanceof Error ? err.message : 'Ошибка при создании')
		} finally {
			setBusy(false)
		}
	}

	const handleJoinByLink = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!inviteCode.trim()) return
		setBusy(true)
		setError('')
		try {
			const token = parseInviteToken(inviteCode)
			const joined = await joinCommunity(token)
			setShowJoinLink(false)
			setInviteCode('')
			window.location.href = `/feed/communities/${joined.id}`
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : 'Не удалось вступить по ссылке')
		} finally {
			setBusy(false)
		}
	}

	const handleDirectJoin = async (communityId: string) => {
		setBusyId(communityId)
		setError('')
		try {
			const joined = await joinCommunity(communityId)
			window.location.href = `/feed/communities/${joined.id}`
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : 'Ошибка вступления')
		} finally {
			setBusyId(null)
		}
	}

	const filteredMyCommunities = communities.filter(c => {
		if (!searchQuery.trim() || activeTab === 'search') return true
		const q = searchQuery.toLowerCase().trim()
		return (
			c.name.toLowerCase().includes(q) ||
			(c.description && c.description.toLowerCase().includes(q))
		)
	})

	return (
		<FeedPageShell email={user?.email} onLogout={logout}>
			<main className='flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full'>
				{/* Page Header */}
				<div className='mb-6 flex flex-wrap items-center justify-between gap-4'>
					<div>
						<h1 className='text-2xl font-bold text-[var(--app-fg)]'>Сообщества</h1>
						<p className='text-sm text-[var(--app-muted)]'>
							Найдите интересующие группы или создайте собственное сообщество
						</p>
					</div>
					<div className='flex gap-2'>
						<button
							type='button'
							onClick={() => {
								setShowJoinLink(v => !v)
								setShowCreate(false)
							}}
							className='flex items-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-2.5 text-sm font-medium text-[var(--app-fg)] hover:bg-white/5 transition-all shadow-sm'
						>
							<LuLink className='h-4 w-4 text-[var(--app-accent)]' />
							По ссылке
						</button>
						<button
							type='button'
							onClick={() => {
								setShowCreate(v => !v)
								setShowJoinLink(false)
							}}
							className='flex items-center gap-2 rounded-xl bg-[var(--app-accent)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-all shadow-md'
						>
							<Plus className='h-4 w-4' />
							Создать
						</button>
					</div>
				</div>

				{error && (
					<div className='mb-4 flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300'>
						<span>{error}</span>
						<button type='button' onClick={() => setError('')} className='hover:text-white'>
							<LuX className='h-4 w-4' />
						</button>
					</div>
				)}

				{/* Invite Link Form Modal / Dropdown */}
				{showJoinLink && (
					<form
						onSubmit={handleJoinByLink}
						className='mb-6 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-xl animate-in fade-in'
					>
						<div className='mb-3 flex justify-between items-center'>
							<h3 className='font-semibold text-sm text-[var(--app-fg)]'>Вход по ссылке-приглашению</h3>
							<button type='button' onClick={() => setShowJoinLink(false)} className='text-[var(--app-muted)] hover:text-white'>
								<LuX className='h-4 w-4' />
							</button>
						</div>
						<div className='flex gap-2'>
							<input
								value={inviteCode}
								onChange={e => setInviteCode(e.target.value)}
								placeholder='Вставьте ссылку или код приглашения (https://vondic.ru/feed/communities/join/...)'
								className='flex-1 rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-4 py-2.5 text-sm text-[var(--app-fg)] focus:outline-none focus:border-[var(--app-accent)]'
							/>
							<button
								type='submit'
								disabled={busy || !inviteCode.trim()}
								className='rounded-xl bg-[var(--app-accent)] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 hover:opacity-90 transition-all'
							>
								{busy ? 'Вступление…' : 'Вступить'}
							</button>
						</div>
					</form>
				)}

				{/* Create Community Form */}
				{showCreate && (
					<form
						onSubmit={handleCreate}
						className='mb-6 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-xl animate-in fade-in space-y-4'
					>
						<div className='flex justify-between items-center'>
							<h3 className='font-semibold text-sm text-[var(--app-fg)]'>Новое сообщество</h3>
							<button type='button' onClick={() => setShowCreate(false)} className='text-[var(--app-muted)] hover:text-white'>
								<LuX className='h-4 w-4' />
							</button>
						</div>
						<input
							value={name}
							onChange={e => setName(e.target.value)}
							placeholder='Название сообщества'
							className='w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-4 py-2.5 text-sm text-[var(--app-fg)] focus:outline-none focus:border-[var(--app-accent)]'
						/>
						<textarea
							value={description}
							onChange={e => setDescription(e.target.value)}
							placeholder='Описание (о чем ваше сообщество)'
							rows={3}
							className='w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-4 py-2.5 text-sm text-[var(--app-fg)] focus:outline-none focus:border-[var(--app-accent)]'
						/>
						<div className='flex justify-end gap-2'>
							<button
								type='button'
								onClick={() => setShowCreate(false)}
								className='rounded-xl border border-[var(--app-border)] px-4 py-2 text-sm text-[var(--app-muted)] hover:text-white'
							>
								Отмена
							</button>
							<button
								type='submit'
								disabled={busy || !name.trim()}
								className='rounded-xl bg-[var(--app-accent)] px-5 py-2 text-sm font-medium text-white disabled:opacity-50 hover:opacity-90'
							>
								{busy ? 'Создание…' : 'Создать'}
							</button>
						</div>
					</form>
				)}

				{/* Search & Navigation Bar */}
				<div className='mb-6 flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center'>
					{/* Tabs */}
					<div className='flex rounded-xl bg-[var(--app-surface)] border border-[var(--app-border)] p-1 self-start'>
						<button
							type='button'
							onClick={() => setActiveTab('my')}
							className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
								activeTab === 'my'
									? 'bg-[var(--app-accent)] text-white shadow-sm'
									: 'text-[var(--app-muted)] hover:text-[var(--app-fg)]'
							}`}
						>
							Мои сообщества ({communities.length})
						</button>
						<button
							type='button'
							onClick={() => {
								setActiveTab('search')
								handleSearch(searchQuery)
							}}
							className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
								activeTab === 'search'
									? 'bg-[var(--app-accent)] text-white shadow-sm'
									: 'text-[var(--app-muted)] hover:text-[var(--app-fg)]'
							}`}
						>
							Поиск сообществ
						</button>
					</div>

					{/* Search Input Box */}
					<div className='relative flex-1 max-w-md'>
						<LuSearch className='absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--app-muted)]' />
						<input
							type='text'
							value={searchQuery}
							onChange={e => setSearchQuery(e.target.value)}
							onFocus={() => {
								if (activeTab !== 'search' && searchQuery.trim()) {
									setActiveTab('search')
								}
							}}
							placeholder='Поиск сообщества по названию или описанию...'
							className='w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] pl-10 pr-9 py-2.5 text-sm text-[var(--app-fg)] placeholder-[var(--app-muted)] focus:outline-none focus:border-[var(--app-accent)] transition-all'
						/>
						{searchQuery && (
							<button
								type='button'
								onClick={() => setSearchQuery('')}
								className='absolute right-3 top-1/2 -translate-y-1/2 text-[var(--app-muted)] hover:text-white'
							>
								<LuX className='h-4 w-4' />
							</button>
						)}
					</div>
				</div>

				{/* Content List */}
				{activeTab === 'my' ? (
					isLoading ? (
						<div className='p-12 text-center text-[var(--app-muted)]'>Загрузка сообществ…</div>
					) : filteredMyCommunities.length === 0 ? (
						<div className='rounded-2xl border border-dashed border-[var(--app-border)] bg-[var(--app-surface)]/40 p-12 text-center text-[var(--app-muted)]'>
							<Users className='mx-auto mb-3 h-12 w-12 opacity-40 text-[var(--app-accent)]' />
							<p className='text-base font-medium text-[var(--app-fg)] mb-1'>
								{searchQuery ? 'Ничего не найдено в ваших сообществах' : 'Вы ещё не состоите ни в одном сообществе'}
							</p>
							<p className='text-xs text-[var(--app-muted)] mb-4'>
								{searchQuery
									? 'Попробуйте переключиться на вкладку «Поиск сообществ»'
									: 'Найдите интересные группы через поиск или создайте свое'}
							</p>
							<div className='flex justify-center gap-3'>
								<button
									type='button'
									onClick={() => {
										setActiveTab('search')
										handleSearch(searchQuery)
									}}
									className='rounded-xl bg-[var(--app-accent)] px-4 py-2 text-sm text-white font-medium hover:opacity-90'
								>
									Перейти в каталог
								</button>
							</div>
						</div>
					) : (
						<div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
							{filteredMyCommunities.map(c => (
								<Link
									key={c.id}
									href={`/feed/communities/${c.id}`}
									className='group relative flex items-center gap-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 hover:border-[var(--app-accent)]/50 hover:bg-[var(--app-surface)]/90 transition-all shadow-sm'
								>
									{c.avatar_url ? (
										<img
											src={getAvatarUrl(c.avatar_url)}
											alt=''
											className='h-14 w-14 rounded-2xl object-cover ring-1 ring-white/10'
										/>
									) : (
										<div className='flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--app-accent)]/20 text-xl font-bold text-[var(--app-accent)] ring-1 ring-[var(--app-accent)]/30'>
											{c.name.charAt(0).toUpperCase()}
										</div>
									)}
									<div className='min-w-0 flex-1'>
										<div className='truncate font-semibold text-[var(--app-fg)] group-hover:text-[var(--app-accent)] transition-colors'>
											{c.name}
										</div>
										{c.description && (
											<div className='truncate text-xs text-[var(--app-muted)] mt-0.5'>
												{c.description}
											</div>
										)}
										<div className='mt-2 flex items-center gap-2 text-xs text-[var(--app-muted)]'>
											<Users className='h-3.5 w-3.5 text-[var(--app-accent)]' />
											<span>{c.members_count ?? 1} участников</span>
										</div>
									</div>
								</Link>
							))}
						</div>
					)
				) : (
					/* SEARCH TAB */
					isSearching ? (
						<div className='p-12 text-center text-[var(--app-muted)]'>Поиск доступных сообществ…</div>
					) : searchResults.length === 0 ? (
						<div className='rounded-2xl border border-dashed border-[var(--app-border)] bg-[var(--app-surface)]/40 p-12 text-center text-[var(--app-muted)]'>
							<LuSearch className='mx-auto mb-3 h-12 w-12 opacity-40 text-[var(--app-accent)]' />
							<p className='text-base font-medium text-[var(--app-fg)] mb-1'>
								Сообществ не найдено
							</p>
							<p className='text-xs text-[var(--app-muted)]'>
								Попробуйте изменить поисковый запрос по названию или описанию
							</p>
						</div>
					) : (
						<div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
							{searchResults.map(c => (
								<div
									key={c.id}
									className='group flex flex-col justify-between rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 hover:border-[var(--app-accent)]/50 transition-all shadow-sm'
								>
									<Link href={`/feed/communities/${c.id}`} className='flex items-start gap-4 mb-3'>
										{c.avatar_url ? (
											<img
												src={getAvatarUrl(c.avatar_url)}
												alt=''
												className='h-14 w-14 rounded-2xl object-cover ring-1 ring-white/10'
											/>
										) : (
											<div className='flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--app-accent)]/20 text-xl font-bold text-[var(--app-accent)] ring-1 ring-[var(--app-accent)]/30'>
												{c.name.charAt(0).toUpperCase()}
											</div>
										)}
										<div className='min-w-0 flex-1'>
											<div className='truncate font-semibold text-[var(--app-fg)] group-hover:text-[var(--app-accent)] transition-colors'>
												{c.name}
											</div>
											{c.description && (
												<div className='line-clamp-2 text-xs text-[var(--app-muted)] mt-1'>
													{c.description}
												</div>
											)}
										</div>
									</Link>

									<div className='flex items-center justify-between pt-3 border-t border-[var(--app-border)]/50 mt-auto'>
										<span className='text-xs text-[var(--app-muted)] flex items-center gap-1.5'>
											<Users className='h-3.5 w-3.5 text-[var(--app-accent)]' />
											{c.members_count ?? 1} участников
										</span>

										<button
											type='button'
											disabled={busyId === c.id}
											onClick={() => handleDirectJoin(c.id)}
											className='flex items-center gap-1.5 rounded-xl bg-[var(--app-accent)] px-3.5 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 transition-all shadow-sm'
										>
											{busyId === c.id ? (
												'Вступление…'
											) : (
												<>
													<LuUserCheck className='h-3.5 w-3.5' />
													Вступить
												</>
											)}
										</button>
									</div>
								</div>
							))}
						</div>
					)
				)}
			</main>
		</FeedPageShell>
	)
}
