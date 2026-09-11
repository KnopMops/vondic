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
		videoStream,
		isVideoActive,
		screenStream,
		remoteStreams,
		remoteScreenShare,
		screenSharePreset,
		isMuted,
		isScreenSharing,
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
		isDataSaver,
		isIpPrivacy,
		toggleDataSaver,
		toggleIpPrivacy,
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
							userName: incomingCall.userName,
							avatarUrl: incomingCall.avatarUrl,
					  }
					: undefined
			await acceptCall(callerSocketId, info)
			showToast('Звонок принят', 'success')
		} catch (error) {
			console.error('Failed to accept call in GlobalCallUI:', error)
			showToast('Не удалось принять звонок', 'error')
		}
	}

	const handleRejectCall = () => {
		if (incomingCall) {
			rejectCall(incomingCall.socketId)
		}
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

	const myName = user?.first_name
		? `${user.first_name} (Вы)`
		: user?.username
		? `${user.username} (Вы)`
		: 'Вы'

	const meParticipant = {
		id: 'me',
		name: myName,
		avatar: user?.avatar,
		isMuted: isMuted,
		isVideoOn: isVideoActive,
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
					participants={[
						meParticipant,
						...Array.from(activeCalls.values())
							.filter(c => c.isGroupCall && c.callId === activeGroupCallId && c.userId !== user?.id)
							.map(c => ({
								id: c.userId || c.socketId,
								name: c.userName || 'Участник',
								avatar: c.avatarUrl,
								socketId: c.socketId,
								isMuted: false,
							})),
					]}
					localStream={localStream}
					videoStream={videoStream || webRTCService?.getVideoStream() || null}
					screenStream={screenStream}
					remoteStreams={remoteStreams}
					remoteScreenShare={remoteScreenShare}
					screenSharePreset={screenSharePreset}
					onScreenSharePresetChange={setScreenSharePreset}
					isMuted={isMuted}
					isVideoEnabled={isVideoActive}
					isScreenSharing={isScreenSharing}
					isScreenShareSupported={isScreenShareSupported}
					isKrispEnabled={isKrispEnabled}
					isPremium={Boolean(user?.premium)}
					audioQualityPreset={audioQualityPreset}
					networkStats={networkStats}
					isDataSaver={isDataSaver}
					isIpPrivacy={isIpPrivacy}
					onMuteToggle={handleMuteToggle}
					onVideoToggle={handleVideoToggle}
					onScreenShareToggle={toggleScreenShare}
					onKrispToggle={handleKrispToggle}
					onAudioQualityChange={setAudioQualityPreset}
					onDataSaverToggle={toggleDataSaver}
					onIpPrivacyToggle={toggleIpPrivacy}
					onDisconnect={() => handleLeaveGroupCall(activeGroupCallId)}
				/>
			)}

			{activeVoiceChannelId && (
				<DiscordCallModal
					title="Голосовой канал"
					subtitle="Сервер Vondic"
					participants={[
						meParticipant,
						...(voiceChannelParticipants[activeVoiceChannelId] || [])
							.filter(p => p.userId !== user?.id)
							.map(p => ({
								id: p.userId,
								name: p.username,
								avatar: p.avatarUrl,
								socketId: p.socketId,
								isMuted: isMuted && p.userId === user?.id,
							})),
					]}
					localStream={localStream}
					videoStream={videoStream || webRTCService?.getVideoStream() || null}
					screenStream={screenStream}
					remoteStreams={remoteStreams}
					remoteScreenShare={remoteScreenShare}
					screenSharePreset={screenSharePreset}
					onScreenSharePresetChange={setScreenSharePreset}
					isMuted={isMuted}
					isVideoEnabled={isVideoActive}
					isScreenSharing={isScreenSharing}
					isScreenShareSupported={isScreenShareSupported}
					isKrispEnabled={isKrispEnabled}
					isPremium={Boolean(user?.premium)}
					audioQualityPreset={audioQualityPreset}
					networkStats={networkStats}
					isDataSaver={isDataSaver}
					isIpPrivacy={isIpPrivacy}
					onMuteToggle={handleMuteToggle}
					onVideoToggle={handleVideoToggle}
					onScreenShareToggle={toggleScreenShare}
					onKrispToggle={handleKrispToggle}
					onAudioQualityChange={setAudioQualityPreset}
					onDataSaverToggle={toggleDataSaver}
					onIpPrivacyToggle={toggleIpPrivacy}
					onDisconnect={handleLeaveVoiceChannel}
				/>
			)}

			{activeDirectCall && !activeGroupCallId && !activeVoiceChannelId && (
				<DiscordCallModal
					title={`Звонок с ${activeDirectCall.userName || 'пользователем'}`}
					subtitle="Прямой звонок"
					participants={[
						meParticipant,
						{
							id: activeDirectCall.userId,
							name: activeDirectCall.userName || 'Собеседник',
							avatar: activeDirectCall.avatarUrl,
							socketId: activeDirectCall.socketId,
						},
					]}
					localStream={localStream}
					videoStream={videoStream || webRTCService?.getVideoStream() || null}
					screenStream={screenStream}
					remoteStreams={remoteStreams}
					remoteScreenShare={remoteScreenShare}
					screenSharePreset={screenSharePreset}
					onScreenSharePresetChange={setScreenSharePreset}
					isMuted={isMuted}
					isVideoEnabled={isVideoActive}
					isScreenSharing={isScreenSharing}
					isScreenShareSupported={isScreenShareSupported}
					isKrispEnabled={isKrispEnabled}
					isPremium={Boolean(user?.premium)}
					audioQualityPreset={audioQualityPreset}
					networkStats={networkStats}
					isDataSaver={isDataSaver}
					isIpPrivacy={isIpPrivacy}
					onMuteToggle={handleMuteToggle}
					onVideoToggle={handleVideoToggle}
					onScreenShareToggle={toggleScreenShare}
					onKrispToggle={handleKrispToggle}
					onAudioQualityChange={setAudioQualityPreset}
					onDataSaverToggle={toggleDataSaver}
					onIpPrivacyToggle={toggleIpPrivacy}
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
