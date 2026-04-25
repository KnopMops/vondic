'use client'

import { useAuth } from '@/lib/AuthContext'
import {
	FiCheckCircle as CheckCircle,
	FiRefreshCw as RefreshCw,
	FiXCircle as XCircle,
} from 'react-icons/fi'
import { LuBot as Bot, LuLoader as Loader2 } from 'react-icons/lu'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Bot = {
	id: string
	name: string
	description?: string
	avatar_url?: string
	is_active: number
	is_verified: number
	created_at: string
	updated_at: string
}

export default function AdminBotsPage() {
	const { user, logout } = useAuth()
	const router = useRouter()
	const [bots, setBots] = useState<Bot[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [verifying, setVerifying] = useState<string | null>(null)

	const backendUrl =
		process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:5050'

	useEffect(() => {
		if (!user) {
			router.push('/login')
			return
		}
		if (user.role !== 'Admin' && user.role !== 'admin') {
			router.push('/')
			return
		}
		loadBots()
	}, [user])

	const loadBots = async () => {
		setLoading(true)
		setError(null)
		try {
			const token = localStorage.getItem('access_token')
			const res = await fetch(`${backendUrl}/api/v1/bots`, {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			})
			if (!res.ok) {
				throw new Error('Failed to load bots')
			}
			const data = await res.json()
			setBots(data)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Unknown error')
		} finally {
			setLoading(false)
		}
	}

	const toggleVerification = async (botId: string, currentVerified: number) => {
		setVerifying(botId)
		try {
			const token = localStorage.getItem('access_token')
			const res = await fetch(`${backendUrl}/api/v1/bots/${botId}/verify`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					is_verified: currentVerified ? 0 : 1,
				}),
			})
			if (!res.ok) {
				throw new Error('Failed to update verification')
			}
			setBots(prev =>
				prev.map(bot =>
					bot.id === botId
						? { ...bot, is_verified: currentVerified ? 0 : 1 }
						: bot,
				),
			)
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Failed to update')
		} finally {
			setVerifying(null)
		}
	}

	if (!user || user.role !== 'Admin') {
		return null
	}

	return (
		<div className='min-h-screen bg-[#0f0f0f]'>
			<div className='container mx-auto px-4 py-8'>
				<div className='mb-6 flex items-center justify-between'>
					<div className='flex items-center gap-3'>
						<Bot className='h-8 w-8 text-emerald-500' />
						<h1 className='text-2xl font-bold text-white'>
							Управление ботами
						</h1>
					</div>
					<button
						onClick={loadBots}
						disabled={loading}
						className='flex items-center gap-2 rounded-lg bg-[#1e1f22] px-4 py-2 text-white hover:bg-[#2b2d31] disabled:opacity-50'
					>
						<RefreshCw
							className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
						/>
						Обновить
					</button>
				</div>

				{loading && (
					<div className='flex items-center justify-center py-12'>
						<Loader2 className='h-8 w-8 animate-spin text-emerald-500' />
					</div>
				)}

				{error && (
					<div className='rounded-lg bg-red-500/10 p-4 text-red-400'>
						{error}
					</div>
				)}

				{!loading && !error && bots.length === 0 && (
					<div className='rounded-lg bg-[#1e1f22] p-8 text-center text-gray-400'>
						Боты не найдены
					</div>
				)}

				<div className='grid gap-4'>
					{bots.map(bot => (
						<div
							key={bot.id}
							className='rounded-lg border border-[#1e1f22] bg-[#1e1f22]/50 p-4'
						>
							<div className='flex items-start justify-between'>
								<div className='flex items-start gap-4'>
									{bot.avatar_url ? (
										<img
											src={bot.avatar_url}
											alt={bot.name}
											className='h-16 w-16 rounded-full object-cover'
										/>
									) : (
										<div className='flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white text-xl font-bold'>
											{bot.name.charAt(0).toUpperCase()}
										</div>
									)}
									<div>
										<div className='flex items-center gap-2'>
											<h3 className='text-lg font-semibold text-white'>
												{bot.name}
											</h3>
											{bot.is_verified ? (
												<CheckCircle className='h-5 w-5 text-blue-500' />
											) : (
												<XCircle className='h-5 w-5 text-gray-500' />
											)}
										</div>
										{bot.description && (
											<p className='mt-1 text-sm text-gray-400'>
												{bot.description}
											</p>
										)}
										<div className='mt-2 flex items-center gap-4 text-xs text-gray-500'>
											<span>ID: {bot.id}</span>
											<span>
												Статус:{' '}
												{bot.is_active ? (
													<span className='text-green-400'>Активен</span>
												) : (
													<span className='text-red-400'>Неактивен</span>
												)}
											</span>
											<span>
												Создан:{' '}
												{new Date(bot.created_at).toLocaleDateString('ru-RU')}
											</span>
										</div>
									</div>
								</div>
								<button
									onClick={() => toggleVerification(bot.id, bot.is_verified)}
									disabled={verifying === bot.id}
									className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
										bot.is_verified
											? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
											: 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
									} disabled:opacity-50`}
								>
									{verifying === bot.id ? (
										<Loader2 className='h-4 w-4 animate-spin' />
									) : bot.is_verified ? (
										<>
											<XCircle className='h-4 w-4' />
											Снять верификацию
										</>
									) : (
										<>
											<CheckCircle className='h-4 w-4' />
											Верифицировать
										</>
									)}
								</button>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	)
}
