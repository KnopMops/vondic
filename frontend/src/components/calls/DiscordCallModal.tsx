'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
	MicIcon,
	MicOffIcon,
	VideoIcon,
	VideoOffIcon,
	MonitorIcon,
	PhoneOffIcon,
	Maximize2Icon,
	Minimize2Icon,
	RadioIcon,
	SparklesIcon,
	ZapIcon,
	CheckIcon,
	ActivityIcon,
	CrownIcon,
	PinIcon,
	PinOffIcon,
	LayoutGridIcon,
	TvIcon,
	ShieldCheckIcon,
	ShieldIcon,
} from 'lucide-react'
import {
	AudioBitratePreset,
	AUDIO_BITRATE_PRESETS,
	NetworkQualityStats,
	ScreenSharePresetKey,
	SCREEN_SHARE_PRESETS,
} from '../../lib/services/AudioProcessor'

/**
 * Надежный плеер видеопотока WebRTC (камера / демонстрация экрана).
 * Всегда использует muted={true} для обхода блокировки Autoplay Policy в браузерах
 * и исключения эха (аудио воспроизводится отдельно через WebRTC transceivers).
 */
const StreamVideo = React.memo(({
	stream,
	className = 'w-full h-full object-cover',
}: {
	stream: MediaStream
	className?: string
}) => {
	const videoRef = useRef<HTMLVideoElement | null>(null)
	const [videoTrackVersion, setVideoTrackVersion] = useState(0)

	// Listen for track changes on the stream (e.g. video track added/removed)
	useEffect(() => {
		if (!stream) return

		const handleTracksChanged = () => {
			setVideoTrackVersion(v => v + 1)
		}

		stream.addEventListener('addtrack', handleTracksChanged)
		stream.addEventListener('removetrack', handleTracksChanged)

		return () => {
			stream.removeEventListener('addtrack', handleTracksChanged)
			stream.removeEventListener('removetrack', handleTracksChanged)
		}
	}, [stream])

	useEffect(() => {
		const el = videoRef.current
		if (!el || !stream) return

		// Extract only live video tracks.
		const liveVideoTracks = stream.getVideoTracks().filter(t => t.readyState === 'live')
		if (liveVideoTracks.length === 0) {
			if (el.srcObject) {
				el.srcObject = null
			}
			return
		}

		// Prevent re-assigning srcObject if it already plays the same track.
		// Re-assigning srcObject causes Chromium to reset hardware decoding and show a black screen!
		const currentSrcStream = el.srcObject as MediaStream | null
		const currentTrackId = currentSrcStream?.getVideoTracks()[0]?.id
		const newTrack = liveVideoTracks[0]

		if (!currentSrcStream || currentTrackId !== newTrack.id) {
			const videoStream = new MediaStream(liveVideoTracks)
			el.srcObject = videoStream
			el.muted = true
			el.playsInline = true
		}

		newTrack.enabled = true

		const attemptPlay = () => {
			if (el && el.paused) {
				el.play().catch(() => {
					// Safe autoplay policy handling
				})
			}
		}

		liveVideoTracks.forEach(track => {
			track.enabled = true
			track.addEventListener('unmute', attemptPlay)
			track.addEventListener('ended', () => setVideoTrackVersion(v => v + 1))
		})

		attemptPlay()

		return () => {
			liveVideoTracks.forEach(track => {
				track.removeEventListener('unmute', attemptPlay)
			})
		}
	}, [stream, videoTrackVersion])

	return (
		<video
			ref={videoRef}
			autoPlay
			playsInline
			muted
			onLoadedMetadata={e => {
				;(e.target as HTMLVideoElement).play().catch(() => {})
			}}
			onCanPlay={e => {
				;(e.target as HTMLVideoElement).play().catch(() => {})
			}}
			className={className}
		/>
	)
})
StreamVideo.displayName = 'StreamVideo'

export interface Participant {
	id: string
	name: string
	avatar?: string
	socketId?: string
	isMuted?: boolean
	isSpeaking?: boolean
	isVideoOn?: boolean
}

export interface DiscordCallModalProps {
	title: string
	subtitle?: string
	participants: Participant[]
	localStream: MediaStream | null
	videoStream: MediaStream | null
	screenStream: MediaStream | null
	remoteStreams: Map<string, MediaStream>
	remoteScreenShare?: { socketId: string; userId?: string; isSharing: boolean } | null
	screenSharePreset?: ScreenSharePresetKey
	isMuted: boolean
	isVideoEnabled: boolean
	isScreenSharing: boolean
	isScreenShareSupported: boolean
	isKrispEnabled?: boolean
	isPremium?: boolean
	audioQualityPreset?: AudioBitratePreset
	networkStats?: NetworkQualityStats | null
	isDataSaver?: boolean
	isIpPrivacy?: boolean
	onMuteToggle: () => void
	onVideoToggle: () => void
	onScreenShareToggle: () => void
	onScreenSharePresetChange?: (preset: ScreenSharePresetKey) => void
	onKrispToggle?: () => void
	onAudioQualityChange?: (preset: AudioBitratePreset) => void
	onDataSaverToggle?: () => void
	onIpPrivacyToggle?: () => void
	onDisconnect: () => void
}

export const DiscordCallModal: React.FC<DiscordCallModalProps> = ({
	title,
	subtitle,
	participants,
	localStream,
	videoStream,
	screenStream,
	remoteStreams,
	remoteScreenShare,
	screenSharePreset = 'screen1080p60',
	isMuted,
	isVideoEnabled,
	isScreenSharing,
	isScreenShareSupported,
	isKrispEnabled = false,
	isPremium = false,
	audioQualityPreset = 'boost1',
	networkStats,
	isDataSaver = false,
	isIpPrivacy = false,
	onMuteToggle,
	onVideoToggle,
	onScreenShareToggle,
	onScreenSharePresetChange,
	onKrispToggle,
	onAudioQualityChange,
	onDataSaverToggle,
	onIpPrivacyToggle,
	onDisconnect,
}) => {
	const [isFullscreen, setIsFullscreen] = useState(false)
	const [allowVideoInDataSaver, setAllowVideoInDataSaver] = useState(false)
	const [isQualityMenuOpen, setIsQualityMenuOpen] = useState(false)
	const [isScreenQualityMenuOpen, setIsScreenQualityMenuOpen] = useState(false)
	const [pinnedParticipantId, setPinnedParticipantId] = useState<string | null>(null)
	const [viewModeOverride, setViewModeOverride] = useState<'auto' | 'grid' | 'stage'>('auto')

	const containerRef = useRef<HTMLDivElement>(null)
	const qualityMenuRef = useRef<HTMLDivElement>(null)
	const screenQualityMenuRef = useRef<HTMLDivElement>(null)

	// Закрытие выпадающих меню при клике снаружи
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (qualityMenuRef.current && !qualityMenuRef.current.contains(e.target as Node)) {
				setIsQualityMenuOpen(false)
			}
			if (screenQualityMenuRef.current && !screenQualityMenuRef.current.contains(e.target as Node)) {
				setIsScreenQualityMenuOpen(false)
			}
		}
		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [])

	const toggleFullscreen = () => {
		if (!document.fullscreenElement) {
			containerRef.current?.requestFullscreen().catch(() => {})
			setIsFullscreen(true)
		} else {
			document.exitFullscreen().catch(() => {})
			setIsFullscreen(false)
		}
	}

	// Определение потока экрана (локального или удаленного)
	const localScreenStream = useMemo(() => {
		return isScreenSharing && screenStream ? screenStream : null
	}, [isScreenSharing, screenStream])

	const remoteScreenStream = useMemo(() => {
		// 1. Если пришел явный сокет-сигнал remoteScreenShare с флагом isSharing:
		if (remoteScreenShare?.isSharing) {
			// 1a. Прямой поиск по socketId
			if (remoteScreenShare.socketId && remoteStreams.has(remoteScreenShare.socketId)) {
				const s = remoteStreams.get(remoteScreenShare.socketId)
				if (s && s.getVideoTracks().some(t => t.readyState === 'live')) return s
			}

			// 1b. Прямой поиск по userId
			if (remoteScreenShare.userId && remoteStreams.has(remoteScreenShare.userId)) {
				const s = remoteStreams.get(remoteScreenShare.userId)
				if (s && s.getVideoTracks().some(t => t.readyState === 'live')) return s
			}

			// 1c. Поиск через сопоставление участников
			const matchedParticipant = participants.find(
				p =>
					(remoteScreenShare.socketId && p.socketId === remoteScreenShare.socketId) ||
					(remoteScreenShare.userId && p.id === remoteScreenShare.userId),
			)
			if (matchedParticipant?.socketId && remoteStreams.has(matchedParticipant.socketId)) {
				const s = remoteStreams.get(matchedParticipant.socketId)
				if (s && s.getVideoTracks().some(t => t.readyState === 'live')) return s
			}
			if (matchedParticipant?.id && remoteStreams.has(matchedParticipant.id)) {
				const s = remoteStreams.get(matchedParticipant.id)
				if (s && s.getVideoTracks().some(t => t.readyState === 'live')) return s
			}
		}

		// 2. В звонке 1-на-1: если единственный собеседник отдает живое видео
		if (remoteStreams.size === 1) {
			const singleStream = remoteStreams.values().next().value
			if (singleStream && singleStream.getVideoTracks().some(t => t.readyState === 'live')) {
				return singleStream
			}
		}

		// 3. Гарантированный фоллбэк: ищем любой удаленный поток с живыми видеотреками
		for (const [key, s] of remoteStreams.entries()) {
			if (s && s.getVideoTracks().some(t => t.readyState === 'live')) {
				return s
			}
		}

		return null
	}, [remoteScreenShare, remoteStreams, participants])

	const activeScreenStream = localScreenStream || remoteScreenStream

	// Определение пользователя, транслирующего экран
	const screenSharerParticipant = useMemo(() => {
		if (localScreenStream) {
			return participants.find(p => p.id === 'me') || { id: 'me', name: 'Вы' }
		}
		if (remoteScreenShare?.isSharing) {
			const found = participants.find(
				p => p.socketId === remoteScreenShare.socketId || p.id === remoteScreenShare.userId,
			)
			if (found) return found
		}
		if (remoteScreenStream) {
			for (const [key, s] of remoteStreams.entries()) {
				if (s === remoteScreenStream) {
					const p = participants.find(part => part.socketId === key || part.id === key)
					if (p) return p
				}
			}
			const other = participants.find(p => p.id !== 'me')
			if (other) return other
			return { id: 'remote', name: 'Собеседник' }
		}
		return null
	}, [localScreenStream, remoteScreenShare, remoteScreenStream, remoteStreams, participants])

	// Вспомогательная функция для получения видеопотока участника (камера)
	const getParticipantVideoStream = (p: Participant): MediaStream | null => {
		if (p.id === 'me') {
			return isVideoEnabled && videoStream ? videoStream : null
		}

		let stream: MediaStream | undefined = undefined
		if (p.socketId && remoteStreams.has(p.socketId)) {
			stream = remoteStreams.get(p.socketId)
		}
		if (!stream && p.id && remoteStreams.has(p.id)) {
			stream = remoteStreams.get(p.id)
		}
		// In 1-on-1 call, fallback to the single remote stream
		if (!stream && remoteStreams.size === 1 && p.id !== 'me') {
			stream = remoteStreams.values().next().value
		}
		if (stream && stream.getVideoTracks().some(t => t.readyState === 'live')) {
			return stream
		}
		return null
	}

	// Проверка наличия видео у участника
	const hasParticipantVideo = (p: Participant): boolean => {
		if (p.id === 'me') {
			return Boolean(
				isVideoEnabled &&
					videoStream &&
					videoStream.getVideoTracks().some(t => t.readyState === 'live'),
			)
		}
		const stream = getParticipantVideoStream(p)
		return Boolean(stream)
	}

	// Эффективный режим отображения (Hero Stage vs Grid)
	const isStageMode = useMemo(() => {
		if (viewModeOverride === 'grid') return false
		if (viewModeOverride === 'stage') return true
		return Boolean(activeScreenStream || pinnedParticipantId)
	}, [viewModeOverride, activeScreenStream, pinnedParticipantId])

	// Закрепленный участник для фокуса
	const pinnedParticipant = useMemo(() => {
		if (!pinnedParticipantId) return null
		return participants.find(p => p.id === pinnedParticipantId) || null
	}, [pinnedParticipantId, participants])

	const currentPresetInfo =
		AUDIO_BITRATE_PRESETS[audioQualityPreset] || AUDIO_BITRATE_PRESETS.boost1
	const currentScreenPresetInfo =
		SCREEN_SHARE_PRESETS[screenSharePreset] || SCREEN_SHARE_PRESETS.screen1080p60

	return (
		<div
			ref={containerRef}
			className="fixed inset-0 z-50 bg-[#1e1f22] text-white flex flex-col overflow-hidden font-sans select-none"
		>
			{/* Top Header Bar */}
			<div className="h-14 px-4 sm:px-6 bg-[#2b2d31]/90 backdrop-blur-md border-b border-white/[0.08] flex items-center justify-between z-20 shrink-0">
				<div className="flex items-center gap-3 min-w-0">
					<div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
						<RadioIcon className="w-4 h-4 animate-pulse" />
					</div>
					<div className="min-w-0">
						<h3 className="font-bold text-sm tracking-wide text-gray-100 flex items-center gap-2 truncate">
							{title}
						</h3>
						{subtitle && <p className="text-[11px] text-gray-400 truncate">{subtitle}</p>}
					</div>
				</div>

				<div className="flex items-center gap-2 sm:gap-3">
					{/* Real-time Network Metrics Badge (RTT & Packet Loss) */}
					{networkStats && (
						<div
							className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
								networkStats.qualityGrade === 'excellent' || networkStats.qualityGrade === 'good'
									? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
									: networkStats.qualityGrade === 'fair'
									? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
									: 'bg-red-500/10 text-red-400 border-red-500/20'
							}`}
							title={`Пинг: ${networkStats.ping} мс | Потери пакетов: ${networkStats.packetLoss}% | Битрейт: ${Math.round(networkStats.currentBitrate / 1000)} кбит/с`}
						>
							<ActivityIcon className="w-3.5 h-3.5 animate-pulse" />
							<span>{networkStats.ping} ms</span>
							{networkStats.packetLoss > 0 && (
								<span className="opacity-80">({networkStats.packetLoss}% loss)</span>
							)}
						</div>
					)}

					{/* Data Saver Mode Pill */}
					{onDataSaverToggle && (
						<button
							onClick={onDataSaverToggle}
							className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border transition-all font-semibold cursor-pointer shadow-sm ${
								isDataSaver
									? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-amber-500/10'
									: 'bg-[#313338] hover:bg-[#383a40] text-gray-400 hover:text-gray-200 border-white/10'
							}`}
							title={
								isDataSaver
									? 'Режим экономии трафика: ВКЛ (звук 32 кбит/с с DTX, видеопотоки на паузе)'
									: 'Включить режим экономии мобильного трафика'
							}
						>
							<ZapIcon className={`w-3.5 h-3.5 ${isDataSaver ? 'text-amber-400 fill-amber-400' : 'text-gray-400'}`} />
							<span className="hidden sm:inline">Эконом</span>
						</button>
					)}

					{/* IP Privacy Mode Pill */}
					{onIpPrivacyToggle && (
						<button
							onClick={onIpPrivacyToggle}
							className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border transition-all font-semibold cursor-pointer shadow-sm ${
								isIpPrivacy
									? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-emerald-500/10'
									: 'bg-[#313338] hover:bg-[#383a40] text-gray-400 hover:text-gray-200 border-white/10'
							}`}
							title={
								isIpPrivacy
									? 'IP скрыт: соединение идёт строго через Vondic Relay, прямой P2P отключён'
									: 'Включить защиту IP: скрыть свой реальный IP через защищённый Vondic Relay'
							}
						>
							<ShieldCheckIcon className={`w-3.5 h-3.5 ${isIpPrivacy ? 'text-emerald-400' : 'text-gray-400'}`} />
							<span className="hidden sm:inline">{isIpPrivacy ? 'IP скрыт' : 'Скрыть IP'}</span>
						</button>
					)}

					{/* Discord Boost Bitrate Selector */}
					{onAudioQualityChange && (
						<div className="relative" ref={qualityMenuRef}>
							<button
								onClick={() => setIsQualityMenuOpen(!isQualityMenuOpen)}
								className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-full bg-[#313338] hover:bg-[#383a40] text-indigo-300 hover:text-indigo-200 border border-indigo-500/30 transition-all font-semibold shadow-sm cursor-pointer"
								title="Управление качеством звука (Discord Boost)"
							>
								<ZapIcon className="w-3.5 h-3.5 text-indigo-400 fill-indigo-400" />
								<span className="hidden sm:inline">{currentPresetInfo.shortLabel}</span>
							</button>

							{isQualityMenuOpen && (
								<div className="absolute right-0 mt-2 w-64 bg-[#2b2d31] border border-white/10 rounded-xl shadow-2xl p-2 z-50 flex flex-col gap-1 backdrop-blur-lg">
									<div className="px-3 py-1.5 border-b border-white/5 mb-1">
										<div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
											Качество канала (Opus)
										</div>
										<div className="text-[10px] text-gray-500">
											Адаптивный битрейт уровня Discord
										</div>
									</div>

									{(Object.entries(AUDIO_BITRATE_PRESETS) as [AudioBitratePreset, typeof currentPresetInfo][]).map(
										([presetKey, info]) => {
											const isSelected = audioQualityPreset === presetKey
											return (
												<button
													key={presetKey}
													onClick={() => {
														onAudioQualityChange(presetKey)
														setIsQualityMenuOpen(false)
													}}
													className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between ${
														isSelected
															? 'bg-indigo-600/20 text-indigo-300 font-semibold'
															: 'hover:bg-white/5 text-gray-300'
													}`}
												>
													<div className="flex flex-col gap-0.5">
														<span className="font-medium text-gray-200">{info.label}</span>
														<span className="text-[10px] text-gray-400">
															{info.description}
														</span>
													</div>
													{isSelected && <CheckIcon className="w-4 h-4 text-indigo-400 shrink-0 ml-2" />}
												</button>
											)
										},
									)}
								</div>
							)}
						</div>
					)}

					{/* Discord Screen Share Quality Selector */}
					{onScreenSharePresetChange && (isScreenSharing || activeScreenStream) && (
						<div className="relative" ref={screenQualityMenuRef}>
							<button
								onClick={() => setIsScreenQualityMenuOpen(!isScreenQualityMenuOpen)}
								className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-full bg-[#313338] hover:bg-[#383a40] text-emerald-300 hover:text-emerald-200 border border-emerald-500/30 transition-all font-semibold shadow-sm cursor-pointer"
								title="Качество трансляции экрана (FPS и разрешение)"
							>
								<MonitorIcon className="w-3.5 h-3.5 text-emerald-400" />
								<span>{currentScreenPresetInfo.shortLabel}</span>
								{currentScreenPresetInfo.isPremium && (
									<CrownIcon className="w-3 h-3 text-amber-400 fill-amber-400 ml-0.5" />
								)}
							</button>

							{isScreenQualityMenuOpen && (
								<div className="absolute right-0 mt-2 w-64 bg-[#2b2d31] border border-white/10 rounded-xl shadow-2xl p-2 z-50 flex flex-col gap-1 backdrop-blur-lg">
									<div className="px-3 py-1.5 border-b border-white/5 mb-1">
										<div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
											Качество трансляции экрана
										</div>
										<div className="text-[10px] text-gray-500">
											H.264 / NVENC аппаратное ускорение
										</div>
									</div>

									{(Object.entries(SCREEN_SHARE_PRESETS) as [ScreenSharePresetKey, typeof currentScreenPresetInfo][]).map(
										([presetKey, info]) => {
											const isSelected = screenSharePreset === presetKey
											return (
												<button
													key={presetKey}
													onClick={() => {
														if (info.isPremium && !isPremium) {
															if (onKrispToggle) onKrispToggle() // opens Premium Modal
															setIsScreenQualityMenuOpen(false)
															return
														}
														onScreenSharePresetChange(presetKey)
														setIsScreenQualityMenuOpen(false)
													}}
													className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between ${
														isSelected
															? 'bg-emerald-600/20 text-emerald-300 font-semibold'
															: 'hover:bg-white/5 text-gray-300'
													}`}
												>
													<div className="flex flex-col gap-0.5">
														<div className="flex items-center gap-1.5">
															<span className="font-medium text-gray-200">{info.label}</span>
															{info.isPremium ? (
																<span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
																	PREMIUM
																</span>
															) : (
																<span className="text-[9px] px-1 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
																	FREE
																</span>
															)}
														</div>
														<span className="text-[10px] text-gray-400">
															{info.description}
														</span>
													</div>
													{isSelected && <CheckIcon className="w-4 h-4 text-emerald-400 shrink-0 ml-2" />}
												</button>
											)
										},
									)}
								</div>
							)}
						</div>
					)}

					{/* Layout Switcher (Grid vs Focus Stage) */}
					<button
						onClick={() => {
							if (isStageMode) {
								setViewModeOverride('grid')
								setPinnedParticipantId(null)
							} else {
								setViewModeOverride('stage')
							}
						}}
						className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
						title={isStageMode ? 'Переключить в режим сетки' : 'Переключить в режим сцены'}
					>
						{isStageMode ? <LayoutGridIcon className="w-4 h-4" /> : <TvIcon className="w-4 h-4" />}
					</button>

					{/* Fullscreen Button */}
					<button
						onClick={toggleFullscreen}
						className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
						title={isFullscreen ? 'Свернуть' : 'Во весь экран'}
					>
						{isFullscreen ? <Minimize2Icon className="w-4 h-4" /> : <Maximize2Icon className="w-4 h-4" />}
					</button>

					{/* Participant Count Badge */}
					<span className="px-2.5 py-1 text-xs rounded-full bg-[#313338] text-gray-300 font-medium">
						👥 {participants.length}
					</span>

					{/* Quick Exit Header Button */}
					<button
						onClick={onDisconnect}
						className="hidden sm:flex ml-2 px-3.5 py-1.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-semibold items-center gap-1.5 shadow-lg shadow-red-600/30 transition-all cursor-pointer"
					>
						<PhoneOffIcon className="w-3.5 h-3.5" />
						Выйти
					</button>
				</div>
			</div>

			{/* Main Video & Grid Stage */}
			<div className="flex-1 p-3 sm:p-4 overflow-hidden relative flex flex-col justify-center items-center">
				{isStageMode ? (
					/* =================== HERO STAGE MODE (Screen Share / Pinned Video) =================== */
					<div className="w-full h-full flex flex-col gap-3 max-w-[1800px]">
						{/* Large Central Stage Viewport */}
						<div className="flex-1 bg-[#111214] rounded-2xl overflow-hidden border border-white/[0.08] relative shadow-2xl flex items-center justify-center min-h-0">
							{activeScreenStream ? (
								/* Screen Share Stream */
								isDataSaver && !allowVideoInDataSaver && !localScreenStream ? (
									<div className="flex flex-col items-center justify-center p-6 text-center max-w-sm gap-3 bg-[#1e1f22]/90 backdrop-blur-md rounded-2xl border border-amber-500/30 shadow-2xl z-10">
										<div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
											<ZapIcon className="w-6 h-6 fill-amber-400" />
										</div>
										<div className="flex flex-col gap-1">
											<span className="font-bold text-gray-100 text-sm">Режим экономии трафика</span>
											<span className="text-xs text-gray-400">Трансляция экрана приостановлена для сохранения мобильного интернета.</span>
										</div>
										<button
											onClick={() => setAllowVideoInDataSaver(true)}
											className="mt-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-lg transition-all cursor-pointer"
										>
											Смотреть трансляцию
										</button>
									</div>
								) : (
									<StreamVideo stream={activeScreenStream} className="w-full h-full object-contain" />
								)
							) : pinnedParticipant && getParticipantVideoStream(pinnedParticipant) ? (
								/* Pinned Participant Camera */
								isDataSaver && !allowVideoInDataSaver && pinnedParticipant.id !== 'me' ? (
									<div className="flex flex-col items-center justify-center p-6 text-center max-w-sm gap-3 bg-[#1e1f22]/90 backdrop-blur-md rounded-2xl border border-amber-500/30 shadow-2xl z-10">
										<div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
											<ZapIcon className="w-6 h-6 fill-amber-400" />
										</div>
										<div className="flex flex-col gap-1">
											<span className="font-bold text-gray-100 text-sm">Видео на паузе (Эконом)</span>
											<span className="text-xs text-gray-400">Режим экономии трафика бережёт ваш канал.</span>
										</div>
										<button
											onClick={() => setAllowVideoInDataSaver(true)}
											className="mt-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-lg transition-all cursor-pointer"
										>
											Включить видео
										</button>
									</div>
								) : (
									<StreamVideo
										stream={getParticipantVideoStream(pinnedParticipant)!}
										className="w-full h-full object-contain"
									/>
								)
							) : pinnedParticipant ? (
								/* Pinned Participant Avatar */
								<div className="flex flex-col items-center gap-3">
									<div className="relative">
										{pinnedParticipant.avatar ? (
											<img
												src={pinnedParticipant.avatar}
												alt={pinnedParticipant.name}
												className="w-32 h-32 rounded-full object-cover shadow-2xl border-4 border-[#2b2d31]"
											/>
										) : (
											<div className="w-32 h-32 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-4xl shadow-2xl">
												{pinnedParticipant.name.charAt(0).toUpperCase()}
											</div>
										)}
									</div>
									<span className="font-bold text-lg text-gray-100">{pinnedParticipant.name}</span>
								</div>
							) : (
								/* Fallback / Local Screen */
								<div className="text-gray-400 text-sm flex items-center gap-2">
									<MonitorIcon className="w-5 h-5 text-gray-500" />
									<span>Трансляция не выбрана</span>
								</div>
							)}

							{/* Top-Left Stage Overlay: Streamer info and Discord LIVE pill */}
							<div className="absolute top-4 left-4 flex items-center gap-2 z-10 pointer-events-none">
								<div className="bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-semibold text-white flex items-center gap-2.5 border border-white/10 shadow-lg">
									{activeScreenStream ? (
										<>
											<span className="px-1.5 py-0.5 rounded bg-[#f23f43] text-white text-[10px] font-black uppercase tracking-wider animate-pulse flex items-center gap-1">
												<span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
												В ЭФИРЕ
											</span>
											<MonitorIcon className="w-4 h-4 text-emerald-400 ml-0.5" />
											<span className="font-medium text-gray-200">
												{screenSharerParticipant?.name || 'Демонстрация экрана'}
											</span>
											<span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
												{currentScreenPresetInfo.shortLabel}
											</span>
										</>
									) : (
										<>
											<PinIcon className="w-3.5 h-3.5 text-indigo-400" />
											<span className="font-medium text-gray-200">
												Фокус: {pinnedParticipant?.name}
											</span>
										</>
									)}
								</div>
							</div>

							{/* Top-Right Stage Overlay: Action controls */}
							<div className="absolute top-4 right-4 flex items-center gap-2 z-10">
								{pinnedParticipantId && (
									<button
										onClick={() => setPinnedParticipantId(null)}
										className="bg-black/75 backdrop-blur-md hover:bg-black/90 p-2 rounded-xl text-xs font-medium text-gray-300 hover:text-white border border-white/10 shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
										title="Снять закрепление"
									>
										<PinOffIcon className="w-4 h-4" />
										<span className="hidden sm:inline">Открепить</span>
									</button>
								)}
								<button
									onClick={toggleFullscreen}
									className="bg-black/75 backdrop-blur-md hover:bg-black/90 p-2 rounded-xl text-gray-300 hover:text-white border border-white/10 shadow-lg transition-all cursor-pointer"
									title={isFullscreen ? 'Свернуть' : 'Во весь экран'}
								>
									{isFullscreen ? <Minimize2Icon className="w-4 h-4" /> : <Maximize2Icon className="w-4 h-4" />}
								</button>
							</div>
						</div>

						{/* Interactive Filmstrip Participant Widget (Лента участников) */}
						<div className="h-28 flex items-center justify-start gap-3 overflow-x-auto py-1 px-1 shrink-0 scrollbar-thin scrollbar-thumb-white/10">
							{participants.map(p => {
								const video = getParticipantVideoStream(p)
								const hasVideo = hasParticipantVideo(p)
								const isPinned = pinnedParticipantId === p.id
								const isSharingThis =
									(p.id === 'me' && isScreenSharing) ||
									(remoteScreenShare?.isSharing &&
										(p.socketId === remoteScreenShare.socketId || p.id === remoteScreenShare.userId))

								return (
									<div
										key={p.id}
										onClick={() => {
											setPinnedParticipantId(isPinned ? null : p.id)
										}}
										className={`group w-40 h-full bg-[#2b2d31] rounded-xl overflow-hidden relative border transition-all duration-200 shrink-0 cursor-pointer flex items-center justify-center ${
											isPinned
												? 'border-indigo-500 ring-2 ring-indigo-500/50 shadow-indigo-500/20'
												: p.isSpeaking
												? 'border-emerald-500 ring-2 ring-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.35)]'
												: 'border-white/[0.08] hover:border-white/20'
										}`}
										title={`Нажмите, чтобы закрепить ${p.name}`}
									>
										{/* Video or Avatar */}
										{hasVideo && video && (!isDataSaver || allowVideoInDataSaver || p.id === 'me') ? (
											<StreamVideo stream={video} className="w-full h-full object-cover" />
										) : (
											<div className="relative flex items-center justify-center">
												{p.avatar ? (
													<img
														src={p.avatar}
														alt={p.name}
														className={`w-11 h-11 rounded-full object-cover border border-white/10 transition-transform ${
															p.isSpeaking ? 'scale-105 ring-2 ring-emerald-500' : ''
														}`}
													/>
												) : (
													<div
														className={`w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm shadow transition-transform ${
															p.isSpeaking ? 'scale-105 ring-2 ring-emerald-500' : ''
														}`}
													>
														{p.name.charAt(0).toUpperCase()}
													</div>
												)}
											</div>
										)}

										{/* Top-Right Badge: Screen share or pin indicator */}
										<div className="absolute top-1.5 right-1.5 flex items-center gap-1">
											{isSharingThis && (
												<span className="p-1 rounded bg-[#f23f43] text-white shadow" title="Транслирует экран">
													<MonitorIcon className="w-2.5 h-2.5" />
												</span>
											)}
											{isPinned && (
												<span className="p-1 rounded bg-indigo-600 text-white shadow" title="Закреплен">
													<PinIcon className="w-2.5 h-2.5" />
												</span>
											)}
										</div>

										{/* Bottom Name & Mic Pill */}
										<div className="absolute bottom-1.5 left-1.5 right-1.5 bg-black/75 backdrop-blur-sm px-2 py-0.5 rounded-md text-[11px] font-medium text-gray-200 flex items-center justify-between border border-white/5">
											<span className="truncate max-w-[95px]">{p.name}</span>
											{p.isMuted ? (
												<MicOffIcon className="w-3 h-3 text-red-400 shrink-0" />
											) : p.isSpeaking ? (
												<MicIcon className="w-3 h-3 text-emerald-400 shrink-0 animate-pulse" />
											) : null}
										</div>
									</div>
								)
							})}
						</div>
					</div>
				) : (
					/* =================== DISCORD GRID MODE =================== */
					<div
						className={`w-full h-full max-w-7xl grid gap-3 sm:gap-4 p-2 sm:p-4 items-center justify-center ${
							participants.length === 1
								? 'grid-cols-1 max-w-2xl'
								: participants.length === 2
								? 'grid-cols-1 md:grid-cols-2 max-w-4xl'
								: participants.length <= 4
								? 'grid-cols-2 max-w-5xl'
								: 'grid-cols-2 md:grid-cols-3'
						}`}
					>
						{participants.map(p => {
							const video = getParticipantVideoStream(p)
							const hasVideo = hasParticipantVideo(p)
							const isSharingThis =
								(p.id === 'me' && isScreenSharing) ||
								(remoteScreenShare?.isSharing &&
									(p.socketId === remoteScreenShare.socketId || p.id === remoteScreenShare.userId))

							return (
								<div
									key={p.id}
									className={`group w-full h-full min-h-[200px] max-h-[460px] aspect-video bg-[#2b2d31] rounded-2xl overflow-hidden relative border flex items-center justify-center shadow-xl transition-all duration-200 ${
										p.isSpeaking
											? 'border-emerald-500 ring-2 ring-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.35)]'
											: 'border-white/[0.08] hover:border-white/20'
									}`}
								>
									{/* Video or Centered Avatar */}
									{hasVideo && video && (!isDataSaver || allowVideoInDataSaver || p.id === 'me') ? (
										<StreamVideo stream={video} className="w-full h-full object-cover" />
									) : (
										<div className="flex flex-col items-center gap-3">
											<div className="relative">
												{p.avatar ? (
													<img
														src={p.avatar}
														alt={p.name}
														className={`w-24 h-24 rounded-full object-cover transition-transform duration-300 border-2 border-white/10 ${
															p.isSpeaking ? 'scale-105 ring-4 ring-emerald-500 shadow-emerald-500/50' : ''
														}`}
													/>
												) : (
													<div
														className={`w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-3xl shadow-lg transition-transform duration-300 border-2 border-white/10 ${
															p.isSpeaking ? 'scale-105 ring-4 ring-emerald-500 shadow-emerald-500/50' : ''
														}`}
													>
														{p.name.charAt(0).toUpperCase()}
													</div>
												)}
												{p.isMuted && (
													<div className="absolute -bottom-1 -right-1 bg-red-600 text-white p-1.5 rounded-full shadow-lg border-2 border-[#2b2d31]">
														<MicOffIcon className="w-3.5 h-3.5" />
													</div>
												)}
											</div>
											<span className="font-semibold text-sm text-gray-200 tracking-wide">{p.name}</span>
										</div>
									)}

									{/* Top-Right Card Actions: Pin to focus stage */}
									<div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 z-10">
										<button
											onClick={() => {
												setPinnedParticipantId(p.id)
												setViewModeOverride('stage')
											}}
											className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-gray-300 hover:text-white backdrop-blur-md border border-white/10 shadow cursor-pointer"
											title="Закрепить на сцене"
										>
											<PinIcon className="w-3.5 h-3.5" />
										</button>
									</div>

									{/* Top-Left Badges (Screen Share / Video Indicator) */}
									{isSharingThis && (
										<div className="absolute top-3 left-3 bg-[#f23f43] px-2 py-0.5 rounded-md text-[10px] font-black tracking-wider text-white uppercase flex items-center gap-1 shadow-lg">
											<MonitorIcon className="w-3 h-3" />
											<span>В ЭФИРЕ</span>
										</div>
									)}

									{/* Bottom Name & Audio Indicator Pill Widget */}
									<div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-md px-3 py-1 rounded-xl text-xs font-medium text-gray-200 flex items-center gap-2 border border-white/10 shadow-lg">
										{p.isMuted ? (
											<MicOffIcon className="w-3.5 h-3.5 text-red-400" />
										) : p.isSpeaking ? (
											<MicIcon className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
										) : (
											<MicIcon className="w-3.5 h-3.5 text-gray-400" />
										)}
										<span className="truncate max-w-[130px]">{p.name}</span>
										{hasVideo && <VideoIcon className="w-3 h-3 text-emerald-400 ml-1" />}
									</div>
								</div>
							)
						})}
					</div>
				)}
			</div>

			{/* =================== FLOATING DISCORD CONTROL DOCK =================== */}
			<div className="h-20 bg-[#2b2d31] border-t border-white/[0.08] flex items-center justify-center gap-3 sm:gap-4 px-4 sm:px-6 z-20 shrink-0">
				{/* Microphone Mute Button */}
				<button
					onClick={onMuteToggle}
					className={`p-3.5 rounded-full text-white transition-all duration-200 cursor-pointer shadow-md ${
						isMuted
							? 'bg-red-600 hover:bg-red-700 shadow-red-600/30 ring-2 ring-red-500/50'
							: 'bg-[#313338] hover:bg-[#3b3d42] text-gray-200'
					}`}
					title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
				>
					{isMuted ? <MicOffIcon className="w-5 h-5" /> : <MicIcon className="w-5 h-5" />}
				</button>

				{/* Discord Krisp AI Noise Suppression Button (Vondic Premium) */}
				{onKrispToggle && (
					<button
						onClick={onKrispToggle}
						className={`relative p-3.5 rounded-full transition-all duration-200 cursor-pointer shadow-md flex items-center justify-center ${
							isKrispEnabled
								? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-600/30 shadow-[0_0_15px_rgba(16,185,129,0.25)]'
								: 'bg-[#313338] hover:bg-[#3b3d42] text-gray-400'
						}`}
						title={
							isKrispEnabled
								? 'Шумоподавление Krisp AI: ВКЛЮЧЕНО (Вондик Premium)'
								: 'Шумоподавление Krisp AI (Доступно с Вондик Premium)'
						}
					>
						<SparklesIcon className="w-5 h-5" />
						<span className="absolute -bottom-1 -right-1 text-[9px] px-1 rounded-full bg-amber-500/30 text-amber-300 font-bold border border-amber-500/40 flex items-center">
							👑
						</span>
						{isKrispEnabled && (
							<span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-[#2b2d31]" />
						)}
					</button>
				)}

				{/* Video Camera Toggle */}
				<button
					onClick={onVideoToggle}
					className={`p-3.5 rounded-full text-white transition-all duration-200 cursor-pointer shadow-md ${
						isVideoEnabled
							? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30 ring-2 ring-emerald-500/50'
							: 'bg-[#313338] hover:bg-[#3b3d42] text-gray-200'
					}`}
					title={isVideoEnabled ? 'Выключить камеру' : 'Включить камеру'}
				>
					{isVideoEnabled ? <VideoIcon className="w-5 h-5" /> : <VideoOffIcon className="w-5 h-5" />}
				</button>

				{/* Screen Share Button */}
				{isScreenShareSupported && (
					<button
						onClick={onScreenShareToggle}
						className={`p-3.5 rounded-full text-white transition-all duration-200 cursor-pointer shadow-md ${
							isScreenSharing
								? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30 ring-2 ring-emerald-500/50'
								: 'bg-[#313338] hover:bg-[#3b3d42] text-gray-200'
						}`}
						title={isScreenSharing ? 'Остановить демонстрацию' : 'Поделиться экраном HD'}
					>
						<MonitorIcon className="w-5 h-5" />
					</button>
				)}

				{/* Data Saver Toggle Dock Button */}
				{onDataSaverToggle && (
					<button
						onClick={onDataSaverToggle}
						className={`p-3.5 rounded-full transition-all duration-200 cursor-pointer shadow-md flex items-center justify-center ${
							isDataSaver
								? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
								: 'bg-[#313338] hover:bg-[#3b3d42] text-gray-400'
						}`}
						title={
							isDataSaver
								? 'Режим экономии трафика: ВКЛ'
								: 'Включить режим экономии трафика'
						}
					>
						<ZapIcon className="w-5 h-5" />
					</button>
				)}

				{/* IP Privacy Toggle Dock Button */}
				{onIpPrivacyToggle && (
					<button
						onClick={onIpPrivacyToggle}
						className={`p-3.5 rounded-full transition-all duration-200 cursor-pointer shadow-md flex items-center justify-center ${
							isIpPrivacy
								? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
								: 'bg-[#313338] hover:bg-[#3b3d42] text-gray-400'
						}`}
						title={
							isIpPrivacy
								? 'Защита IP (Relay): ВКЛЮЧЕНА'
								: 'Включить защиту IP (Relay)'
						}
					>
						<ShieldCheckIcon className="w-5 h-5" />
					</button>
				)}

				<div className="w-px h-8 bg-white/10 mx-1 sm:mx-2" />

				{/* Disconnect Button */}
				<button
					onClick={onDisconnect}
					className="px-6 py-3 rounded-full bg-red-600 hover:bg-red-700 text-white font-semibold text-sm flex items-center gap-2 shadow-lg shadow-red-600/30 transition-all duration-200 cursor-pointer"
				>
					<PhoneOffIcon className="w-4 h-4" />
					<span>Отключиться</span>
				</button>
			</div>
		</div>
	)
}

export default DiscordCallModal
