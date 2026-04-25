'use client'
import Header from '@/components/social/Header'
import Sidebar from '@/components/social/Sidebar'
import { useAuth } from '@/lib/AuthContext'
import { fetchUser } from '@/lib/features/authSlice'
import { useAppDispatch } from '@/lib/hooks'
import { FiCheckCircle as CheckCircle } from 'react-icons/fi'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function ShopSuccessPage() {
	const { user } = useAuth()
	const dispatch = useAppDispatch()
	const [confirming, setConfirming] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		const params = new URLSearchParams(window.location.search)
		const sessionId = params.get('session_id')
		const confirm = async () => {
			if (!sessionId) {
				dispatch(fetchUser())
				return
			}
			setConfirming(true)
			setError(null)
			try {
				const backendUrl =
					process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'
				const res = await fetch(`${backendUrl}/api/v1/payments/confirm-coins`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ session_id: sessionId }),
				})
				if (!res.ok) {
					const text = await res.text()
					throw new Error(text || 'Failed to confirm payment')
				}
				await res.json()
				dispatch(fetchUser())
			} catch (e: any) {
				setError(e.message || 'Ошибка подтверждения оплаты')
			} finally {
				setConfirming(false)
			}
		}
		confirm()
	}, [dispatch])

	return (
		<div className='min-h-screen bg-black text-white selection:bg-indigo-500 selection:text-white overflow-x-hidden relative'>
			<div className='fixed inset-0 z-0 overflow-hidden pointer-events-none'>
				<div className='absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-emerald-900/20 blur-[120px]' />
				<div className='absolute top-[40%] -right-[10%] w-[40%] h-[60%] rounded-full bg-indigo-900/20 blur-[120px]' />
				<div className='absolute bottom-[10%] left-[20%] w-[30%] h-[30%] rounded-full bg-purple-900/10 blur-[100px]' />
			</div>

			<div className='relative z-20'>
				<Header email={user?.email} onLogout={() => {}} />
			</div>

			<div className='relative z-10 mx-auto flex max-w-7xl pt-6'>
				<Sidebar />
				<main className='flex-1 p-4 sm:p-6 lg:p-8'>
					<div className='mx-auto max-w-3xl'>
						<div className='rounded-2xl border border-gray-200 bg-white/90 p-8 shadow-sm dark:border-gray-700 dark:bg-gray-800/90'>
							<div className='flex items-start gap-4'>
								<CheckCircle className='h-8 w-8 text-emerald-600 dark:text-emerald-400' />
								<div>
									<h1 className='text-2xl font-bold text-gray-900 dark:text-white'>
										Оплата прошла успешно
									</h1>
									<p className='mt-2 text-gray-600 dark:text-gray-300'>
										Спасибо за покупку Вондик Coins. Монеты зачисляются
										автоматически после подтверждения оплаты.
									</p>
									{confirming && (
										<p className='mt-2 text-sm text-indigo-600 dark:text-indigo-400'>
											Подтверждаем оплату…
										</p>
									)}
									{error && (
										<p className='mt-2 text-sm text-red-600 dark:text-red-400'>
											{error}
										</p>
									)}
								</div>
							</div>

							<div className='mt-6 flex gap-3'>
								<Link
									href='/shop'
									className='rounded-xl bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700'
								>
									Вернуться в магазин
								</Link>
								<Link
									href='/feed'
									className='rounded-xl border border-gray-300 px-4 py-2 text-gray-900 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700'
								>
									Перейти в ленту
								</Link>
							</div>

							<div className='mt-4 text-sm text-gray-500 dark:text-gray-400'>
								Ваш текущий баланс: {user?.balance ?? 0} coins
							</div>
						</div>
					</div>
				</main>
			</div>
		</div>
	)
}
