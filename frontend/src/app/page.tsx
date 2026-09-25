'use client'

import BrandLogo from '@/components/social/BrandLogo'
import { useAuth } from '@/lib/AuthContext'
import { motion } from 'framer-motion'
import {
	LuGithub as Github,
	LuMessageSquare as MessageCircle,
	LuMonitor as Monitor,
	LuShare2 as Share2,
	LuShieldCheck as Shield,
	LuSmartphone as Smartphone,
	LuZap as Zap,
	LuMusic as Music,
	LuUsers as Users,
	LuArrowRight as ArrowRight,
} from 'react-icons/lu'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

export default function Home() {
	const { user } = useAuth()
	const [onlineCount, setOnlineCount] = useState<number | null>(null)
	const cursorRef = useRef<HTMLDivElement | null>(null)

	useEffect(() => {
		const fetchOnlineUsers = async () => {
			try {
				const webrtcUrl =
					process.env.NEXT_PUBLIC_WEBRTC_URL || 'http://localhost:5000'
				const res = await fetch(`${webrtcUrl}/api/online-users`)
				if (res.ok) {
					const data = await res.json()
					setOnlineCount(data.count)
				}
			} catch (e) {
				console.error('Failed to fetch online users count', e)
			}
		}

		fetchOnlineUsers()
		const interval = setInterval(fetchOnlineUsers, 60000)
		return () => clearInterval(interval)
	}, [])

	useEffect(() => {
		const handleMove = (e: MouseEvent) => {
			if (!cursorRef.current) return
			const x = e.clientX
			const y = e.clientY
			cursorRef.current.style.transform = `translate(${x}px, ${y}px)`
		}
		window.addEventListener('mousemove', handleMove)
		return () => window.removeEventListener('mousemove', handleMove)
	}, [])

	return (
		<div className='min-h-screen bg-[#0e1117] text-[#e6edf3] selection:bg-[#0077FF] selection:text-white overflow-x-hidden font-sans relative'>
			{/* Cursor glow */}
			<div
				ref={cursorRef}
				className='fixed top-0 left-0 z-[1] pointer-events-none'
				style={{ transform: 'translate(-1000px, -1000px)' }}
			>
				<div className='-translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-[#0077FF]/15 blur-3xl mix-blend-screen' />
			</div>

			{/* Background ambient lighting */}
			<div className='fixed inset-0 z-0 overflow-hidden pointer-events-none'>
				<div className='absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-[#0077FF]/10 blur-[140px] rounded-full' />
				<div className='absolute top-1/3 -right-40 w-[500px] h-[400px] bg-purple-600/10 blur-[150px] rounded-full' />
				<div className='absolute bottom-10 -left-40 w-[500px] h-[400px] bg-blue-600/10 blur-[150px] rounded-full' />
			</div>

			{/* Navigation */}
			<nav className='relative z-50 border-b border-[#30363d] bg-[#161b22]/80 backdrop-blur-md sticky top-0'>
				<div className='flex items-center justify-between px-6 py-4 mx-auto max-w-6xl'>
					<Link href='/' className='flex items-center gap-3 group'>
						<div className='w-10 h-10 rounded-xl bg-[#0d1117] border border-[#30363d] p-1 flex items-center justify-center shadow-sm group-hover:border-[#0077FF] transition-colors'>
							<BrandLogo size={32} />
						</div>
						<span className='text-xl font-bold tracking-tight text-white'>Вондик</span>
					</Link>

					<div className='flex items-center gap-3'>
						<Link
							href='/about'
							className='px-3.5 py-1.5 text-xs font-medium text-[#8b949e] hover:text-white rounded-lg hover:bg-[#21262d] transition-colors'
						>
							О платформе
						</Link>
						{user ? (
							<Link
								href='/feed'
								className='px-4 py-2 text-xs font-semibold text-white transition-all bg-[#0077FF] rounded-lg hover:bg-[#0066dd] shadow-sm'
							>
								Открыть Вондик Web
							</Link>
						) : (
							<>
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
							</>
						)}
					</div>
				</div>
			</nav>

			{/* Main Hero */}
			<main className='relative z-10 flex flex-col items-center justify-center px-4 pt-16 pb-28 text-center max-w-6xl mx-auto'>
				<motion.div
					initial={{ opacity: 0, y: 16 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.6, ease: 'easeOut' }}
					className='max-w-3xl space-y-6'
				>
					<div className='inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#161b22] border border-[#30363d] text-[#8b949e] text-xs font-medium'>
						<span className='w-2 h-2 rounded-full bg-emerald-500 animate-pulse' />
						Версия Вондик · Единая экосистема
					</div>

					<h1 className='text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-tight text-white'>
						Общайся.{' '}
						<span className='text-transparent bg-clip-text bg-gradient-to-r from-[#0077FF] via-indigo-400 to-purple-400'>
							Делись.
						</span>{' '}
						<br />
						Вдохновляй.
					</h1>

					<p className='max-w-2xl mx-auto text-base sm:text-lg text-[#8b949e] leading-relaxed font-normal'>
						Современная цифровая платформа Вондик: быстрый защищённый мессенджер,
						аудио- и видеозвонки, персональная лента, музыка и сообщества в едином интерфейсе.
					</p>

					<div className='flex flex-wrap items-center justify-center gap-3 pt-4'>
						{user ? (
							<Link
								href='/feed'
								className='px-6 py-3 text-sm font-semibold text-white transition-all bg-[#0077FF] rounded-xl hover:bg-[#0066dd] shadow-md shadow-blue-500/20 flex items-center justify-center gap-2'
							>
								Перейти в ленту
								<ArrowRight className='w-4 h-4' />
							</Link>
						) : (
							<Link
								href='/register'
								className='px-6 py-3 text-sm font-semibold text-white transition-all bg-[#0077FF] rounded-xl hover:bg-[#0066dd] shadow-md shadow-blue-500/20 flex items-center justify-center gap-2'
							>
								Создать аккаунт
								<ArrowRight className='w-4 h-4' />
							</Link>
						)}

						{!user && (
							<Link
								href='/login'
								className='px-6 py-3 text-sm font-semibold text-[#e6edf3] transition-all bg-[#161b22] rounded-xl hover:bg-[#21262d] border border-[#30363d] hover:border-[#8b949e]/40 flex items-center justify-center'
							>
								Войти в аккаунт
							</Link>
						)}

						<Link
							href='/about'
							className='px-6 py-3 text-sm font-semibold text-[#e6edf3] transition-all bg-[#161b22] rounded-xl hover:bg-[#21262d] border border-[#30363d] hover:border-[#8b949e]/40 flex items-center justify-center'
						>
							О нас
						</Link>
					</div>

					<div className='flex flex-wrap items-center justify-center gap-2 pt-2 text-xs'>
						<a
							href='https://github.com/KnopMops/vondic'
							target='_blank'
							rel='noreferrer'
							className='px-3.5 py-2 rounded-lg bg-[#161b22] border border-[#30363d] text-[#8b949e] hover:text-white hover:border-[#8b949e]/40 transition-colors flex items-center gap-1.5'
						>
							<Github className='h-3.5 w-3.5' />
							<span>GitHub</span>
						</a>
						<Link
							href='/api-docs'
							className='px-3.5 py-2 rounded-lg bg-[#161b22] border border-[#30363d] text-[#8b949e] hover:text-white hover:border-[#8b949e]/40 transition-colors flex items-center gap-1.5'
						>
							<Zap className='h-3.5 w-3.5 text-[#58a6ff]' />
							<span>API</span>
						</Link>
						<Link
							href='/download/desktop'
							className='px-3.5 py-2 rounded-lg bg-[#161b22] border border-[#30363d] text-[#8b949e] hover:text-white hover:border-[#8b949e]/40 transition-colors flex items-center gap-1.5'
						>
							<Monitor className='h-3.5 w-3.5' />
							<span>Десктоп</span>
						</Link>
						<Link
							href='/download/mobile'
							className='px-3.5 py-2 rounded-lg bg-[#161b22] border border-[#30363d] text-[#8b949e] hover:text-white hover:border-[#8b949e]/40 transition-colors flex items-center gap-1.5'
						>
							<Smartphone className='h-3.5 w-3.5' />
							<span>Мобильная</span>
						</Link>
					</div>
				</motion.div>

				{/* Feature Cards in Obsidian Auth Style */}
				<motion.div
					initial={{ opacity: 0, y: 30 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
					className='grid grid-cols-1 md:grid-cols-3 gap-5 mt-20 w-full text-left'
				>
					{[
						{
							icon: <MessageCircle className='w-6 h-6 text-[#58a6ff]' />,
							title: 'Мгновенные сообщения',
							desc: 'Чаты, голосовые и видеозвонки WebRTC, обмен файлами и синхронизация в реальном времени.',
							iconBg: 'bg-[#0077FF]/15 border-[#0077FF]/30',
						},
						{
							icon: <Share2 className='w-6 h-6 text-purple-400' />,
							title: 'Социальная экосистема',
							desc: 'Публикации, сообщества, персональная лента, друзья и реакции без назойливой рекламы.',
							iconBg: 'bg-purple-500/15 border-purple-500/30',
						},
						{
							icon: <Shield className='w-6 h-6 text-emerald-400' />,
							title: 'Приватность и безопасность',
							desc: 'Сквозное E2E-шифрование, поддержка Passkey и защита персональных данных.',
							iconBg: 'bg-emerald-500/15 border-emerald-500/30',
						},
					].map((feature, i) => (
						<div
							key={i}
							className='group p-6 rounded-2xl bg-[#161b22] border border-[#30363d] hover:border-[#8b949e]/40 hover:bg-[#1c2129] transition-all duration-200'
						>
							<div
								className={`w-12 h-12 rounded-xl ${feature.iconBg} border flex items-center justify-center mb-4 transition-transform group-hover:scale-105`}
							>
								{feature.icon}
							</div>
							<h3 className='text-base font-semibold mb-2 text-white group-hover:text-[#58a6ff] transition-colors'>
								{feature.title}
							</h3>
							<p className='text-xs sm:text-sm text-[#8b949e] leading-relaxed'>{feature.desc}</p>
						</div>
					))}
				</motion.div>

				{/* Online Counter */}
				<div className='mt-20 w-full pt-10 border-t border-[#30363d]'>
					<div className='flex justify-center'>
						<div className='flex flex-col items-center bg-[#161b22] border border-[#30363d] rounded-2xl px-8 py-4'>
							<span className='text-3xl font-extrabold text-white'>
								{onlineCount !== null ? onlineCount : '1'}
							</span>
							<span className='text-xs text-[#8b949e] uppercase tracking-wider font-medium mt-1 flex items-center gap-1.5'>
								<span className='w-2 h-2 rounded-full bg-emerald-500' />
								Сейчас онлайн в Вондик
							</span>
						</div>
					</div>
				</div>
			</main>

			{/* Footer */}
			<footer className='py-12 relative z-10 border-t border-[#30363d] bg-[#161b22]/50'>
				<div className='max-w-4xl mx-auto px-6 text-center space-y-6'>
					<div className='flex items-center justify-center gap-2.5'>
						<div className='w-8 h-8 rounded-lg bg-[#0d1117] border border-[#30363d] p-1 flex items-center justify-center'>
							<BrandLogo size={24} />
						</div>
						<span className='font-bold text-white text-base'>Вондик</span>
					</div>

					<div className='grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-[#8b949e] max-w-2xl mx-auto'>
						<a
							href='https://s3.vondic.ru/uploads/docs/privacy_policy.rtf'
							target='_blank'
							rel='noopener'
							className='hover:text-white transition-colors'
						>
							Конфиденциальность
						</a>
						<a
							href='https://s3.vondic.ru/uploads/docs/terms_of_service.rtf'
							target='_blank'
							rel='noopener'
							className='hover:text-white transition-colors'
						>
							Соглашение
						</a>
						<a
							href='https://s3.vondic.ru/uploads/docs/cookie_policy.rtf'
							target='_blank'
							rel='noopener'
							className='hover:text-white transition-colors'
						>
							Cookies
						</a>
						<Link href='/about' className='hover:text-white transition-colors'>
							О сервисе
						</Link>
					</div>

					<p className='text-[#8b949e] text-xs'>
						© 2026 Вондик. Все права защищены.
					</p>
				</div>
			</footer>
		</div>
	)
}
