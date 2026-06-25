'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { LuArrowLeft as Back, LuSend as Send } from 'react-icons/lu'

type ChatMessage = {
	id: number
	sender: string
	content: string
	created_at: string
}

export default function AnonChatPage() {
	const params = useParams()
	const router = useRouter()
	const chatId = params?.chatId as string
	const [messages, setMessages] = useState<ChatMessage[]>([])
	const [input, setInput] = useState('')
	const [status, setStatus] = useState('open')
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const [sending, setSending] = useState(false)
	const messagesEndRef = useRef<HTMLDivElement>(null)
	const lastMsgIdRef = useRef(0)
	const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
	const tokenRef = useRef('')

	useEffect(() => {
		const t = localStorage.getItem('anon_support_token')
		if (!t) {
			setError('Токен не найден. Вернитесь на главную.')
			setLoading(false)
			return
		}
		tokenRef.current = t
		loadMessages(true)
		pollRef.current = setInterval(() => loadMessages(false), 3000)
		return () => {
			if (pollRef.current) clearInterval(pollRef.current)
		}
	}, [chatId])

	const loadMessages = useCallback(async (initial = false) => {
		const token = tokenRef.current
		if (!token) return
		try {
			const sinceId = initial ? '0' : String(lastMsgIdRef.current)
			const res = await fetch(
				`/api/support/anon/messages?id=${chatId}&token=${token}&since_id=${sinceId}`
			)
			const data = await res.json()
			if (data.ok) {
				if (initial) {
					setMessages(data.messages || [])
				} else if (data.messages?.length > 0) {
					setMessages(prev => {
						const existingIds = new Set(prev.map(m => m.id))
						const newMsgs = data.messages.filter((m: ChatMessage) => !existingIds.has(m.id))
						return [...prev, ...newMsgs]
					})
				}
				if (data.messages?.length > 0) {
					lastMsgIdRef.current = Math.max(...data.messages.map((m: ChatMessage) => m.id))
				}
				setStatus(data.status || 'open')
			}
		} catch {}
		setLoading(false)
	}, [chatId])

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
	}, [messages])

	const handleSend = async () => {
		if (!input.trim() || sending || status === 'closed') return
		setSending(true)
		try {
			const res = await fetch('/api/support/anon/send', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: Number(chatId),
					token: tokenRef.current,
					message: input.trim(),
				}),
			})
			const data = await res.json()
			if (data.ok) {
				setInput('')
				await loadMessages(false)
			}
		} catch {}
		setSending(false)
	}

	if (error) {
		return (
			<div className='min-h-screen bg-gray-950 flex items-center justify-center p-4'>
				<div className='text-center'>
					<p className='text-gray-400 mb-4'>{error}</p>
					<button
						onClick={() => router.push('/')}
						className='rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500'
					>
						На главную
					</button>
				</div>
			</div>
		)
	}

	return (
		<div className='min-h-screen bg-gray-950 flex flex-col'>
			<div className='flex items-center gap-3 p-4 border-b border-white/10 bg-gray-950/80 backdrop-blur-xl sticky top-0 z-10'>
				<button
					onClick={() => router.push('/')}
					className='p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors'
				>
					<Back className='h-5 w-5' />
				</button>
				<div>
					<h1 className='text-sm font-semibold text-white'>Техническая поддержка</h1>
					<p className='text-xs text-gray-400'>Заявка #{chatId}</p>
				</div>
				{status === 'closed' && (
					<span className='ml-auto text-xs text-red-400 bg-red-400/10 px-2 py-1 rounded-full'>Закрыт</span>
				)}
			</div>

			<div className='flex-1 overflow-y-auto p-4 space-y-3'>
				{loading && messages.length === 0 && (
					<div className='text-center text-gray-500 py-8'>Загрузка...</div>
				)}
				{messages.map(msg => (
					<div
						key={msg.id}
						className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
					>
						<div
							className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
								msg.sender === 'user'
									? 'bg-indigo-600 text-white rounded-br-md'
									: msg.sender === 'bot'
										? 'bg-gray-800 text-gray-200 rounded-bl-md'
										: 'bg-green-700/80 text-white rounded-bl-md'
							}`}
						>
							{msg.sender !== 'user' && (
								<div className='text-[10px] font-medium opacity-70 mb-1'>
									{msg.sender === 'bot' ? 'Бот' : 'Оператор'}
								</div>
							)}
							<div className='text-sm break-words'>{msg.content}</div>
							<div className='text-[10px] opacity-50 mt-1'>
								{new Date(msg.created_at).toLocaleTimeString('ru-RU', {
									hour: '2-digit',
									minute: '2-digit',
								})}
							</div>
						</div>
					</div>
				))}
				<div ref={messagesEndRef} />
			</div>

			{status !== 'closed' && (
				<div className='p-4 border-t border-white/10 bg-gray-950/80 backdrop-blur-xl'>
					<div className='flex gap-2'>
						<input
							type='text'
							value={input}
							onChange={e => setInput(e.target.value)}
							onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
							placeholder='Напишите сообщение...'
							disabled={sending}
							className='flex-1 rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50'
						/>
						<button
							onClick={handleSend}
							disabled={!input.trim() || sending}
							className='rounded-xl bg-indigo-600 px-4 py-2.5 text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
						>
							<Send className='h-4 w-4' />
						</button>
					</div>
				</div>
			)}
			{status === 'closed' && (
				<div className='p-4 border-t border-white/10 text-center text-sm text-gray-500'>
					Чат закрыт
				</div>
			)}
		</div>
	)
}
