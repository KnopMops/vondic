import Link from 'next/link'
import Logo from '@/components/Logo'
import {
	FiMessageCircle as Message,
	FiUsers as Users,
	FiTrello as Communities,
	FiCpu as Bots,
	FiMusic as Music,
	FiMail as Mail,
	FiShield as Shield,
	FiGlobe as Globe,
	FiSmartphone as Mobile,
	FiMonitor as Desktop,
	FiLock as Privacy,
} from 'react-icons/fi'

const features = [
	{
		icon: Message,
		title: 'Мессенджер',
		description: 'Личные и групповые чаты, голосовые и видеозвонки через WebRTC. Всё работает в реальном времени — без задержек и посредников.',
		color: 'from-indigo-500 to-blue-500',
		iconColor: 'text-indigo-400',
		borderColor: 'hover:border-indigo-500/30',
	},
	{
		icon: Users,
		title: 'Социальная сеть',
		description: 'Лента, посты, комментарии, друзья, сообщества. Стройте аудиторию, делясь контентом — здесь есть всё, что нужно для общения.',
		color: 'from-purple-500 to-pink-500',
		iconColor: 'text-purple-400',
		borderColor: 'hover:border-purple-500/30',
	},
	{
		icon: Communities,
		title: 'Сообщества',
		description: 'Создавайте тематические сообщества с постами, обсуждениями и совместным контентом. Управляйте ролями и настройками доступа.',
		color: 'from-emerald-500 to-teal-500',
		iconColor: 'text-emerald-400',
		borderColor: 'hover:border-emerald-500/30',
	},
	{
		icon: Bots,
		title: 'Боты и мини-приложения',
		description: 'Встраивайте ботов в чаты, создавайте интерактивные мини-игры. Платформа для автоматизации и развлечений.',
		color: 'from-cyan-500 to-blue-500',
		iconColor: 'text-cyan-400',
		borderColor: 'hover:border-cyan-500/30',
	},
	{
		icon: Music,
		title: 'Музыка',
		description: 'Слушайте музыку прямо в мессенджере. Глобальный плеер работает даже при переключении между чатами.',
		color: 'from-pink-500 to-rose-500',
		iconColor: 'text-pink-400',
		borderColor: 'hover:border-pink-500/30',
	},
	{
		icon: Mail,
		title: 'Почта @vondic.ru',
		description: 'Бесплатный почтовый ящик прямо в платформе. Отправляйте и получайте письма, работайте с вложениями — всё в одном месте.',
		color: 'from-amber-500 to-yellow-500',
		iconColor: 'text-amber-400',
		borderColor: 'hover:border-amber-500/30',
	},
	{
		icon: Shield,
		title: 'Приватность и E2E',
		description: 'Сквозное шифрование для сообщений. Ваши данные принадлежат только вам — мы не имеем доступа к содержимому ваших чатов.',
		color: 'from-violet-500 to-purple-500',
		iconColor: 'text-violet-400',
		borderColor: 'hover:border-violet-500/30',
	},
]

const platforms = [
	{ icon: Desktop, label: 'Desktop', platforms: 'Windows · macOS · Linux', href: '/download/desktop' },
	{ icon: Mobile, label: 'Mobile', platforms: 'iOS · Android', href: '/download/mobile' },
]

export default function AboutPage() {
	return (
		<div className='min-h-screen bg-black text-white selection:bg-indigo-500 selection:text-white overflow-x-hidden'>
			<div className='fixed inset-0 z-0 overflow-hidden pointer-events-none'>
				<div className='absolute -top-[30%] -left-[15%] w-[60%] h-[60%] rounded-full bg-indigo-600/15 blur-[150px]' />
				<div className='absolute top-[30%] -right-[10%] w-[50%] h-[50%] rounded-full bg-purple-600/15 blur-[150px]' />
				<div className='absolute bottom-[0%] left-[30%] w-[40%] h-[40%] rounded-full bg-emerald-600/10 blur-[130px]' />
			</div>

			<nav className='relative z-10 mx-auto max-w-5xl px-6 py-5 flex items-center justify-between'>
				<Link href='/' className='flex items-center gap-2.5 group'>
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

			<div className='relative z-10 mx-auto max-w-5xl px-6 pt-12 pb-20 md:pt-20 md:pb-28'>
				<div className='text-center mb-20'>
					<div className='inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-medium mb-6'>
						<span className='w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse' />
						Открытая платформа
					</div>
					<h1 className='text-4xl md:text-6xl font-bold tracking-tight mb-6'>
						{'Что такое '}
						<span className='bg-gradient-to-r from-indigo-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent'>
							Вондик
						</span>
						{'?'}
					</h1>
					<p className='text-gray-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed'>
						Вондик — это платформа, которая объединяет мессенджер, социальную сеть
						и рабочее пространство в одном приложении.
						Мы сделали общение удобным, а данные — вашими.
					</p>
				</div>

				<div className='mb-20'>
					<h2 className='text-2xl md:text-3xl font-bold text-center mb-4'>
						{'Всё для '}
						<span className='bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent'>
							общения
						</span>
					</h2>
					<p className='text-gray-400 text-center mb-10 max-w-xl mx-auto'>
						Независимо от того, общаетесь ли вы с друзьями или работаете над проектом,
						у Вондика есть инструмент для этого.
					</p>

					<div className='grid grid-cols-1 md:grid-cols-2 gap-5'>
						{features.map((f) => (
							<div
								key={f.title}
								className={`group relative rounded-2xl bg-gray-900/50 border border-white/[0.06] p-6 transition-all duration-300 ${f.borderColor} hover:bg-gray-800/50 hover:shadow-2xl hover:shadow-white/[0.03]`}
							>
								<div className='absolute inset-0 rounded-2xl bg-gradient-to-b from-white/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity' />
								<div className='relative flex gap-4'>
									<div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} bg-opacity-20 flex items-center justify-center shrink-0 border border-white/10`}>
										<f.icon className={`h-6 w-6 ${f.iconColor}`} />
									</div>
									<div>
										<div className='text-lg font-semibold text-white mb-1'>{f.title}</div>
										<div className='text-sm text-gray-400 leading-relaxed'>{f.description}</div>
									</div>
								</div>
							</div>
						))}
					</div>
				</div>

				<div className='mb-20'>
					<h2 className='text-2xl md:text-3xl font-bold text-center mb-4'>
						{'На '}
						<span className='bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent'>
							любом устройстве
						</span>
					</h2>
					<p className='text-gray-400 text-center mb-10 max-w-xl mx-auto'>
						Приложение работает везде — на компьютере и телефоне.
						Синхронизация аккаунта, истории и настроек происходит автоматически.
					</p>

					<div className='grid grid-cols-1 md:grid-cols-2 gap-5'>
						{platforms.map((p) => (
							<Link
								key={p.label}
								href={p.href}
								className='group relative rounded-2xl bg-gray-900/50 border border-white/[0.06] p-6 text-center hover:border-white/[0.12] transition-all hover:bg-gray-800/50 hover:shadow-2xl hover:shadow-white/[0.03]'
							>
								<div className='w-12 h-12 rounded-xl bg-gradient-to-br from-gray-700 to-gray-800 border border-white/10 flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform'>
									<p.icon className='h-6 w-6 text-white' />
								</div>
								<div className='text-lg font-semibold text-white mb-1'>{p.label}</div>
								<div className='text-sm text-gray-400'>{p.platforms}</div>
							</Link>
						))}
					</div>
				</div>

				<div className='mb-20'>
					<h2 className='text-2xl md:text-3xl font-bold text-center mb-4'>
						{'Почему '}
						<span className='bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent'>
							Вондик
						</span>
						{'?'}
					</h2>
					<p className='text-gray-400 text-center mb-10 max-w-xl mx-auto'>
						Мы строим платформу, которой можно доверять.
					</p>

					<div className='grid grid-cols-1 md:grid-cols-3 gap-5'>
						<div className='rounded-2xl bg-gray-900/50 border border-white/[0.06] p-6 text-center hover:border-white/[0.12] transition-all'>
							<div className='w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600/20 to-emerald-800/20 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4'>
								<Privacy className='h-6 w-6 text-emerald-400' />
							</div>
							<div className='text-lg font-semibold text-white mb-1'>Приватность</div>
							<div className='text-sm text-gray-400 leading-relaxed'>
								Skype-шифрование, защита данных, прозрачная политика обработки персональных данных
							</div>
						</div>

						<div className='rounded-2xl bg-gray-900/50 border border-white/[0.06] p-6 text-center hover:border-white/[0.12] transition-all'>
							<div className='w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600/20 to-indigo-800/20 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4'>
							<Globe className='h-6 w-6 text-indigo-400' />
							</div>
							<div className='text-lg font-semibold text-white mb-1'>Открытый код</div>
							<div className='text-sm text-gray-400 leading-relaxed'>
								Исходный код доступен для ознакомления на GitHub — изучайте архитектуру и технологии
							</div>
						</div>

						<div className='rounded-2xl bg-gray-900/50 border border-white/[0.06] p-6 text-center hover:border-white/[0.12] transition-all'>
							<div className='w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600/20 to-purple-800/20 border border-purple-500/20 flex items-center justify-center mx-auto mb-4'>
								<Bots className='h-6 w-6 text-purple-400' />
							</div>
							<div className='text-lg font-semibold text-white mb-1'>Расширяемость</div>
							<div className='text-sm text-gray-400 leading-relaxed'>
								API, боты, мини-приложения — платформа, которую можно адаптировать под любые задачи
							</div>
						</div>
					</div>
				</div>

				<div className='relative rounded-2xl bg-gray-900/50 border border-white/[0.06] p-8 md:p-12 text-center'>
					<div className='absolute inset-0 rounded-2xl bg-gradient-to-b from-indigo-500/[0.04] to-purple-500/[0.04]' />
					<div className='relative'>
						<h2 className='text-2xl md:text-3xl font-bold mb-4'>Вондик Corporate</h2>
						<p className='text-gray-400 mb-6 max-w-lg mx-auto'>
							Корпоративная версия платформы для бизнеса. Безопасность, управление,
							интеграции и поддержка — всё для командной работы.
						</p>
						<span className='inline-block px-4 py-2 text-sm font-medium text-gray-300 rounded-full border border-white/10 bg-white/5'>
							Скоро
						</span>
					</div>
				</div>

				<div className='text-center mt-20 pt-8 border-t border-white/[0.06]'>
					<p className='text-gray-500 text-sm'>
						© 2026 Вондик ·{' '}
						<Link href='https://github.com/KnopMops/vondic' className='text-gray-400 hover:text-white transition-colors' target='_blank' rel='noreferrer'>
							GitHub
						</Link>
					</p>
				</div>
			</div>
		</div>
	)
}
