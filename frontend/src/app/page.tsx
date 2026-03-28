'use client'

import LoginModal from '@/components/auth/LoginModal'
import BrandLogo from '@/components/social/BrandLogo'
import { useAuth } from '@/lib/AuthContext'
import { motion } from 'framer-motion'
import {
    Github,
    MessageCircle,
    Monitor,
    Share2,
    Shield,
    Smartphone,
    Zap,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

export default function Home() {
	const { user } = useAuth()
	const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)
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
	// Cursor glow effect
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
		<div className='min-h-screen bg-black text-white selection:bg-indigo-500 selection:text-white overflow-x-hidden'>
			{/* Cursor-following glow */}
			<div
				ref={cursorRef}
				className='fixed top-0 left-0 z-[1] pointer-events-none'
				style={{ transform: 'translate(-1000px, -1000px)' }}
			>
				<div className='-translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 blur-3xl mix-blend-screen' />
			</div>
			<div className='fixed inset-0 z-0 overflow-hidden pointer-events-none'>
				<div className='absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-indigo-900/20 blur-[120px]' />
				<div className='absolute top-[40%] -right-[10%] w-[40%] h-[60%] rounded-full bg-purple-900/20 blur-[120px]' />
				<div className='absolute bottom-[10%] left-[20%] w-[30%] h-[30%] rounded-full bg-emerald-900/10 blur-[100px]' />
			</div>

			<nav className='relative z-50 flex items-center justify-between px-6 py-6 mx-auto max-w-7xl'>
				<div className='flex items-center gap-3'>
					<BrandLogo size={40} />
					<span className='text-2xl font-bold tracking-tight'>Вондик</span>
				</div>
				<div className='flex items-center gap-6'>
					{user ? (
						<Link
							href='/feed'
							className='px-6 py-2.5 text-sm font-medium text-white transition-all bg-indigo-600 rounded-full hover:bg-indigo-500 shadow-lg shadow-indigo-500/20'
						>
							Открыть Вондик Web
						</Link>
					) : (
						<>
							<button
								onClick={() => setIsLoginModalOpen(true)}
								className='text-sm font-medium text-gray-300 transition-colors hover:text-white hidden sm:block'
							>
								Войти
							</button>
							<Link
								href='/register'
								className='px-6 py-2.5 text-sm font-medium text-white transition-all bg-white/10 rounded-full hover:bg-white/20 backdrop-blur-sm border border-white/10 hover:border-white/20'
							>
								Регистрация
							</Link>
						</>
					)}
				</div>
			</nav>

			<main className='relative z-10 flex flex-col items-center justify-center px-4 pt-20 pb-32 text-center'>
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.8, ease: 'easeOut' }}
					className='max-w-4xl space-y-8'
				>
					<motion.div
						initial={{ opacity: 0, scale: 0.9 }}
						animate={{ opacity: 1, scale: 1 }}
						transition={{ delay: 0.2, duration: 0.5 }}
						className='inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-widest mb-4'
					>
						<span className='w-2 h-2 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_10px_rgba(99,102,241,0.5)]' />
						Вондик
					</motion.div>

					<h1 className='text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-tight'>
						Общайся.{' '}
						<span className='text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 animate-gradient-x'>
							Делись.
						</span>{' '}
						<br />
						Вдохновляй.
					</h1>

					<p className='max-w-2xl mx-auto text-lg md:text-xl text-gray-400 leading-relaxed font-light'>
						Современная социальная платформа для тех, кто ценит свободу общения,
						минимализм и скорость. Присоединяйся к сообществу будущего уже
						сегодня.
					</p>

					<div className='flex flex-col sm:flex-row items-center justify-center gap-4 pt-8'>
						{user ? (
							<Link
								href='/feed'
								className='w-full sm:w-auto px-8 py-4 text-lg font-semibold text-white transition-all bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full hover:shadow-lg hover:shadow-indigo-500/25 hover:scale-105 active:scale-95 flex items-center justify-center gap-2 group'
							>
								Перейти в ленту
								<Zap className='w-5 h-5 group-hover:fill-current transition-all' />
							</Link>
						) : (
							<Link
								href='/register'
								className='w-full sm:w-auto px-8 py-4 text-lg font-semibold text-white transition-all bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full hover:shadow-lg hover:shadow-indigo-500/25 hover:scale-105 active:scale-95 flex items-center justify-center gap-2 group'
							>
								Начать сейчас
								<Zap className='w-5 h-5 group-hover:fill-current transition-all' />
							</Link>
						)}

						{!user && (
							<button
								onClick={() => setIsLoginModalOpen(true)}
								className='w-full sm:w-auto px-8 py-4 text-lg font-semibold text-white transition-all bg-gray-800/50 backdrop-blur-sm rounded-full hover:bg-gray-800 border border-gray-700 hover:border-gray-600 flex items-center justify-center'
							>
								У меня есть аккаунт
							</button>
						)}
					</div>

					<div className='flex flex-col sm:flex-row items-center justify-center gap-3 pt-6'>
						<a
							href='https://github.com/KnopMops/vondic'
							target='_blank'
							rel='noreferrer'
							className='w-full sm:w-auto px-6 py-3 text-sm font-semibold text-white transition-all bg-white/10 rounded-full hover:bg-white/20 border border-white/10 hover:border-white/20 flex items-center justify-center gap-2'
						>
							<Github className='h-4 w-4' />
						</a>
						<Link
							href='/api-docs'
							className='w-full sm:w-auto px-6 py-3 text-sm font-semibold text-white transition-all bg-white/10 rounded-full hover:bg-white/20 border border-white/10 hover:border-white/20 flex items-center justify-center gap-2'
						>
							<Zap className='h-4 w-4' />
							<span>Документация API</span>
						</Link>
						<Link
							href='/download/desktop'
							className='w-full sm:w-auto px-6 py-3 text-sm font-semibold text-white transition-all bg-white/10 rounded-full hover:bg-white/20 border border-white/10 hover:border-white/20 flex items-center justify-center gap-2'
						>
							<Monitor className='h-4 w-4' />
						</Link>
						<Link
							href='/download/mobile'
							className='w-full sm:w-auto px-6 py-3 text-sm font-semibold text-white transition-all bg-white/10 rounded-full hover:bg-white/20 border border-white/10 hover:border-white/20 flex items-center justify-center gap-2'
						>
							<Smartphone className='h-4 w-4' />
						</Link>
					</div>
				</motion.div>

				<motion.div
					initial={{ opacity: 0, y: 40 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
					className='grid grid-cols-1 md:grid-cols-3 gap-6 mt-32 max-w-6xl w-full px-4'
				>
					{[
						{
							icon: <MessageCircle className='w-8 h-8 text-indigo-400' />,
							title: 'Мгновенные сообщения',
							desc: 'Общайтесь с друзьями в реальном времени с поддержкой статусов и индикаторов набора текста.',
							color: 'bg-indigo-500/10',
							border: 'border-indigo-500/20',
						},
						{
							icon: <Share2 className='w-8 h-8 text-purple-400' />,
							title: 'Делитесь моментами',
							desc: 'Публикуйте фото и мысли, делитесь контентом в один клик с красивыми превью.',
							color: 'bg-purple-500/10',
							border: 'border-purple-500/20',
						},
						{
							icon: <Shield className='w-8 h-8 text-emerald-400' />,
							title: 'Приватность',
							desc: 'Ваши данные под защитой. Мы ценим вашу анонимность, безопасность и свободу.',
							color: 'bg-emerald-500/10',
							border: 'border-emerald-500/20',
						},
					].map((feature, i) => (
						<div
							key={i}
							className='group p-8 rounded-3xl bg-gray-900/40 border border-gray-800 backdrop-blur-sm hover:bg-gray-800/60 transition-all duration-300 hover:-translate-y-1'
						>
							<div
								className={`w-16 h-16 rounded-2xl ${feature.color} border ${feature.border} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}
							>
								{feature.icon}
							</div>
							<h3 className='text-xl font-bold mb-3 text-white'>
								{feature.title}
							</h3>
							<p className='text-gray-400 leading-relaxed'>{feature.desc}</p>
						</div>
					))}
				</motion.div>

				<motion.div
					initial={{ opacity: 0 }}
					whileInView={{ opacity: 1 }}
					viewport={{ once: true }}
					transition={{ duration: 1, delay: 0.2 }}
					className='mt-32 w-full max-w-4xl border-t border-gray-800 pt-16'
				>
					<div className='flex justify-center'>
						<div className='flex flex-col items-center'>
							<span className='text-3xl font-bold text-white mb-1'>
								{onlineCount !== null ? onlineCount : '-'}
							</span>
							<span className='text-sm text-gray-500 uppercase tracking-wider font-medium'>
								Сейчас онлайн
							</span>
						</div>
					</div>
				</motion.div>
			</main>

			<footer className='py-12 text-center relative z-10 border-t border-gray-900'>
				<div className='flex items-center justify-center gap-2 mb-4 opacity-50 hover:opacity-100 transition-opacity'>
					<span className='text-xl font-bold'>В</span>
					<span className='font-semibold'>Вондик</span>
				</div>
				<p className='text-gray-600 text-sm'>&copy; 2026 Вондик</p>
			</footer>

			<LoginModal
				isOpen={isLoginModalOpen}
				onClose={() => setIsLoginModalOpen(false)}
			/>
		</div>
	)
}
