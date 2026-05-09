import Link from 'next/link'
import { Monitor, ArrowLeft, Download } from 'lucide-react'

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
					<div className='w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-5'>
						<Monitor className='h-7 w-7 text-indigo-300' />
					</div>
					<h1 className='text-2xl md:text-3xl font-bold'>Desktop версия</h1>
					<p className='mt-3 text-gray-400'>
						Приложение для Windows, macOS и Linux находится в разработке.
					</p>
					
					<div className='mt-8 p-6 rounded-2xl bg-gray-800/50 border border-gray-700'>
						<div className='flex items-start gap-4'>
							<Download className='h-6 w-6 text-indigo-400 mt-1' />
							<div>
								<h3 className='font-semibold text-white mb-2'>Скоро доступно</h3>
								<p className='text-gray-400 text-sm'>
									Мы работаем над нативными приложениями для всех популярных платформ. 
									Следите за обновлениями!
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
