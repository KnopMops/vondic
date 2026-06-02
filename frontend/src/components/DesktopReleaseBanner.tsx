'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { FiDownload as Download, FiMonitor as Monitor, FiX as X } from 'react-icons/fi'

const BANNER_STORAGE_KEY = 'vondic-banner-desktop-v1.0.0-dismissed'
const DESKTOP_VERSION = 'v1.0.1'

export default function DesktopReleaseBanner() {
	const pathname = usePathname()
	const [visible, setVisible] = useState(false)

	useEffect(() => {
		if (pathname?.startsWith('/download/desktop')) return

		try {
			if (localStorage.getItem(BANNER_STORAGE_KEY) === '1') return
		} catch {
			// private mode / blocked storage
		}

		setVisible(true)
	}, [pathname])

	const dismiss = () => {
		setVisible(false)
		try {
			localStorage.setItem(BANNER_STORAGE_KEY, '1')
		} catch {
			// ignore
		}
	}

	if (!visible) return null

	return (
		<>
			<div aria-hidden className='h-[52px] shrink-0 sm:h-[56px]' />
			<div
				role='status'
				className='fixed top-0 left-0 right-0 z-[100] border-b border-indigo-500/30 bg-gradient-to-r from-indigo-950/95 via-indigo-900/95 to-purple-950/95 backdrop-blur-md'
			>
				<div className='mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6'>
					<div className='hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-indigo-400/30 bg-indigo-500/20'>
						<Monitor className='h-4 w-4 text-indigo-200' />
					</div>

					<p className='min-w-0 flex-1 text-sm leading-snug text-indigo-50 sm:text-[15px]'>
						<span className='font-semibold text-white'>
							Вышла desktop-версия Вондик
						</span>
						<span className='hidden sm:inline'> — </span>
						<span className='block sm:inline text-indigo-100/90'>
							доступна для Windows ({DESKTOP_VERSION})
						</span>
					</p>

					<Link
						href='/download/desktop'
						onClick={dismiss}
						className='inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold text-indigo-950 transition-colors hover:bg-indigo-50'
					>
						<Download className='h-3.5 w-3.5' />
						Скачать
					</Link>

					<button
						type='button'
						onClick={dismiss}
						aria-label='Закрыть уведомление'
						className='shrink-0 rounded-lg p-1.5 text-indigo-200/80 transition-colors hover:bg-white/10 hover:text-white'
					>
						<X className='h-4 w-4' />
					</button>
				</div>
			</div>
		</>
	)
}
