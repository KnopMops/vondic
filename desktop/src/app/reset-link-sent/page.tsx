'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function ResetLinkSentContent() {
	const searchParams = useSearchParams()
	const email = searchParams.get('email') || ''

	return (
		<div className='min-h-screen bg-black text-white flex items-center justify-center'>
			<div className='max-w-md w-full mx-4 rounded-2xl bg-white/5 border border-white/10 p-8 text-center space-y-6'>
				<div className='w-16 h-16 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center'>
					<svg className='w-8 h-8 text-emerald-400' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
						<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' />
					</svg>
				</div>
				<h1 className='text-xl font-semibold'>Ссылка отправлена</h1>
				<p className='text-gray-400 text-sm'>
					Мы отправили ссылку для восстановления аккаунта на{' '}
					<span className='text-white font-medium'>{email}</span>
				</p>
				<p className='text-gray-500 text-xs'>
					Проверьте папку «Спам», если письмо не пришло.
				</p>
				<Link
					href='/login'
					className='inline-block rounded-lg bg-white/10 border border-white/20 px-6 py-2 text-sm text-white hover:bg-white/20 transition'
				>
					Вернуться к входу
				</Link>
			</div>
		</div>
	)
}

export default function ResetLinkSentPage() {
	return (
		<Suspense fallback={<div className='min-h-screen bg-black' />}>
			<ResetLinkSentContent />
		</Suspense>
	)
}
