'use client'

import {
	AlertCircle,
	Maximize2,
	Minimize2,
	Monitor,
	X,
	Zap,
} from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import { useCallStore } from '../../lib/stores/callStore'

interface ScreenShareViewerProps {
	onClose: () => void
}

export const ScreenShareViewer: React.FC<ScreenShareViewerProps> = ({
	onClose,
}) => {
	const { screenStream, isScreenSharing, remoteStreams, activeCalls } =
		useCallStore()
	const videoRef = useRef<HTMLVideoElement>(null)
	const [isFullscreen, setIsFullscreen] = useState(false)
	const [isHover, setIsHover] = useState(false)
	const [hasError, setHasError] = useState(false)
	const containerRef = useRef<HTMLDivElement>(null)
	const [fps, setFps] = useState(0)
	const [resolution, setResolution] = useState({ width: 0, height: 0 })

	const isFullscreenSupported =
		typeof document !== 'undefined' &&
		(!!document.documentElement.requestFullscreen ||
			(document.documentElement as any).webkitRequestFullscreen ||
			(document.documentElement as any).mozRequestFullScreen ||
			(document.documentElement as any).msRequestFullscreen)

	useEffect(() => {
		if (videoRef.current && screenStream) {
			videoRef.current.srcObject = screenStream
			videoRef.current.muted = true
			videoRef.current.play().catch(err => {
				console.error('Failed to play screen share:', err)
				setHasError(true)
			})

			
			const track = screenStream.getVideoTracks()[0]
			if (track) {
				const settings = track.getSettings()
				setResolution({
					width: settings.width || 0,
					height: settings.height || 0,
				})
				setFps(settings.frameRate || 0)

				
				const interval = setInterval(() => {
					const currentSettings = track.getSettings()
					setResolution({
						width: currentSettings.width || 0,
						height: currentSettings.height || 0,
					})
					setFps(currentSettings.frameRate || 0)
				}, 1000)

				return () => clearInterval(interval)
			}
		}
	}, [screenStream])

	useEffect(() => {
		const handleFullscreenChange = () => {
			setIsFullscreen(!!document.fullscreenElement)
		}
		document.addEventListener('fullscreenchange', handleFullscreenChange)
		return () => {
			document.removeEventListener('fullscreenchange', handleFullscreenChange)
		}
	}, [])

	const toggleFullscreen = async () => {
		if (!containerRef.current) return

		try {
			if (document.fullscreenElement) {
				await document.exitFullscreen()
			} else {
				await containerRef.current.requestFullscreen()
			}
		} catch (err) {
			console.error('Fullscreen error:', err)
		}
	}

	const handleStop = () => {
		if (screenStream) {
			screenStream.getTracks().forEach(track => track.stop())
		}
		onClose()
	}

	if (!screenStream && !isScreenSharing) {
		return null
	}

	return (
		<div
			ref={containerRef}
			className={`fixed inset-0 bg-[#1e1f22] z-[100] flex flex-col ${isFullscreen ? '' : ''}`}
		>
			
			<div className='flex items-center justify-between px-4 py-3 bg-[#2b2d31] border-b border-[#1e1f22]'>
				<div className='flex items-center gap-3'>
					<Monitor className='w-5 h-5 text-green-400' />
					<span className='text-white font-semibold text-sm'>
						Демонстрация экрана
					</span>
					{isFullscreen && (
						<span className='text-xs text-gray-400 bg-[#1e1f22] px-2 py-1 rounded'>
							Полноэкранный режим
						</span>
					)}
				</div>
				<div className='flex items-center gap-2'>
					<button
						onClick={toggleFullscreen}
						className='p-2 text-gray-300 hover:text-white hover:bg-[#35373c] rounded-lg transition-colors'
						title={isFullscreen ? 'Выйти из полноэкранного' : 'Во весь экран'}
					>
						{isFullscreen ? (
							<Minimize2 className='w-5 h-5' />
						) : (
							<Maximize2 className='w-5 h-5' />
						)}
					</button>
					<button
						onClick={handleStop}
						className='p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors'
						title='Остановить демонстрацию'
					>
						<X className='w-5 h-5' />
					</button>
				</div>
			</div>

			
			<div
				className='flex-1 flex items-center justify-center p-4 bg-[#111214] relative overflow-hidden group'
				onMouseEnter={() => setIsHover(true)}
				onMouseLeave={() => setIsHover(false)}
			>
				{hasError ? (
					<div className='text-center text-gray-400'>
						<AlertCircle className='w-16 h-16 mx-auto mb-4 text-amber-500' />
						<p className='text-lg font-semibold mb-2'>Ошибка воспроизведения</p>
						<p className='text-sm'>Не удалось запустить демонстрацию экрана</p>
					</div>
				) : (
					<>
						<video
							ref={videoRef}
							autoPlay
							playsInline
							muted
							className='max-w-full max-h-full rounded-lg shadow-2xl'
							style={{
								width: 'auto',
								height: 'auto',
								maxWidth: '100%',
								maxHeight: '100%',
								objectFit: 'contain',
							}}
							onPlay={() => setHasError(false)}
							onError={() => setHasError(true)}
						/>

						
						{isFullscreenSupported && (
							<div
								className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity duration-300 ${isHover ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
							>
								<button
									onClick={e => {
										e.stopPropagation()
										toggleFullscreen()
									}}
									className='p-4 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-all transform hover:scale-110'
									title={
										isFullscreen
											? 'Выход из полноэкранного режима'
											: 'Во весь экран'
									}
									aria-label={
										isFullscreen
											? 'Выход из полноэкранного режима'
											: 'Во весь экран'
									}
									onKeyDown={e => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault()
											toggleFullscreen()
										}
									}}
								>
									{isFullscreen ? (
										<Minimize2 className='w-8 h-8' />
									) : (
										<Maximize2 className='w-8 h-8' />
									)}
								</button>
							</div>
						)}
					</>
				)}
			</div>

			
			<div className='px-4 py-2 bg-[#2b2d31] border-t border-[#1e1f22]'>
				<div className='flex items-center justify-between text-xs text-gray-400'>
					<div className='flex items-center gap-4'>
						<span className='flex items-center gap-1.5'>
							<span className='text-white font-mono'>
								{resolution.width} x {resolution.height}
							</span>
						</span>
						<span className='flex items-center gap-1.5'>
							<Zap
								className={`w-3.5 h-3.5 ${fps >= 60 ? 'text-green-400' : fps >= 30 ? 'text-amber-400' : 'text-red-400'}`}
							/>
							<span
								className={`font-mono font-semibold ${fps >= 60 ? 'text-green-400' : fps >= 30 ? 'text-amber-400' : 'text-red-400'}`}
							>
								{Math.round(fps)} FPS
							</span>
						</span>
					</div>
					<span
						className={`px-2 py-1 rounded text-xs font-medium ${fps >= 60 ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}
					>
						{isScreenSharing ? 'Демонстрация активна' : 'Ожидание...'}
					</span>
				</div>
			</div>
		</div>
	)
}
