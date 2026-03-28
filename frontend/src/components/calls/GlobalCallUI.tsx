'use client'

import React from 'react'
import { useCallStore } from '../../lib/stores/callStore'
import { useToast } from '../../lib/ToastContext'
import ActiveGroupCall from './ActiveGroupCall'
import IncomingCallModal from './IncomingCallModal'


export const GlobalCallUI: React.FC = () => {
	const {
		incomingCall,
		activeCalls,
		activeGroupCallId,
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

	const handleMuteToggle = () => {
		toggleMute()
	}

	const handleVideoToggle = async () => {
		await toggleVideo()
	}

	return (
		<>
			{/* Incoming Call Modal */}
			{incomingCall && (
				<IncomingCallModal
					callerInfo={incomingCall}
					onAccept={handleAcceptCall}
					onReject={handleRejectCall}
					isVisible={!!incomingCall}
				/>
			)}

			{/* Active Group Call */}
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

			{/* Individual 1-on-1 calls are now shown in chat UI */}
		</>
	)
}
