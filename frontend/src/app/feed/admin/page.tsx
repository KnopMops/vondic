'use client'

import Header from '@/components/social/Header'
import Sidebar from '@/components/social/Sidebar'
import { useAuth } from '@/lib/AuthContext'
import { useEffect, useRef, useState } from 'react'

type Escalation = {
	id: number
	user_id: string
	question: string
	created_at: number
}

export default function AdminSupportPage() {
	const { user } = useAuth()
	const [items, setItems] = useState<Escalation[]>([])
	const [chatOpen, setChatOpen] = useState(false)
	const [selectedId, setSelectedId] = useState<number | null>(null)
	const [chatMessages, setChatMessages] = useState<
		{ id: number; sender: string; content: string; created_at: number }[]
	>([])
	const [chatInput, setChatInput] = useState('')
	const [pollTimer, setPollTimer] = useState<NodeJS.Timeout | null>(null)
	const lastMsgIdRef = useRef(0)
	const BACKEND_URL =
		process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:5050'

	const renderInline = (text: string, keyPrefix: string) => {
		const parts = text.split('`')
		return parts.map((part, index) =>
			index % 2 === 1 ? (
				<code
					key={`${keyPrefix}-code-${index}`}
					className='rounded bg-black/30 px-1 text-[0.9em] font-mono text-emerald-200'
				>
					{part}
				</code>
			) : (
				<span key={`${keyPrefix}-text-${index}`}>{part}</span>
			),
		)
	}

	const renderTextBlock = (text: string, keyPrefix: string) => {
		const lines = text.split('\n')
		return (
			<div key={keyPrefix} className='break-words leading-relaxed'>
				{lines.map((line, index) => (
					<span key={`${keyPrefix}-line-${index}`}>
						{renderInline(line, `${keyPrefix}-inline-${index}`)}
						{index < lines.length - 1 ? <br /> : null}
					</span>
				))}
			</div>
		)
	}

	const renderFormattedContent = (content: string) => {
		const blocks = content.split('```')
		return blocks.map((block, index) => {
			if (index % 2 === 1) {
				const firstNewline = block.indexOf('\n')
				const firstLine =
					firstNewline === -1
						? block.trim()
						: block.slice(0, firstNewline).trim()
				const hasLang =
					firstLine.length > 0 &&
					!firstLine.includes(' ') &&
					firstNewline !== -1
				const language = hasLang ? firstLine : ''
				const code = hasLang ? block.slice(firstNewline + 1) : block
				const codeText = code.replace(/\n$/, '')
				return (
					<div
						key={`code-${index}`}
						className='my-2 overflow-hidden rounded-lg border border-white/10 bg-black/30'
					>
						{language ? (
							<div className='border-b border-white/10 bg-black/40 px-3 py-1 text-[10px] uppercase tracking-wider text-gray-400'>
								{language}
							</div>
						) : null}
						<pre className='overflow-x-auto p-3 text-xs md:text-sm'>
							<code className='font-mono text-emerald-200'>{codeText}</code>
						</pre>
					</div>
				)
			}
			return block.trim() ? renderTextBlock(block, `text-${index}`) : null
		})
	}

	const loadEscalations = async () => {
		try {
			const res = await fetch(`/api/support/admin/escalations`)
			const text = await res.text()
			let data: any = {}
			try {
				data = JSON.parse(text)
			} catch {
				console.error(
					'Invalid JSON from backend /support/admin/escalations:',
					text,
				)
				return
			}
			if (data?.ok && Array.isArray(data.escalations)) {
				setItems(data.escalations)
			}
		} catch (e) {
			console.error('Admin escalations load error', e)
		}
	}

	const openChat = async (escId: number) => {
		setSelectedId(escId)
		setChatOpen(true)
		try {
			const res = await fetch('/api/support/admin/escalations/messages', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ escId }),
			})
			const text = await res.text()
			let data: any = {}
			try {
				data = JSON.parse(text)
			} catch {
				console.error('Invalid JSON from backend /messages:', text)
				return
			}
			if (data?.ok && Array.isArray(data.messages)) {
				// Ensure unique messages by id
				const uniqueById = new Map<
					number,
					{ id: number; sender: string; content: string; created_at: number }
				>()
				for (const m of data.messages) {
					uniqueById.set(m.id, m)
				}
				const msgs = Array.from(uniqueById.values()).sort((a, b) => {
					if (a.sender === 'admin' && b.sender !== 'admin') return -1
					if (a.sender !== 'admin' && b.sender === 'admin') return 1
					if (b.created_at !== a.created_at) return b.created_at - a.created_at
					return b.id - a.id
				})
				setChatMessages(msgs)
				const lastServerId = msgs.length
					? Math.max(...msgs.filter(m => m.id > 0).map(m => m.id))
					: 0
				lastMsgIdRef.current = lastServerId
			}
		} catch (e) {
			console.error('Admin messages load error', e)
		}
		// Start polling for user updates
		if (pollTimer) {
			clearInterval(pollTimer)
		}
		const t = setInterval(async () => {
			try {
				const params = new URLSearchParams()
				params.set('escId', String(escId))
				if (lastMsgIdRef.current > 0)
					params.set('since_id', String(lastMsgIdRef.current))
				const res = await fetch(
					`/api/support/admin/escalations/updates?${params.toString()}`,
				)
				const text = await res.text()
				let data: any = {}
				try {
					data = JSON.parse(text)
				} catch {
					return
				}
				if (data?.ok && Array.isArray(data.messages) && data.messages.length) {
					setChatMessages(prev => {
						// Merge with dedup by id
						const map = new Map<
							number,
							{
								id: number
								sender: string
								content: string
								created_at: number
							}
						>()
						for (const m of prev) {
							map.set(m.id, m)
						}
						for (const m of data.messages) {
							map.set(m.id, m)
						}
						const merged = Array.from(map.values()).sort((a, b) => {
							if (a.sender === 'admin' && b.sender !== 'admin') return -1
							if (a.sender !== 'admin' && b.sender === 'admin') return 1
							if (b.created_at !== a.created_at)
								return b.created_at - a.created_at
							return b.id - a.id
						})
						const positiveIds = merged.filter(m => m.id > 0).map(m => m.id)
						if (positiveIds.length) {
							lastMsgIdRef.current = Math.max(...positiveIds)
						}
						return merged
					})
				}
			} catch {}
		}, 3000)
		setPollTimer(t)
	}

	const closeChatModal = () => {
		setChatOpen(false)
		setSelectedId(null)
		setChatMessages([])
		setChatInput('')
		if (pollTimer) {
			clearInterval(pollTimer)
			setPollTimer(null)
		}
	}

	const sendChatMessage = async () => {
		if (!selectedId) return
		const text = chatInput.trim()
		if (!text) return
		try {
			const res = await fetch(`/api/support/admin/escalations/answer`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ escId: selectedId, answer: text }),
			})
			const t = await res.text()
			let data: any = {}
			try {
				data = JSON.parse(t)
			} catch {}
			if (res.ok && data?.ok) {
				const ts = Math.floor(Date.now() / 1000)
				// Append optimistic admin message with unique negative id to avoid collisions
				setChatMessages(prev => {
					const optimistic = {
						id: -Date.now(),
						sender: 'admin',
						content: text,
						created_at: ts,
					}
					const map = new Map<
						number,
						{ id: number; sender: string; content: string; created_at: number }
					>()
					for (const m of prev) map.set(m.id, m)
					map.set(optimistic.id, optimistic)
					return Array.from(map.values()).sort((a, b) => {
						if (a.sender === 'admin' && b.sender !== 'admin') return -1
						if (a.sender !== 'admin' && b.sender === 'admin') return 1
						if (b.created_at !== a.created_at)
							return b.created_at - a.created_at
						return b.id - a.id
					})
				})
				setChatInput('')
			} else {
				console.error('Admin answer error:', t)
			}
		} catch (e) {
			console.error('Admin answer error', e)
		}
	}

	const closeEscalation = async (escId: number) => {
		try {
			const res = await fetch(`/api/support/admin/escalations/close`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ escId }),
			})
			const t = await res.text()
			let data: any = {}
			try {
				data = JSON.parse(t)
			} catch {}
			if (res.ok && data?.ok) {
				setItems(prev => prev.filter(i => i.id !== escId))
				if (selectedId === escId) {
					closeChatModal()
				}
			} else {
				console.error('Admin close error:', t)
			}
		} catch (e) {
			console.error('Admin close error', e)
		}
	}

	useEffect(() => {
		loadEscalations()
	}, [])

	const roleAllowed = user?.role === 'Support' || user?.role === 'Admin'

	return (
		<div className='min-h-screen bg-gradient-to-b from-gray-950 to-gray-900'>
			<Header />
			<main className='mx-auto max-w-6xl px-4 pt-6 sm:px-6 lg:px-8 grid grid-cols-12 gap-6'>
				<div className='col-span-3'>
					<Sidebar />
				</div>
				<div className='col-span-9'>
					<div className='rounded-2xl border border-gray-800 bg-gray-900 p-4'>
						<div className='flex items-center justify-between mb-3'>
							<div className='flex items-center gap-2'>
								<span className='text-lg font-semibold text-white'>
									Админка
								</span>
								<span className='text-xs text-gray-400'>
									Заявки пользователей
								</span>
							</div>
						</div>

						{!roleAllowed ? (
							<div className='p-4 text-gray-400'>Недостаточно прав</div>
						) : (
							<div className='space-y-4'>
								{items.length === 0 ? (
									<div className='p-4 text-gray-400'>Нет заявок</div>
								) : (
									items.map(i => (
										<div
											key={i.id}
											className='rounded-xl border border-gray-800 bg-gray-950 p-4'
										>
											<div className='text-sm text-gray-300'>
												<div className='font-semibold text-white mb-1'>
													Заявка #{i.id}
												</div>
												<div className='text-gray-400'>
													Пользователь: {i.user_id}
												</div>
												<div className='mt-2 text-gray-200'>
													Вопрос: {i.question}
												</div>
											</div>
											<div className='mt-3 flex gap-2'>
												<button
													onClick={() => openChat(i.id)}
													className='px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium'
												>
													Чат
												</button>
												<button
													onClick={() => closeEscalation(i.id)}
													className='px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium'
												>
													Закрыть
												</button>
											</div>
										</div>
									))
								)}
							</div>
						)}
					</div>
				</div>
			</main>
			{chatOpen && (
				<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60'>
					<div className='w-full max-w-2xl rounded-2xl border border-gray-800 bg-gray-900 p-4'>
						<div className='flex items-center justify-between'>
							<div className='text-white font-semibold'>История чата</div>
							<button
								onClick={closeChatModal}
								className='text-gray-400 hover:text-white'
								aria-label='Закрыть модалку'
							>
								✕
							</button>
						</div>
						<div className='mt-3 max-h-96 overflow-y-auto space-y-2'>
							{chatMessages.length === 0 ? (
								<div className='text-gray-400 text-sm'>Пусто</div>
							) : (
								chatMessages.map(m => (
									<div
										key={`${m.id}-${m.sender}-${m.created_at}`}
										className={`rounded-lg px-3 py-2 text-sm ${
											m.sender === 'admin'
												? 'bg-emerald-900/30 text-emerald-100'
												: 'bg-gray-800 text-gray-100'
										}`}
									>
										<div className='text-xs opacity-70'>
											{m.sender === 'admin'
												? 'Оператор'
												: m.sender === 'bot'
													? 'Бот'
													: 'Пользователь'}
										</div>
										<div>
											{m.content.startsWith('/static/uploads/') &&
											/\.(jpg|jpeg|png|gif|webp)$/i.test(m.content) ? (
												<img
													src={
														m.content.startsWith('http')
															? m.content
															: `${BACKEND_URL}${m.content}`
													}
													alt='attachment'
													className='max-w-full rounded-lg max-h-60 object-contain cursor-pointer'
													onClick={() =>
														window.open(
															m.content.startsWith('http')
																? m.content
																: `${BACKEND_URL}${m.content}`,
															'_blank',
														)
													}
												/>
											) : (
												<div className='space-y-2'>
													{renderFormattedContent(m.content)}
												</div>
											)}
										</div>
									</div>
								))
							)}
						</div>
						<div className='mt-3 flex gap-2'>
							<input
								value={chatInput}
								onChange={e => setChatInput(e.target.value)}
								onKeyDown={e => {
									if (e.key === 'Enter') sendChatMessage()
								}}
								placeholder='Написать сообщение...'
								className='flex-1 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-600'
							/>
							<button
								onClick={sendChatMessage}
								className='px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium'
							>
								Отправить
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
