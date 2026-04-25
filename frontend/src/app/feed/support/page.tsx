'use client'

import Header from '@/components/social/Header'
import Sidebar from '@/components/social/Sidebar'
import RightPanel from '@/components/social/RightPanel'
import { useAuth } from '@/lib/AuthContext'
import { FiPaperclip as Paperclip } from 'react-icons/fi'
import { LuLoader as Loader2 } from 'react-icons/lu'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type RagMessage = {
	id: number
	sender: 'user' | 'admin' | string
	content: string
	created_at: number
	escalation_id?: number
}

export default function SupportPage() {
	const { user, isLoading: isAuthLoading, isInitialized } = useAuth()
	const router = useRouter()
	const [ragMessages, setRagMessages] = useState<RagMessage[]>([])
	const [ragInput, setRagInput] = useState('')
	const [isUploading, setIsUploading] = useState(false)

	if (!isInitialized || isAuthLoading || !user) {
		return (
			<div className='flex min-h-screen items-center justify-center bg-black'>
				<div className='h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent'></div>
			</div>
		)
	}

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
					firstNewline === -1 ? block.trim() : block.slice(0, firstNewline).trim()
				const hasLang =
					firstLine.length > 0 && !firstLine.includes(' ') && firstNewline !== -1
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
			return block.trim()
				? renderTextBlock(block, `text-${index}`)
				: null
		})
	}
	const fileInputRef = useRef<HTMLInputElement>(null)
	const ragPollRef = useRef<number | null>(null)
	const BACKEND_URL =
		process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:5050'

	const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (!file) return

		if (file.size > 10 * 1024 * 1024) {
			alert('Файл слишком большой (макс 10МБ)')
			return
		}

		setIsUploading(true)
		try {
			const reader = new FileReader()
			reader.onload = async () => {
				const base64 = reader.result as string
				try {
					const res = await fetch('/api/v1/upload/file', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							file: base64,
							filename: file.name,
						}),
					})
					const data = await res.json()
					if (res.ok && data.url) {
						await ragSend(data.url)
					} else {
						alert('Ошибка загрузки: ' + (data.error || 'Unknown error'))
					}
				} catch (err) {
					console.error(err)
					alert('Ошибка загрузки файла')
				} finally {
					setIsUploading(false)
					if (fileInputRef.current) fileInputRef.current.value = ''
				}
			}
			reader.readAsDataURL(file)
		} catch (err) {
			setIsUploading(false)
		}
	}

	const ragLoadHistory = async () => {
		try {
			const res = await fetch(`/api/support/chat/history`)
			const text = await res.text()
			let data: any = {}
			try {
				data = JSON.parse(text)
			} catch {
				console.error('Invalid JSON from backend /support/chat/history:', text)
				return
			}
			if (data?.ok && Array.isArray(data.messages)) {
				setRagMessages(data.messages)
			}
		} catch (e) {
			console.error('RAG history error', e)
		}
	}

	const ragPoll = async () => {
		try {
			const res = await fetch(`/api/support/chat/updates`)
			const text = await res.text()
			let data: any = {}
			try {
				data = JSON.parse(text)
			} catch {
				console.error('Invalid JSON from backend /support/chat/updates:', text)
				return
			}
			if (data?.ok && Array.isArray(data.updates) && data.updates.length) {
				setRagMessages(prev => {
					const mapped = data.updates.map((u: any) => ({
						id: u.id,
						sender: u.sender || 'admin',
						content: u.answer || '',
						created_at: u.answered_at || Date.now(),
						escalation_id: u.escalation_id,
					}))
					const map = new Map<number, RagMessage>()
					for (const m of prev) map.set(m.id, m)
					for (const m of mapped) map.set(m.id, m)
					return Array.from(map.values())
				})
			}
		} catch (e) {
			console.error('RAG poll error', e)
		}
	}

	const ragSend = async (overrideText?: string) => {
		const text = overrideText || ragInput.trim()
		if (!text) return
		if (!overrideText) setRagInput('')
		const tempId = Date.now()
		const optimisticEsc = selectedEsc ?? (newChatMode ? -1 : undefined)
		setRagMessages(prev => [
			...prev,
			{
				id: tempId,
				sender: 'user',
				content: text,
				created_at: Date.now(),
				escalation_id: optimisticEsc,
			},
		])
		try {
			const res = await fetch(`/api/support/chat/send`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(
					selectedEsc && selectedEsc !== -1
						? { message: text, esc_id: selectedEsc }
						: { message: text, new_chat: true },
				),
			})
			const respText = await res.text()
			let data: any = {}
			try {
				data = JSON.parse(respText)
			} catch {
				console.error('Invalid JSON from backend /support/chat/send:', respText)
				return
			}
			if (res.ok && data?.ok) {
				if ((newChatMode || selectedEsc === -1) && data.escalation_id) {
					setRagMessages(prev =>
						prev.map(m =>
							m.escalation_id === -1
								? { ...m, escalation_id: data.escalation_id }
								: m,
						),
					)
					setSelectedEsc(data.escalation_id)
					setNewChatMode(false)
					loadChats()
				}
				setRagMessages(prev => [
					...prev,
					{
						id: tempId + 1,
						sender: data.answer ? 'bot' : 'admin',
						content: data.answer || 'Сообщение отправлено оператору',
						created_at: Date.now(),
						escalation_id:
							data.escalation_id ||
							(selectedEsc === -1 ? undefined : selectedEsc || undefined),
					},
				])
			} else {
				console.error('RAG send error:', respText)
			}
		} catch (e) {
			console.error('RAG send error', e)
		}
	}

	useEffect(() => {
		ragLoadHistory()
		ragPollRef.current = window.setInterval(ragPoll, 5000)
		return () => {
			if (ragPollRef.current) window.clearInterval(ragPollRef.current)
		}
	}, [])

	const [chats, setChats] = useState<
		{ id: number; question: string; status: string; created_at: number }[]
	>([])
	const [selectedEsc, setSelectedEsc] = useState<number | null>(null)
	const [newChatMode, setNewChatMode] = useState(false)
	const loadChats = async () => {
		try {
			const res = await fetch('/api/support/chats')
			const data = await res.json()
			if (data?.ok && Array.isArray(data.chats)) setChats(data.chats)
		} catch {}
	}
	useEffect(() => {
		loadChats()
	}, [])
	const deleteChat = async (escId: number) => {
		try {
			const res = await fetch('/api/support/chats/delete', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ escId }),
			})
			const data = await res.json()
			if (res.ok && data?.ok) {
				setChats(prev => prev.filter(c => c.id !== escId))
				if (selectedEsc === escId) setSelectedEsc(null)
				setRagMessages(prev => prev.filter(m => m.escalation_id !== escId))
			}
		} catch {}
	}

	return (
		<div className='min-h-screen bg-black text-white selection:bg-indigo-500 selection:text-white overflow-x-hidden relative'>
			<div className='fixed inset-0 z-0 overflow-hidden pointer-events-none'>
				<div className='absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-indigo-900/20 blur-[120px]' />
				<div className='absolute top-[40%] -right-[10%] w-[40%] h-[60%] rounded-full bg-purple-900/20 blur-[120px]' />
				<div className='absolute bottom-[10%] left-[20%] w-[30%] h-[30%] rounded-full bg-emerald-900/10 blur-[100px]' />
			</div>

			<div className='relative z-20'>
				<Header email={user.email} onLogout={() => router.push('/')} />
			</div>

			<div className='relative z-10 mx-auto flex max-w-7xl pt-6'>
				<Sidebar />
				<main className='flex-1 px-4 sm:px-6 lg:px-8'>
					<div className='mx-auto max-w-2xl space-y-6'>
						<div className='rounded-2xl border border-gray-800 bg-black/40 backdrop-blur-sm p-6'>
							<div className='flex items-center justify-between mb-4'>
								<div className='flex items-center gap-2'>
									<span className='text-lg font-semibold text-white'>
										Тех. поддержка
									</span>
									<span className='text-xs text-gray-400'>
										Справка и чат с поддержкой
									</span>
								</div>
							</div>
							<div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
								<div className='md:col-span-1 bg-gray-950/60 border border-gray-800 rounded-xl p-3 h-[50vh] flex flex-col'>
									<div className='text-sm font-medium text-gray-200 mb-2'>
										Частые вопросы
									</div>
									<div className='flex-1 overflow-y-auto space-y-2 text-sm text-gray-300 custom-scrollbar'>
										<div>
											<div className='font-semibold'>Как войти через Yandex?</div>
											<div className='text-gray-400'>
												На странице входа нажмите «Войти через Yandex» и
												подтвердите вход.
											</div>
										</div>
										<div>
											<div className='font-semibold'>
												Почему меня просят ввести код при входе?
											</div>
											<div className='text-gray-400'>
												Это двухфакторная защита (2FA).
											</div>
										</div>
										<div>
											<div className='font-semibold'>
												Письмо с кодом не приходит — что делать?
											</div>
											<div className='text-gray-400'>
												Проверьте «Спам» и «Промоакции».
											</div>
										</div>
									</div>
								</div>
								<div className='md:col-span-2'>
									<div className='bg-gray-950/60 border border-gray-800 rounded-xl p-3 h-[50vh] flex flex-col'>
										<div className='flex items-center justify-between mb-2'>
											<div className='text-sm text-gray-300'>
												{selectedEsc ? `Чат #${selectedEsc}` : 'Все чаты'}
											</div>
											<div className='flex gap-2'>
												<button
													onClick={() => {
														setSelectedEsc(-1)
														setNewChatMode(true)
													}}
													className='px-2 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-xs'
													title='Начать новый чат'
												>
													Новый чат
												</button>
												<select
													value={selectedEsc || ''}
													onChange={e =>
														setSelectedEsc(
															e.target.value ? Number(e.target.value) : null,
														)
													}
													className='bg-gray-900 border border-gray-800 rounded-lg px-2 py-1 text-sm text-gray-100'
												>
													<option value=''>Все</option>
													{chats.map(c => (
														<option key={c.id} value={c.id}>
															#{c.id} [{c.status}] {c.question?.slice(0, 20)}
														</option>
													))}
												</select>
											</div>
										</div>
										<div
											className='flex-1 overflow-y-auto space-y-2 custom-scrollbar'
											id='rag-chat-box'
										>
											{ragMessages
												.filter(m =>
													selectedEsc ? m.escalation_id === selectedEsc : true,
												)
												.map(m => (
													<div
														key={`${m.id}-${m.sender}-${m.created_at}`}
														className={`flex ${
															m.sender === 'user'
																? 'justify-end'
																: 'justify-start'
														}`}
													>
														<div
															className={`max-w-[70%] px-3 py-2 rounded-lg ${
																m.sender === 'user'
																	? 'bg-blue-600 text-white'
																	: m.sender === 'bot'
																		? 'bg-indigo-600 text-white'
																		: 'bg-gray-800 text-gray-100'
															}`}
														>
															<div className='text-xs opacity-70 mb-1'>
																{m.sender === 'admin'
																	? 'Оператор'
																	: m.sender === 'bot'
																		? 'Бот'
																		: 'Вы'}
															</div>
															<div className='space-y-2'>
																{renderFormattedContent(m.content)}
															</div>
														</div>
													</div>
												))}
										</div>
										<div className='mt-3 flex gap-2 items-center'>
											<input
												type='file'
												ref={fileInputRef}
												className='hidden'
												accept='image/*'
												onChange={handleFileSelect}
											/>
											<button
												onClick={() => fileInputRef.current?.click()}
												disabled={isUploading}
												className='p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors'
												title='Прикрепить фото'
											>
												{isUploading ? (
													<Loader2 className='w-5 h-5 animate-spin' />
												) : (
													<Paperclip className='w-5 h-5' />
												)}
											</button>
											<input
												value={ragInput}
												onChange={e => setRagInput(e.target.value)}
												onKeyDown={e => {
													if (e.key === 'Enter') ragSend()
												}}
												placeholder='Сообщение поддержке...'
												className='flex-1 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-600'
											/>
											<button
												onClick={() => ragSend()}
												className='px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium'
											>
												Отправить
											</button>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</main>
				<div className='hidden w-80 p-6 lg:block'>
					<RightPanel />
				</div>
			</div>
		</div>
	)
}
