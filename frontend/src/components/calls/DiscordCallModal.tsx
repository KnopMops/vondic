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
	Volume2Icon,
	UserIcon,
	RadioIcon,
} from 'lucide-react'

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
	onMuteToggle: () => void
	onVideoToggle: () => void
	onScreenShareToggle: () => void
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
	onMuteToggle,
	onVideoToggle,
	onScreenShareToggle,
	onDisconnect,
}) => {
	const [isFullscreen, setIsFullscreen] = useState(false)
	const containerRef = useRef<HTMLDivElement>(null)

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

	const activeScreenStream = screenStream || Array.from(remoteStreams.values()).find(s => s.getVideoTracks().some(t => t.label.toLowerCase().includes('screen') || t.label.toLowerCase().includes('display')))

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

				<div className="flex items-center gap-2">
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
						<div className="flex-1 w-full relative rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl flex items-center justify-center">
							<StreamVideo stream={activeScreenStream} className="w-full h-full object-contain" />
							<div className="absolute top-4 left-4 bg-emerald-600/90 text-white px-3 py-1 rounded-full text-xs font-medium backdrop-blur-md flex items-center gap-1.5 shadow-lg">
								<MonitorIcon className="w-3.5 h-3.5" /> Демонстрация экрана HD 60FPS
							</div>
						</div>

						{/* Participant Dock at Bottom */}
						<div className="h-24 flex items-center gap-3 overflow-x-auto px-2 py-1 custom-scrollbar justify-center">
							{participants.map(p => (
								<div
									key={p.id}
									className={`relative w-20 h-20 rounded-xl overflow-hidden bg-[#2b2d31] flex-shrink-0 flex items-center justify-center border ${
										p.isSpeaking ? 'border-emerald-500 ring-2 ring-emerald-500/50 shadow-lg shadow-emerald-500/30' : 'border-white/5'
									}`}
								>
									{p.avatar ? (
										<img src={p.avatar} alt={p.name} className="w-10 h-10 rounded-full object-cover" />
									) : (
										<div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
											{p.name.charAt(0).toUpperCase()}
										</div>
									)}
									<span className="absolute bottom-1 left-1 right-1 text-[9px] font-medium truncate text-center text-gray-200 bg-black/60 px-1 rounded">
										{p.name}
									</span>
								</div>
							))}
						</div>
					</div>
				) : (
					/* Normal Participant Tiles Grid */
					<div
						className={`w-full max-w-6xl h-full grid gap-4 p-2 items-center justify-center ${
							participants.length <= 1
								? 'grid-cols-1 max-w-2xl max-h-[500px]'
								: participants.length <= 4
								? 'grid-cols-1 md:grid-cols-2 max-h-[600px]'
								: 'grid-cols-2 md:grid-cols-3'
						}`}
					>
						{participants.map(p => {
							const remoteStream = p.socketId ? remoteStreams.get(p.socketId) : null
							const pStream = p.id === 'me' ? (videoStream || localStream) : remoteStream

							return (
								<div
									key={p.id}
									className={`relative w-full h-full min-h-[200px] rounded-2xl overflow-hidden bg-[#2b2d31] border flex items-center justify-center transition-all duration-300 ${
										p.isSpeaking
											? 'border-emerald-500 ring-4 ring-emerald-500/40 shadow-xl shadow-emerald-500/20'
											: 'border-white/5 hover:border-white/10'
									}`}
								>
									{pStream && pStream.getVideoTracks().some(t => t.enabled) ? (
										<StreamVideo stream={pStream} muted={p.id === 'me'} />
									) : (
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
			<div className="h-20 bg-[#2b2d31] border-t border-white/5 flex items-center justify-center gap-4 px-6 z-20">
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

				<div className="w-px h-8 bg-white/10 mx-2" />

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
