'use client'

import Link from 'next/link'
import {
	ArrowLeft,
	Clock,
	Compass,
	History,
	Home,
	ListVideo,
	Play,
	Search,
	TrendingUp,
	Video,
} from 'lucide-react'

const mockCards = Array.from({ length: 12 }, (_, i) => i)

export default function VideoPage() {
	return (
		<div className='min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-gray-100'>
			<div className='fixed inset-0 pointer-events-none'>
				<div className='absolute -top-[20%] -left-[10%] w-[45%] h-[45%] rounded-full bg-indigo-900/20 blur-[140px]' />
				<div className='absolute top-[35%] -right-[10%] w-[40%] h-[55%] rounded-full bg-purple-900/20 blur-[140px]' />
				<div className='absolute bottom-[5%] left-[25%] w-[35%] h-[35%] rounded-full bg-emerald-900/10 blur-[120px]' />
			</div>
			<div className='relative z-10 flex min-h-screen flex-col'>
				<header className='sticky top-0 z-20 border-b border-gray-800 bg-gray-950/80 backdrop-blur'>
					<div className='mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4'>
						<div className='flex items-center gap-3'>
							<Link
								href='/feed'
								className='flex h-9 w-9 items-center justify-center rounded-full border border-gray-800 bg-gray-900/60 text-gray-300 hover:bg-gray-800/80 hover:text-white'
							>
								<ArrowLeft className='h-4 w-4' />
							</Link>
							<div className='flex items-center gap-2'>
								<div className='flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-300'>
									<Video className='h-5 w-5' />
								</div>
								<span className='text-lg font-semibold text-white'>Vondic</span>
								<span className='rounded-full border border-indigo-500/40 bg-indigo-500/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-indigo-300'>
									Видео
								</span>
							</div>
						</div>
						<div className='flex flex-1 max-w-xl items-center gap-2'>
							<div className='relative flex-1'>
								<Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500' />
								<input
									placeholder='Поиск видео'
									className='h-10 w-full rounded-full border border-gray-800 bg-gray-900/70 pl-9 pr-4 text-sm text-gray-200 outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20'
								/>
							</div>
							<button className='h-10 rounded-full border border-gray-800 bg-gray-900/70 px-4 text-xs font-semibold text-gray-200 hover:bg-gray-800/80'>
								Поиск
							</button>
						</div>
						<div className='flex items-center gap-2'>
							<button className='h-9 rounded-full border border-gray-800 bg-gray-900/60 px-4 text-xs font-semibold text-gray-200 hover:bg-gray-800/80'>
								Загрузить
							</button>
							<div className='h-9 w-9 rounded-full border border-gray-800 bg-gray-900/60' />
						</div>
					</div>
				</header>
				<div className='mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-6'>
					<aside className='hidden w-56 flex-shrink-0 space-y-2 lg:block'>
						<div className='rounded-2xl border border-gray-800 bg-gray-950/60 p-3'>
							<div className='space-y-1 text-sm text-gray-300'>
								<div className='flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-gray-900/80'>
									<Home className='h-4 w-4 text-indigo-300' />
									<span>Главная</span>
								</div>
								<div className='flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-gray-900/80'>
									<TrendingUp className='h-4 w-4 text-purple-300' />
									<span>Тренды</span>
								</div>
								<div className='flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-gray-900/80'>
									<Compass className='h-4 w-4 text-emerald-300' />
									<span>Категории</span>
								</div>
								<div className='flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-gray-900/80'>
									<Play className='h-4 w-4 text-amber-300' />
									<span>Подписки</span>
								</div>
							</div>
						</div>
						<div className='rounded-2xl border border-gray-800 bg-gray-950/60 p-3'>
							<div className='space-y-1 text-sm text-gray-300'>
								<div className='flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-gray-900/80'>
									<History className='h-4 w-4 text-gray-400' />
									<span>История</span>
								</div>
								<div className='flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-gray-900/80'>
									<Clock className='h-4 w-4 text-gray-400' />
									<span>Смотреть позже</span>
								</div>
								<div className='flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-gray-900/80'>
									<ListVideo className='h-4 w-4 text-gray-400' />
									<span>Плейлисты</span>
								</div>
							</div>
						</div>
					</aside>
					<section className='flex-1 space-y-4'>
						<div className='flex flex-wrap gap-2'>
							{['Для вас', 'Музыка', 'Игры', 'Новости', 'Фильмы', 'Подкасты'].map(
								item => (
									<button
										key={item}
										className='rounded-full border border-gray-800 bg-gray-900/70 px-4 py-1.5 text-xs font-medium text-gray-200 hover:bg-gray-800/80'
									>
										{item}
									</button>
								),
							)}
						</div>
						<div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
							{mockCards.map(card => (
								<div
									key={card}
									className='overflow-hidden rounded-2xl border border-gray-800 bg-gray-950/60'
								>
									<div className='h-36 bg-gradient-to-br from-gray-900 via-gray-900/70 to-gray-950' />
									<div className='space-y-2 p-4'>
										<div className='h-3 w-3/4 rounded-full bg-gray-800' />
										<div className='h-3 w-2/3 rounded-full bg-gray-800/70' />
										<div className='flex items-center gap-2 pt-1'>
											<div className='h-8 w-8 rounded-full bg-gray-800/80' />
											<div className='h-3 w-1/2 rounded-full bg-gray-800/60' />
										</div>
									</div>
								</div>
							))}
						</div>
					</section>
				</div>
			</div>
		</div>
	)
}
