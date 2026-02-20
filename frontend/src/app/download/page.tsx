import Link from 'next/link'
import { Github, Monitor, Smartphone } from 'lucide-react'

export default function DownloadPage() {
	return (
		<div className='min-h-screen bg-black text-white selection:bg-indigo-500 selection:text-white overflow-x-hidden'>
			<div className='fixed inset-0 z-0 overflow-hidden pointer-events-none'>
				<div className='absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-indigo-900/20 blur-[120px]' />
				<div className='absolute top-[40%] -right-[10%] w-[40%] h-[60%] rounded-full bg-purple-900/20 blur-[120px]' />
				<div className='absolute bottom-[10%] left-[20%] w-[30%] h-[30%] rounded-full bg-emerald-900/10 blur-[100px]' />
			</div>

			<div className='relative z-10 mx-auto max-w-5xl px-6 py-16'>
				<div className='flex items-center justify-between mb-12'>
					<div>
						<h1 className='text-3xl md:text-4xl font-bold'>Загрузки Vondic</h1>
						<p className='text-gray-400 mt-2'>
							Выберите платформу для скачивания.
						</p>
					</div>
					<Link
						href='/'
						className='px-4 py-2 text-sm font-medium text-white bg-white/10 rounded-full hover:bg-white/20 border border-white/10'
					>
						На главную
					</Link>
				</div>

				<div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
					<a
						href='https://github.com/KnopMops/vondic'
						target='_blank'
						rel='noreferrer'
						className='group rounded-3xl bg-gray-900/40 border border-gray-800 p-6 hover:bg-gray-800/60 transition-all'
					>
						<div className='w-12 h-12 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center mb-4'>
							<Github className='h-6 w-6 text-white' />
						</div>
						<div className='text-lg font-semibold text-white mb-1'>GitHub</div>
						<div className='text-sm text-gray-400'>
							Исходный код и релизы
						</div>
					</a>

					<Link
						href='/download/desktop'
						className='group rounded-3xl bg-gray-900/40 border border-gray-800 p-6 hover:bg-gray-800/60 transition-all'
					>
						<div className='w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4'>
							<Monitor className='h-6 w-6 text-indigo-300' />
						</div>
						<div className='text-lg font-semibold text-white mb-1'>Desktop</div>
						<div className='text-sm text-gray-400'>Windows, macOS, Linux</div>
					</Link>

					<Link
						href='/download/mobile'
						className='group rounded-3xl bg-gray-900/40 border border-gray-800 p-6 hover:bg-gray-800/60 transition-all'
					>
						<div className='w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4'>
							<Smartphone className='h-6 w-6 text-emerald-300' />
						</div>
						<div className='text-lg font-semibold text-white mb-1'>Mobile</div>
						<div className='text-sm text-gray-400'>iOS, Android</div>
					</Link>
				</div>
			</div>
		</div>
	)
}
