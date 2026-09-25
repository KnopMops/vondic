'use client'

import Link from 'next/link'
import Logo from '@/components/Logo'
import { useEffect, useState } from 'react'
import {
	FiArrowLeft as ArrowLeft,
	FiDownload as Download,
	FiSmartphone as Smartphone,
	FiCheckCircle as Check,
	FiShare2 as Share,
	FiPlusSquare as PlusSquare,
	FiBell as Bell,
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

			<div className='relative z-10 mx-auto max-w-3xl px-6 pt-8 pb-20 md:pt-12 md:pb-28'>
				<Link
					href='/download'
					className='inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors group'
				>
					<ArrowLeft className='h-4 w-4 group-hover:-translate-x-1 transition-transform' />
					Назад к загрузкам
				</Link>

				<div className='mt-8 rounded-2xl bg-[#161b22] border border-[#30363d] p-8 md:p-10 relative overflow-hidden shadow-xl'>
					<div className='absolute inset-0 bg-gradient-to-br from-[#0077FF]/[0.04] to-transparent pointer-events-none' />

					<div className='relative'>
						<div className='flex flex-wrap items-start justify-between gap-4'>
							<div className='w-14 h-14 rounded-2xl bg-[#0077FF]/15 border border-[#0077FF]/30 flex items-center justify-center shadow-sm'>
								<Smartphone className='h-7 w-7 text-[#58a6ff]' />
							</div>
							<span className='inline-flex items-center rounded-full border border-[#0077FF]/30 bg-[#0077FF]/10 px-3 py-1 text-xs font-semibold text-[#58a6ff]'>
								PWA Web App v{m.version}
							</span>
						</div>

						<h1 className='mt-6 text-2xl md:text-3xl font-bold text-white'>
							Вондик для iOS и Android (PWA)
						</h1>
						<p className='mt-3 text-gray-300 leading-relaxed text-sm md:text-base'>
							Полноценное мобильное приложение без установки из App Store или Google Play. Работает на любом телефоне с поддержкой Push-уведомлений и WebRTC звонков.
						</p>

						{/* Feature badges */}
						<div className='mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3'>
							<div className='flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 p-3 text-xs font-medium text-gray-200'>
								<Check className='h-4 w-4 text-emerald-400 shrink-0' />
								100% Бесплатно на iOS
							</div>
							<div className='flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 p-3 text-xs font-medium text-gray-200'>
								<Bell className='h-4 w-4 text-indigo-400 shrink-0' />
								Push-уведомления и звонки
							</div>
							<div className='flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 p-3 text-xs font-medium text-gray-200'>
								<Smartphone className='h-4 w-4 text-purple-400 shrink-0' />
								Без App Store / APK
							</div>
						</div>

						{/* iOS Installation Instructions */}
						<div className='mt-8 rounded-2xl border border-white/10 bg-black/40 p-6 space-y-4'>
							<div className='flex items-center gap-3 text-indigo-400 font-semibold text-base border-b border-white/10 pb-3'>
								<SiApple className='h-6 w-6 text-white' />
								Инструкция по установке на iPhone / iPad (iOS)
							</div>
							<div className='space-y-3 text-sm text-gray-300'>
								<div className='flex items-start gap-3'>
									<span className='flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white font-bold text-xs'>1</span>
									<p>Откройте сайт <span className='text-indigo-300 font-semibold'>vondic.ru</span> в браузере <span className='text-white font-semibold'>Safari</span>.</p>
								</div>
								<div className='flex items-start gap-3'>
									<span className='flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white font-bold text-xs'>2</span>
									<p>Нажмите кнопку <Share className='inline h-4 w-4 text-indigo-400 mx-1 align-middle' /> <span className='text-indigo-300 font-semibold'>«Поделиться»</span> внизу экрана Safari.</p>
								</div>
								<div className='flex items-start gap-3'>
									<span className='flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white font-bold text-xs'>3</span>
									<p>Пролистайте меню вниз и выберите <PlusSquare className='inline h-4 w-4 text-indigo-400 mx-1 align-middle' /> <span className='text-indigo-300 font-semibold'>«На экран Домой»</span>.</p>
								</div>
								<div className='flex items-start gap-3'>
									<span className='flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white font-bold text-xs'>4</span>
									<p>Нажмите <span className='text-indigo-300 font-semibold'>«Добавить»</span>. Приложение появится на рабочем столе с иконкой и поддержкой уведомлений!</p>
								</div>
							</div>
						</div>

						{/* Android Direct APK Section */}
						<div className='mt-6 space-y-3'>
							<h3 className='text-sm font-semibold text-gray-400 uppercase tracking-wider'>Прямое скачивание APK для Android</h3>
							{m.android_available && m.android_download_url ? (
								<a
									href={m.android_download_url}
									className='group flex items-center justify-between gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 transition-all duration-300 hover:bg-emerald-500/20 hover:border-emerald-500/50'
								>
									<div className='flex items-center gap-4'>
										<SiAndroid className='h-8 w-8 text-emerald-400' />
										<div>
											<div className='font-semibold text-white'>Android APK</div>
											<div className='text-sm text-gray-400'>Прямой дистрибутив v{m.version}</div>
										</div>
									</div>
									<span className='inline-flex shrink-0 items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 group-hover:bg-emerald-400 transition-all'>
										<Download className='h-4 w-4' />
										Скачать APK
									</span>
								</a>
							) : (
								<div className='flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-5'>
									<div className='flex items-center gap-4'>
										<SiAndroid className='h-8 w-8 text-emerald-400' />
										<div>
											<div className='font-semibold text-white'>Android PWA</div>
											<div className='text-sm text-gray-400'>Нажмите «Установить» в меню Google Chrome</div>
										</div>
									</div>
									<span className='shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-300'>
										Готово в Chrome
									</span>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
