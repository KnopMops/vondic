import React from 'react'

interface CallButtonProps {
	userId: string
	userName: string
	isOnline: boolean
	isInCall?: boolean
	onCallInitiate: (userId: string, userName: string) => void
	className?: string
}

const CallButton: React.FC<CallButtonProps> = ({
	userId,
	userName,
	isOnline,
	isInCall = false,
	onCallInitiate,
	className = '',
}) => {
	const handleCallClick = () => {
		if (isOnline && !isInCall) {
			onCallInitiate(userId, userName)
		} else if (!isOnline) {
			alert('Пользователь не в сети')
		} else if (isInCall) {
			alert('Уже идет звонок')
		}
	}

	const getButtonTitle = () => {
		if (!isOnline) return 'Пользователь не в сети'
		if (isInCall) return 'Уже идет звонок'
		return 'Позвонить'
	}

	return (
		<button
			onClick={handleCallClick}
			disabled={!isOnline || isInCall}
			className={`call-button ${isOnline ? 'online' : 'offline'} ${isInCall ? 'in-call' : ''} ${className}`}
			title={getButtonTitle()}
		>
			<span className="call-icon">📞</span>
			<span className="call-text">
				{!isOnline ? 'Оффлайн' : isInCall ? 'В звонке' : 'Позвонить'}
			</span>
		</button>
	)
}

export default CallButton
