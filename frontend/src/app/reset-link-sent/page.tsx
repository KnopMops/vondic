'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { LuMailCheck } from 'react-icons/lu'

function ResetLinkSentContent() {
	const searchParams = useSearchParams()
	const email = searchParams.get('email') || ''

	return (
		<div className='flex min-h-screen items-center justify-center bg-[#0e1117] p-4 text-[#e6edf3] selection:bg-[#0077FF] selection:text-white relative'>
			<div className='w-full max-w-[420px] space-y-6 rounded-2xl bg-[#161b22] border border-[#30363d] p-7 shadow-xl relative z-10 text-center'>
				<div className='flex flex-col items-center justify-center gap-2.5'>
					<div className='relative flex items-center justify-center w-14 h-14 rounded-2xl bg-[#0d1117] border border-[#30363d] shadow-lg shadow-black/40 overflow-hidden p-1.5'>
						<img
							src='/logo.png'
							alt='Вондик'
							className='w-full h-full object-contain drop-shadow'
						/>
					</div>
					<div className='w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mt-2'>
						<LuMailCheck className='w-6 h-6' />
					</div>
					<h1 className='text-2xl font-bold text-white tracking-tight mt-1'>
						Письмо отправлено
					</h1>
					<p className='text-xs text-[#8b949e] max-w-xs leading-relaxed'>
						Мы отправили ссылку для восстановления аккаунта Вондик на{' '}
						<span className='text-white font-medium break-all'>{email || 'ваш email'}</span>
					</p>
				</div>

				<div className='rounded-xl bg-[#0d1117] border border-[#30363d] p-3 text-xs text-[#8b949e]'>
					Если письмо не пришло в течение нескольких минут, проверьте папку «Спам».
				</div>

				<Link
					href='/login'
					className='block w-full rounded-lg bg-[#0077FF] hover:bg-[#0066dd] py-2.5 px-4 text-center text-sm font-semibold text-white transition-colors shadow-sm'
				>
					Вернуться ко входу в Вондик
				</Link>
			</div>
		</div>
	)
}

export default function ResetLinkSentPage() {
	return (
		<Suspense fallback={<div className='min-h-screen bg-[#0e1117]' />}>
			<ResetLinkSentContent />
		</Suspense>
	)
}
