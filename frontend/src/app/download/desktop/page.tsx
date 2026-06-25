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
				<div className='absolute -top-[30%] -left-[15%] w-[60%] h-[60%] rounded-full bg-indigo-600/15 blur-[150px]' />
				<div className='absolute top-[30%] -right-[10%] w-[50%] h-[50%] rounded-full bg-purple-600/15 blur-[150px]' />
			</div>

			<nav className='relative z-10 mx-auto max-w-3xl px-6 py-5 flex items-center justify-between'>
				<Link href='/' className='flex items-center gap-2.5'>
					<div className='w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20'>
						<span className='text-white font-bold text-sm'>V</span>
					</div>
					<span className='text-lg font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent'>
						Vondic
					</span>
				</Link>
				<div className='flex items-center gap-3'>
					<Link
						href='/login'
						className='px-4 py-2 text-sm font-medium text-gray-300 hover:text-white rounded-full border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all'
					>
						Войти
					</Link>
					<Link
						href='/register'
						className='px-4 py-2 text-sm font-medium text-white rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/25 transition-all'
					>
						Регистрация
					</Link>
				</div>
			</nav>

			<div className='relative z-10 mx-auto max-w-3xl px-6 pt-8 pb-20 md:pt-14 md:pb-28'>
				<Link
					href='/download'
					className='inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors group'
				>
					<ArrowLeft className='h-4 w-4 group-hover:-translate-x-1 transition-transform' />
					Назад к загрузкам
				</Link>

				<div className='mt-10 rounded-3xl bg-gray-900/50 border border-white/[0.06] p-8 md:p-10 relative overflow-hidden'>
					<div className='absolute inset-0 bg-gradient-to-br from-indigo-500/[0.04] to-transparent' />

					<div className='relative'>
						<div className='flex flex-wrap items-start justify-between gap-4'>
							<div className='w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600/20 to-indigo-800/20 border border-indigo-500/20 flex items-center justify-center'>
								<Monitor className='h-7 w-7 text-indigo-400' />
							</div>
							<span className='inline-flex items-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-sm font-medium text-indigo-300'>
								v{d.version}
							</span>
						</div>

						<h1 className='mt-6 text-2xl md:text-3xl font-bold'>Vondic Desktop</h1>
						<p className='mt-3 text-gray-400 leading-relaxed'>
							Нативное приложение для компьютера. Скачивание зависит от платформы —
							настройки обновляются администратором.
						</p>

						<div className='mt-8 space-y-3'>
							{d.windows_available && d.windows_download_url ? (
								<a
									href={d.windows_download_url}
									className='group flex items-center justify-between gap-4 rounded-2xl border border-sky-500/20 bg-sky-500/[0.06] p-5 transition-all duration-300 hover:bg-sky-500/[0.12] hover:border-sky-500/40 hover:shadow-lg hover:shadow-sky-500/10'
								>
									<div className='flex items-center gap-4'>
										<div className='flex h-12 w-12 items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/10'>
											<FaWindows className='h-5 w-5 text-sky-400' />
										</div>
										<div>
											<div className='font-semibold text-white'>Windows</div>
											<div className='text-sm text-gray-400'>
												Установщик · v{d.version}
											</div>
										</div>
									</div>
									<span className='inline-flex shrink-0 items-center gap-2 rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 group-hover:bg-sky-400 group-hover:shadow-sky-400/30 transition-all'>
										<Download className='h-4 w-4' />
										Скачать
									</span>
								</a>
							) : (
								<div className='flex items-center justify-between gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 opacity-60'>
									<div className='flex items-center gap-4'>
										<div className='flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03]'>
											<FaWindows className='h-5 w-5 text-gray-500' />
										</div>
										<div>
											<div className='font-semibold text-gray-300'>Windows</div>
											<div className='text-sm text-gray-500'>Пока недоступно</div>
										</div>
									</div>
									<span className='shrink-0 rounded-full border border-white/[0.08] px-4 py-2 text-sm text-gray-500'>
										Скоро
									</span>
								</div>
							)}

							{d.macos_available && d.macos_download_url ? (
								<a
									href={d.macos_download_url}
									className='group flex items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 transition-all duration-300 hover:border-white/[0.15] hover:bg-white/[0.06] hover:shadow-lg hover:shadow-white/[0.03]'
								>
									<div className='flex items-center gap-4'>
										<div className='flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04]'>
											<SiApple className='h-5 w-5 text-gray-200' />
										</div>
										<div>
											<div className='font-semibold text-white'>macOS</div>
											<div className='text-sm text-gray-400'>v{d.version}</div>
										</div>
									</div>
									<span className='inline-flex shrink-0 items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white group-hover:bg-white/15 transition-all'>
										<Download className='h-4 w-4' />
										Скачать
									</span>
								</a>
							) : (
								<div className='flex items-center justify-between gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 opacity-60'>
									<div className='flex items-center gap-4'>
										<div className='flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03]'>
											<SiApple className='h-5 w-5 text-gray-500' />
										</div>
										<div>
											<div className='font-semibold text-gray-300'>macOS</div>
											<div className='text-sm text-gray-500'>Пока недоступно</div>
										</div>
									</div>
									<span className='shrink-0 rounded-full border border-white/[0.08] px-4 py-2 text-sm text-gray-500'>
										Скоро
									</span>
								</div>
							)}

							{d.linux_available && d.linux_download_url ? (
								<a
									href={d.linux_download_url}
									className='group flex items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 transition-all duration-300 hover:border-white/[0.15] hover:bg-white/[0.06] hover:shadow-lg hover:shadow-white/[0.03]'
								>
									<div className='flex items-center gap-4'>
										<div className='flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04]'>
											<SiLinux className='h-5 w-5 text-gray-200' />
										</div>
										<div>
											<div className='font-semibold text-white'>Linux</div>
											<div className='text-sm text-gray-400'>v{d.version}</div>
										</div>
									</div>
									<span className='inline-flex shrink-0 items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white group-hover:bg-white/15 transition-all'>
										<Download className='h-4 w-4' />
										Скачать
									</span>
								</a>
							) : (
								<div className='flex items-center justify-between gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 opacity-60'>
									<div className='flex items-center gap-4'>
										<div className='flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03]'>
											<SiLinux className='h-5 w-5 text-gray-500' />
										</div>
										<div>
											<div className='font-semibold text-gray-300'>Linux</div>
											<div className='text-sm text-gray-500'>Пока недоступно</div>
										</div>
									</div>
									<span className='shrink-0 rounded-full border border-white/[0.08] px-4 py-2 text-sm text-gray-500'>
										Скоро
									</span>
								</div>
							)}
						</div>

						{d.github_release_url && (
							<div className='mt-8 flex flex-wrap gap-3 border-t border-white/[0.06] pt-6'>
								<a
									href={d.github_release_url}
									target='_blank'
									rel='noreferrer'
									className='inline-flex items-center gap-2 rounded-full border border-white/[0.08] px-4 py-2 text-sm text-gray-400 transition-all hover:border-white/[0.15] hover:text-white hover:bg-white/[0.03]'
								>
									<ExternalLink className='h-4 w-4' />
									Релиз на GitHub
								</a>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}
