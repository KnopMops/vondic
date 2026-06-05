'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
	FiArrowLeft as ArrowLeft,
	FiDownload as Download,
	FiSmartphone as Smartphone,
} from 'react-icons/fi'
import { SiApple, SiAndroid } from 'react-icons/si'
import {
	DEFAULT_APP_DOWNLOADS,
	fetchAppDownloads,
	type AppDownloadsSettings,
} from '@/lib/appDownloads'

export default function MobileDownloadPage() {
	const [settings, setSettings] = useState<AppDownloadsSettings>(
		DEFAULT_APP_DOWNLOADS,
	)

	useEffect(() => {
		fetchAppDownloads().then(setSettings)
	}, [])

	const m = settings.mobile

	return (
		<div className='min-h-screen bg-black text-white selection:bg-indigo-500 selection:text-white overflow-x-hidden'>
			<div className='fixed inset-0 z-0 overflow-hidden pointer-events-none'>
				<div className='absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-emerald-900/20 blur-[120px]' />
				<div className='absolute top-[40%] -right-[10%] w-[40%] h-[60%] rounded-full bg-purple-900/20 blur-[120px]' />
			</div>

			<div className='relative z-10 mx-auto max-w-3xl px-6 py-16'>
				<Link
					href='/download'
					className='inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white'
				>
					<ArrowLeft className='h-4 w-4' />
					Назад к загрузкам
				</Link>

				<div className='mt-10 rounded-3xl bg-gray-900/40 border border-gray-800 p-8'>
					<div className='flex flex-wrap items-start justify-between gap-4'>
						<div className='w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center'>
							<Smartphone className='h-7 w-7 text-emerald-300' />
						</div>
						<span className='inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-200'>
							{m.version}
						</span>
					</div>
					<h1 className='mt-5 text-2xl md:text-3xl font-bold'>Vondic Mobile</h1>
					<p className='mt-3 text-gray-400'>
						Мобильное приложение для iOS и Android.
					</p>

					<div className='mt-8 space-y-3'>
						{m.android_available && m.android_download_url ? (
							<a
								href={m.android_download_url}
								className='group flex items-center justify-between gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 transition-all hover:bg-emerald-500/20'
							>
								<div className='flex items-center gap-4'>
									<SiAndroid className='h-8 w-8 text-emerald-300' />
									<div>
										<div className='font-semibold text-white'>Android</div>
										<div className='text-sm text-gray-400'>{m.version}</div>
									</div>
								</div>
								<span className='inline-flex shrink-0 items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white'>
									<Download className='h-4 w-4' />
									Скачать
								</span>
							</a>
						) : (
							<div className='flex items-center justify-between gap-4 rounded-2xl border border-gray-800 bg-gray-800/30 p-5 opacity-70'>
								<div className='flex items-center gap-4'>
									<SiAndroid className='h-8 w-8 text-gray-500' />
									<div>
										<div className='font-semibold text-gray-300'>Android</div>
										<div className='text-sm text-gray-500'>Пока недоступно</div>
									</div>
								</div>
								<span className='shrink-0 rounded-full border border-gray-700 px-4 py-2 text-sm text-gray-500'>
									Скоро
								</span>
							</div>
						)}

						{m.ios_available && m.ios_download_url ? (
							<a
								href={m.ios_download_url}
								className='group flex items-center justify-between gap-4 rounded-2xl border border-gray-700 bg-gray-800/40 p-5 transition-all hover:border-gray-600'
							>
								<div className='flex items-center gap-4'>
									<SiApple className='h-8 w-8 text-gray-200' />
									<div>
										<div className='font-semibold text-white'>iOS</div>
										<div className='text-sm text-gray-400'>{m.version}</div>
									</div>
								</div>
								<span className='inline-flex shrink-0 items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white'>
									<Download className='h-4 w-4' />
									Скачать
								</span>
							</a>
						) : (
							<div className='flex items-center justify-between gap-4 rounded-2xl border border-gray-800 bg-gray-800/30 p-5 opacity-70'>
								<div className='flex items-center gap-4'>
									<SiApple className='h-8 w-8 text-gray-500' />
									<div>
										<div className='font-semibold text-gray-300'>iOS</div>
										<div className='text-sm text-gray-500'>Пока недоступно</div>
									</div>
								</div>
								<span className='shrink-0 rounded-full border border-gray-700 px-4 py-2 text-sm text-gray-500'>
									Скоро
								</span>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}
