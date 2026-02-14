'use client'

import React from 'react'
import { useCallStore } from '../../lib/stores/callStore'
import { useToast } from '../../lib/ToastContext'
import ActiveCall from './ActiveCall'
import ActiveGroupCall from './ActiveGroupCall'
import IncomingCallModal from './IncomingCallModal'

export const GlobalCallUI: React.FC = () => {
	const {
		incomingCall,
		activeCalls,
		activeGroupCallId,
		localStream,
		remoteStreams,
		isMuted,
		acceptCall,
		rejectCall,
		endCall,
		leaveGroupCall,
		toggleMute,
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

	const handleEndCall = (targetSocketId: string) => {
		endCall(targetSocketId)
		showToast('Звонок завершен', 'info')
	}

	const handleLeaveGroupCall = (callId: string) => {
		leaveGroupCall(callId)
		showToast('Вы вышли из группового звонка', 'info')
	}

	const handleMuteToggle = () => {
		toggleMute()
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
					remoteStreams={remoteStreams}
					onEndCall={handleLeaveGroupCall}
					onMuteToggle={handleMuteToggle}
					isMuted={isMuted}
				/>
			)}

			{/* Active Individual Calls */}
			{Array.from(activeCalls.values())
				.filter(call => !call.isGroupCall)
				.map(call => (
					<ActiveCall
						key={call.socketId}
						callInfo={call}
						onEndCall={handleEndCall}
						onMuteToggle={handleMuteToggle}
						isMuted={isMuted}
						localStream={localStream}
						remoteStream={remoteStreams.get(call.socketId) || null}
					/>
				))}
		</>
	)
}
