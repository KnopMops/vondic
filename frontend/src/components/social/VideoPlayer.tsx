import { getAttachmentUrl } from '@/lib/utils'
import {
	Maximize,
	Minimize,
	Pause,
	PictureInPicture,
	Play,
	Volume2,
	VolumeX,
	Settings,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'

type Props = {
	src: string
	poster?: string | null
	className?: string
	videoId?: string
	onFirstPlay?: () => void
}

export default function VideoPlayer({ src, poster, className, videoId, onFirstPlay }: Props) {
	const { user } = useAuth()
	const videoRef = useRef<HTMLVideoElement>(null)
	const containerRef = useRef<HTMLDivElement>(null)
	const [isPlaying, setIsPlaying] = useState(false)
	const [duration, setDuration] = useState(0)
	const [currentTime, setCurrentTime] = useState(0)
	const [volume, setVolume] = useState(1)
	const [isMuted, setIsMuted] = useState(false)
	const [isHover, setIsHover] = useState(false)
	const [isFullscreen, setIsFullscreen] = useState(false)
	const [isLoading, setIsLoading] = useState(true)
	const [playbackRate, setPlaybackRate] = useState(1)
	const [isSettingsOpen, setIsSettingsOpen] = useState(false)
	const [isLoop, setIsLoop] = useState(false)
	const [showAd, setShowAd] = useState(false)
	const [adLeft, setAdLeft] = useState(3)

	useEffect(() => {
		const v = videoRef.current
		if (!v) return
		const onLoaded = () => {
			setDuration(v.duration || 0)
			setIsLoading(false)
		}
		const onTime = () => setCurrentTime(v.currentTime || 0)
		const onWaiting = () => setIsLoading(true)
		const onCanPlay = () => setIsLoading(false)
		let hasCounted = false
		const onPlay = () => {
			setIsPlaying(true)
			if (!hasCounted && videoId) {
				hasCounted = true
				onFirstPlay?.()
			}
		}
		const onPause = () => setIsPlaying(false)
		v.addEventListener('loadedmetadata', onLoaded)
		v.addEventListener('timeupdate', onTime)
		v.addEventListener('waiting', onWaiting)
		v.addEventListener('canplay', onCanPlay)
		v.addEventListener('play', onPlay)
		v.addEventListener('pause', onPause)
		v.volume = volume
		v.muted = isMuted
		v.playbackRate = playbackRate
		v.loop = isLoop
		return () => {
			v.removeEventListener('loadedmetadata', onLoaded)
			v.removeEventListener('timeupdate', onTime)
			v.removeEventListener('waiting', onWaiting)
			v.removeEventListener('canplay', onCanPlay)
			v.removeEventListener('play', onPlay)
			v.removeEventListener('pause', onPause)
		}
	}, [])

	useEffect(() => {
		if (user?.premium) {
			setShowAd(false)
			return
		}
		setShowAd(true)
		setAdLeft(3)
		const v = videoRef.current
		if (v) v.pause()
		let left = 3
		const timer = setInterval(() => {
			left -= 1
			setAdLeft(Math.max(0, left))
			if (left <= 0) {
				clearInterval(timer)
				setShowAd(false)
				const vid = videoRef.current
				if (vid) {
					vid.play().catch(() => {})
				}
			}
		}, 1000)
		return () => {
			clearInterval(timer)
		}
	}, [src, user?.premium])

	useEffect(() => {
		const v = videoRef.current
		if (!v) return
		v.volume = volume
	}, [volume])

	useEffect(() => {
		const v = videoRef.current
		if (!v) return
		v.muted = isMuted
	}, [isMuted])

	useEffect(() => {
		const v = videoRef.current
		if (!v) return
		v.playbackRate = playbackRate
	}, [playbackRate])
	useEffect(() => {
		const v = videoRef.current
		if (!v) return
		v.loop = isLoop
	}, [isLoop])

	useEffect(() => {
		const onFsChange = () => {
			const d = document as any
			const fsEl =
				d.fullscreenElement ||
				d.webkitFullscreenElement ||
				d.msFullscreenElement
			setIsFullscreen(!!fsEl)
		}
		document.addEventListener('fullscreenchange', onFsChange)
		document.addEventListener('webkitfullscreenchange', onFsChange as any)
		document.addEventListener('msfullscreenchange', onFsChange as any)
		return () => {
			document.removeEventListener('fullscreenchange', onFsChange)
			document.removeEventListener('webkitfullscreenchange', onFsChange as any)
			document.removeEventListener('msfullscreenchange', onFsChange as any)
		}
	}, [])

	const togglePlay = () => {
		if (showAd) return
		const v = videoRef.current
		if (!v) return
		if (v.paused) v.play()
		else v.pause()
	}

	const formatTime = (t: number) => {
		const s = Math.floor(t % 60)
		const m = Math.floor((t / 60) % 60)
		const h = Math.floor(t / 3600)
		const pad = (n: number) => String(n).padStart(2, '0')
		if (h > 0) return `${h}:${pad(m)}:${pad(s)}`
		return `${pad(m)}:${pad(s)}`
	}

	const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
		const v = videoRef.current
		if (!v) return
		const val = Number(e.target.value)
		v.currentTime = val
		setCurrentTime(val)
	}

	const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = Number(e.target.value)
		setVolume(val)
		setIsMuted(val === 0)
	}

	const toggleMute = () => {
		setIsMuted(x => !x)
	}

	const toggleFullscreen = () => {
		const el = containerRef.current as any
		if (!el) return
		const d = document as any
		const fsEl =
			d.fullscreenElement || d.webkitFullscreenElement || d.msFullscreenElement
		if (fsEl) {
			if (d.exitFullscreen) d.exitFullscreen()
			else if (d.webkitExitFullscreen) d.webkitExitFullscreen()
			else if (d.msExitFullscreen) d.msExitFullscreen()
		} else {
			if (el.requestFullscreen) el.requestFullscreen()
			else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen()
			else if (el.msRequestFullscreen) el.msRequestFullscreen()
		}
	}

	const togglePiP = async () => {
		const v = videoRef.current as any
		if (!v) return
		if (document.pictureInPictureElement) {
			await (document as any).exitPictureInPicture()
			return
		}
		if (v.requestPictureInPicture) {
			try {
				await v.requestPictureInPicture()
			} catch {}
		}
	}

	const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
		if (e.key === ' ') {
			e.preventDefault()
			togglePlay()
		} else if (e.key === 'ArrowRight') {
			const v = videoRef.current
			if (v)
				v.currentTime = Math.min(
					v.currentTime + 5,
					v.duration || v.currentTime + 5,
				)
		} else if (e.key === 'ArrowLeft') {
			const v = videoRef.current
			if (v) v.currentTime = Math.max(v.currentTime - 5, 0)
		} else if (e.key.toLowerCase() === 'm') {
			toggleMute()
		} else if (e.key.toLowerCase() === 'f') {
			toggleFullscreen()
		}
	}

	return (
		<div
			ref={containerRef}
			tabIndex={0}
			onKeyDown={onKeyDown}
			onMouseEnter={() => setIsHover(true)}
			onMouseLeave={() => setIsHover(false)}
			className={`group rounded-xl border border-gray-800/50 bg-black overflow-hidden ${className || ''}`}
		>
			<div className='relative'>
				<video
					ref={videoRef}
					src={getAttachmentUrl(src)}
					poster={poster ? getAttachmentUrl(poster) : undefined}
					playsInline
					className='w-full h-auto bg-black'
					onClick={togglePlay}
				/>
				{isLoading && (
					<div className='absolute inset-0 flex items-center justify-center'>
						<div className='h-8 w-8 rounded-full border-2 border-white/20 border-t-white animate-spin' />
					</div>
				)}
				{showAd && (
					<div className='absolute inset-0 flex items-center justify-center bg-black'>
						<div className='text-center space-y-1'>
							<div className='text-white font-bold text-lg'>Вондик Premium</div>
							<div className='text-gray-300 text-xs'>Без рекламы и задержек</div>
							<div className='text-gray-400 text-xs'>{adLeft} сек...</div>
						</div>
					</div>
				)}
				<div
					className={`absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent transition-opacity ${isHover || !isPlaying ? 'opacity-100' : 'opacity-0'}`}
				>
					<div className='flex items-center gap-2'>
						<button
							onClick={togglePlay}
							className='rounded-md p-1.5 text-white bg-white/10 hover:bg-white/20 transition transform hover:scale-105 active:scale-95'
							type='button'
							aria-label={isPlaying ? 'Pause' : 'Play'}
						>
							{isPlaying ? <Pause size={16} /> : <Play size={16} />}
						</button>
						<div className='flex-1 flex items-center gap-2 min-w-0'>
							<input
								type='range'
								min={0}
								max={Math.max(1, duration)}
								step={0.1}
								value={currentTime}
								onChange={handleSeek}
								className='w-full h-1 accent-indigo-500'
							/>
							<span className='text-[10px] text-gray-300 whitespace-nowrap'>
								{formatTime(currentTime)} / {formatTime(duration)}
							</span>
						</div>
						<div className='relative flex items-center'>
							<button
								onClick={toggleMute}
								className='rounded-md p-1.5 text-white bg-white/10 hover:bg-white/20 transition transform hover:scale-105 active:scale-95'
								type='button'
								aria-label={isMuted ? 'Unmute' : 'Mute'}
							>
								{isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
							</button>
							<div className='w-0 overflow-hidden group-hover:w-24 transition-all duration-200 ml-1'>
								<input
									type='range'
									min={0}
									max={1}
									step={0.05}
									value={volume}
									onChange={handleVolume}
									className='w-24 accent-indigo-500 h-1'
								/>
							</div>
						</div>
						<button
							onClick={togglePiP}
							className='rounded-md p-1.5 text-white bg-white/10 hover:bg-white/20 transition transform hover:scale-105 active:scale-95'
							type='button'
							aria-label='Picture in Picture'
						>
							<PictureInPicture size={16} />
						</button>
						<button
							onClick={toggleFullscreen}
							className='rounded-md p-1.5 text-white bg-white/10 hover:bg-white/20 transition transform hover:scale-105 active:scale-95'
							type='button'
							aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
						>
							{isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
						</button>
						<div className='relative'>
							<button
								onClick={() => setIsSettingsOpen(x => !x)}
								className='rounded-md p-1.5 text-white bg-white/10 hover:bg-white/20 transition transform hover:scale-105 active:scale-95'
								type='button'
								aria-label='Settings'
							>
								<Settings size={16} />
							</button>
							{isSettingsOpen && (
								<div
									className='absolute bottom-full right-0 mb-2 w-44 rounded-lg border border-white/10 bg-black/80 backdrop-blur-sm shadow-lg'
								>
									<div className='px-3 py-2'>
										<div className='text-[11px] text-gray-400 mb-1'>Скорость</div>
										<div className='grid grid-cols-3 gap-2'>
											{[0.5, 1, 1.5, 2].map(rate => (
												<button
													key={rate}
													onClick={() => setPlaybackRate(rate)}
													className={`text-xs rounded-md px-2 py-1 transition ${
														playbackRate === rate
															? 'bg-indigo-600 text-white'
															: 'bg-white/10 text-gray-200 hover:bg-white/20'
													}`}
													type='button'
												>
													{rate}x
												</button>
											))}
										</div>
									</div>
									<div className='px-3 py-2 border-t border-white/10'>
										<label className='flex items-center justify-between text-xs text-gray-200'>
											<span>Петля</span>
											<input
												type='checkbox'
												checked={isLoop}
												onChange={e => setIsLoop(e.target.checked)}
												className='accent-indigo-500'
											/>
										</label>
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
