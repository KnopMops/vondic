'use client'

import { useWebRTCService } from '@/lib/stores/callStore'
import { getAttachmentUrl } from '@/lib/utils'
import React, { useEffect, useRef, useState } from 'react'
import { CallState } from '../../lib/services/WebRTCService'

interface ActiveCallProps {
	callInfo: CallState
	onEndCall: (socketId: string) => void
	onMuteToggle: () => void
	isMuted: boolean
	localStream: MediaStream | null
	remoteStream: MediaStream | null
}

const ActiveCall: React.FC<ActiveCallProps> = ({
	callInfo,
	onEndCall,
	onMuteToggle,
	isMuted,
	localStream,
	remoteStream,
}) => {
	const remoteAudioRef = useRef<HTMLAudioElement>(null)
	const localAudioRef = useRef<HTMLAudioElement>(null)
	const [duration, setDuration] = useState(0)
	const [isMinimized, setIsMinimized] = useState(false)
	const [connState, setConnState] = useState<string>('')
	const [iceType, setIceType] = useState<string>('')
	const [iceConnState, setIceConnState] = useState<string>('')
	const [signalingState, setSignalingState] = useState<string>('')
	const [remoteTrackCount, setRemoteTrackCount] = useState<number>(0)
	const [needUnmute, setNeedUnmute] = useState<boolean>(false)
	const [pingMs, setPingMs] = useState<number>(0)
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
			const p = el.play()
			if (p && typeof p.catch === 'function') p.catch(() => setNeedUnmute(true))
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
			<div className='active-call minimized'>
				<div className='minimized-call-info' onClick={toggleMinimize}>
					<span className='call-icon'>📞</span>
					<span className='call-duration'>{formatDuration(duration)}</span>
					<span className='call-status'>{callInfo.status}</span>
				</div>
				<div className='minimized-controls'>
					<button
						onClick={handleMuteToggle}
						className={`mute-button ${isMuted ? 'muted' : ''}`}
						title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
					>
						{isMuted ? '🔇' : '🎤'}
					</button>
					<button
						onClick={handleEndCall}
						className='end-call-button'
						title='Завершить звонок'
					>
						📞
					</button>
				</div>
			</div>
		)
	}

	return (
		<div className='active-call' onClick={handleUserInteraction}>
			<div className='call-header'>
				<div className='call-info'>
					<h3 className='call-title'>
						{callInfo.status === 'connected' ? 'Звонок с' : 'Звоним'}{' '}
						{callInfo.userName || 'Неизвестный пользователь'}
					</h3>
					<div className='call-meta'>
						<span className='call-duration'>{formatDuration(duration)}</span>
						<span className={`call-status status-${callInfo.status}`}>
							{(() => {
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
							})()}
						</span>
						<span className='call-status'>
							{`Треки собеседника: ${remoteTrackCount}`}
						</span>
					</div>
				</div>
				<button
					onClick={toggleMinimize}
					className='minimize-button'
					title='Свернуть'
				>
					➖
				</button>
			</div>

			<div className='call-content'>
				<div className='audio-visualization'>
					<div className='local-audio-indicator'>
						<div className={`audio-level ${isMuted ? 'muted' : 'active'}`}>
							<span className='audio-icon'>{isMuted ? '🔇' : '🎤'}</span>
							<span className='audio-label'>Вы</span>
						</div>
					</div>

					<div className='remote-audio-indicator'>
						<div
							className={`audio-level ${remoteStream ? 'active' : 'inactive'}`}
						>
							<span className='audio-icon'>🔊</span>
							<span className='audio-label'>
								{callInfo.userName || 'Собеседник'}
							</span>
						</div>
					</div>
				</div>
			</div>

			<div className='call-controls'>
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
						className='unmute-button'
						title='Включить звук собеседника'
					>
						<span className='button-icon'>🔊</span>
						<span className='button-text'>Включить звук</span>
					</button>
				)}
				{needUnmute && (
					<span className='unmute-hint'>
						Нажмите, чтобы разблокировать звук
					</span>
				)}
				{webAudioEnabled && audioCtxRef.current && audioCtxRef.current.state === 'suspended' && (
					<button
						onClick={handleUnlockAudio}
						className='unlock-audio-button'
						title='Разблокировать аудио'
					>
						<span className='button-icon'>🔓</span>
						<span className='button-text'>Разблокировать звук</span>
					</button>
				)}
				<button
					onClick={handleMuteToggle}
					className={`mute-button ${isMuted ? 'muted' : ''}`}
					title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
				>
					<span className='button-icon'>{isMuted ? '🔇' : '🎤'}</span>
					<span className='button-text'>
						{isMuted ? 'Включить' : 'Выключить'}
					</span>
				</button>

				<button
					onClick={handleEndCall}
					className='end-call-button'
					title='Завершить звонок'
				>
					<span className='button-icon'>📞</span>
					<span className='button-text'>Завершить</span>
				</button>
			</div>

			{/* Скрытые аудио элементы */}
			<audio ref={remoteAudioRef} autoPlay playsInline />
			<audio ref={localAudioRef} autoPlay playsInline muted />
		</div>
	)
}

export default ActiveCall
