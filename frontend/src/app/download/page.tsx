import Link from 'next/link'
import BrandLogo from '@/components/social/BrandLogo'
import {
	LuGithub as Github,
	LuMonitor as Monitor,
	LuSmartphone as Smartphone,
	LuDownload as Download,
} from 'react-icons/lu'

export default function DownloadPage() {
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

			<div className='relative z-10 mx-auto max-w-5xl px-6 pt-16 pb-24 space-y-16'>
				<div className='text-center space-y-4 max-w-2xl mx-auto'>
					<div className='inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#30363d] bg-[#161b22] text-[#8b949e] text-xs font-medium'>
						<span className='w-2 h-2 rounded-full bg-emerald-500 animate-pulse' />
						Доступно на всех платформах
					</div>
					<h1 className='text-4xl sm:text-5xl font-extrabold text-white tracking-tight'>
						Скачайте{' '}
						<span className='text-transparent bg-clip-text bg-gradient-to-r from-[#0077FF] via-indigo-400 to-purple-400'>
							Вондик
						</span>
					</h1>
					<p className='text-[#8b949e] text-sm sm:text-base leading-relaxed'>
						Мессенджер, социальная сеть и медиаплатформа — всё в одном приложении.
						Выберите вашу операционную систему.
					</p>
				</div>

				<div className='grid grid-cols-1 md:grid-cols-3 gap-5'>
					<a
						href='https://github.com/KnopMops/vondic'
						target='_blank'
						rel='noreferrer'
						className='group rounded-2xl bg-[#161b22] border border-[#30363d] p-7 hover:border-[#8b949e]/40 hover:bg-[#1c2129] transition-all shadow-sm flex flex-col justify-between'
					>
						<div>
							<div className='w-12 h-12 rounded-xl bg-[#21262d] border border-[#30363d] flex items-center justify-center mb-5 group-hover:scale-105 transition-transform'>
								<Github className='h-6 w-6 text-white' />
							</div>
							<h3 className='text-base font-semibold text-white mb-1.5'>GitHub</h3>
							<p className='text-xs text-[#8b949e] leading-relaxed'>
								Открытый исходный код, последние релизы сборщика и документация для разработчиков.
							</p>
						</div>
						<div className='pt-6'>
							<span className='text-xs font-semibold text-[#58a6ff] group-hover:underline'>
								Перейти к репозиторию →
							</span>
						</div>
					</a>

					<Link
						href='/download/desktop'
						className='group rounded-2xl bg-[#161b22] border border-[#30363d] p-7 hover:border-[#0077FF]/40 hover:bg-[#1c2129] transition-all shadow-sm flex flex-col justify-between'
					>
						<div>
							<div className='w-12 h-12 rounded-xl bg-[#0077FF]/15 border border-[#0077FF]/30 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform'>
								<Monitor className='h-6 w-6 text-[#58a6ff]' />
							</div>
							<h3 className='text-base font-semibold text-white mb-1.5'>Десктоп</h3>
							<p className='text-xs text-[#8b949e] leading-relaxed'>
								Нативные приложения для Windows, macOS и Linux со сквозным шифрованием и уведомлениями.
							</p>
						</div>
						<div className='pt-6'>
							<span className='text-xs font-semibold text-[#58a6ff] group-hover:underline'>
								Скачать для ПК →
							</span>
						</div>
					</Link>

					<Link
						href='/download/mobile'
						className='group rounded-2xl bg-[#161b22] border border-[#30363d] p-7 hover:border-emerald-500/40 hover:bg-[#1c2129] transition-all shadow-sm flex flex-col justify-between'
					>
						<div>
							<div className='w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform'>
								<Smartphone className='h-6 w-6 text-emerald-400' />
							</div>
							<h3 className='text-base font-semibold text-white mb-1.5'>Мобильная версия</h3>
							<p className='text-xs text-[#8b949e] leading-relaxed'>
								Приложения для Android и iOS. Будьте всегда на связи с быстрым и защищённым чатом.
							</p>
						</div>
						<div className='pt-6'>
							<span className='text-xs font-semibold text-emerald-400 group-hover:underline'>
								Установить на телефон →
							</span>
						</div>
					</Link>
				</div>
			</div>
		</div>
	)
}
