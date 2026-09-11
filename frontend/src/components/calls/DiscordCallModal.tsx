'use client'

import React, { useState, useEffect, useRef } from 'react'
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
} from 'lucide-react'
import {
	AudioBitratePreset,
	AUDIO_BITRATE_PRESETS,
	NetworkQualityStats,
} from '../../lib/services/AudioProcessor'

interface Participant {
	id: string
	name: string
	avatar?: string
	socketId?: string
	isMuted?: boolean
	isSpeaking?: boolean
	isVideoOn?: boolean
}

interface DiscordCallModalProps {
	title: string
	subtitle?: string
	participants: Participant[]
	localStream: MediaStream | null
	videoStream: MediaStream | null
	screenStream: MediaStream | null
	remoteStreams: Map<string, MediaStream>
	isMuted: boolean
	isVideoEnabled: boolean
	isScreenSharing: boolean
	isScreenShareSupported: boolean
	isKrispEnabled?: boolean
	audioQualityPreset?: AudioBitratePreset
	networkStats?: NetworkQualityStats | null
	onMuteToggle: () => void
	onVideoToggle: () => void
	onScreenShareToggle: () => void
	onKrispToggle?: () => void
	onAudioQualityChange?: (preset: AudioBitratePreset) => void
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
	isMuted,
	isVideoEnabled,
	isScreenSharing,
	isScreenShareSupported,
	isKrispEnabled = true,
	audioQualityPreset = 'boost1',
	networkStats,
	onMuteToggle,
	onVideoToggle,
	onScreenShareToggle,
	onKrispToggle,
	onAudioQualityChange,
	onDisconnect,
}) => {
	const [isFullscreen, setIsFullscreen] = useState(false)
	const [isQualityMenuOpen, setIsQualityMenuOpen] = useState(false)
	const containerRef = useRef<HTMLDivElement>(null)
	const qualityMenuRef = useRef<HTMLDivElement>(null)

	// Закрытие меню выбора битрейта при клике вне его
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (qualityMenuRef.current && !qualityMenuRef.current.contains(e.target as Node)) {
				setIsQualityMenuOpen(false)
			}
		}
		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [])

	// Stream video ref component
	const StreamVideo: React.FC<{ stream: MediaStream; muted?: boolean; className?: string }> = ({
		stream,
		muted = false,
		className = 'w-full h-full object-cover',
	}) => {
		const videoRef = useRef<HTMLVideoElement>(null)
		useEffect(() => {
			if (videoRef.current && stream) {
				videoRef.current.srcObject = stream
			}
		}, [stream])

		return <video ref={videoRef} autoPlay playsInline muted={muted} className={className} />
	}

	const toggleFullscreen = () => {
		if (!document.fullscreenElement) {
			containerRef.current?.requestFullscreen().catch(() => {})
			setIsFullscreen(true)
		} else {
			document.exitFullscreen().catch(() => {})
			setIsFullscreen(false)
		}
	}

	const activeScreenStream =
		screenStream ||
		Array.from(remoteStreams.values()).find(s =>
			s.getVideoTracks().some(t => t.label.toLowerCase().includes('screen') || t.label.toLowerCase().includes('display')),
		)

	const currentPresetInfo = AUDIO_BITRATE_PRESETS[audioQualityPreset] || AUDIO_BITRATE_PRESETS.boost1

	return (
		<div
			ref={containerRef}
			className="fixed inset-0 z-50 bg-[#1e1f22] text-white flex flex-col overflow-hidden font-sans select-none"
		>
			{/* Top Header Bar */}
			<div className="h-14 px-6 bg-[#2b2d31]/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between z-20">
				<div className="flex items-center gap-3">
					<div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
						<RadioIcon className="w-4 h-4 animate-pulse" />
					</div>
					<div>
						<h3 className="font-bold text-sm tracking-wide text-gray-100 flex items-center gap-2">
							{title}
						</h3>
						{subtitle && <p className="text-[11px] text-gray-400">{subtitle}</p>}
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
							title={`Пинг: ${networkStats.ping} мс | Потери пакетов: ${networkStats.packetLoss}% | Текущий битрейт: ${Math.round(networkStats.currentBitrate / 1000)} кбит/с`}
						>
							<ActivityIcon className="w-3.5 h-3.5 animate-pulse" />
							<span>{networkStats.ping} ms</span>
							{networkStats.packetLoss > 0 && (
								<span className="opacity-80">({networkStats.packetLoss}% loss)</span>
							)}
						</div>
					)}

					{/* Discord Boost Bitrate Selector */}
					{onAudioQualityChange && (
						<div className="relative" ref={qualityMenuRef}>
							<button
								onClick={() => setIsQualityMenuOpen(!isQualityMenuOpen)}
								className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-full bg-[#313338] hover:bg-[#383a40] text-indigo-300 hover:text-indigo-200 border border-indigo-500/30 transition-all font-semibold shadow-sm cursor-pointer"
								title="Управление битрейтом аудио канала (Boost)"
							>
								<ZapIcon className="w-3.5 h-3.5 text-indigo-400 fill-indigo-400" />
								<span>{currentPresetInfo.shortLabel}</span>
							</button>

							{/* Dropdown Menu */}
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

					<span className="px-2.5 py-1 text-xs rounded-full bg-[#313338] text-gray-300 font-medium">
						👥 {participants.length}
					</span>

					<button
						onClick={toggleFullscreen}
						className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
						title={isFullscreen ? 'Свернуть' : 'Во весь экран'}
					>
						{isFullscreen ? <Minimize2Icon className="w-4 h-4" /> : <Maximize2Icon className="w-4 h-4" />}
					</button>

					<button
						onClick={onDisconnect}
						className="ml-2 px-4 py-1.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-red-600/30 transition-all cursor-pointer"
					>
						<PhoneOffIcon className="w-3.5 h-3.5" />
						Выйти
					</button>
				</div>
			</div>

			{/* Main Video & Grid Area */}
			<div className="flex-1 p-4 overflow-hidden relative flex flex-col justify-center items-center">
				{activeScreenStream ? (
					/* Screen Share View */
					<div className="w-full h-full flex flex-col gap-4">
						<div className="flex-1 bg-black/60 rounded-2xl overflow-hidden border border-white/10 relative shadow-2xl flex items-center justify-center">
							<StreamVideo stream={activeScreenStream} className="w-full h-full object-contain" />
							<div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-2 border border-white/10">
								<MonitorIcon className="w-4 h-4 text-emerald-400" />
								<span>Демонстрация экрана HD</span>
							</div>
						</div>

						{/* Small Strip of Participants */}
						<div className="h-28 flex items-center justify-center gap-3 overflow-x-auto py-2">
							{participants.map(p => {
								const participantStream =
									p.id === 'me'
										? localStream
										: p.socketId
										? remoteStreams.get(p.socketId)
										: null
								const hasVideo = p.id === 'me' ? isVideoEnabled : !!participantStream

								return (
									<div
										key={p.id}
										className="w-36 h-full bg-[#2b2d31] rounded-xl overflow-hidden relative border border-white/5 flex items-center justify-center shrink-0"
									>
										{hasVideo && participantStream ? (
											<StreamVideo stream={participantStream} muted={p.id === 'me'} />
										) : (
											<div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-sm text-white">
												{p.name.charAt(0).toUpperCase()}
											</div>
										)}
										<div className="absolute bottom-1.5 left-1.5 bg-black/60 px-2 py-0.5 rounded text-[10px] font-medium text-gray-300 flex items-center gap-1">
											{p.isMuted && <MicOffIcon className="w-3 h-3 text-red-400" />}
											<span className="truncate max-w-[80px]">{p.name}</span>
										</div>
									</div>
								)
							})}
						</div>
					</div>
				) : (
					/* Grid Layout */
					<div
						className={`w-full h-full max-w-6xl grid gap-4 p-4 items-center justify-center ${
							participants.length === 1
								? 'grid-cols-1'
								: participants.length === 2
								? 'grid-cols-1 md:grid-cols-2'
								: participants.length <= 4
								? 'grid-cols-2'
								: 'grid-cols-2 md:grid-cols-3'
						}`}
					>
						{participants.map(p => {
							const participantStream =
								p.id === 'me'
									? (isVideoEnabled && videoStream) ? videoStream : null
									: p.socketId
									? remoteStreams.get(p.socketId)
									: null

							const hasVideo = !!participantStream && participantStream.getVideoTracks().length > 0

							return (
								<div
									key={p.id}
									className={`w-full h-full min-h-[220px] bg-[#2b2d31] rounded-2xl overflow-hidden relative border flex items-center justify-center shadow-xl transition-all duration-200 ${
										p.isSpeaking
											? 'border-emerald-500 shadow-emerald-500/20 ring-2 ring-emerald-500/30'
											: 'border-white/5'
									}`}
								>
									{hasVideo ? (
										<StreamVideo stream={participantStream!} muted={p.id === 'me'} />
									) : (
										/* Avatar Center Placeholder */
										<div className="flex flex-col items-center gap-3">
											<div className="relative">
												{p.avatar ? (
													<img
														src={p.avatar}
														alt={p.name}
														className={`w-24 h-24 rounded-full object-cover transition-transform duration-300 ${
															p.isSpeaking ? 'scale-105 ring-4 ring-emerald-500' : ''
														}`}
													/>
												) : (
													<div
														className={`w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-3xl shadow-lg transition-transform duration-300 ${
															p.isSpeaking ? 'scale-105 ring-4 ring-emerald-500' : ''
														}`}
													>
														{p.name.charAt(0).toUpperCase()}
													</div>
												)}
												{p.isMuted && (
													<div className="absolute -bottom-1 -right-1 bg-red-600 text-white p-1.5 rounded-full shadow-lg border border-[#2b2d31]">
														<MicOffIcon className="w-3.5 h-3.5" />
													</div>
												)}
											</div>
											<span className="font-semibold text-sm text-gray-200">{p.name}</span>
										</div>
									)}

									{/* Bottom Name Badge */}
									<div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg text-xs font-medium text-gray-200 flex items-center gap-2 border border-white/5">
										{p.isMuted ? (
											<MicOffIcon className="w-3.5 h-3.5 text-red-400" />
										) : (
											<MicIcon className="w-3.5 h-3.5 text-emerald-400" />
										)}
										<span className="truncate max-w-[120px]">{p.name}</span>
									</div>
								</div>
							)
						})}
					</div>
				)}
			</div>

			{/* Floating Discord Dock Footer */}
			<div className="h-20 bg-[#2b2d31] border-t border-white/5 flex items-center justify-center gap-3 sm:gap-4 px-6 z-20">
				{/* Microphone Mute */}
				<button
					onClick={onMuteToggle}
					className={`p-3.5 rounded-full text-white transition-all duration-200 cursor-pointer shadow-md ${
						isMuted
							? 'bg-red-600 hover:bg-red-700 shadow-red-600/30'
							: 'bg-[#313338] hover:bg-[#3b3d42] text-gray-200'
					}`}
					title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
				>
					{isMuted ? <MicOffIcon className="w-5 h-5" /> : <MicIcon className="w-5 h-5" />}
				</button>

				{/* Discord-style Krisp AI Noise Suppression Button */}
				{onKrispToggle && (
					<button
						onClick={onKrispToggle}
						className={`relative p-3.5 rounded-full transition-all duration-200 cursor-pointer shadow-md flex items-center justify-center ${
							isKrispEnabled
								? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-600/30 shadow-emerald-500/20'
								: 'bg-[#313338] hover:bg-[#3b3d42] text-gray-400'
						}`}
						title={
							isKrispEnabled
								? 'Шумоподавление Krisp AI: ВКЛЮЧЕНО (фильтрует клики, вентиляторы, эхо)'
								: 'Шумоподавление Krisp AI: ВЫКЛЮЧЕНО'
						}
					>
						<SparklesIcon className="w-5 h-5" />
						{isKrispEnabled && (
							<span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-[#2b2d31]" />
						)}
					</button>
				)}

				{/* Video Camera Toggle */}
				<button
					onClick={onVideoToggle}
					className={`p-3.5 rounded-full text-white transition-all duration-200 cursor-pointer shadow-md ${
						!isVideoEnabled
							? 'bg-red-600 hover:bg-red-700 shadow-red-600/30'
							: 'bg-[#313338] hover:bg-[#3b3d42] text-gray-200'
					}`}
					title={isVideoEnabled ? 'Выключить камеру' : 'Включить камеру'}
				>
					{!isVideoEnabled ? <VideoOffIcon className="w-5 h-5" /> : <VideoIcon className="w-5 h-5" />}
				</button>

				{/* Screen Share */}
				{isScreenShareSupported && (
					<button
						onClick={onScreenShareToggle}
						className={`p-3.5 rounded-full text-white transition-all duration-200 cursor-pointer shadow-md ${
							isScreenSharing
								? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
								: 'bg-[#313338] hover:bg-[#3b3d42] text-gray-200'
						}`}
						title={isScreenSharing ? 'Остановить демонстрацию' : 'Поделиться экраном HD'}
					>
						<MonitorIcon className="w-5 h-5" />
					</button>
				)}

				<div className="w-px h-8 bg-white/10 mx-1 sm:mx-2" />

				{/* Disconnect Button */}
				<button
					onClick={onDisconnect}
					className="px-6 py-3 rounded-full bg-red-600 hover:bg-red-700 text-white font-semibold text-sm flex items-center gap-2 shadow-lg shadow-red-600/30 transition-all duration-200 cursor-pointer"
				>
					<PhoneOffIcon className="w-4 h-4" />
					Отключиться
				</button>
			</div>
		</div>
	)
}

export default DiscordCallModal
