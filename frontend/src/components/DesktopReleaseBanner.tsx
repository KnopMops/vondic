'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { FiDownload as Download, FiMonitor as Monitor, FiX as X } from 'react-icons/fi'
import { fetchAppDownloads } from '@/lib/appDownloads'

export default function DesktopReleaseBanner() {
	const pathname = usePathname()
	const [visible, setVisible] = useState(false)
	const [version, setVersion] = useState('')

	useEffect(() => {
		if (pathname?.startsWith('/download/desktop')) return

		let cancelled = false
		;(async () => {
			const settings = await fetchAppDownloads()
			const v = settings.desktop.version || ''
			if (cancelled) return
			setVersion(v)
			const storageKey = `vondic-banner-desktop-${v}-dismissed`
			try {
				if (localStorage.getItem(storageKey) === '1') return
			} catch {
				// private mode / blocked storage
			}
			if (!settings.desktop.windows_available) return
			setVisible(true)
		})()

		return () => {
			cancelled = true
		}
	}, [pathname])

	const dismiss = () => {
		setVisible(false)
		try {
			localStorage.setItem(
				`vondic-banner-desktop-${version}-dismissed`,
				'1',
			)
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
				className='fixed top-0 left-0 right-0 z-[100] border-b border-[#30363d] bg-[#161b22]/95 backdrop-blur-md'
			>
				<div className='mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6'>
					<div className='hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#0077FF]/30 bg-[#0077FF]/15'>
						<Monitor className='h-4 w-4 text-[#0077FF]' />
					</div>

					<p className='min-w-0 flex-1 text-sm leading-snug text-[#e6edf3] sm:text-[15px]'>
						<span className='font-semibold text-white'>
							Вышла desktop-версия Вондик
						</span>
						<span className='hidden sm:inline'> — </span>
						<span className='block sm:inline text-[#8b949e]'>
							доступна для Windows{version ? ` (${version})` : ''}
						</span>
					</p>

					<Link
						href='/download/desktop'
						onClick={dismiss}
						className='inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#0077FF] px-4 py-1.5 text-xs sm:text-sm font-semibold text-white transition-colors hover:bg-[#0066dd] shadow-sm shadow-[#0077FF]/25'
					>
						<Download className='h-3.5 w-3.5' />
						Скачать
					</Link>

					<button
						type='button'
						onClick={dismiss}
						aria-label='Закрыть уведомление'
						className='shrink-0 rounded-lg p-1.5 text-[#8b949e] transition-colors hover:bg-white/10 hover:text-white cursor-pointer'
					>
						<X className='h-4 w-4' />
					</button>
				</div>
			</div>
		</>
	)
}
