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
			<div className='min-h-screen bg-[#0e1117] flex items-center justify-center p-4'>
				<div className='text-center'>
					<p className='text-[#8b949e] mb-4'>{error}</p>
					<button
						onClick={() => router.push('/')}
						className='rounded-xl bg-[#0077FF] px-4 py-2 text-sm text-white hover:bg-[#0062d6] transition-colors'
					>
						На главную
					</button>
				</div>
			</div>
		)
	}

	return (
		<div className='min-h-screen bg-[#0e1117] flex flex-col text-[#e6edf3]'>
			<div className='flex items-center gap-3 p-4 border-b border-[#30363d] bg-[#161b22]/90 backdrop-blur-xl sticky top-0 z-10'>
				<button
					onClick={() => router.push('/')}
					className='p-2 rounded-full text-[#8b949e] hover:text-white hover:bg-[#21262d] transition-colors'
				>
					<Back className='h-5 w-5' />
				</button>
				<div>
					<h1 className='text-sm font-semibold text-[#e6edf3]'>Техническая поддержка</h1>
					<p className='text-xs text-[#8b949e]'>Заявка #{chatId}</p>
				</div>
				{status === 'closed' && (
					<span className='ml-auto text-xs text-red-400 bg-red-400/10 px-2.5 py-1 rounded-full border border-red-500/20'>Закрыт</span>
				)}
			</div>

			<div className='flex-1 overflow-y-auto p-4 space-y-3'>
				{loading && messages.length === 0 && (
					<div className='text-center text-[#8b949e] py-8'>Загрузка...</div>
				)}
				{messages.map(msg => (
					<div
						key={msg.id}
						className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
					>
						<div
							className={`max-w-[80%] rounded-2xl px-4 py-2.5 shadow-sm ${
								msg.sender === 'user'
									? 'bg-[#0077FF] text-white rounded-br-md shadow-[0_2px_8px_rgba(0,119,255,0.25)]'
									: msg.sender === 'bot'
										? 'bg-[#161b22] text-[#e6edf3] border border-[#30363d] rounded-bl-md'
										: 'bg-[#161b22] text-[#e6edf3] border border-[#23a55a]/40 rounded-bl-md'
							}`}
						>
							{msg.sender !== 'user' && (
								<div className={`text-[10px] font-medium mb-1 ${msg.sender === 'bot' ? 'text-[#8b949e]' : 'text-[#23a55a]'}`}>
									{msg.sender === 'bot' ? 'Бот' : 'Оператор'}
								</div>
							)}
							<div className='text-sm break-words'>{msg.content}</div>
							<div className={`text-[10px] mt-1 text-right ${msg.sender === 'user' ? 'text-white/70' : 'text-[#8b949e]'}`}>
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
				<div className='p-4 border-t border-[#30363d] bg-[#161b22]/90 backdrop-blur-xl'>
					<div className='flex gap-2 max-w-4xl mx-auto'>
						<input
							type='text'
							value={input}
							onChange={e => setInput(e.target.value)}
							onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
							placeholder='Напишите сообщение...'
							disabled={sending}
							className='flex-1 rounded-xl bg-[#0e1117] border border-[#30363d] px-4 py-2.5 text-sm text-[#e6edf3] placeholder-[#8b949e] focus:outline-none focus:border-[#0077FF] transition-colors'
						/>
						<button
							onClick={handleSend}
							disabled={!input.trim() || sending}
							className='rounded-xl bg-[#0077FF] px-4 py-2.5 text-white hover:bg-[#0062d6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
						>
							<Send className='h-4 w-4' />
						</button>
					</div>
				</div>
			)}
			{status === 'closed' && (
				<div className='p-4 border-t border-[#30363d] text-center text-sm text-[#8b949e] bg-[#161b22]'>
					Чат закрыт
				</div>
			)}
		</div>
	)
}
