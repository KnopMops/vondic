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
		<div className='min-h-screen bg-black text-white selection:bg-indigo-500 selection:text-white overflow-x-hidden'>
			<div className='fixed inset-0 z-0 overflow-hidden pointer-events-none'>
				<div className='absolute -top-[30%] -left-[15%] w-[60%] h-[60%] rounded-full bg-indigo-600/15 blur-[150px]' />
				<div className='absolute top-[30%] -right-[10%] w-[50%] h-[50%] rounded-full bg-purple-600/15 blur-[150px]' />
			</div>

			<nav className='relative z-10 mx-auto max-w-3xl px-6 py-5 flex items-center justify-between'>
				<Link href='/' className='flex items-center gap-2.5'>
					<Logo />
					<span className='text-lg font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent'>
						Вондик
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

			<div className='relative z-10 mx-auto max-w-3xl px-6 pt-8 pb-20 md:pt-12 md:pb-28'>
				<Link
					href='/download'
					className='inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors group'
				>
					<ArrowLeft className='h-4 w-4 group-hover:-translate-x-1 transition-transform' />
					Назад к загрузкам
				</Link>

				<div className='mt-8 rounded-3xl bg-gray-900/60 border border-indigo-500/20 p-8 md:p-10 relative overflow-hidden shadow-2xl'>
					<div className='absolute inset-0 bg-gradient-to-br from-indigo-500/[0.06] via-purple-500/[0.03] to-transparent' />

					<div className='relative'>
						<div className='flex flex-wrap items-start justify-between gap-4'>
							<div className='w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600/30 to-purple-600/30 border border-indigo-500/30 flex items-center justify-center shadow-lg shadow-indigo-500/20'>
								<Smartphone className='h-7 w-7 text-indigo-300' />
							</div>
							<span className='inline-flex items-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-sm font-semibold text-indigo-300'>
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
