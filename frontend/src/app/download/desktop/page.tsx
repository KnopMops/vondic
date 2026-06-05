'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
	FiArrowLeft as ArrowLeft,
	FiDownload as Download,
	FiExternalLink as ExternalLink,
	FiMonitor as Monitor,
} from 'react-icons/fi'
import { SiApple, SiLinux } from 'react-icons/si'
import { FaWindows } from 'react-icons/fa6'
import {
	DEFAULT_APP_DOWNLOADS,
	fetchAppDownloads,
	type AppDownloadsSettings,
} from '@/lib/appDownloads'

export default function DesktopDownloadPage() {
	const [settings, setSettings] = useState<AppDownloadsSettings>(
		DEFAULT_APP_DOWNLOADS,
	)

	useEffect(() => {
		fetchAppDownloads().then(setSettings)
	}, [])

	const d = settings.desktop

	return (
		<div className='min-h-screen bg-black text-white selection:bg-indigo-500 selection:text-white overflow-x-hidden'>
			<div className='fixed inset-0 z-0 overflow-hidden pointer-events-none'>
				<div className='absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-indigo-900/20 blur-[120px]' />
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
						<div className='w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center'>
							<Monitor className='h-7 w-7 text-indigo-300' />
						</div>
						<span className='inline-flex items-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-sm font-medium text-indigo-200'>
							{d.version}
						</span>
					</div>

					<h1 className='mt-5 text-2xl md:text-3xl font-bold'>Vondic Desktop</h1>
					<p className='mt-3 text-gray-400'>
						Нативное приложение для компьютера. Скачивание зависит от платформы —
						настройки обновляются администратором.
					</p>

					<div className='mt-8 space-y-3'>
						{d.windows_available && d.windows_download_url ? (
							<a
								href={d.windows_download_url}
								className='group flex items-center justify-between gap-4 rounded-2xl border border-sky-500/30 bg-sky-500/10 p-5 transition-all hover:bg-sky-500/20 hover:border-sky-500/50'
							>
								<div className='flex items-center gap-4'>
									<div className='flex h-12 w-12 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/10'>
										<FaWindows className='h-6 w-6 text-sky-300' />
									</div>
									<div>
										<div className='font-semibold text-white'>Windows</div>
										<div className='text-sm text-gray-400'>
											Установщик · {d.version}
										</div>
									</div>
								</div>
								<span className='inline-flex shrink-0 items-center gap-2 rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition-colors group-hover:bg-sky-400'>
									<Download className='h-4 w-4' />
									Скачать
								</span>
							</a>
						) : (
							<div className='flex items-center justify-between gap-4 rounded-2xl border border-gray-800 bg-gray-800/30 p-5 opacity-70'>
								<div className='flex items-center gap-4'>
									<div className='flex h-12 w-12 items-center justify-center rounded-xl border border-gray-700 bg-gray-800/50'>
										<FaWindows className='h-6 w-6 text-gray-400' />
									</div>
									<div>
										<div className='font-semibold text-gray-300'>Windows</div>
										<div className='text-sm text-gray-500'>Пока недоступно</div>
									</div>
								</div>
								<span className='shrink-0 rounded-full border border-gray-700 px-4 py-2 text-sm text-gray-500'>
									Скоро
								</span>
							</div>
						)}

						{d.macos_available && d.macos_download_url ? (
							<a
								href={d.macos_download_url}
								className='group flex items-center justify-between gap-4 rounded-2xl border border-gray-700 bg-gray-800/40 p-5 transition-all hover:border-gray-600'
							>
								<div className='flex items-center gap-4'>
									<div className='flex h-12 w-12 items-center justify-center rounded-xl border border-gray-600 bg-gray-800/50'>
										<SiApple className='h-6 w-6 text-gray-200' />
									</div>
									<div>
										<div className='font-semibold text-white'>macOS</div>
										<div className='text-sm text-gray-400'>{d.version}</div>
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
									<div className='flex h-12 w-12 items-center justify-center rounded-xl border border-gray-700 bg-gray-800/50'>
										<SiApple className='h-6 w-6 text-gray-400' />
									</div>
									<div>
										<div className='font-semibold text-gray-300'>macOS</div>
										<div className='text-sm text-gray-500'>Пока недоступно</div>
									</div>
								</div>
								<span className='shrink-0 rounded-full border border-gray-700 px-4 py-2 text-sm text-gray-500'>
									Скоро
								</span>
							</div>
						)}

						{d.linux_available && d.linux_download_url ? (
							<a
								href={d.linux_download_url}
								className='group flex items-center justify-between gap-4 rounded-2xl border border-gray-700 bg-gray-800/40 p-5 transition-all hover:border-gray-600'
							>
								<div className='flex items-center gap-4'>
									<div className='flex h-12 w-12 items-center justify-center rounded-xl border border-gray-600 bg-gray-800/50'>
										<SiLinux className='h-6 w-6 text-gray-200' />
									</div>
									<div>
										<div className='font-semibold text-white'>Linux</div>
										<div className='text-sm text-gray-400'>{d.version}</div>
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
									<div className='flex h-12 w-12 items-center justify-center rounded-xl border border-gray-700 bg-gray-800/50'>
										<SiLinux className='h-6 w-6 text-gray-400' />
									</div>
									<div>
										<div className='font-semibold text-gray-300'>Linux</div>
										<div className='text-sm text-gray-500'>Пока недоступно</div>
									</div>
								</div>
								<span className='shrink-0 rounded-full border border-gray-700 px-4 py-2 text-sm text-gray-500'>
									Скоро
								</span>
							</div>
						)}
					</div>

					{d.github_release_url ? (
						<div className='mt-8 flex flex-wrap gap-3 border-t border-gray-800 pt-6'>
							<a
								href={d.github_release_url}
								target='_blank'
								rel='noreferrer'
								className='inline-flex items-center gap-2 rounded-full border border-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-gray-600 hover:text-white'
							>
								<ExternalLink className='h-4 w-4' />
								Релиз на GitHub
							</a>
						</div>
					) : null}
				</div>
			</div>
		</div>
	)
}
