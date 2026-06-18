'use client'

import { usePathname, useRouter } from 'next/navigation'
import React from 'react'
import { useCallStore } from '../../lib/stores/callStore'
import { useToast } from '../../lib/ToastContext'
import ActiveCall from './ActiveCall'
import ActiveGroupCall from './ActiveGroupCall'
import ActiveVoiceChannel from './ActiveVoiceChannel'
import { FloatingCallBar } from './FloatingCallBar'
import IncomingCallModal from './IncomingCallModal'


export const GlobalCallUI: React.FC = () => {
	const pathname = usePathname()
	const router = useRouter()
	const {
		incomingCall,
		activeCalls,
		activeGroupCallId,
		activeVoiceChannelId,
		voiceChannelParticipants,
		localStream,
		screenStream,
		remoteStreams,
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
	} = useCallStore()

	const { showToast } = useToast()

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
				<ActiveGroupCall
					callId={activeGroupCallId}
					participants={Array.from(activeCalls.values()).filter(
						c => c.isGroupCall && c.callId === activeGroupCallId,
					)}
					localStream={localStream}
					videoStream={webRTCService?.getVideoStream() || null}
					screenStream={screenStream}
					remoteStreams={remoteStreams}
					onEndCall={handleLeaveGroupCall}
					onMuteToggle={handleMuteToggle}
					onVideoToggle={handleVideoToggle}
					isMuted={isMuted}
					isVideoEnabled={isVideoEnabled()}
					onScreenShareToggle={toggleScreenShare}
					isScreenSharing={isScreenSharing}
					isScreenShareSupported={isScreenShareSupported}
				/>
			)}

			{activeVoiceChannelId && (
				<ActiveVoiceChannel
					channelId={activeVoiceChannelId}
					participants={voiceChannelParticipants[activeVoiceChannelId] || []}
					isMuted={isMuted}
					onMuteToggle={handleMuteToggle}
					onLeave={handleLeaveVoiceChannel}
				/>
			)}

			{activeDirectCall && !activeGroupCallId && !activeVoiceChannelId && !isMessagesPage && (
				<ActiveCall
					callInfo={activeDirectCall}
					localStream={localStream}
					screenStream={screenStream}
					remoteStream={remoteStreams.get(activeDirectCall.socketId) || null}
					videoStream={webRTCService?.getVideoStream() || null}
					onEndCall={endCall}
					onMuteToggle={handleMuteToggle}
					onScreenShareToggle={toggleScreenShare}
					onVideoToggle={handleVideoToggle}
					isMuted={isMuted}
					isScreenSharing={isScreenSharing}
					isVideoEnabled={isVideoEnabled()}
					isScreenShareSupported={isScreenShareSupported}
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
		</>
	)
}
