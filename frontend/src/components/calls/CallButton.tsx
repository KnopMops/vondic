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
		if (isInCall) {
			alert('Уже идет звонок')
			return
		}
		// Allow calling both online and offline users
		onCallInitiate(userId, userName)
	}

	const getButtonTitle = () => {
		if (isInCall) return 'Уже идет звонок'
		if (!isOnline) return 'Позвонить (пользователь оффлайн)'
		return 'Позвонить'
	}

	return (
		<button
			onClick={handleCallClick}
			disabled={isInCall}
			className={`call-button ${isOnline ? 'online' : 'offline'} ${isInCall ? 'in-call' : ''} ${className}`}
			title={getButtonTitle()}
		>
			<span className='call-icon'>📞</span>
			<span className='call-text'>
				{isInCall ? 'В звонке' : 'Позвонить'}
			</span>
		</button>
	)
}

export default CallButton
