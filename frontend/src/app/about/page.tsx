import Link from 'next/link'
import BrandLogo from '@/components/social/BrandLogo'
import {
	LuMessageSquare as Message,
	LuUsers as Users,
	LuLayers as Communities,
	LuBot as Bots,
	LuMusic as Music,
	LuMail as Mail,
	LuShieldCheck as Shield,
	LuGlobe as Globe,
	LuSmartphone as Mobile,
	LuMonitor as Desktop,
	LuLock as Privacy,
	LuBuilding2 as Corporate,
	LuSparkles as Sparkles,
	LuClock as Clock,
	LuCircleCheck as CheckCircle,
	LuExternalLink as ExternalLink,
} from 'react-icons/lu'

export const metadata = {
	title: 'О нас | Вондик',
	description: 'Вондик — единая экосистема для общения, работы, мультимедиа и сообществ.',
}

const features = [
	{
		icon: Message,
		title: 'Мессенджер и звонки',
		description:
			'Мгновенные сообщения, аудио- и видеозвонки WebRTC в HD-качестве. Быстрая доставка, передача файлов любого формата и сквозное шифрование.',
		color: 'from-blue-500/20 to-indigo-500/20 text-[#58a6ff] border-[#0077FF]/30',
	},
	{
		icon: Users,
		title: 'Социальная лента и друзья',
		description:
			'Персональная лента новостей, посты, реакции, быстрый поиск единомышленников и мгновенная синхронизация списка друзей.',
		color: 'from-purple-500/20 to-pink-500/20 text-purple-400 border-purple-500/30',
	},
	{
		icon: Music,
		title: 'Вондик Музыка',
		description:
			'Встроенный аудиоплеер, доступный в любом уголке платформы. Слушайте любимые треки фоном во время переписок и звонков.',
		color: 'from-pink-500/20 to-rose-500/20 text-pink-400 border-pink-500/30',
	},
	{
		icon: Communities,
		title: 'Сообщества и каналы',
		description:
			'Создавайте открытые и закрытые клубы по интересам, управляйте правами участников, ведите блоги и стройте своё комьюнити.',
		color: 'from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/30',
	},
	{
		icon: Bots,
		title: 'Боты и мини-аппы',
		description:
			'Интеграции с искусственным интеллектом, автоматизация задач, мини-игры и сервисы прямо внутри диалогов.',
		color: 'from-cyan-500/20 to-blue-500/20 text-cyan-400 border-cyan-500/30',
	},
	{
		icon: Mail,
		title: 'Почта @vondic.ru',
		description:
			'Единый почтовый ящик, привязанный к вашему профилю. Надежная защита от спама, быстрый веб-интерфейс и мгновенные уведомления.',
		color: 'from-amber-500/20 to-yellow-500/20 text-amber-400 border-amber-500/30',
	},
	{
		icon: Shield,
		title: 'Приватность и E2E',
		description:
			'Сквозное шифрование конфиденциальных диалогов, аппаратные ключи Passkey и строгая защита персональных данных.',
		color: 'from-violet-500/20 to-purple-500/20 text-violet-400 border-violet-500/30',
	},
	{
		icon: Globe,
		title: 'Открытая экосистема',
		description:
			'Открытый API для разработчиков, независимая серверная архитектура и полная свобода взаимодействия.',
		color: 'from-teal-500/20 to-emerald-500/20 text-teal-400 border-teal-500/30',
	},
]

const platforms = [
	{
		icon: Desktop,
		label: 'Десктопная версия',
		description: 'Приложение для Windows, macOS и Linux с поддержкой горячих клавиш и системных уведомлений.',
		href: '/download/desktop',
	},
	{
		icon: Mobile,
		label: 'Мобильное приложение',
		description: 'Удобная версия для Android и iOS (PWA/Native) со звонками и push-уведомлениями.',
		href: '/download/mobile',
	},
]

const corporateFeatures = [
	'Развёртывание в изолированном контуре (On-Premise / Private Cloud)',
	'Интеграция с корпоративными каталогами (SSO, SAML 2.0, Active Directory)',
	'Расширенные политики безопасности, аудит действий и DLP-контроль',
	'Неограниченное число рабочих пространств и защищённых переговорных',
	'Приоритетная техническая поддержка и индивидуальный SLA',
]

export default function AboutPage() {
	return (
		<div className='min-h-screen bg-[#0e1117] text-[#e6edf3] selection:bg-[#0077FF] selection:text-white relative overflow-x-hidden font-sans'>
			{/* Subtle background glow */}
			<div className='fixed inset-0 z-0 pointer-events-none overflow-hidden'>
				<div className='absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-[#0077FF]/10 blur-[140px] rounded-full' />
				<div className='absolute top-1/3 -right-40 w-[500px] h-[400px] bg-purple-600/10 blur-[150px] rounded-full' />
				<div className='absolute bottom-10 -left-40 w-[500px] h-[400px] bg-blue-600/10 blur-[150px] rounded-full' />
			</div>

			{/* Navigation */}
			<nav className='relative z-20 border-b border-[#30363d] bg-[#161b22]/80 backdrop-blur-md sticky top-0'>
				<div className='max-w-6xl mx-auto px-6 py-4 flex items-center justify-between'>
					<Link href='/' className='flex items-center gap-3 group'>
						<div className='w-10 h-10 rounded-xl bg-[#0d1117] border border-[#30363d] p-1 flex items-center justify-center shadow-sm group-hover:border-[#0077FF] transition-colors'>
							<BrandLogo size={32} />
						</div>
						<div className='flex flex-col'>
							<span className='text-lg font-bold text-white tracking-tight leading-tight'>
								Вондик
							</span>
							<span className='text-[10px] text-[#8b949e] font-mono tracking-wider uppercase'>
								Платформа
							</span>
						</div>
					</Link>

					<div className='flex items-center gap-3'>
						<Link
							href='/feed'
							className='px-3.5 py-1.5 text-xs font-medium text-[#8b949e] hover:text-white rounded-lg hover:bg-[#21262d] transition-colors'
						>
							Лента
						</Link>
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

			{/* Main Content */}
			<div className='relative z-10 max-w-6xl mx-auto px-6 pt-16 pb-24 space-y-24'>
				{/* Hero Section */}
				<div className='text-center max-w-3xl mx-auto space-y-6'>
					<div className='inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#30363d] bg-[#161b22] text-[#8b949e] text-xs font-medium'>
						<span className='w-2 h-2 rounded-full bg-emerald-500 animate-pulse' />
						Версия Вондик 2026 · Официальная платформа
					</div>

					<h1 className='text-4xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight leading-tight'>
						Что такое{' '}
						<span className='text-transparent bg-clip-text bg-gradient-to-r from-[#0077FF] via-indigo-400 to-purple-400'>
							Вондик
						</span>
						?
					</h1>

					<p className='text-base sm:text-lg text-[#8b949e] leading-relaxed'>
						Вондик — это единая цифровая экосистема, сочетающая в себе защищённый
						мессенджер, социальную ленту, голосовые и видеоконференции, стриминг музыки
						и гибкое пространство для сообществ.
					</p>

					<div className='flex flex-wrap items-center justify-center gap-3 pt-2'>
						<Link
							href='/register'
							className='px-6 py-2.5 text-sm font-semibold text-white rounded-xl bg-[#0077FF] hover:bg-[#0066dd] shadow-md shadow-blue-500/20 transition-all'
						>
							Создать аккаунт в Вондике
						</Link>
						<Link
							href='/feed'
							className='px-6 py-2.5 text-sm font-semibold text-[#e6edf3] rounded-xl bg-[#161b22] border border-[#30363d] hover:bg-[#21262d] hover:border-[#8b949e]/40 transition-all'
						>
							Открыть веб-версию
						</Link>
					</div>
				</div>

				{/* Features Grid */}
				<div className='space-y-8'>
					<div className='text-center space-y-2'>
						<h2 className='text-2xl sm:text-3xl font-bold text-white tracking-tight'>
							Возможности платформы Вондик
						</h2>
						<p className='text-sm text-[#8b949e] max-w-xl mx-auto'>
							Всё необходимое для повседневного общения, работы и развлечений — в одном месте.
						</p>
					</div>

					<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
						{features.map(f => (
							<div
								key={f.title}
								className='group rounded-2xl bg-[#161b22] border border-[#30363d] p-6 hover:border-[#8b949e]/40 hover:bg-[#1c2129] transition-all shadow-sm flex gap-4'
							>
								<div
									className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} border flex items-center justify-center shrink-0 shadow-sm`}
								>
									<f.icon className='w-6 h-6' />
								</div>
								<div className='space-y-1.5'>
									<h3 className='text-base font-semibold text-white group-hover:text-[#58a6ff] transition-colors'>
										{f.title}
									</h3>
									<p className='text-xs sm:text-sm text-[#8b949e] leading-relaxed'>
										{f.description}
									</p>
								</div>
							</div>
						))}
					</div>
				</div>

				{/* Multiplatform */}
				<div className='space-y-8'>
					<div className='text-center space-y-2'>
						<h2 className='text-2xl sm:text-3xl font-bold text-white tracking-tight'>
							Вондик на всех ваших устройствах
						</h2>
						<p className='text-sm text-[#8b949e] max-w-xl mx-auto'>
							Мгновенная синхронизация чатов, медиа и настроек между всеми клиентами.
						</p>
					</div>

					<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
						{platforms.map(p => (
							<Link
								key={p.label}
								href={p.href}
								className='group rounded-2xl bg-[#161b22] border border-[#30363d] p-6 hover:border-[#8b949e]/40 hover:bg-[#1c2129] transition-all shadow-sm flex items-start gap-4'
							>
								<div className='w-12 h-12 rounded-xl bg-[#21262d] border border-[#30363d] flex items-center justify-center shrink-0 group-hover:border-[#0077FF] transition-colors'>
									<p.icon className='w-6 h-6 text-white' />
								</div>
								<div className='space-y-1 flex-1'>
									<div className='flex items-center justify-between'>
										<h3 className='text-base font-semibold text-white group-hover:text-[#58a6ff] transition-colors'>
											{p.label}
										</h3>
										<ExternalLink className='w-4 h-4 text-[#8b949e] group-hover:text-white transition-colors' />
									</div>
									<p className='text-xs sm:text-sm text-[#8b949e] leading-relaxed'>
										{p.description}
									</p>
								</div>
							</Link>
						))}
					</div>
				</div>

				{/* Vondic Corporate Section */}
				<div className='rounded-2xl bg-[#161b22] border border-[#30363d] p-8 md:p-12 relative overflow-hidden shadow-xl'>
					<div className='absolute -top-24 -right-24 w-80 h-80 bg-[#0077FF]/10 rounded-full blur-[90px] pointer-events-none' />

					<div className='relative z-10 max-w-3xl space-y-6'>
						<div className='flex items-center gap-3'>
							<div className='w-10 h-10 rounded-xl bg-[#0077FF]/15 border border-[#0077FF]/30 flex items-center justify-center text-[#58a6ff]'>
								<Corporate className='w-5 h-5' />
							</div>
							<span className='inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#0077FF]/15 border border-[#0077FF]/30 text-[#58a6ff]'>
								<Clock className='w-3.5 h-3.5' /> Скоро появится
							</span>
						</div>

						<div className='space-y-3'>
							<h2 className='text-3xl font-extrabold text-white tracking-tight'>
								Вондик Corporate
							</h2>
							<p className='text-sm sm:text-base text-[#8b949e] leading-relaxed'>
								Корпоративная версия платформы Вондик для бизнеса, команд и организаций.
								Безопасная коммуникация в собственном контуре с полным контролем данных,
								единой системой аутентификации и централизованным управлением.
							</p>
						</div>

						<div className='grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2'>
							{corporateFeatures.map((item, idx) => (
								<div key={idx} className='flex items-start gap-2.5 text-xs sm:text-sm text-[#e6edf3]'>
									<CheckCircle className='w-4 h-4 text-[#58a6ff] shrink-0 mt-0.5' />
									<span>{item}</span>
								</div>
							))}
						</div>

						<div className='pt-4 flex items-center gap-4'>
							<span className='inline-block px-4 py-2 text-xs font-semibold text-[#8b949e] rounded-xl border border-[#30363d] bg-[#0d1117]'>
								Релиз запланирован на 2026 год
							</span>
							<Link
								href='mailto:support@vondic.ru?subject=Vondic%20Corporate%20Inquiry'
								className='text-xs font-medium text-[#58a6ff] hover:underline'
							>
								Оставить предварительную заявку →
							</Link>
						</div>
					</div>
				</div>

				{/* Footer */}
				<div className='pt-12 border-t border-[#30363d] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#8b949e]'>
					<div className='flex items-center gap-2'>
						<BrandLogo size={20} />
						<span>© 2026 Вондик. Все права защищены.</span>
					</div>
					<div className='flex items-center gap-6'>
						<Link href='/feed' className='hover:text-white transition-colors'>
							Вондик Web
						</Link>
						<Link href='/feed/privacy' className='hover:text-white transition-colors'>
							Конфиденциальность
						</Link>
						<Link
							href='https://github.com/KnopMops/vondic'
							target='_blank'
							rel='noreferrer'
							className='hover:text-white transition-colors'
						>
							GitHub
						</Link>
					</div>
				</div>
			</div>
		</div>
	)
}
