'use client'

import { useWebRTCService } from '@/lib/stores/callStore'
import { getAttachmentUrl } from '@/lib/utils'
import React, { useEffect, useRef, useState } from 'react'
import { CallState } from '../../lib/services/WebRTCService'

interface ActiveCallProps {
	callInfo: CallState
	onEndCall: (socketId: string) => void
	onMuteToggle: () => void
	onScreenShareToggle: () => void
	onVideoToggle: () => void
	isMuted: boolean
	isScreenSharing: boolean
	isVideoEnabled: boolean
	isScreenShareSupported: boolean
	localStream: MediaStream | null
	screenStream: MediaStream | null
	remoteStream: MediaStream | null
	videoStream: MediaStream | null
}

const ActiveCall: React.FC<ActiveCallProps> = ({
	callInfo,
	onEndCall,
	onMuteToggle,
	onScreenShareToggle,
	onVideoToggle,
	isMuted,
	isScreenSharing,
	isVideoEnabled,
	isScreenShareSupported,
	localStream,
	screenStream,
	remoteStream,
	videoStream,
}) => {
	const remoteAudioRef = useRef<HTMLAudioElement>(null)
	const localAudioRef = useRef<HTMLAudioElement>(null)
	const remoteVideoRef = useRef<HTMLVideoElement>(null)
	const localVideoRef = useRef<HTMLVideoElement>(null)
	const localScreenRef = useRef<HTMLVideoElement>(null)
	const [duration, setDuration] = useState(0)
	const [isMinimized, setIsMinimized] = useState(false)
	const [connState, setConnState] = useState<string>('')
	const [iceType, setIceType] = useState<string>('')
	const [iceConnState, setIceConnState] = useState<string>('')
	const [signalingState, setSignalingState] = useState<string>('')
	const [remoteTrackCount, setRemoteTrackCount] = useState<number>(0)
	const [needUnmute, setNeedUnmute] = useState<boolean>(false)
	const [pingMs, setPingMs] = useState<number>(0)
	const [isScreenPip, setIsScreenPip] = useState(false)
	const [isScreenFullscreen, setIsScreenFullscreen] = useState(false)
	const [isScreenZoomed, setIsScreenZoomed] = useState(false)
	const webRTCService = useWebRTCService()
	const ringtoneRef = useRef<HTMLAudioElement | null>(null)
	const playAttemptRef = useRef<any>(null)
	const analyserRef = useRef<any>(null)
	const audioCtxRef = useRef<any>(null)
	const webAudioSourceRef = useRef<any>(null)
	const [webAudioEnabled, setWebAudioEnabled] = useState<boolean>(false)

	// Обновление длительности звонка
	useEffect(() => {
		if (callInfo.status === 'connected' && callInfo.startTime) {
			const interval = setInterval(() => {
				const elapsed = Math.floor(
					(Date.now() - callInfo.startTime!.getTime()) / 1000,
				)
				setDuration(elapsed)
			}, 1000)

			return () => clearInterval(interval)
		}
	}, [callInfo.status, callInfo.startTime])

	// Настройка удалённого аудио: включать только при установленном ICE-соединении
	useEffect(() => {
		const el = remoteAudioRef.current
		if (!el) return
		if (remoteStream) {
			el.srcObject = remoteStream
			el.muted = false
			el.volume = 1
			
			// Try to play and handle potential play restrictions
			const p = el.play()
			if (p && typeof p.catch === 'function') {
				p.catch(() => {
					setNeedUnmute(true)
					// If play failed, try to resume after user interaction
					const handleInteraction = () => {
						el.play().catch(() => setNeedUnmute(true))
						document.removeEventListener('click', handleInteraction)
						document.removeEventListener('touchstart', handleInteraction)
					}
					document.addEventListener('click', handleInteraction)
					document.addEventListener('touchstart', handleInteraction)
				})
			}
		} else {
			try {
				el.pause()
			} catch {}
			el.srcObject = null
			setNeedUnmute(false)
		}
	}, [remoteStream, callInfo.status, iceConnState])

	useEffect(() => {
		let timer: any
		const tryPlay = () => {
			const el = remoteAudioRef.current
			if (!el) return
			if (remoteStream) {
				if (el.paused || el.muted) {
					el.muted = false
					el.volume = 1
					const p = el.play()
					if (p && typeof p.then === 'function') {
						p.then(() => {
							setNeedUnmute(false)
							if (playAttemptRef.current) {
								clearInterval(playAttemptRef.current)
								playAttemptRef.current = null
							}
						}).catch(() => setNeedUnmute(true))
					}
				}
			}
		}
		tryPlay()
		timer = setInterval(tryPlay, 1500)
		playAttemptRef.current = timer
		return () => {
			if (timer) clearInterval(timer)
			playAttemptRef.current = null
		}
	}, [remoteStream])
	useEffect(() => {
		if (localAudioRef.current && localStream) {
			localAudioRef.current.srcObject = localStream
			const p = localAudioRef.current.play()
			if (p && typeof p.catch === 'function') p.catch(() => {})
		}
	}, [localStream])

	useEffect(() => {
		const el = localVideoRef.current
		if (!el) return
		const hasVideo = !!videoStream?.getVideoTracks().length
		if (videoStream && hasVideo) {
			el.srcObject = videoStream
			el.muted = true
			const p = el.play()
			if (p && typeof p.catch === 'function') p.catch(() => {})
		} else {
			try {
				el.pause()
			} catch {}
			el.srcObject = null
		}
	}, [videoStream])

	useEffect(() => {
		const el = remoteVideoRef.current
		if (!el) return
		const hasVideo = !!remoteStream?.getVideoTracks().length
		if (remoteStream && hasVideo) {
			el.srcObject = remoteStream
			el.muted = true
			const p = el.play()
			if (p && typeof p.catch === 'function') p.catch(() => {})
		} else {
			try {
				el.pause()
			} catch {}
			el.srcObject = null
		}
	}, [remoteStream])

	useEffect(() => {
		const el = localScreenRef.current
		if (!el) return
		const hasVideo = !!screenStream?.getVideoTracks().length
		if (screenStream && hasVideo) {
			el.srcObject = screenStream
			el.muted = true
			const p = el.play()
			if (p && typeof p.catch === 'function') p.catch(() => {})
		} else {
			try {
				el.pause()
			} catch {}
			el.srcObject = null
		}
	}, [screenStream])

	useEffect(() => {
		const start = () => {
			if (!ringtoneRef.current) {
				const src = getAttachmentUrl('/static/rington.wav')
				const el = new Audio(src)
				el.loop = true
				el.volume = 1
				ringtoneRef.current = el
			}
			const el = ringtoneRef.current!
			el.currentTime = 0
			el.play().catch(() => {})
		}
		const stop = () => {
			const el = ringtoneRef.current
			if (!el) return
			try {
				el.pause()
				el.currentTime = 0
			} catch {}
		}
		if (callInfo.status === 'calling') start()
		else stop()
		return () => stop()
	}, [callInfo.status])

	useEffect(() => {
		let timer: any
		const poll = async () => {
			try {
				if (!webRTCService || !callInfo.socketId) return
				const pc = webRTCService.getPeerConnection(callInfo.socketId)
				if (!pc) return
				setConnState(pc.connectionState || '')
				setIceConnState((pc as any).iceConnectionState || '')
				setSignalingState(pc.signalingState || '')
				const rs = webRTCService.getRemoteStream(callInfo.socketId)
				setRemoteTrackCount(rs ? rs.getTracks().length : 0)
				const stats = await pc.getStats()
				let selectedId = ''
				stats.forEach(r => {
					const anyr: any = r
					if (r.type === 'transport' && anyr.selectedCandidatePairId) {
						selectedId = anyr.selectedCandidatePairId
					}
				})
				let pair: any = null
				stats.forEach(r => {
					const anyr: any = r
					if (r.type === 'candidate-pair') {
						if (selectedId ? r.id === selectedId : anyr.selected) {
							pair = anyr
						}
					}
				})
				let localType = ''
				let remoteType = ''
				if (pair) {
					const localId = pair.localCandidateId
					const remoteId = pair.remoteCandidateId
					stats.forEach(r => {
						const anyr: any = r
						if (r.id === localId && anyr.candidateType)
							localType = anyr.candidateType
						if (r.id === remoteId && anyr.candidateType)
							remoteType = anyr.candidateType
					})
					const rtt =
						typeof pair.currentRoundTripTime === 'number'
							? pair.currentRoundTripTime * 1000
							: typeof pair.roundTripTime === 'number'
								? pair.roundTripTime * 1000
								: 0
					setPingMs(Math.max(0, Math.round(rtt)))
				}
				setIceType(localType || remoteType || '')
			} catch {}
		}
		poll()
		timer = setInterval(poll, 1000)
		return () => clearInterval(timer)
	}, [webRTCService, callInfo.socketId])

	useEffect(() => {
		if (!webRTCService) return
		const timer = setTimeout(() => {
			try {
				const allRemoteKeys = Array.from(
					webRTCService.getAllRemoteStreams().keys(),
				)
				const allPeerKeys = Array.from(
					webRTCService.getAllPeerConnections().keys(),
				)
				console.log(
					'Delayed check:',
					'remoteKeys=',
					allRemoteKeys,
					'peerKeys=',
					allPeerKeys,
					'currentSocketId=',
					callInfo.socketId,
				)
				if (
					allRemoteKeys.length > 0 &&
					!allRemoteKeys.includes(callInfo.socketId)
				) {
					console.warn(
						'Remote stream exists but under different key:',
						allRemoteKeys[0],
					)
				}
			} catch {}
		}, 1000)
		return () => clearTimeout(timer)
	}, [webRTCService, callInfo.socketId])
	useEffect(() => {
		if (!webRTCService) return
		try {
			const rsKeys = Array.from(webRTCService.getAllRemoteStreams().keys())
			const pcKeys = Array.from(webRTCService.getAllPeerConnections().keys())
			const sid = callInfo.socketId
			const stream = webRTCService.getRemoteStream(sid)
			console.log('Remote streams keys:', rsKeys)
			console.log('Peer connections keys:', pcKeys)
			console.log('Current call socketId:', sid)
			console.log('Remote stream for current key:', stream ? 'exists' : 'null')
		} catch {}
	}, [webRTCService, callInfo.socketId])

	const formatDuration = (seconds: number): string => {
		const mins = Math.floor(seconds / 60)
		const secs = seconds % 60
		return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
	}

	const handleEndCall = () => {
		onEndCall(callInfo.socketId)
	}

	const handleMuteToggle = () => {
		onMuteToggle()
		const el = remoteAudioRef.current
		if (el) {
			el.muted = false
			el.volume = 1
			const p = el.play()
			if (p && typeof p.catch === 'function') p.catch(() => setNeedUnmute(true))
		}
	}

	useEffect(() => {
		if (!remoteStream) return
		if (!remoteStream.getAudioTracks().length) return
		const AC: any =
			(window as any).AudioContext || (window as any).webkitAudioContext
		if (!AC) return
		const ctx = new AC()
		audioCtxRef.current = ctx
		const source = ctx.createMediaStreamSource(remoteStream)
		const analyser = ctx.createAnalyser()
		analyser.fftSize = 512
		try {
			if (ctx.state === 'suspended') {
				ctx.resume().catch(() => {})
			}
			source.connect(ctx.destination)
			webAudioSourceRef.current = source
			setWebAudioEnabled(true)
			console.log('Web Audio API playing')
		} catch {}
		source.connect(analyser)
		analyserRef.current = analyser
		const buf = new Uint8Array(analyser.frequencyBinCount)
		const tick = () => {
			analyser.getByteFrequencyData(buf)
			const avg = buf.reduce((a, b) => a + b, 0) / buf.length
			console.log('Audio volume level:', Math.round(avg))
			if (avg > 10) console.log('Audio data detected')
			requestAnimationFrame(tick)
		}
		tick()
		return () => {
			try {
				source.disconnect()
				if (webAudioSourceRef.current) {
					try {
						webAudioSourceRef.current.disconnect()
					} catch {}
					webAudioSourceRef.current = null
				}
				analyser.disconnect()
				ctx.close()
			} catch {}
			analyserRef.current = null
			setWebAudioEnabled(false)
			audioCtxRef.current = null
		}
	}, [remoteStream])

	useEffect(() => {
		const el = remoteAudioRef.current
		if (el && remoteStream) {
			console.log('Audio element state:', {
				srcObject: !!el.srcObject,
				muted: el.muted,
				volume: el.volume,
				paused: el.paused,
				currentTime: el.currentTime,
			})
		}
	}, [remoteStream, callInfo.status])

	const toggleMinimize = () => {
		setIsMinimized(!isMinimized)
	}

	const handleUserInteraction = () => {
		const el = remoteAudioRef.current
		if (el && remoteStream) {
			el.muted = false
			el.volume = 1
			const p = el.play()
			if (p && typeof p.catch === 'function') p.catch(() => setNeedUnmute(true))
		}
	}

	const getPrimaryVideo = () => {
		if (screenStream?.getVideoTracks().length && localScreenRef.current) {
			return localScreenRef.current
		}
		if (remoteStream?.getVideoTracks().length && remoteVideoRef.current) {
			return remoteVideoRef.current
		}
		return null
	}

	const togglePictureInPicture = async () => {
		const video = getPrimaryVideo()
		if (!video) return
		if (
			'pictureInPictureEnabled' in document &&
			document.pictureInPictureEnabled
		) {
			if (document.pictureInPictureElement) {
				await document.exitPictureInPicture()
				setIsScreenPip(false)
				return
			}
			try {
				await (video as any).requestPictureInPicture()
				setIsScreenPip(true)
			} catch {}
		}
	}

	const toggleFullscreen = async () => {
		const root = document.documentElement
		if (document.fullscreenElement) {
			await document.exitFullscreen()
			return
		}
		try {
			await root.requestFullscreen()
		} catch {}
	}
	useEffect(() => {
		const handleFullscreenChange = () => {
			setIsScreenFullscreen(!!document.fullscreenElement)
		}
		document.addEventListener('fullscreenchange', handleFullscreenChange)
		return () => {
			document.removeEventListener('fullscreenchange', handleFullscreenChange)
		}
	}, [])
	const hasScreenVideo =
		!!screenStream?.getVideoTracks().length ||
		!!remoteStream?.getVideoTracks().length ||
		!!videoStream?.getVideoTracks().length
	const screenShareDisabled = !isScreenShareSupported
	const statusLabel =
		callInfo.status === 'connected'
			? 'В сети'
			: callInfo.status === 'calling'
				? 'Звонок...'
				: callInfo.status === 'ringing'
					? 'Ожидание ответа...'
					: callInfo.status === 'failed'
						? 'Ошибка'
						: callInfo.status === 'ended'
							? 'Завершено'
							: callInfo.status === 'rejected'
								? 'Отклонено'
								: 'Звонок'
	const statusLine = (() => {
		const mapConn: Record<string, string> = {
			new: 'Инициализация',
			connecting: 'Подключение',
			connected: 'Подключено',
			disconnected: 'Отключено',
			failed: 'Ошибка',
			closed: 'Закрыто',
		}
		const mapIce: Record<string, string> = {
			new: 'Инициализация',
			checking: 'Проверка путей',
			connected: 'Подключено',
			completed: 'Завершено',
			disconnected: 'Отключено',
			failed: 'Ошибка',
			closed: 'Закрыто',
		}
		const mapType: Record<string, string> = {
			host: 'Прямой',
			srflx: 'Через NAT',
			prflx: 'Peer Reflexive',
			relay: 'Через TURN',
		}
		const connLbl = mapConn[connState] || connState || 'Неизвестно'
		const iceLbl = mapIce[iceConnState] || iceConnState || ''
		const pathLbl = mapType[iceType] || (iceType ? iceType : '')
		const pingLbl = pingMs > 0 ? ` · Пинг: ${pingMs} мс` : ''
		const pathPart = pathLbl ? ` · Путь: ${pathLbl}` : ''
		const icePart = iceLbl ? ` · ICE: ${iceLbl}` : ''
		return `Статус: ${connLbl}${pathPart}${icePart}${pingLbl}`
	})()
	const avatarUrl = callInfo.avatarUrl
		? getAttachmentUrl(callInfo.avatarUrl)
		: ''

	const handleUnlockAudio = async () => {
		try {
			const ctx: AudioContext | null = audioCtxRef.current
			if (ctx && ctx.state === 'suspended') {
				await ctx.resume()
			}
			if (!webAudioSourceRef.current && remoteStream && ctx) {
				const src = ctx.createMediaStreamSource(remoteStream)
				src.connect(ctx.destination)
				webAudioSourceRef.current = src
				setWebAudioEnabled(true)
			}
		} catch {}
	}

	useEffect(() => {
		if (!remoteStream) return
		try {
			remoteStream.getTracks().forEach(t => {
				if (!t.enabled) t.enabled = true
			})
		} catch {}
	}, [remoteStream])

	if (isMinimized) {
		return (
			<div className='fixed left-1/2 top-4 z-40 w-[min(92vw,760px)] -translate-x-1/2 rounded-3xl border border-white/10 bg-gradient-to-br from-black/90 via-black/80 to-zinc-900/80 px-4 py-3 text-white shadow-2xl backdrop-blur'>
				<div className='flex items-center justify-between gap-3'>
					<button
						onClick={toggleMinimize}
						className='flex items-center gap-3 text-left'
						aria-label='Развернуть'
					>
						<div className='h-9 w-9 overflow-hidden rounded-2xl bg-white/10 flex items-center justify-center'>
							{avatarUrl ? (
								<img
									src={avatarUrl}
									alt={callInfo.userName || 'Собеседник'}
									className='h-full w-full object-cover'
								/>
							) : (
								<span className='text-sm font-semibold'>
									{(callInfo.userName || 'V').slice(0, 1).toUpperCase()}
								</span>
							)}
						</div>
						<div>
							<p className='text-xs font-semibold text-white truncate'>
								{callInfo.userName || 'Звонок'}
							</p>
							<p className='text-[10px] text-white/60'>
								{formatDuration(duration)} · {statusLabel}
							</p>
						</div>
					</button>
					<div className='flex items-center gap-2'>
						<button
							onClick={handleMuteToggle}
							className={`rounded-xl border px-2 py-1 text-white transition ${
								isMuted
									? 'border-rose-500/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20'
									: 'border-white/10 bg-white/5 hover:bg-white/10'
							}`}
							title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
						>
							{isMuted ? '🔇' : '🎤'}
						</button>
						<button
							onClick={handleEndCall}
							className='rounded-xl border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-rose-200 transition hover:bg-rose-500/20'
							title='Завершить звонок'
						>
							📞
						</button>
					</div>
				</div>
			</div>
		)
	}

	return (
		<div
			className='fixed left-1/2 top-4 z-40 w-[min(92vw,760px)] -translate-x-1/2 rounded-3xl border border-white/10 bg-gradient-to-br from-black/90 via-black/80 to-zinc-900/80 p-4 text-white shadow-2xl backdrop-blur'
			onClick={handleUserInteraction}
		>
			<div className='flex items-start justify-between gap-3'>
				<div className='flex items-center gap-3 min-w-0'>
					<div className='h-10 w-10 overflow-hidden rounded-2xl bg-white/10 flex items-center justify-center'>
						{avatarUrl ? (
							<img
								src={avatarUrl}
								alt={callInfo.userName || 'Собеседник'}
								className='h-full w-full object-cover'
							/>
						) : (
							<span className='text-sm font-semibold'>
								{(callInfo.userName || 'V').slice(0, 1).toUpperCase()}
							</span>
						)}
					</div>
					<div className='min-w-0'>
						<p className='text-sm font-semibold truncate'>
							{callInfo.userName || 'Звонок'}
						</p>
						<div className='mt-1 flex items-center gap-2 text-[10px] text-white/60'>
							<span className='rounded-full bg-white/10 px-2 py-0.5 text-white/70'>
								{statusLabel}
							</span>
							<span>{formatDuration(duration)}</span>
						</div>
						<p className='mt-1 text-[10px] text-white/50'>{statusLine}</p>
						<p className='text-[10px] text-white/50'>
							{`Треки собеседника: ${remoteTrackCount}`}
						</p>
					</div>
				</div>
				<button
					onClick={toggleMinimize}
					className='rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-white hover:bg-white/10'
					title='Свернуть'
				>
					➖
				</button>
			</div>

			{(hasScreenVideo || videoStream?.getVideoTracks().length) && (
				<div className='mt-3 grid gap-3'>
					{screenStream?.getVideoTracks().length ? (
						<div className='rounded-2xl border border-white/10 bg-white/5 p-2'>
							<video
								ref={localScreenRef}
								autoPlay
								playsInline
								muted
								className='h-44 w-full rounded-xl bg-black object-cover'
							/>
							<span className='mt-2 block text-xs text-white/70'>
								Ваш экран
							</span>
						</div>
					) : null}
					{videoStream?.getVideoTracks().length ? (
						<div className='rounded-2xl border border-white/10 bg-white/5 p-2'>
							<video
								ref={localVideoRef}
								autoPlay
								playsInline
								muted
								className='h-44 w-full rounded-xl bg-black object-cover'
							/>
							<span className='mt-2 block text-xs text-white/70'>
								Ваше видео
							</span>
						</div>
					) : null}
					{remoteStream?.getVideoTracks().length ? (
						<div className='rounded-2xl border border-white/10 bg-white/5 p-2'>
							<video
								ref={remoteVideoRef}
								autoPlay
								playsInline
								muted
								className={`h-44 w-full rounded-xl bg-black object-cover ${
									isScreenZoomed ? 'scale-105' : ''
								}`}
							/>
							<span className='mt-2 block text-xs text-white/70'>
								{callInfo.userName || 'Экран собеседника'}
							</span>
						</div>
					) : remoteStream ? (
						<div className='rounded-2xl border border-white/10 bg-white/5 p-2 flex items-center justify-center'>
							<div className='text-center'>
								<div className='mx-auto h-16 w-16 rounded-full bg-gray-700 flex items-center justify-center'>
									<span className='text-2xl'>👤</span>
								</div>
								<p className='mt-2 text-xs text-white/70'>
									{callInfo.userName || 'Собеседник'}
								</p>
								<p className='text-[10px] text-white/50 mt-1'>
									Камера выключена
								</p>
							</div>
						</div>
					) : null}
				</div>
			)}

			<div className='mt-3 flex flex-wrap items-center justify-center gap-2'>
				{needUnmute && (
					<button
						onClick={() => {
							const el = remoteAudioRef.current
							if (el) {
								el.muted = false
								el.volume = 1
								const p = el.play()
								if (p && typeof p.catch === 'function') p.catch(() => {})
								setNeedUnmute(false)
							}
						}}
						className='rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-emerald-200 transition hover:bg-emerald-500/20'
						title='Включить звук собеседника'
					>
						🔊 Включить звук
					</button>
				)}
				{webAudioEnabled &&
					audioCtxRef.current &&
					audioCtxRef.current.state === 'suspended' && (
						<button
							onClick={handleUnlockAudio}
							className='rounded-2xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-200 transition hover:bg-amber-500/20'
							title='Разблокировать аудио'
						>
							🔓 Разблокировать звук
						</button>
					)}
				<button
					onClick={handleMuteToggle}
					className={`rounded-2xl border px-4 py-2 text-white transition ${
						isMuted
							? 'border-rose-500/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20'
							: 'border-white/10 bg-white/5 hover:bg-white/10'
					}`}
					title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
				>
					{isMuted ? '🔇' : '🎤'}
				</button>
				{hasScreenVideo && (
					<>
						<button
							onClick={togglePictureInPicture}
							className={`rounded-2xl border px-4 py-2 text-white transition ${
								isScreenPip
									? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/20'
									: 'border-white/10 bg-white/5 hover:bg-white/10'
							}`}
							title={isScreenPip ? 'Скрыть окно' : 'Вынести в окно'}
						>
							🗔
						</button>
						<button
							onClick={toggleFullscreen}
							className={`rounded-2xl border px-4 py-2 text-white transition ${
								isScreenFullscreen
									? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/20'
									: 'border-white/10 bg-white/5 hover:bg-white/10'
							}`}
							title={
								isScreenFullscreen ? 'Выйти из полноэкранного' : 'Во весь экран'
							}
						>
							⛶
						</button>
						<button
							onClick={() => setIsScreenZoomed(prev => !prev)}
							className={`rounded-2xl border px-4 py-2 text-white transition ${
								isScreenZoomed
									? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/20'
									: 'border-white/10 bg-white/5 hover:bg-white/10'
							}`}
							title={isScreenZoomed ? 'Обычный размер' : 'Увеличить'}
						>
							🔍
						</button>
					</>
				)}
				<button
					onClick={onVideoToggle}
					className={`rounded-2xl border px-4 py-2 text-white transition ${
						isVideoEnabled
							? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20'
							: 'border-white/10 bg-white/5 hover:bg-white/10'
					}`}
					title={isVideoEnabled ? 'Выключить камеру' : 'Включить камеру'}
				>
					{isVideoEnabled ? '📹' : '📷'}
				</button>
				<button
					onClick={onScreenShareToggle}
					disabled={screenShareDisabled}
					className={`rounded-2xl border px-4 py-2 text-white transition ${
						screenShareDisabled
							? 'border-white/10 bg-white/5 opacity-60'
							: isScreenSharing
								? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20'
								: 'border-white/10 bg-white/5 hover:bg-white/10'
					}`}
					title={
						screenShareDisabled
							? 'Демонстрация экрана недоступна на этом устройстве'
							: isScreenSharing
								? 'Остановить демонстрацию'
								: 'Демонстрация экрана'
					}
				>
					🖥️
				</button>
				<button
					onClick={handleEndCall}
					className='rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-rose-200 transition hover:bg-rose-500/20'
					title='Завершить звонок'
				>
					📞
				</button>
			</div>

			<audio ref={remoteAudioRef} autoPlay playsInline />
			<audio ref={localAudioRef} autoPlay playsInline muted />
		</div>
	)
}

export default ActiveCall
