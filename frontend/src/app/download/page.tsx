import Link from 'next/link'
import {
	FiGithub as Github,
	FiMonitor as Monitor,
	FiSmartphone as Smartphone,
} from 'react-icons/fi'

export default function DownloadPage() {
	return (
		<div className='min-h-screen bg-black text-white selection:bg-indigo-500 selection:text-white overflow-x-hidden'>
			<div className='fixed inset-0 z-0 overflow-hidden pointer-events-none'>
				<div className='absolute -top-[30%] -left-[15%] w-[60%] h-[60%] rounded-full bg-indigo-600/15 blur-[150px]' />
				<div className='absolute top-[30%] -right-[10%] w-[50%] h-[50%] rounded-full bg-purple-600/15 blur-[150px]' />
				<div className='absolute bottom-[0%] left-[30%] w-[40%] h-[40%] rounded-full bg-emerald-600/10 blur-[130px]' />
			</div>

			<nav className='relative z-10 mx-auto max-w-5xl px-6 py-5 flex items-center justify-between'>
				<Link href='/' className='flex items-center gap-2.5 group'>
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

			<div className='relative z-10 mx-auto max-w-5xl px-6 pt-12 pb-20 md:pt-20 md:pb-28'>
				<div className='text-center mb-16'>
					<div className='inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-medium mb-6'>
						<span className='w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse' />
						Доступно на всех платформах
					</div>
					<h1 className='text-4xl md:text-6xl font-bold tracking-tight'>
						Скачайте{' '}
						<span className='bg-gradient-to-r from-indigo-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent'>
							Вондик
						</span>
					</h1>
					<p className='mt-4 text-gray-400 text-lg max-w-xl mx-auto'>
						Мессенджер, социальная сеть и платформа — всё в одном.
						Выберите свою платформу.
					</p>
				</div>

				<div className='grid grid-cols-1 md:grid-cols-3 gap-5'>
					<a
						href='https://github.com/KnopMops/vondic'
						target='_blank'
						rel='noreferrer'
						className='group relative rounded-2xl bg-gray-900/50 border border-white/[0.06] p-6 transition-all duration-300 hover:border-white/[0.12] hover:bg-gray-800/50 hover:shadow-2xl hover:shadow-white/[0.03]'
					>
						<div className='absolute inset-0 rounded-2xl bg-gradient-to-b from-white/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity' />
						<div className='relative'>
							<div className='w-12 h-12 rounded-xl bg-gradient-to-br from-gray-700 to-gray-800 border border-white/10 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform'>
								<Github className='h-6 w-6 text-white' />
							</div>
							<div className='text-lg font-semibold text-white mb-1'>GitHub</div>
							<div className='text-sm text-gray-400 leading-relaxed'>
								Исходный код, релизы и документация
							</div>
						</div>
					</a>

					<Link
						href='/download/desktop'
						className='group relative rounded-2xl bg-gray-900/50 border border-white/[0.06] p-6 transition-all duration-300 hover:border-indigo-500/30 hover:bg-gray-800/50 hover:shadow-2xl hover:shadow-indigo-500/10'
					>
						<div className='absolute inset-0 rounded-2xl bg-gradient-to-b from-indigo-500/[0.06] to-transparent opacity-0 group-hover:opacity-100 transition-opacity' />
						<div className='relative'>
							<div className='w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600/20 to-indigo-800/20 border border-indigo-500/20 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform'>
								<Monitor className='h-6 w-6 text-indigo-400' />
							</div>
							<div className='text-lg font-semibold text-white mb-1'>Desktop</div>
							<div className='text-sm text-gray-400 leading-relaxed'>
								Windows, macOS, Linux — нативное приложение
							</div>
						</div>
					</Link>

					<Link
						href='/download/mobile'
						className='group relative rounded-2xl bg-gray-900/50 border border-white/[0.06] p-6 transition-all duration-300 hover:border-emerald-500/30 hover:bg-gray-800/50 hover:shadow-2xl hover:shadow-emerald-500/10'
					>
						<div className='absolute inset-0 rounded-2xl bg-gradient-to-b from-emerald-500/[0.06] to-transparent opacity-0 group-hover:opacity-100 transition-opacity' />
						<div className='relative'>
							<div className='w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600/20 to-emerald-800/20 border border-emerald-500/20 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform'>
								<Smartphone className='h-6 w-6 text-emerald-400' />
							</div>
							<div className='text-lg font-semibold text-white mb-1'>Mobile</div>
							<div className='text-sm text-gray-400 leading-relaxed'>
								iOS и Android — мессенджер всегда с собой
							</div>
						</div>
					</Link>
				</div>
			</div>
		</div>
	)
}
