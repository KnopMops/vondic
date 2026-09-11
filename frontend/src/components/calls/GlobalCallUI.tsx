'use client'

import { usePathname, useRouter } from 'next/navigation'
import React, { useState } from 'react'
import { useCallStore } from '../../lib/stores/callStore'
import { useToast } from '../../lib/ToastContext'
import { useAuth } from '../../lib/AuthContext'
import PremiumModal from '../premium/PremiumModal'
import ActiveCall from './ActiveCall'
import ActiveGroupCall from './ActiveGroupCall'
import ActiveVoiceChannel from './ActiveVoiceChannel'
import DiscordCallModal from './DiscordCallModal'
import { FloatingCallBar } from './FloatingCallBar'
import IncomingCallModal from './IncomingCallModal'


export const GlobalCallUI: React.FC = () => {
	const pathname = usePathname()
	const router = useRouter()
	const { user } = useAuth()
	const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false)

	const {
		incomingCall,
		activeCalls,
		activeGroupCallId,
		activeVoiceChannelId,
		voiceChannelParticipants,
		localStream,
		screenStream,
		remoteStreams,
		remoteScreenShare,
		screenSharePreset,
		isMuted,
		isScreenSharing,
		isVideoEnabled,
		isScreenShareSupported,
		acceptCall,
		rejectCall,
		endCall,
		leaveGroupCall,
		leaveVoiceChannel,
		toggleMute,
		toggleScreenShare,
		toggleVideo,
		webRTCService,
		audioQualityPreset,
		isKrispEnabled,
		networkStats,
		setAudioQualityPreset,
		setScreenSharePreset,
		toggleKrisp,
	} = useCallStore()

	const { showToast } = useToast()

	const handleKrispToggle = () => {
		if (!user?.premium) {
			setIsPremiumModalOpen(true)
			showToast('Шумоподавление Krisp AI доступно только с подпиской Вондик Premium', 'info')
			return
		}
		toggleKrisp()
	}

	const handleAcceptCall = async (callerSocketId: string) => {
		try {
			const info =
				incomingCall && incomingCall.socketId === callerSocketId
					? {
							userId: incomingCall.userId,
							userName: incomingCall.userName || 'Unknown',
						}
					: { userId: '', userName: '' }

			await acceptCall(callerSocketId, info)
			showToast('Звонок принят', 'success')
		} catch (error) {
			console.error('Failed to accept call:', error)
			showToast('Не удалось принять звонок', 'error')
		}
	}

	const handleRejectCall = (callerSocketId: string) => {
		rejectCall(callerSocketId)
		showToast('Звонок отклонен', 'info')
	}

	const handleLeaveGroupCall = (callId: string) => {
		leaveGroupCall(callId)
		showToast('Вы вышли из группового звонка', 'info')
	}

	const handleLeaveVoiceChannel = () => {
		if (activeVoiceChannelId) {
			leaveVoiceChannel(activeVoiceChannelId)
			showToast('Вы отключились от голосового канала', 'info')
		}
	}

	const handleMuteToggle = () => {
		toggleMute()
	}

	const handleVideoToggle = async () => {
		await toggleVideo()
	}

	const activeDirectCall = Array.from(activeCalls.values()).find(c => !c.isGroupCall)
	const hasDirectCall = !!activeDirectCall
	const isMessagesPage = pathname ? (pathname.startsWith('/feed/messages') || pathname.startsWith('/messages')) : false

	return (
		<>
			
			{incomingCall && (
				<IncomingCallModal
					callerInfo={incomingCall}
					onAccept={handleAcceptCall}
					onReject={handleRejectCall}
					isVisible={!!incomingCall}
				/>
			)}

			
			{activeGroupCallId && (
				<DiscordCallModal
					title="Групповой звонок"
					subtitle="Vondic Group Call"
					participants={Array.from(activeCalls.values())
						.filter(c => c.isGroupCall && c.callId === activeGroupCallId)
						.map(c => ({
							id: c.userId || c.socketId,
							name: c.userName || 'Участник',
							avatar: c.avatarUrl,
							socketId: c.socketId,
							isMuted: false,
						}))}
					localStream={localStream}
					videoStream={webRTCService?.getVideoStream() || null}
					screenStream={screenStream}
					remoteStreams={remoteStreams}
					remoteScreenShare={remoteScreenShare}
					screenSharePreset={screenSharePreset}
					onScreenSharePresetChange={setScreenSharePreset}
					isMuted={isMuted}
					isVideoEnabled={isVideoEnabled()}
					isScreenSharing={isScreenSharing}
					isScreenShareSupported={isScreenShareSupported}
					isKrispEnabled={isKrispEnabled}
					isPremium={Boolean(user?.premium)}
					audioQualityPreset={audioQualityPreset}
					networkStats={networkStats}
					onMuteToggle={handleMuteToggle}
					onVideoToggle={handleVideoToggle}
					onScreenShareToggle={toggleScreenShare}
					onKrispToggle={handleKrispToggle}
					onAudioQualityChange={setAudioQualityPreset}
					onDisconnect={() => handleLeaveGroupCall(activeGroupCallId)}
				/>
			)}

			{activeVoiceChannelId && (
				<DiscordCallModal
					title="Голосовой канал"
					subtitle="Сервер Vondic"
					participants={(voiceChannelParticipants[activeVoiceChannelId] || []).map(p => ({
						id: p.userId,
						name: p.username,
						avatar: p.avatarUrl,
						socketId: p.socketId,
						isMuted: isMuted && p.userId === webRTCService?.userId,
					}))}
					localStream={localStream}
					videoStream={webRTCService?.getVideoStream() || null}
					screenStream={screenStream}
					remoteStreams={remoteStreams}
					remoteScreenShare={remoteScreenShare}
					screenSharePreset={screenSharePreset}
					onScreenSharePresetChange={setScreenSharePreset}
					isMuted={isMuted}
					isVideoEnabled={isVideoEnabled()}
					isScreenSharing={isScreenSharing}
					isScreenShareSupported={isScreenShareSupported}
					isKrispEnabled={isKrispEnabled}
					isPremium={Boolean(user?.premium)}
					audioQualityPreset={audioQualityPreset}
					networkStats={networkStats}
					onMuteToggle={handleMuteToggle}
					onVideoToggle={handleVideoToggle}
					onScreenShareToggle={toggleScreenShare}
					onKrispToggle={handleKrispToggle}
					onAudioQualityChange={setAudioQualityPreset}
					onDisconnect={handleLeaveVoiceChannel}
				/>
			)}

			{activeDirectCall && !activeGroupCallId && !activeVoiceChannelId && (
				<DiscordCallModal
					title={`Звонок с ${activeDirectCall.userName || 'пользователем'}`}
					subtitle="Прямой звонок"
					participants={[
						{
							id: 'me',
							name: 'Вы',
							isMuted: isMuted,
						},
						{
							id: activeDirectCall.userId,
							name: activeDirectCall.userName || 'Собеседник',
							avatar: activeDirectCall.avatarUrl,
							socketId: activeDirectCall.socketId,
						},
					]}
					localStream={localStream}
					videoStream={webRTCService?.getVideoStream() || null}
					screenStream={screenStream}
					remoteStreams={remoteStreams}
					remoteScreenShare={remoteScreenShare}
					screenSharePreset={screenSharePreset}
					onScreenSharePresetChange={setScreenSharePreset}
					isMuted={isMuted}
					isVideoEnabled={isVideoEnabled()}
					isScreenSharing={isScreenSharing}
					isScreenShareSupported={isScreenShareSupported}
					isKrispEnabled={isKrispEnabled}
					isPremium={Boolean(user?.premium)}
					audioQualityPreset={audioQualityPreset}
					networkStats={networkStats}
					onMuteToggle={handleMuteToggle}
					onVideoToggle={handleVideoToggle}
					onScreenShareToggle={toggleScreenShare}
					onKrispToggle={handleKrispToggle}
					onAudioQualityChange={setAudioQualityPreset}
					onDisconnect={() => endCall(activeDirectCall.socketId)}
				/>
			)}

			{hasDirectCall && !activeGroupCallId && !activeVoiceChannelId && !isMessagesPage && (
				<FloatingCallBar
					onReturnToCall={() => {
						if (activeDirectCall?.userId) {
							router.push(`/feed/messages?direct_id=${encodeURIComponent(activeDirectCall.userId)}`)
							return
						}
						router.push('/feed/messages')
					}}
				/>
			)}

			<PremiumModal
				isOpen={isPremiumModalOpen}
				onClose={() => setIsPremiumModalOpen(false)}
			/>
		</>
	)
}
