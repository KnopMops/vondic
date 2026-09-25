'use client'

import Link from 'next/link'
import Logo from '@/components/Logo'
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
		<div className='min-h-screen bg-[#0e1117] text-[#e6edf3] selection:bg-[#0077FF] selection:text-white overflow-x-hidden font-sans relative'>
			<div className='fixed inset-0 z-0 overflow-hidden pointer-events-none'>
				<div className='absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-[#0077FF]/10 blur-[140px] rounded-full' />
			</div>

			<nav className='relative z-20 border-b border-[#30363d] bg-[#161b22]/80 backdrop-blur-md sticky top-0'>
				<div className='max-w-6xl mx-auto px-6 py-4 flex items-center justify-between'>
					<Link href='/' className='flex items-center gap-3 group'>
						<div className='w-10 h-10 rounded-xl bg-[#0d1117] border border-[#30363d] p-1 flex items-center justify-center shadow-sm group-hover:border-[#0077FF] transition-colors'>
							<BrandLogo size={32} />
						</div>
						<span className='text-lg font-bold text-white tracking-tight'>
							Вондик
						</span>
					</Link>
					<div className='flex items-center gap-3'>
						<Link
							href='/login'
							className='px-3.5 py-1.5 text-xs font-medium text-white rounded-lg border border-[#30363d] bg-[#21262d] hover:bg-[#30363d] hover:border-[#8b949e]/40 transition-colors'
						>
							Войти
						</Link>
						<Link
							href='/register'
							className='px-3.5 py-1.5 text-xs font-medium text-white rounded-lg bg-[#0077FF] hover:bg-[#0066dd] shadow-sm transition-colors'
						>
							Регистрация
						</Link>
					</div>
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

				<div className='mt-10 rounded-2xl bg-[#161b22] border border-[#30363d] p-8 md:p-10 relative overflow-hidden shadow-xl'>
					<div className='absolute inset-0 bg-gradient-to-br from-[#0077FF]/[0.04] to-transparent pointer-events-none' />

					<div className='relative'>
						<div className='flex flex-wrap items-start justify-between gap-4'>
							<div className='w-14 h-14 rounded-2xl bg-[#0077FF]/15 border border-[#0077FF]/30 flex items-center justify-center'>
								<Monitor className='h-7 w-7 text-[#58a6ff]' />
							</div>
							<span className='inline-flex items-center rounded-full border border-[#0077FF]/30 bg-[#0077FF]/10 px-3 py-1 text-xs font-semibold text-[#58a6ff]'>
								v{d.version}
							</span>
						</div>

						<h1 className='mt-6 text-2xl md:text-3xl font-bold'>Вондик Desktop</h1>
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
