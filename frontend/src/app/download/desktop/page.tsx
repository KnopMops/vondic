import Link from 'next/link'
import {
	FiArrowLeft as ArrowLeft,
	FiDownload as Download,
	FiExternalLink as ExternalLink,
	FiMonitor as Monitor,
} from 'react-icons/fi'
import { SiApple, SiLinux } from 'react-icons/si'
import { FaWindows } from 'react-icons/fa6'

const DESKTOP_VERSION = 'v1.0.1'
const GITHUB_RELEASE_URL =
	'https://github.com/KnopMops/vondic/releases/tag/vondic-desktop'
const WINDOWS_DOWNLOAD_URL =
	'https://github.com/KnopMops/vondic/releases/download/vondic-desktop/portable.zip'

export default function DesktopDownloadPage() {
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
							{DESKTOP_VERSION}
						</span>
					</div>

					<h1 className='mt-5 text-2xl md:text-3xl font-bold'>Vondic Desktop</h1>
					<p className='mt-3 text-gray-400'>
						Нативное приложение для компьютера. Сейчас доступна загрузка для
						Windows — macOS и Linux появятся позже.
					</p>

					<div className='mt-8 space-y-3'>
						<a
							href={WINDOWS_DOWNLOAD_URL}
							className='group flex items-center justify-between gap-4 rounded-2xl border border-sky-500/30 bg-sky-500/10 p-5 transition-all hover:bg-sky-500/20 hover:border-sky-500/50'
						>
							<div className='flex items-center gap-4'>
								<div className='flex h-12 w-12 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/10'>
									<FaWindows className='h-6 w-6 text-sky-300' />
								</div>
								<div>
									<div className='font-semibold text-white'>Windows</div>
									<div className='text-sm text-gray-400'>
										Установщик .exe · {DESKTOP_VERSION}
									</div>
								</div>
							</div>
							<span className='inline-flex shrink-0 items-center gap-2 rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition-colors group-hover:bg-sky-400'>
								<Download className='h-4 w-4' />
								Скачать
							</span>
						</a>

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
					</div>

					<div className='mt-8 flex flex-wrap gap-3 border-t border-gray-800 pt-6'>
						<a
							href={GITHUB_RELEASE_URL}
							target='_blank'
							rel='noreferrer'
							className='inline-flex items-center gap-2 rounded-full border border-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-gray-600 hover:text-white'
						>
							<ExternalLink className='h-4 w-4' />
							Релиз на GitHub
						</a>
					</div>
				</div>
			</div>
		</div>
	)
}
