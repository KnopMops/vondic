'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import BrandLogo from './social/BrandLogo'
import { LuArrowLeft as ArrowLeft, LuHouse as Home } from 'react-icons/lu'

interface ErrorPageProps {
	code: number
	title: string
	message: string
	showRedirect?: boolean
}

export const ErrorPage: React.FC<ErrorPageProps> = ({
	code,
	title,
	message,
	showRedirect = true,
}) => {
	const router = useRouter()
	const [timeLeft, setTimeLeft] = useState(10)

	useEffect(() => {
		if (!showRedirect) return

		const timer = setInterval(() => {
			setTimeLeft(prev => {
				if (prev <= 1) {
					clearInterval(timer)
					router.push('/')
					return 0
				}
				return prev - 1
			})
		}, 1000)

		return () => clearInterval(timer)
	}, [showRedirect, router])

	const goBack = () => {
		router.back()
	}

	return (
		<div className='min-h-screen bg-[#0e1117] flex flex-col items-center justify-center p-4 text-[#e6edf3] selection:bg-[#0077FF] selection:text-white'>
			<div className='max-w-[460px] w-full text-center space-y-6 rounded-2xl bg-[#161b22] border border-[#30363d] p-8 shadow-xl animate-in fade-in duration-300'>
				<div className='relative inline-block mx-auto'>
					<div className='w-20 h-20 bg-[#0d1117] border border-[#30363d] rounded-2xl flex items-center justify-center p-3 shadow-md'>
						<BrandLogo size={56} />
					</div>
					<div className='absolute -top-2 -right-2 bg-[#0077FF] text-white text-xs font-bold px-2 py-0.5 rounded-full border-2 border-[#161b22]'>
						{code}
					</div>
				</div>

				<div className='space-y-2'>
					<h1 className='text-2xl font-bold text-white tracking-tight'>
						{title}
					</h1>
					<p className='text-xs text-[#8b949e] leading-relaxed'>{message}</p>
				</div>

				{showRedirect && (
					<div className='bg-[#0d1117] border border-[#30363d] rounded-xl p-3'>
						<p className='text-xs text-[#8b949e]'>
							Автоматический возврат на главную через{' '}
							<span className='text-[#58a6ff] font-mono font-bold'>{timeLeft}</span>{' '}
							сек.
						</p>
					</div>
				)}

				<div className='flex flex-col sm:flex-row items-center justify-center gap-3 pt-2'>
					<button
						onClick={goBack}
						className='w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-white rounded-lg transition-colors text-xs font-medium'
					>
						<ArrowLeft className='w-4 h-4' />
						Назад
					</button>
					<button
						onClick={() => router.push('/')}
						className='w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-[#0077FF] hover:bg-[#0066dd] text-white rounded-lg transition-colors text-xs font-medium shadow-sm'
					>
						<Home className='w-4 h-4' />
						На главную
					</button>
				</div>
			</div>
		</div>
	)
}
