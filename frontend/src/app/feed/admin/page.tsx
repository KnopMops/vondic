'use client'

import Header from '@/components/social/Header'
import PostDetailsModal from '@/components/social/PostDetailsModal'
import Sidebar from '@/components/social/Sidebar'
import { useAuth } from '@/lib/AuthContext'
import { getAttachmentUrl } from '@/lib/utils'
import { Loader2, Paperclip } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

type Escalation = {
	id: number
	user_id: string
	question: string
	created_at: number
}

type PostReport = {
	id: number
	reporter_id?: string
	reporter_login?: string
	post_id: string
	post_author_login: string
	description: string
	attachments?: string[]
	created_at: number
	status?: string
	verdict_at?: number | null
	removal_deadline?: number | null
	removal_time_left?: number | null
}

export default function AdminSupportPage() {
	const { user, logout } = useAuth()
	const [items, setItems] = useState<Escalation[]>([])
	const [postReports, setPostReports] = useState<PostReport[]>([])
	const [postReportsLoading, setPostReportsLoading] = useState(false)
	const [postDetailsOpen, setPostDetailsOpen] = useState(false)
	const [postDetailsId, setPostDetailsId] = useState<string | null>(null)
	const [violationOpen, setViolationOpen] = useState(false)
	const [violationAction, setViolationAction] = useState<
		'request_removal' | 'force_remove'
	>('request_removal')
	const [violationReason, setViolationReason] = useState('')
	const [violationCustomReason, setViolationCustomReason] = useState('')
	const [violationReportId, setViolationReportId] = useState<number | null>(
		null,
	)
	const [violationPostId, setViolationPostId] = useState<string | null>(null)
	const [violationBusy, setViolationBusy] = useState(false)
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

	const backendUrl =
		process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:5050'

	const [gifts, setGifts] = useState<any[]>([])
	const [giftsLoading, setGiftsLoading] = useState(false)
	const [giftsError, setGiftsError] = useState<string | null>(null)
	const [newGiftName, setNewGiftName] = useState('')
	const [newGiftPrice, setNewGiftPrice] = useState('0')
	const [newGiftIcon, setNewGiftIcon] = useState('Gift')
	const [newGiftDesc, setNewGiftDesc] = useState('')
	const [newGiftImageUrl, setNewGiftImageUrl] = useState('')
	const [newGiftTotalSupply, setNewGiftTotalSupply] = useState('')
	const [giftUploading, setGiftUploading] = useState(false)
	const giftFileInputRef = useRef<HTMLInputElement | null>(null)
	const [nowTs, setNowTs] = useState(() => Date.now())

	useEffect(() => {
		const t = setInterval(() => setNowTs(Date.now()), 1000)
		return () => clearInterval(t)
	}, [])

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

	const formatTimeLeft = (deadline?: number | null) => {
		if (!deadline) return null
		const diff = Math.max(0, deadline * 1000 - nowTs)
		const totalSeconds = Math.floor(diff / 1000)
		const hours = Math.floor(totalSeconds / 3600)
		const minutes = Math.floor((totalSeconds % 3600) / 60)
		const seconds = totalSeconds % 60
		return `${hours}ч ${minutes}м ${seconds}с`
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

	const loadPostReports = async () => {
		setPostReportsLoading(true)
		try {
			const res = await fetch('/api/support/admin/post-reports')
			const text = await res.text()
			let data: any = {}
			try {
				data = JSON.parse(text)
			} catch {
				console.error('Invalid JSON from backend /post-reports:', text)
				return
			}
			if (data?.ok && Array.isArray(data.reports)) {
				setPostReports(data.reports)
			}
		} catch (e) {
			console.error('Admin post reports load error', e)
		} finally {
			setPostReportsLoading(false)
		}
	}

	const openPostDetails = (postId: string) => {
		setPostDetailsId(postId)
		setPostDetailsOpen(true)
	}

	const closePostDetails = () => {
		setPostDetailsOpen(false)
		setPostDetailsId(null)
	}

	const openViolationModal = (
		reportId: number | null,
		postId: string,
		action: 'request_removal' | 'force_remove',
	) => {
		setViolationReportId(reportId)
		setViolationPostId(postId)
		setViolationAction(action)
		setViolationReason('')
		setViolationCustomReason('')
		setViolationOpen(true)
	}

	const closeViolationModal = () => {
		setViolationOpen(false)
		setViolationReason('')
		setViolationCustomReason('')
		setViolationReportId(null)
		setViolationPostId(null)
	}

	const resolveViolationReason = () => {
		const custom = violationCustomReason.trim()
		if (custom) return custom
		return violationReason.trim()
	}

	const submitViolationAction = async () => {
		if (!violationPostId) return
		if (!violationReason.trim() && !violationCustomReason.trim()) {
			return
		}
		try {
			setViolationBusy(true)
			const res = await fetch('/api/support/admin/post-reports/action', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: violationAction,
					post_id: violationPostId,
					report_id: violationReportId ?? undefined,
					reason: resolveViolationReason(),
				}),
			})
			const text = await res.text()
			let data: any = {}
			try {
				data = JSON.parse(text)
			} catch {}
			if (!res.ok || !data?.ok) {
				throw new Error(data?.error || text || 'Ошибка выполнения действия')
			}
			if (violationReportId != null && data?.removed) {
				setPostReports(prev => prev.filter(r => r.id !== violationReportId))
			} else if (violationReportId != null && data?.status) {
				setPostReports(prev =>
					prev.map(r =>
						r.id === violationReportId ? { ...r, status: data.status } : r,
					),
				)
			}
			closeViolationModal()
		} catch (e) {
		} finally {
			setViolationBusy(false)
		}
	}

	const submitLegalRemoval = async (
		reportId: number | null,
		postId: string,
	) => {
		try {
			const res = await fetch('/api/support/admin/post-reports/action', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'legal_remove',
					post_id: postId,
					report_id: reportId ?? undefined,
				}),
			})
			const text = await res.text()
			let data: any = {}
			try {
				data = JSON.parse(text)
			} catch {}
			if (!res.ok || !data?.ok) {
				throw new Error(data?.error || text || 'Ошибка выполнения действия')
			}
			if (reportId != null && data?.removed) {
				setPostReports(prev => prev.filter(r => r.id !== reportId))
			} else if (reportId != null && data?.status) {
				setPostReports(prev =>
					prev.map(r =>
						r.id === reportId ? { ...r, status: data.status } : r,
					),
				)
			}
		} catch (e) {}
	}

	const submitNoViolation = async (reportId: number | null, postId: string) => {
		try {
			const res = await fetch('/api/support/admin/post-reports/action', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'no_violation',
					post_id: postId,
					report_id: reportId ?? undefined,
				}),
			})
			const text = await res.text()
			let data: any = {}
			try {
				data = JSON.parse(text)
			} catch {}
			if (!res.ok || !data?.ok) {
				throw new Error(data?.error || text || 'Ошибка выполнения действия')
			}
			if (reportId != null && data?.removed) {
				setPostReports(prev => prev.filter(r => r.id !== reportId))
			} else if (reportId != null && data?.status) {
				setPostReports(prev =>
					prev.map(r =>
						r.id === reportId ? { ...r, status: data.status } : r,
					),
				)
			}
		} catch (e) {}
	}

	const loadGifts = async () => {
		setGiftsLoading(true)
		setGiftsError(null)
		try {
			const res = await fetch(`${backendUrl}/api/v1/gifts/`, {
				method: 'GET',
			})
			if (!res.ok) {
				const text = await res.text()
				throw new Error(text || 'Ошибка загрузки подарков')
			}
			const data = await res.json()
			setGifts(Array.isArray(data) ? data : [])
		} catch (e: any) {
			setGiftsError(e.message || 'Не удалось загрузить подарки')
		} finally {
			setGiftsLoading(false)
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

	const ensureToken = async (): Promise<string> => {
		const meRes = await fetch('/api/auth/me', { method: 'GET' })
		if (meRes.ok) {
			const meData = await meRes.json()
			const token = meData?.user?.access_token || meData?.access_token
			if (token) return token
		}
		throw new Error('Требуется авторизация')
	}

	const handleGiftFileSelect = async (
		e: React.ChangeEvent<HTMLInputElement>,
	) => {
		const file = e.target.files?.[0]
		if (!file) return
		if (file.size > 10 * 1024 * 1024) {
			alert('Файл слишком большой (макс 10МБ)')
			return
		}
		setGiftUploading(true)
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
						setNewGiftImageUrl(data.url)
					} else {
						alert('Ошибка загрузки: ' + (data.error || 'Unknown error'))
					}
				} catch (err) {
					console.error(err)
					alert('Ошибка загрузки файла')
				} finally {
					setGiftUploading(false)
					if (giftFileInputRef.current) {
						giftFileInputRef.current.value = ''
					}
				}
			}
			reader.readAsDataURL(file)
		} catch (err) {
			setGiftUploading(false)
		}
	}

	const createGift = async () => {
		try {
			const name = newGiftName.trim()
			if (!name) {
				setGiftsError('Введите название подарка')
				return
			}
			const price = parseInt(newGiftPrice || '0', 10)
			if (Number.isNaN(price) || price < 0) {
				setGiftsError('Цена должна быть неотрицательным числом')
				return
			}
			setGiftsError(null)
			const token = await ensureToken()
			const res = await fetch(`${backendUrl}/api/v1/gifts/admin/create`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					name,
					coin_price: price,
					icon: newGiftIcon,
					description: newGiftDesc.trim() || undefined,
					image_url: newGiftImageUrl || undefined,
					total_supply: newGiftTotalSupply.trim() || undefined,
				}),
			})
			const text = await res.text()
			let data: any = {}
			try {
				data = JSON.parse(text)
			} catch {}
			if (!res.ok || !data?.gift) {
				throw new Error(data?.error || text || 'Не удалось создать подарок')
			}
			setGifts(prev => [...prev, data.gift])
			setNewGiftName('')
			setNewGiftPrice('0')
			setNewGiftDesc('')
			setNewGiftImageUrl('')
			setNewGiftTotalSupply('')
		} catch (e: any) {
			setGiftsError(e.message || 'Не удалось создать подарок')
		}
	}

	const deleteGift = async (id: string) => {
		try {
			const token = await ensureToken()
			const res = await fetch(`${backendUrl}/api/v1/gifts/admin/delete`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ id }),
			})
			const text = await res.text()
			let data: any = {}
			try {
				data = JSON.parse(text)
			} catch {}
			if (!res.ok || data?.error) {
				throw new Error(data?.error || text || 'Не удалось удалить подарок')
			}
			setGifts(prev => prev.filter(g => g.id !== id))
		} catch (e: any) {
			setGiftsError(e.message || 'Не удалось удалить подарок')
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
		loadPostReports()
	}, [])

	useEffect(() => {
		if (user?.role === 'Admin') {
			loadGifts()
		}
	}, [user?.role])

	const roleAllowed = user?.role === 'Support' || user?.role === 'Admin'

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
				<Sidebar />
				<main className='flex-1 px-4 sm:px-6 lg:px-8 pb-20'>
					<div className='mx-auto max-w-5xl space-y-6'>
						<div className='rounded-2xl bg-white/5 border border-white/10 p-6'>
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
								<div className='space-y-8'>
									<div className='space-y-4'>
										{items.length === 0 ? (
											<div className='p-4 text-gray-400'>Нет заявок</div>
										) : (
											items.map(i => (
												<div
													key={i.id}
													className='rounded-xl border border-white/10 bg-black/30 p-4'
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
									<div className='rounded-xl border border-gray-800 bg-gray-950 p-4'>
										<div className='flex items-center justify-between mb-3'>
											<div className='text-sm font-semibold text-white'>
												Жалобы на публикации
											</div>
											<div className='text-xs text-gray-400'>
												Поступившие обращения на посты
											</div>
										</div>
										{postReportsLoading ? (
											<div className='text-xs text-gray-500'>
												Загрузка жалоб...
											</div>
										) : postReports.length === 0 ? (
											<div className='text-sm text-gray-400'>Нет жалоб</div>
										) : (
											<div className='space-y-3'>
												{postReports.map(r => (
													<div
														key={r.id}
														className='rounded-lg border border-gray-800 bg-gray-900/60 p-4 text-sm text-gray-200 space-y-2'
													>
														<div className='flex items-center justify-between'>
															<div className='font-semibold text-white'>
																Жалоба #{r.id}
															</div>
															{r.created_at && (
																<div className='text-xs text-gray-500'>
																	{new Date(
																		r.created_at * 1000,
																	).toLocaleString()}
																</div>
															)}
														</div>
														<div className='text-gray-400'>
															Автор поста: {r.post_author_login}
														</div>
														<div className='text-gray-400'>
															ID публикации: {r.post_id}
														</div>
														{r.reporter_login && (
															<div className='text-gray-400'>
																Отправил: {r.reporter_login}
															</div>
														)}
														{r.status && (
															<div className='text-xs text-gray-500'>
																Статус: {r.status}
															</div>
														)}
														{r.status === 'removal_requested' &&
															r.removal_deadline && (
																<div className='text-xs text-amber-300'>
																	Осталось: {formatTimeLeft(r.removal_deadline)}
																</div>
															)}
														<div className='text-gray-200 whitespace-pre-wrap'>
															{r.description}
														</div>
														{r.attachments && r.attachments.length > 0 && (
															<div className='space-y-1'>
																<div className='text-xs text-gray-400'>
																	Вложения:
																</div>
																<div className='space-y-1'>
																	{r.attachments.map(a => (
																		<a
																			key={a}
																			href={getAttachmentUrl(a)}
																			target='_blank'
																			rel='noreferrer'
																			className='block text-xs text-indigo-300 hover:text-indigo-200 truncate'
																		>
																			{a}
																		</a>
																	))}
																</div>
															</div>
														)}
														<div className='flex flex-wrap gap-2 pt-2'>
															<button
																onClick={() =>
																	openPostDetails(String(r.post_id))
																}
																className='rounded-md border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs font-medium text-gray-200 hover:bg-gray-800'
															>
																Подробнее
															</button>
															<button
																onClick={() =>
																	openViolationModal(
																		r.id,
																		String(r.post_id),
																		'request_removal',
																	)
																}
																className='rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-500/20'
															>
																Требование удалить
															</button>
															<button
																onClick={() =>
																	submitNoViolation(r.id, String(r.post_id))
																}
																className='rounded-md border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs font-medium text-gray-200 hover:bg-gray-800'
															>
																Нарушений не найдено
															</button>
															{user?.role === 'Admin' && (
																<>
																	<button
																		onClick={() =>
																			openViolationModal(
																				r.id,
																				String(r.post_id),
																				'force_remove',
																			)
																		}
																		className='rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-200 hover:bg-red-500/20'
																	>
																		Удалить принудительно
																	</button>
																	<button
																		onClick={() =>
																			submitLegalRemoval(
																				r.id,
																				String(r.post_id),
																			)
																		}
																		className='rounded-md border border-red-600/60 bg-red-600/20 px-3 py-1.5 text-xs font-medium text-red-100 hover:bg-red-600/30'
																	>
																		Нарушение закона РФ
																	</button>
																</>
															)}
														</div>
													</div>
												))}
											</div>
										)}
									</div>

									{user?.role === 'Admin' && (
										<div className='rounded-xl border border-gray-800 bg-gray-950 p-4'>
											<div className='flex items-center justify-between mb-2'>
												<div className='text-sm font-semibold text-white'>
													Подарки (админ)
												</div>
												<div className='text-xs text-gray-400'>
													Управление списком подарков магазина
												</div>
											</div>
											{giftsError && (
												<div className='mb-3 rounded-md border border-red-500 bg-red-50 px-3 py-2 text-xs text-red-700'>
													{giftsError}
												</div>
											)}
											<div className='grid grid-cols-1 gap-3 md:grid-cols-4'>
												<div className='md:col-span-2'>
													<label className='block text-xs font-medium text-gray-300'>
														Название
													</label>
													<input
														value={newGiftName}
														onChange={e => setNewGiftName(e.target.value)}
														className='mt-1 w-full rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-sm text-gray-100 focus:border-indigo-500 focus:ring-indigo-500'
													/>
												</div>
												<div>
													<label className='block text-xs font-medium text-gray-300'>
														Цена (коины)
													</label>
													<input
														type='number'
														min={0}
														value={newGiftPrice}
														onChange={e => setNewGiftPrice(e.target.value)}
														className='mt-1 w-full rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-sm text-gray-100 focus:border-indigo-500 focus:ring-indigo-500'
													/>
												</div>
												<div>
													<label className='block text-xs font-medium text-gray-300'>
														Иконка
													</label>
													<select
														value={newGiftIcon}
														onChange={e => setNewGiftIcon(e.target.value)}
														className='mt-1 w-full rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-sm text-gray-100 focus:border-indigo-500 focus:ring-indigo-500'
													>
														<option value='Gift'>Gift</option>
														<option value='Heart'>Heart</option>
														<option value='Flame'>Flame</option>
														<option value='Flower'>Flower</option>
														<option value='Coffee'>Coffee</option>
														<option value='Crown'>Crown</option>
														<option value='Star'>Star</option>
													</select>
												</div>
											</div>
											<div className='mt-3 grid grid-cols-1 gap-3 md:grid-cols-2'>
												<div>
													<label className='block text-xs font-medium text-gray-300'>
														Тираж (пусто — без лимита)
													</label>
													<input
														type='number'
														min={1}
														value={newGiftTotalSupply}
														onChange={e =>
															setNewGiftTotalSupply(e.target.value)
														}
														className='mt-1 w-full rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-sm text-gray-100 focus:border-indigo-500 focus:ring-indigo-500'
														placeholder='Например, 500'
													/>
												</div>
												<label className='block text-xs font-medium text-gray-300'>
													Описание
												</label>
												<textarea
													value={newGiftDesc}
													onChange={e => setNewGiftDesc(e.target.value)}
													rows={2}
													className='mt-1 w-full rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-sm text-gray-100 focus:border-indigo-500 focus:ring-indigo-500'
												/>
											</div>
											<div className='mt-3 grid grid-cols-1 md:grid-cols-[auto,1fr] gap-3 items-center'>
												<div className='flex items-center gap-2'>
													<input
														ref={giftFileInputRef}
														type='file'
														accept='image/*,image/gif'
														className='hidden'
														onChange={handleGiftFileSelect}
													/>
													<button
														type='button'
														onClick={() => giftFileInputRef.current?.click()}
														disabled={giftUploading}
														className='inline-flex items-center gap-1 rounded-md border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs font-medium text-gray-100 hover:bg-gray-800 disabled:opacity-60'
													>
														{giftUploading ? (
															<Loader2 className='h-4 w-4 animate-spin' />
														) : (
															<Paperclip className='h-4 w-4' />
														)}
														<span>Загрузить картинку</span>
													</button>
													{newGiftImageUrl && (
														<span className='text-[10px] text-gray-400 max-w-[160px] truncate'>
															{newGiftImageUrl}
														</span>
													)}
												</div>
												<div className='flex justify-end'>
													<button
														onClick={createGift}
														className='rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60'
														disabled={giftsLoading}
													>
														Создать подарок
													</button>
												</div>
											</div>
											<div className='mt-4 border-t border-white/10 pt-3'>
												<div className='text-xs font-semibold uppercase tracking-wide text-gray-400'>
													Текущие подарки
												</div>
												{giftsLoading ? (
													<div className='mt-2 text-xs text-gray-500'>
														Загрузка подарков...
													</div>
												) : (
													<div className='mt-2 space-y-2'>
														{gifts.map(g => (
															<div
																key={g.id}
																className='flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm'
															>
																<div>
																	<div className='font-medium text-gray-100'>
																		{g.name}
																	</div>
																	<div className='text-xs text-gray-400'>
																		{g.coinPrice} коинов · {g.icon}
																	</div>
																</div>
																<button
																	onClick={() => deleteGift(g.id)}
																	className='text-xs text-red-500 hover:text-red-600'
																>
																	Удалить
																</button>
															</div>
														))}
														{gifts.length === 0 && (
															<div className='mt-1 text-xs text-gray-500'>
																Пока нет ни одного подарка
															</div>
														)}
													</div>
												)}
											</div>
										</div>
									)}
								</div>
							)}
						</div>
					</div>
				</main>
			</div>
			{chatOpen && (
				<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm'>
					<div className='w-full max-w-2xl rounded-2xl border border-white/10 bg-white/5 p-4'>
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
			{postDetailsId && (
				<PostDetailsModal
					postId={postDetailsId}
					isOpen={postDetailsOpen}
					onClose={closePostDetails}
				/>
			)}
			{violationOpen && (
				<div className='fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4'>
					<div className='w-full max-w-lg rounded-2xl border border-white/10 bg-white/5 p-5 text-gray-200'>
						<div className='flex items-center justify-between'>
							<div className='text-lg font-semibold text-white'>
								Причина нарушения
							</div>
							<button
								onClick={closeViolationModal}
								className='text-gray-400 hover:text-white'
							>
								✕
							</button>
						</div>
						<div className='mt-4 space-y-3'>
							<select
								value={violationReason}
								onChange={e => setViolationReason(e.target.value)}
								className='w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100'
							>
								<option value=''>Выберите причину</option>
								<option value='Нарушение авторских прав'>
									Нарушение авторских прав
								</option>
								<option value='Нарушение внутренних правил этики'>
									Нарушение внутренних правил этики
								</option>
								<option value='Спам или мошенничество'>
									Спам или мошенничество
								</option>
								<option value='Оскорбления или травля'>
									Оскорбления или травля
								</option>
								<option value='Иное'>Иное</option>
							</select>
							<textarea
								value={violationCustomReason}
								onChange={e => setViolationCustomReason(e.target.value)}
								placeholder='Дополните причину при необходимости'
								rows={3}
								className='w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100'
							/>
						</div>
						<div className='mt-4 flex justify-end gap-2'>
							<button
								onClick={closeViolationModal}
								className='rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-200 hover:bg-gray-800'
								disabled={violationBusy}
							>
								Отмена
							</button>
							<button
								onClick={submitViolationAction}
								className='rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60'
								disabled={
									violationBusy ||
									(!violationReason.trim() && !violationCustomReason.trim())
								}
							>
								Подтвердить
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
