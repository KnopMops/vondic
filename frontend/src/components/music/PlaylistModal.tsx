'use client'

import React, { useRef } from 'react'
import {
	FiX,
	FiPlay,
	FiPause,
	FiSkipBack,
	FiSkipForward,
	FiVolume2,
	FiVolumeX,
	FiRepeat,
	FiShuffle,
	FiTrash2,
	FiMusic,
	FiUpload,
	FiBookmark,
} from 'react-icons/fi'
import { useMusicPlayerStore, Track } from '@/lib/stores/musicPlayerStore'

export default function PlaylistModal() {
	const {
		isPlaylistModalOpen,
		setIsPlaylistModalOpen,
		myPlaylist,
		currentTrack,
		isPlaying,
		currentTime,
		duration,
		volume,
		isMuted,
		isShuffled,
		repeatMode,
		pinnedProfileTrack,
		playTrack,
		togglePlay,
		nextTrack,
		previousTrack,
		toggleShuffle,
		toggleRepeat,
		setVolume,
		toggleMute,
		seek,
		addToMyPlaylist,
		removeFromMyPlaylist,
		setPinnedProfileTrack,
	} = useMusicPlayerStore()

	const fileInputRef = useRef<HTMLInputElement>(null)

	if (!isPlaylistModalOpen) return null

	const formatTime = (secs: number) => {
		if (isNaN(secs) || secs < 0) return '0:00'
		const m = Math.floor(secs / 60)
		const s = Math.floor(secs % 60)
		return `${m}:${s < 10 ? '0' : ''}${s}`
	}

	const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files
		if (!files || files.length === 0) return
		Array.from(files).forEach(file => {
			if (!file.type.startsWith('audio/')) return
			const url = URL.createObjectURL(file)
			const nameParts = file.name.replace(/\.[^/.]+$/, '').split(' - ')
			const artist = nameParts.length > 1 ? nameParts[0] : 'Неизвестный исполнитель'
			const title = nameParts.length > 1 ? nameParts.slice(1).join(' - ') : nameParts[0]
			const newTrack: Track = {
				id: `uploaded-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
				title,
				artist,
				duration: '0:00',
				url,
			}
			addToMyPlaylist(newTrack)
		})
	}

	return (
		<div className='fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn'>
			<div className='relative w-full max-w-2xl bg-neutral-900/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-white'>
				{/* Modal Header */}
				<div className='flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5'>
					<div className='flex items-center gap-3'>
						<div className='w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400'>
							<FiMusic className='w-5 h-5' />
						</div>
						<div>
							<h2 className='text-lg font-bold text-white'>Мой Плейлист</h2>
							<p className='text-xs text-gray-400'>
								{myPlaylist.length}{' '}
								{myPlaylist.length === 1 ? 'трек' : myPlaylist.length > 1 && myPlaylist.length < 5 ? 'трека' : 'треков'}
							</p>
						</div>
					</div>
					<div className='flex items-center gap-2'>
						<input
							type='file'
							ref={fileInputRef}
							onChange={handleFileUpload}
							accept='audio/*'
							multiple
							className='hidden'
						/>
						<button
							onClick={() => fileInputRef.current?.click()}
							className='flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors text-white'
							title='Загрузить аудиофайл'
						>
							<FiUpload className='w-3.5 h-3.5' /> Загрузить
						</button>
						<button
							onClick={() => setIsPlaylistModalOpen(false)}
							className='p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors'
						>
							<FiX className='w-5 h-5' />
						</button>
					</div>
				</div>

				{/* Active Playing Track Controls Banner */}
				{currentTrack && (
					<div className='p-5 bg-gradient-to-r from-violet-950/60 to-indigo-950/60 border-b border-white/10 flex flex-col gap-3'>
						<div className='flex items-center justify-between gap-4'>
							<div className='min-w-0 flex-1'>
								<h3 className='font-semibold text-sm text-white truncate'>{currentTrack.title}</h3>
								<p className='text-xs text-violet-300/70 truncate'>{currentTrack.artist}</p>
							</div>

							<div className='flex items-center gap-3'>
								<button
									onClick={toggleShuffle}
									className={`p-2 rounded-lg transition-colors ${
										isShuffled ? 'text-violet-400 bg-violet-500/20' : 'text-gray-400 hover:text-white'
									}`}
									title='Перемешать'
								>
									<FiShuffle className='w-4 h-4' />
								</button>
								<button
									onClick={toggleRepeat}
									className={`p-2 rounded-lg transition-colors relative ${
										repeatMode !== 'none'
											? 'text-violet-400 bg-violet-500/20'
											: 'text-gray-400 hover:text-white'
									}`}
									title={`Повтор: ${
										repeatMode === 'one' ? 'Песня' : repeatMode === 'all' ? 'Плейлист' : 'Выкл'
									}`}
								>
									<FiRepeat className='w-4 h-4' />
									{repeatMode === 'one' && (
										<span className='absolute -top-1 -right-1 text-[9px] font-bold bg-violet-500 text-white w-3.5 h-3.5 rounded-full flex items-center justify-center'>
											1
										</span>
									)}
								</button>
							</div>
						</div>

						{/* Seekbar */}
						<div className='space-y-1'>
							<input
								type='range'
								min={0}
								max={duration || 100}
								value={currentTime}
								onChange={e => seek(Number(e.target.value))}
								className='w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-violet-500 focus:outline-none'
							/>
							<div className='flex justify-between text-[11px] font-mono text-gray-400'>
								<span>{formatTime(currentTime)}</span>
								<span>{formatTime(duration)}</span>
							</div>
						</div>

						{/* Playback & Volume Control */}
						<div className='flex items-center justify-between pt-1'>
							<div className='flex items-center gap-2'>
								<button
									onClick={toggleMute}
									className='p-1.5 text-gray-400 hover:text-white transition-colors'
								>
									{isMuted || volume === 0 ? (
										<FiVolumeX className='w-4 h-4 text-red-400' />
									) : (
										<FiVolume2 className='w-4 h-4' />
									)}
								</button>
								<input
									type='range'
									min={0}
									max={1}
									step={0.01}
									value={isMuted ? 0 : volume}
									onChange={e => setVolume(Number(e.target.value))}
									className='w-20 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-violet-400 focus:outline-none'
								/>
							</div>

							<div className='flex items-center gap-4'>
								<button
									onClick={previousTrack}
									className='p-2 text-gray-300 hover:text-white transition-colors active:scale-95'
								>
									<FiSkipBack className='w-5 h-5 fill-current' />
								</button>
								<button
									onClick={togglePlay}
									className='w-11 h-11 rounded-full bg-violet-600 hover:bg-violet-500 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95'
								>
									{isPlaying ? (
										<FiPause className='w-5 h-5 fill-current' />
									) : (
										<FiPlay className='w-5 h-5 fill-current ml-0.5' />
									)}
								</button>
								<button
									onClick={nextTrack}
									className='p-2 text-gray-300 hover:text-white transition-colors active:scale-95'
								>
									<FiSkipForward className='w-5 h-5 fill-current' />
								</button>
							</div>
						</div>
					</div>
				)}

				{/* Track List */}
				<div className='flex-1 overflow-y-auto p-4 space-y-1 divide-y divide-white/5'>
					{myPlaylist.length === 0 ? (
						<div className='py-12 text-center text-gray-400 space-y-3'>
							<FiMusic className='w-12 h-12 mx-auto opacity-30 text-violet-400' />
							<p className='text-sm'>Ваш плейлист пуст.</p>
							<p className='text-xs text-gray-500'>
								Добавляйте музыку из сообщений по кнопке <span className='text-violet-400 font-semibold'>⋮</span> или загрузите с устройства.
							</p>
						</div>
					) : (
						myPlaylist.map((track, idx) => {
							const isCurrent = currentTrack?.id === track.id
							const isPinned = pinnedProfileTrack?.id === track.id

							return (
								<div
									key={track.id || idx}
									className={`flex items-center justify-between p-3 rounded-xl transition-all group ${
										isCurrent
											? 'bg-violet-600/20 border border-violet-500/30'
											: 'hover:bg-white/5 border border-transparent'
									}`}
								>
									<div
										onClick={() => playTrack(track, myPlaylist)}
										className='flex items-center gap-3 flex-1 min-w-0 cursor-pointer'
									>
										<button className='w-8 h-8 rounded-lg bg-white/10 group-hover:bg-violet-600 flex items-center justify-center text-white transition-colors flex-shrink-0'>
											{isCurrent && isPlaying ? (
												<FiPause className='w-4 h-4 fill-current text-violet-300' />
											) : (
												<FiPlay className='w-4 h-4 fill-current ml-0.5' />
											)}
										</button>
										<div className='min-w-0 flex-1'>
											<h4
												className={`text-sm font-medium truncate ${
													isCurrent ? 'text-violet-300 font-semibold' : 'text-gray-200'
												}`}
											>
												{track.title}
											</h4>
											<p className='text-xs text-gray-400 truncate'>{track.artist}</p>
										</div>
									</div>

									<div className='flex items-center gap-2 ml-3'>
										<button
											onClick={() => setPinnedProfileTrack(isPinned ? null : track)}
											className={`p-2 rounded-lg transition-colors ${
												isPinned
													? 'text-amber-400 bg-amber-500/20'
													: 'text-gray-500 hover:text-amber-400 hover:bg-white/5'
											}`}
											title={isPinned ? 'Открепить от профиля' : 'Закрепить в профиле (Telegram-стиль)'}
										>
											<FiBookmark className='w-4 h-4' />
										</button>
										<button
											onClick={() => removeFromMyPlaylist(track.id)}
											className='p-2 text-gray-500 hover:text-red-400 rounded-lg hover:bg-white/5 transition-colors'
											title='Удалить из плейлиста'
										>
											<FiTrash2 className='w-4 h-4' />
										</button>
									</div>
								</div>
							)
						})
					)}
				</div>
			</div>
		</div>
	)
}
