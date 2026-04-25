'use client'

import { ChatMenu } from '@/components/calls'
import { ConnectingModal } from '@/components/calls/ConnectingModal'
import { FloatingCallBar } from '@/components/calls/FloatingCallBar'
import { IntegratedCallPanel } from '@/components/calls/IntegratedCallPanel'
import { ScreenShareViewer } from '@/components/calls/ScreenShareViewer'
import { useAuth } from '@/lib/AuthContext'
import {
	canPinChats,
	sortChatsWithPinned,
	togglePinChat,
} from '@/lib/chatUtils'
import { useChannels } from '@/lib/hooks/useChannels'
import { useChat } from '@/lib/hooks/useChat'
import { useCommunities } from '@/lib/hooks/useCommunities'
import { useDebounce } from '@/lib/hooks/useDebounce'
import { useGroups } from '@/lib/hooks/useGroups'
import { useSocket } from '@/lib/SocketContext'
import {
	clearCallState,
	restoreCallState,
	saveCallState,
	useActiveCalls,
	useActiveGroupCallId,
	useCallStore,
	useIsInitialized,
	useIsScreenShareSupported,
	useIsWebRTCSupported,
} from '@/lib/stores/callStore'
import { useToast } from '@/lib/ToastContext'
import { Channel, Group, Message, User } from '@/lib/types'
import { apiUrl, webrtcUrl } from '@/lib/url-fallback'
import { getAttachmentUrl, getAvatarUrl } from '@/lib/utils'
import Link from 'next/link'
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import MessageBubble from './MessageBubble'
import { AppleEmoji } from '@/components/ui/AppleEmoji'

const formatLastSeen = (lastSeen?: string | Date): string => {
	if (!lastSeen) return 'Не в сети'

	const now = new Date()
	const lastSeenDate = new Date(lastSeen)
	const diffMs = now.getTime() - lastSeenDate.getTime()
	const diffMins = Math.floor(diffMs / 60000)
	const diffHours = Math.floor(diffMins / 60)
	const diffDays = Math.floor(diffHours / 24)

	if (diffMins < 1) return 'только что'
	if (diffMins < 60) return `${diffMins} мин. назад`
	if (diffHours < 24) return `${diffHours} ч. назад`
	if (diffDays < 7) return `${diffDays} д. назад`

	return lastSeenDate.toLocaleDateString('ru-RU', {
		day: 'numeric',
		month: 'short',
	})
}

const getLastMessage = (friendId: string, messages: Message[]): string => {
	// Filter only direct messages (no channel_id or group_id) between current user and friend
	const friendMessages = (messages || []).filter(
		m =>
			m &&
			// Direct message: no channel or group
			(m.channel_id === undefined || m.channel_id === null) &&
			(m.group_id === undefined || m.group_id === null) &&
			// Messages from or to this friend
			(m.sender_id === friendId || (!m.isOwn && m.sender_id !== friendId)),
	)
	if (friendMessages.length === 0) return ''

	const lastMessage = friendMessages[friendMessages.length - 1]
	if (!lastMessage) return ''
	if (lastMessage.type === 'voice') return '🎤 Голосовое сообщение'
	if (lastMessage.type === 'image') return '🖼️ Фото'
	if (lastMessage.type === 'file') return '📎 Файл'

	const content = lastMessage.content || ''
	return content.length > 30 ? content.substring(0, 30) + '...' : content
}

const getLastMessageTime = (friendId: string, messages: Message[]): string => {
	// Filter only direct messages (no channel_id or group_id) between current user and friend
	const friendMessages = (messages || []).filter(
		m =>
			m &&
			// Direct message: no channel or group
			(m.channel_id === undefined || m.channel_id === null) &&
			(m.group_id === undefined || m.group_id === null) &&
			// Messages from or to this friend
			(m.sender_id === friendId || (!m.isOwn && m.sender_id !== friendId)),
	)
	if (friendMessages.length === 0) return ''

	const lastMessage = friendMessages[friendMessages.length - 1]
	if (!lastMessage || !lastMessage.timestamp) return ''
	try {
		return new Date(lastMessage.timestamp).toLocaleTimeString('ru-RU', {
			hour: '2-digit',
			minute: '2-digit',
		})
	} catch {
		return ''
	}
}

// --- Icons Components ---
const ArrowLeftIcon = ({ className }: { className?: string }) => (
	<svg
		viewBox='0 0 24 24'
		fill='none'
		stroke='currentColor'
		strokeWidth='2'
		strokeLinecap='round'
		strokeLinejoin='round'
		className={className}
	>
		<line x1='19' y1='12' x2='5' y2='12'></line>
		<polyline points='12 19 5 12 12 5'></polyline>
	</svg>
)

const SendIcon = ({ className }: { className?: string }) => (
	<svg
		viewBox='0 0 24 24'
		fill='none'
		stroke='currentColor'
		strokeWidth='2'
		strokeLinecap='round'
		strokeLinejoin='round'
		className={className}
	>
		<line x1='22' y1='2' x2='11' y2='13'></line>
		<polygon points='22 2 15 22 11 13 2 9 22 2'></polygon>
	</svg>
)

const PaperclipIcon = ({ className }: { className?: string }) => (
	<svg
		viewBox='0 0 24 24'
		fill='none'
		stroke='currentColor'
		strokeWidth='2'
		strokeLinecap='round'
		strokeLinejoin='round'
		className={className}
	>
		<path d='M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48'></path>
	</svg>
)

const SmileIcon = ({ className }: { className?: string }) => (
	<svg
		viewBox='0 0 24 24'
		fill='none'
		stroke='currentColor'
		strokeWidth='2'
		strokeLinecap='round'
		strokeLinejoin='round'
		className={className}
	>
		<circle cx='12' cy='12' r='10'></circle>
		<path d='M8 14s1.5 2 4 2 4-2 4-2'></path>
		<line x1='9' y1='9' x2='9.01' y2='9'></line>
		<line x1='15' y1='9' x2='15.01' y2='9'></line>
	</svg>
)

const StickerIcon = ({ className }: { className?: string }) => (
	<svg
		viewBox='0 0 24 24'
		fill='none'
		stroke='currentColor'
		strokeWidth='2'
		strokeLinecap='round'
		strokeLinejoin='round'
		className={className}
	>
		<rect x='3' y='3' width='18' height='18' rx='4' ry='4'></rect>
		<circle cx='9' cy='9' r='1'></circle>
		<circle cx='15' cy='9' r='1'></circle>
		<path d='M8 15s1.5 2 4 2 4-2 4-2'></path>
	</svg>
)

const XIcon = ({ className }: { className?: string }) => (
	<svg
		viewBox='0 0 24 24'
		fill='none'
		stroke='currentColor'
		strokeWidth='2'
		strokeLinecap='round'
		strokeLinejoin='round'
		className={className}
	>
		<path d='M18 6 6 18'></path>
		<path d='m6 6 12 12'></path>
	</svg>
)

const MoreVerticalIcon = ({ className }: { className?: string }) => (
	<svg
		viewBox='0 0 24 24'
		fill='none'
		stroke='currentColor'
		strokeWidth='2'
		strokeLinecap='round'
		strokeLinejoin='round'
		className={className}
	>
		<circle cx='12' cy='12' r='1'></circle>
		<circle cx='12' cy='5' r='1'></circle>
		<circle cx='12' cy='19' r='1'></circle>
	</svg>
)

const ScreenShareIcon = ({ className }: { className?: string }) => (
	<svg
		viewBox='0 0 24 24'
		fill='none'
		stroke='currentColor'
		strokeWidth='2'
		strokeLinecap='round'
		strokeLinejoin='round'
		className={className}
	>
		<rect x='2' y='3' width='20' height='14' rx='2'></rect>
		<path d='M8 21h8'></path>
		<path d='M12 17v4'></path>
		<path d='M9 8l6 3-6 3z'></path>
	</svg>
)

const SearchIcon = ({ className }: { className?: string }) => (
	<svg
		viewBox='0 0 24 24'
		fill='none'
		stroke='currentColor'
		strokeWidth='2'
		strokeLinecap='round'
		strokeLinejoin='round'
		className={className}
	>
		<circle cx='11' cy='11' r='8'></circle>
		<line x1='21' y1='21' x2='16.65' y2='16.65'></line>
	</svg>
)

const UserPlusIcon = ({ className }: { className?: string }) => (
	<svg
		viewBox='0 0 24 24'
		fill='none'
		stroke='currentColor'
		strokeWidth='2'
		strokeLinecap='round'
		strokeLinejoin='round'
		className={className}
	>
		<path d='M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2'></path>
		<circle cx='8.5' cy='7' r='4'></circle>
		<line x1='20' y1='8' x2='20' y2='14'></line>
		<line x1='23' y1='11' x2='17' y2='11'></line>
	</svg>
)

const FilterIcon = ({ className }: { className?: string }) => (
	<svg
		viewBox='0 0 24 24'
		fill='none'
		stroke='currentColor'
		strokeWidth='2'
		strokeLinecap='round'
		strokeLinejoin='round'
		className={className}
	>
		<polygon points='22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3'></polygon>
	</svg>
)

const UsersIcon = ({ className }: { className?: string }) => (
	<svg
		viewBox='0 0 24 24'
		fill='none'
		stroke='currentColor'
		strokeWidth='2'
		strokeLinecap='round'
		strokeLinejoin='round'
		className={className}
	>
		<path d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2'></path>
		<circle cx='9' cy='7' r='4'></circle>
		<path d='M23 21v-2a4 4 0 0 0-3-3.87'></path>
		<path d='M16 3.13a4 4 0 0 1 0 7.75'></path>
	</svg>
)

const MessageSquareIcon = ({ className }: { className?: string }) => (
	<svg
		viewBox='0 0 24 24'
		fill='none'
		stroke='currentColor'
		strokeWidth='2'
		strokeLinecap='round'
		strokeLinejoin='round'
		className={className}
	>
		<path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'></path>
	</svg>
)

const PlusIcon = ({ className }: { className?: string }) => (
	<svg
		viewBox='0 0 24 24'
		fill='none'
		stroke='currentColor'
		strokeWidth='2'
		strokeLinecap='round'
		strokeLinejoin='round'
		className={className}
	>
		<line x1='12' y1='5' x2='12' y2='19'></line>
		<line x1='5' y1='12' x2='19' y2='12'></line>
	</svg>
)

const InfoIcon = ({ className }: { className?: string }) => (
	<svg
		viewBox='0 0 24 24'
		fill='none'
		stroke='currentColor'
		strokeWidth='2'
		strokeLinecap='round'
		strokeLinejoin='round'
		className={className}
	>
		<circle cx='12' cy='12' r='10'></circle>
		<line x1='12' y1='16' x2='12' y2='12'></line>
		<line x1='12' y1='8' x2='12.01' y2='8'></line>
	</svg>
)

const HashIcon = ({ className }: { className?: string }) => (
	<svg
		viewBox='0 0 24 24'
		fill='none'
		stroke='currentColor'
		strokeWidth='2'
		strokeLinecap='round'
		strokeLinejoin='round'
		className={className}
	>
		<line x1='4' y1='9' x2='20' y2='9'></line>
		<line x1='4' y1='15' x2='20' y2='15'></line>
		<line x1='10' y1='3' x2='8' y2='21'></line>
		<line x1='16' y1='3' x2='14' y2='21'></line>
	</svg>
)

const LogInIcon = ({ className }: { className?: string }) => (
	<svg
		viewBox='0 0 24 24'
		fill='none'
		stroke='currentColor'
		strokeWidth='2'
		strokeLinecap='round'
		strokeLinejoin='round'
		className={className}
	>
		<path d='M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4'></path>
		<polyline points='10 17 15 12 10 7'></polyline>
		<line x1='15' y1='12' x2='3' y2='12'></line>
	</svg>
)

const EMOJIS = [
	'😀',
	'😁',
	'😆',
	'😅',
	'🙂',
	'🙃',
	'😉',
	'😇',
	'😂',
	'🤣',
	'😊',
	'😍',
	'🥰',
	'😘',
	'😗',
	'😙',
	'😚',
	'😜',
	'😝',
	'🤪',
	'🤔',
	'🤨',
	'😎',
	'🤩',
	'🥳',
	'😌',
	'😏',
	'😒',
	'😞',
	'😔',
	'😟',
	'😕',
	'🙁',
	'☹️',
	'😢',
	'😭',
	'🥺',
	'😤',
	'😠',
	'😡',
	'🤬',
	'🤯',
	'😳',
	'😬',
	'😮‍💨',
	'🥵',
	'🥶',
	'😱',
	'😨',
	'😰',
	'😥',
	'😓',
	'🤗',
	'🤫',
	'🤭',
	'🫢',
	'🫣',
	'😶‍🌫️',
	'😵‍💫',
	'🤤',
	'😴',
	'😪',
	'😷',
	'🤒',
	'🤕',
	'🤢',
	'🤮',
	'🤧',
	'😈',
	'👿',
	'💀',
	'☠️',
	'👻',
	'👽',
	'🤖',
	'🎃',
	'💩',
	'❤️',
	'🧡',
	'💛',
	'💚',
	'🩵',
	'💙',
	'💜',
	'🖤',
	'🤍',
	'🤎',
	'💔',
	'❤️‍🔥',
	'❤️‍🩹',
	'💯',
	'💫',
	'✨',
	'⭐️',
	'🌟',
	'⚡️',
	'🔥',
	'🌈',
	'☀️',
	'🌙',
	'🌧️',
	'❄️',
	'☁️',
	'🍀',
	'🌹',
	'🌻',
	'🌸',
	'🌊',
	'🫶',
	'👍',
	'👎',
	'👊',
	'✊',
	'🤛',
	'🤜',
	'👏',
	'🙌',
	'👐',
	'🤲',
	'🤝',
	'🙏',
	'🤌',
	'🤏',
	'👌',
	'✌️',
	'🤞',
	'🤟',
	'🤘',
	'🤙',
	'🫡',
	'🫠',
	'🫥',
	'👀',
	'💪',
	'🧠',
	'🦴',
	'👁️',
	'👄',
	'💋',
	'👅',
	'👃',
	'👂',
	'🦶',
	'🦵',
	'👣',
	'💥',
	'💢',
	'💦',
	'💧',
	'💤',
	'👋',
	'🤚',
	'🖐️',
	'✋',
	'🖖',
	'🫳',
	'🫴',
	'🫵',
	'🖤',
	'✅',
	'❌',
	'⚠️',
	'🗑️',
	'📎',
	'📌',
	'🧩',
	'🧠',
	'🎉',
	'🎁',
	'🎈',
	'🎶',
	'🎵',
	'🎬',
	'📷',
	'🖼️',
	'📹',
	'🎮',
	'🏆',
	'💎',
	'🪙',
	'🧿',
	'🔒',
	'🔓',
	'🔑',
	'👑',
	'🗣️',
	'💬',
	'🫧',
	'🧨',
	'🚀',
	'🛰️',
	'🧳',
	'🧭',
	'🕹️',
	'🧸',
	'🐶',
	'🐱',
	'🐭',
	'🐹',
	'🐰',
	'🦊',
	'🐻',
	'🐼',
	'🐨',
	'🐯',
	'🦁',
	'🐮',
	'🐷',
	'🐸',
	'🐵',
	'🦄',
	'🐝',
	'🦋',
	'🐢',
	'🐙',
	'🦕',
	'🦖',
	'🍎',
	'🍌',
	'🍓',
	'🍉',
	'🍇',
	'🍒',
	'🍑',
	'🍍',
	'🥑',
	'🍔',
	'🍕',
	'🍟',
	'🌭',
	'🍿',
	'🍣',
	'🍜',
	'🍦',
	'🍩',
	'🍪',
	'☕️',
	'🧋',
	'🍺',
	'🥂',
	'⚽️',
	'🏀',
	'🏈',
	'🎾',
	'🏐',
	'🏓',
	'🏸',
	'🏹',
	'🎯',
	'🎲',
]

const STICKERS = Array.from({ length: 13 }, (_, index) => ({
	id: `sticker-${index + 1}`,
	url: `/static/sticker_pack/${index + 1}.png`,
}))

const BACKGROUNDS = [
	{
		id: 'default',
		name: 'Стандартный',
		class: 'bg-gray-950',
		preview: 'bg-gray-950',
		accentColor: 'text-blue-500',
		buttonBg: 'bg-blue-600',
		buttonHover: 'hover:bg-blue-700',
		ownMessageBg: 'bg-gradient-to-br from-blue-600 to-blue-700',
		borderColor: 'border-blue-500/20',
		ringColor: 'focus:ring-blue-500/50',
		gradientText: 'from-blue-500 to-purple-600',
	},
	{
		id: 'blue',
		name: 'Синий',
		class:
			'bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-800/30 via-gray-950 to-gray-950',
		preview: 'bg-gradient-to-tr from-blue-600 to-gray-900',
		accentColor: 'text-blue-400',
		buttonBg: 'bg-blue-600',
		buttonHover: 'hover:bg-blue-700',
		ownMessageBg: 'bg-gradient-to-br from-blue-600 to-indigo-700',
		borderColor: 'border-blue-500/20',
		ringColor: 'focus:ring-blue-500/50',
		gradientText: 'from-blue-400 to-indigo-500',
	},
	{
		id: 'purple',
		name: 'Фиолетовый',
		class:
			'bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-800/30 via-gray-950 to-gray-950',
		preview: 'bg-gradient-to-tr from-purple-600 to-gray-900',
		accentColor: 'text-purple-400',
		buttonBg: 'bg-purple-600',
		buttonHover: 'hover:bg-purple-700',
		ownMessageBg: 'bg-gradient-to-br from-purple-600 to-fuchsia-700',
		borderColor: 'border-purple-500/20',
		ringColor: 'focus:ring-purple-500/50',
		gradientText: 'from-purple-400 to-fuchsia-500',
	},
	{
		id: 'emerald',
		name: 'Изумрудный',
		class:
			'bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-800/30 via-gray-950 to-gray-950',
		preview: 'bg-gradient-to-tr from-emerald-600 to-gray-900',
		accentColor: 'text-emerald-400',
		buttonBg: 'bg-emerald-600',
		buttonHover: 'hover:bg-emerald-700',
		ownMessageBg: 'bg-gradient-to-br from-emerald-600 to-teal-700',
		borderColor: 'border-emerald-500/20',
		ringColor: 'focus:ring-emerald-500/50',
		gradientText: 'from-emerald-400 to-teal-500',
	},
	{
		id: 'rose',
		name: 'Розовый',
		class:
			'bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-rose-800/30 via-gray-950 to-gray-950',
		preview: 'bg-gradient-to-tr from-rose-600 to-gray-900',
		accentColor: 'text-rose-400',
		buttonBg: 'bg-rose-600',
		buttonHover: 'hover:bg-rose-700',
		ownMessageBg: 'bg-gradient-to-br from-rose-600 to-pink-700',
		borderColor: 'border-rose-500/20',
		ringColor: 'focus:ring-rose-500/50',
		gradientText: 'from-rose-400 to-pink-500',
	},
]

const PhoneIcon = ({ className }: { className?: string }) => (
	<svg
		viewBox='0 0 24 24'
		fill='none'
		stroke='currentColor'
		strokeWidth='2'
		strokeLinecap='round'
		strokeLinejoin='round'
		className={className}
	>
		<path d='M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z'></path>
	</svg>
)

const MicIcon = ({ className }: { className?: string }) => (
	<svg
		viewBox='0 0 24 24'
		fill='none'
		stroke='currentColor'
		strokeWidth='2'
		strokeLinecap='round'
		strokeLinejoin='round'
		className={className}
	>
		<path d='M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z'></path>
		<path d='M19 10v2a7 7 0 0 1-14 0v-2'></path>
		<line x1='12' y1='19' x2='12' y2='23'></line>
		<line x1='8' y1='23' x2='16' y2='23'></line>
	</svg>
)

const StopIcon = ({ className }: { className?: string }) => (
	<svg
		viewBox='0 0 24 24'
		fill='none'
		stroke='currentColor'
		strokeWidth='2'
		strokeLinecap='round'
		strokeLinejoin='round'
		className={className}
	>
		<rect x='3' y='3' width='18' height='18' rx='2' ry='2'></rect>
	</svg>
)

const CheckIcon = ({ className }: { className?: string }) => (
	<svg
		viewBox='0 0 24 24'
		fill='none'
		stroke='currentColor'
		strokeWidth='2'
		strokeLinecap='round'
		strokeLinejoin='round'
		className={className}
	>
		<polyline points='20 6 9 17 4 12'></polyline>
	</svg>
)

const CopyIcon = ({ className }: { className?: string }) => (
	<svg
		viewBox='0 0 24 24'
		fill='none'
		stroke='currentColor'
		strokeWidth='2'
		strokeLinecap='round'
		strokeLinejoin='round'
		className={className}
	>
		<rect x='9' y='9' width='13' height='13' rx='2' ry='2'></rect>
		<path d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'></path>
	</svg>
)

export default function MessengerPage() {
	const { user } = useAuth()
	const { socket, isConnected } = useSocket()
	const [hasConnectedBefore, setHasConnectedBefore] = useState(false)
	const SUPPORT_API_URL =
		process.env.NEXT_PUBLIC_SUPPORT_API_URL || 'http://127.0.0.1:8000'
	const [aiUser, setAiUser] = useState<User>({
		id: 'vondic-ai',
		email: 'ai@vondic.local',
		username: 'Вондик AI',
		role: 'AI',
		is_bot: false,
		avatar_url: null,
		status: 'Online',
		premium: false,
	})
	const botUser = useMemo<User>(
		() => ({
			id: 'botik',
			email: 'botik@вондик.local',
			username: 'Botik',
			role: 'Bot',
			is_bot: true,
			avatar_url: '/static/botik.png',
			status: 'Online',
			premium: false,
		}),
		[],
	)
	const [friends, setFriends] = useState<User[]>([])
	const [recentContacts, setRecentContacts] = useState<User[]>([])
	const [selectedFriend, setSelectedFriend] = useState<User | null>(null)
	const [isRagOpen, setIsRagOpen] = useState(false)
	const [isUserProfileModalOpen, setIsUserProfileModalOpen] = useState(false)
	const [selectedUserForModal, setSelectedUserForModal] = useState<User | null>(
		null,
	)
	const [ragMessages, setRagMessages] = useState<
		{
			id: number
			sender: 'user' | 'admin' | string
			content: string
			created_at: number
		}[]
	>([])
	const [ragInput, setRagInput] = useState('')
	const ragPollRef = useRef<number | null>(null)
	const [aiMessages, setAiMessages] = useState<Message[]>([])
	const aiStorageKey = user?.id
		? `vondic_ai_history_${user.id}`
		: 'vondic_ai_history'
	const [botMessages, setBotMessages] = useState<Message[]>([])
	const botMessageIdsRef = useRef<Set<string>>(new Set())
	const botStorageLoadedRef = useRef(false)
	const botStorageKeyRef = useRef<string | null>(null)
	const [botStorageReadyKey, setBotStorageReadyKey] = useState<string | null>(
		null,
	)
	const botikStorageKey = user?.id
		? `bot_history_${user.id}_${botUser.id}`
		: `bot_history_${botUser.id}`
	const activeBotId =
		selectedFriend?.is_bot === true ? selectedFriend.id : botUser.id
	const botStorageKey = user?.id
		? `bot_history_${user.id}_${activeBotId}`
		: `bot_history_${activeBotId}`
	const [hasBotHistory, setHasBotHistory] = useState(false)
	const botCommands = useMemo(
		() => [
			{ command: 'help', title: '/help', description: 'Список команд' },
			{ command: 'about', title: '/about', description: 'О Botik' },
			{ command: 'time', title: '/time', description: 'Текущее время' },
			{ command: 'ping', title: '/ping', description: 'Проверка связи' },
			{ command: 'echo', title: '/echo', description: 'Повторить текст' },
			{
				command: 'createbot',
				title: '/createbot',
				description: 'Создать бота',
			},
			{ command: 'clear', title: '/clear', description: 'Очистить чат' },
		],
		[],
	)
	const [botCommandHintsById, setBotCommandHintsById] = useState<
		Record<string, { command: string; title: string; description: string }[]>
	>({})
	const activeBotCommands = useMemo(() => {
		if (!selectedFriend || selectedFriend.is_bot !== true) return []
		if (selectedFriend.id === botUser.id) return botCommands
		return botCommandHintsById[selectedFriend.id] || []
	}, [selectedFriend, botUser.id, botCommands, botCommandHintsById])

	useEffect(() => {
		let active = true
		const loadAiUser = async () => {
			try {
				const res = await fetch('/api/v1/auth/ai-user')
				const text = await res.text()
				let data: any = {}
				try {
					data = JSON.parse(text)
				} catch {
					return
				}
				if (!active || !res.ok || !data?.id) return
				setAiUser(prev => ({
					...prev,
					...data,
					username: data.username || prev.username,
					email: data.email || prev.email,
					avatar_url: data.avatar_url ?? prev.avatar_url,
					role: data.role || prev.role,
					status: data.status || prev.status,
					premium: !!data.premium,
				}))
			} catch {}
		}
		loadAiUser()
		return () => {
			active = false
		}
	}, [])

	useEffect(() => {
		if (!selectedFriend) return
		if (selectedFriend.id === aiUser.id) return
		if (selectedFriend.username === aiUser.username) {
			setSelectedFriend(aiUser)
		}
	}, [aiUser, selectedFriend])

	const ragLoadHistory = async () => {
		try {
			const res = await fetch(`${SUPPORT_API_URL}/chat/history`, {
				credentials: 'include',
				mode: 'cors',
			})
			const text = await res.text()
			let data: any = {}
			try {
				data = JSON.parse(text)
			} catch {
				console.error('Invalid JSON from support-api /chat/history:', text)
				return
			}
			if (data?.ok && Array.isArray(data.messages)) {
				setRagMessages(data.messages)
			}
		} catch (e) {
			console.error('RAG history error', e)
		}
	}

	const ragPoll = async () => {
		try {
			const res = await fetch(`${SUPPORT_API_URL}/chat/updates`, {
				credentials: 'include',
				mode: 'cors',
			})
			const text = await res.text()
			let data: any = {}
			try {
				data = JSON.parse(text)
			} catch {
				console.error('Invalid JSON from support-api /chat/updates:', text)
				return
			}
			if (data?.ok && Array.isArray(data.updates) && data.updates.length) {
				setRagMessages(prev => [
					...prev,
					...data.updates.map((u: any) => ({
						id: u.id,
						sender: 'admin',
						content: u.answer || '',
						created_at: u.answered_at || Date.now(),
					})),
				])
			}
		} catch (e) {
			console.error('RAG poll error', e)
		}
	}

	const ragSend = async () => {
		const text = ragInput.trim()
		if (!text) return
		setRagInput('')
		const tempId = Date.now()
		setRagMessages(prev => [
			...prev,
			{ id: tempId, sender: 'user', content: text, created_at: Date.now() },
		])
		try {
			const res = await fetch('/api/support/chat/send', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: text }),
			})
			const respText = await res.text()
			let data: any = {}
			try {
				data = JSON.parse(respText)
			} catch {
				console.error('Invalid JSON from support-api /chat/send:', respText)
				return
			}
			if (data?.ok && data.answer) {
				setRagMessages(prev => [
					...prev,
					{
						id: tempId + 1,
						sender: 'admin',
						content: data.answer,
						created_at: Date.now(),
					},
				])
			}
		} catch (e) {
			console.error('RAG send error', e)
		}
	}

	useEffect(() => {
		if (isRagOpen) {
			ragLoadHistory()
			if (ragPollRef.current) {
				window.clearInterval(ragPollRef.current)
			}
			ragPollRef.current = window.setInterval(ragPoll, 2500)
		} else {
			if (ragPollRef.current) {
				window.clearInterval(ragPollRef.current)
				ragPollRef.current = null
			}
		}
		return () => {
			if (ragPollRef.current) {
				window.clearInterval(ragPollRef.current)
				ragPollRef.current = null
			}
		}
	}, [isRagOpen])

	useEffect(() => {
		try {
			const raw = localStorage.getItem(aiStorageKey)
			if (raw) {
				const parsed = JSON.parse(raw)
				if (Array.isArray(parsed)) {
					setAiMessages(parsed)
					return
				}
			}
		} catch {}
		setAiMessages([])
	}, [aiStorageKey])

	useEffect(() => {
		try {
			localStorage.setItem(aiStorageKey, JSON.stringify(aiMessages))
		} catch {}
	}, [aiMessages, aiStorageKey])
	useEffect(() => {
		botStorageLoadedRef.current = false
		setBotStorageReadyKey(null)
		try {
			const raw = localStorage.getItem(botStorageKey)
			if (raw) {
				const parsed = JSON.parse(raw)
				if (Array.isArray(parsed)) {
					setBotMessages(parsed)
					botMessageIdsRef.current = new Set(
						parsed.map((item: Message) => item.id),
					)
					botStorageLoadedRef.current = true
					botStorageKeyRef.current = botStorageKey
					setBotStorageReadyKey(botStorageKey)
					return
				}
			}
			if (user?.id) {
				const legacyKey = `bot_history_${activeBotId}`
				if (legacyKey !== botStorageKey) {
					const legacyRaw = localStorage.getItem(legacyKey)
					if (legacyRaw) {
						const legacyParsed = JSON.parse(legacyRaw)
						if (Array.isArray(legacyParsed)) {
							localStorage.setItem(botStorageKey, JSON.stringify(legacyParsed))
							localStorage.removeItem(legacyKey)
							setBotMessages(legacyParsed)
							botMessageIdsRef.current = new Set(
								legacyParsed.map((item: Message) => item.id),
							)
							botStorageLoadedRef.current = true
							botStorageKeyRef.current = botStorageKey
							setBotStorageReadyKey(botStorageKey)
							return
						}
					}
				}
			}
		} catch {}
		setBotMessages([])
		botMessageIdsRef.current = new Set()
		botStorageLoadedRef.current = true
		botStorageKeyRef.current = botStorageKey
		setBotStorageReadyKey(botStorageKey)
	}, [botStorageKey, activeBotId, user?.id])

	useEffect(() => {
		if (
			!botStorageLoadedRef.current ||
			botStorageKeyRef.current !== botStorageKey ||
			botStorageReadyKey !== botStorageKey
		) {
			return
		}
		try {
			localStorage.setItem(botStorageKey, JSON.stringify(botMessages))
		} catch {}
		botMessageIdsRef.current = new Set(botMessages.map(item => item.id))
		if (botStorageKey === botikStorageKey) {
			setHasBotHistory(botMessages.length > 0)
		}
	}, [botMessages, botStorageKey, botikStorageKey, botStorageReadyKey])

	useEffect(() => {
		try {
			const raw = localStorage.getItem(botikStorageKey)
			if (raw) {
				const parsed = JSON.parse(raw)
				if (Array.isArray(parsed)) {
					setHasBotHistory(parsed.length > 0)
					return
				}
			}
		} catch {}
		setHasBotHistory(false)
	}, [botikStorageKey])

	useEffect(() => {
		if (!selectedFriend || selectedFriend.role !== 'Bot') return
		if (selectedFriend.id === botUser.id) return
		try {
			const key = getBotHintsStorageKey(selectedFriend.id)
			const raw = localStorage.getItem(key)
			if (raw) {
				const parsed = JSON.parse(raw)
				if (Array.isArray(parsed)) {
					setBotCommandHintsById(prev => ({
						...prev,
						[selectedFriend.id]: parsed,
					}))
				}
			}
		} catch {}
	}, [selectedFriend, botUser.id, user?.id])

	useEffect(() => {
		if (!selectedFriend || selectedFriend.is_bot !== true) return
		if (selectedFriend.id === botUser.id) return
		if (!user?.id) return
		let active = true
		let pollTimeout: number | null = null
		const poll = async () => {
			try {
				const token =
					accessToken ||
					(typeof window !== 'undefined'
						? localStorage.getItem('access_token') || undefined
						: undefined)
				const res = await fetch(
					`/api/v1/bots?bot_id=${selectedFriend.id}&chat_id=${user.id}&mode=outbox`,
					token
						? {
								headers: {
									Authorization: `Bearer ${token}`,
								},
							}
						: undefined,
				)
				if (!res.ok) {
					if (res.status !== 401) {
						console.warn('[Bot outbox] poll failed with status', res.status)
					}
					return
				}
				const data: any = await res.json().catch(() => ({}))
				const items = Array.isArray(data?.items) ? data.items : []
				if (!items.length || !active) return
				appendBotOutboxItems(selectedFriend.id, items)
			} catch {}
			if (active) {
				pollTimeout = window.setTimeout(poll, 1200)
			}
		}
		poll()
		return () => {
			active = false
			if (pollTimeout) {
				window.clearTimeout(pollTimeout)
			}
		}
	}, [selectedFriend, botUser.id, user?.id])

	// Groups State
	const {
		groups,
		fetchMyGroups,
		createGroup,
		addParticipant,
		getGroupParticipants,
		getGroupDetails,
		joinGroup,
	} = useGroups()
	const communitiesHook = useCommunities()
	const {
		communities,
		fetchMyCommunities,
		createCommunity,
		joinCommunity,
		getCommunityDetails,
		getCommunityInviteCode,
	} = communitiesHook
	const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
	const [groupParticipants, setGroupParticipants] = useState<
		Record<string, User>
	>({})
	const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false)
	const [isAddMemberOpen, setIsAddMemberOpen] = useState(false)
	const [newGroupName, setNewGroupName] = useState('')
	const [newGroupDesc, setNewGroupDesc] = useState('')

	const [isJoinGroupOpen, setIsJoinGroupOpen] = useState(false)
	const [joinGroupInviteCode, setJoinGroupInviteCode] = useState('')

	// Communities State
	const [isJoinCommunityOpen, setIsJoinCommunityOpen] = useState(false)
	const [joinCommunityInviteCode, setJoinCommunityInviteCode] = useState('')
	const [communityInviteCode, setCommunityInviteCode] = useState('')
	const [showInviteCode, setShowInviteCode] = useState(false)
	const [input, setInput] = useState('')
	const [activeTab, setActiveTab] = useState<'direct' | 'community'>('direct')
	const messagesEndRef = useRef<HTMLDivElement>(null)
	const messageRefs = useRef<Record<string, HTMLDivElement | null>>({})
	const containerRef = useRef<HTMLDivElement>(null)
	const forceScrollToBottomRef = useRef(false)
	const scrollToBottomOnOpenRef = useRef(false)
	const [prevScrollHeight, setPrevScrollHeight] = useState(0)
	const [isRestoringScroll, setIsRestoringScroll] = useState(false)
	const [replyToMessage, setReplyToMessage] = useState<Message | null>(null)
	const [pinnedMessageId, setPinnedMessageId] = useState<string | null>(null)
	const [pinnedMessageIds, setPinnedMessageIds] = useState<string[]>([])
	const [reactionCounts, setReactionCounts] = useState<
		Record<string, Record<string, number>>
	>({})
	const [myReactions, setMyReactions] = useState<
		Record<string, Record<string, boolean>>
	>({})
	const [replyMap, setReplyMap] = useState<Record<string, Message>>({})
	const [forwardMessage, setForwardMessage] = useState<Message | null>(null)
	// Selection mode for mass deletion
	const [isSelectionMode, setIsSelectionMode] = useState(false)
	const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(
		new Set(),
	)
	// Track messages being deleted for animation (for AI and Bot chats)
	const [deletingAiBotMessageIds, setDeletingAiBotMessageIds] = useState<Set<string>>(
		new Set(),
	)
	// Message filter state
	const [isFilterOpen, setIsFilterOpen] = useState(false)
	const [messageFilter, setMessageFilter] = useState<
		'all' | 'files' | 'photos' | 'links'
	>('all')

	const getReactionsForMessage = (id: string) => {
		const counts = reactionCounts[id] || {}
		const mine = myReactions[id] || {}
		const allEmojis = new Set<string>([
			...Object.keys(counts),
			...Object.keys(mine),
		])
		const result: Record<string, { count: number; reacted: boolean }> = {}
		allEmojis.forEach(emoji => {
			const count = counts[emoji] ?? 0
			const reacted = !!mine[emoji]
			if (count > 0 || reacted) {
				result[emoji] = { count: count || (reacted ? 1 : 0), reacted }
			}
		})
		return result
	}
	const [isForwardOpen, setIsForwardOpen] = useState(false)
	const [forwardQuery, setForwardQuery] = useState('')
	const pendingReplyRef = useRef<{
		content: string
		reply: Message
		sentAt: number
		attachmentsCount: number
	} | null>(null)

	// Channels State
	const {
		channels,
		fetchMyChannels,
		createChannel,
		joinChannel,
		getChannelInfo,
	} = useChannels()
	const { showToast } = useToast()
	const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
	const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false)
	const [isJoinChannelOpen, setIsJoinChannelOpen] = useState(false)
	const [isChannelInfoOpen, setIsChannelInfoOpen] = useState(false)

	// Channel Forms State
	const [newChannelName, setNewChannelName] = useState('')
	const [newChannelDesc, setNewChannelDesc] = useState('')
	const [joinInviteCode, setJoinInviteCode] = useState('')

	// Communities create UI state
	const [isCreateCommunityOpen, setIsCreateCommunityOpen] = useState(false)
	const [communityName, setCommunityName] = useState('')
	const [communityDesc, setCommunityDesc] = useState('')
	// Community channel create UI state
	const [isCreateCommChannelOpen, setIsCreateCommChannelOpen] = useState(false)
	const [commChannelName, setCommChannelName] = useState('')
	const [commChannelDesc, setCommChannelDesc] = useState('')
	const [commChannelType, setCommChannelType] = useState<'text' | 'voice'>(
		'text',
	)
	const [myCommunities, setMyCommunities] = useState<any[]>([])
	const [selectedCommunityId, setSelectedCommunityId] = useState<string>('')
	const [communityChannels, setCommunityChannels] = useState<any[]>([])
	const [selectedCommunity, setSelectedCommunity] = useState<any | null>(null)
	// Voice channel participants state (per channel)
	const [voiceChannelParticipants, setVoiceChannelParticipants] = useState<
		Record<
			string,
			Record<string, { userId: string; username: string; avatarUrl?: string }>
		>
	>({})

	const updateChatUrl = useCallback(
		(
			next: {
				botId?: string
				directId?: string
				groupId?: string
				channelId?: string
				serverId?: string
			} | null,
		) => {
			if (typeof window === 'undefined') return
			const params = new URLSearchParams(window.location.search)
			params.delete('bot_id')
			params.delete('direct_id')
			params.delete('user_id')
			params.delete('group_id')
			params.delete('channel_id')
			params.delete('server_id')
			if (next?.botId) params.set('bot_id', next.botId)
			if (next?.directId) params.set('direct_id', next.directId)
			if (next?.groupId) params.set('group_id', next.groupId)
			if (next?.channelId) params.set('channel_id', next.channelId)
			if (next?.serverId) params.set('server_id', next.serverId)
			const query = params.toString()
			const nextUrl = query
				? `${window.location.pathname}?${query}`
				: window.location.pathname
			window.history.replaceState(null, '', nextUrl)
		},
		[],
	)

	// Sidebar Search State
	const [searchQuery, setSearchQuery] = useState('')

	// WebRTC Actions
	const {
		initiateCall,
		initiateGroupCall,
		joinVoiceChannel,
		leaveVoiceChannel,
		joinGroupCall,
		toggleScreenShare,
		isScreenSharing,
	} = useCallStore()
	const activeGroupCallId = useActiveGroupCallId()
	const activeCalls = useActiveCalls()
	const isInitialized = useIsInitialized()
	const isWebRTCSupported = useIsWebRTCSupported()
	const isScreenShareSupported = useIsScreenShareSupported()
	const debouncedSearchQuery = useDebounce(searchQuery, 500)
	const [userSearchResults, setUserSearchResults] = useState<User[]>([])
	const [botSearchResults, setBotSearchResults] = useState<User[]>([])
	const [isSearchingUsers, setIsSearchingUsers] = useState(false)

	// Message Search State
	const [isChatSearchOpen, setIsChatSearchOpen] = useState(false)
	const [chatSearchQuery, setChatSearchQuery] = useState('')
	const [foundMessages, setFoundMessages] = useState<Message[]>([])
	const [isSearchingMessages, setIsSearchingMessages] = useState(false)
	// Unified Emoji/Sticker Picker State
	const [isPickerOpen, setIsPickerOpen] = useState(false)
	const [pickerTab, setPickerTab] = useState<'emoji' | 'sticker'>('emoji')
	const pickerRef = useRef<HTMLDivElement>(null)

	// Close picker when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				pickerRef.current &&
				!pickerRef.current.contains(event.target as Node)
			) {
				setIsPickerOpen(false)
			}
		}

		if (isPickerOpen) {
			document.addEventListener('mousedown', handleClickOutside)
		}

		return () => {
			document.removeEventListener('mousedown', handleClickOutside)
		}
	}, [isPickerOpen])
	const [isScreenViewerOpen, setIsScreenViewerOpen] = useState(false)
	const [customStickers, setCustomStickers] = useState<
		Array<{ id: string; url: string }>
	>(() => {
		if (typeof window !== 'undefined') {
			const saved = localStorage.getItem('custom_stickers')
			if (saved) {
				try {
					return JSON.parse(saved)
				} catch {
					return []
				}
			}
		}
		return []
	})

	// Pinned Chats State (Premium feature)
	const [pinnedChatIds, setPinnedChatIds] = useState<string[]>(() => {
		// Load from localStorage on mount
		if (typeof window !== 'undefined') {
			const saved = localStorage.getItem('pinned_chats')
			if (saved) {
				try {
					return JSON.parse(saved)
				} catch {
					return []
				}
			}
		}
		return []
	})
	const [isPinnedChatsOpen, setIsPinnedChatsOpen] = useState(false)

	// Save pinned chats to localStorage when changed
	useEffect(() => {
		if (typeof window !== 'undefined') {
			localStorage.setItem('pinned_chats', JSON.stringify(pinnedChatIds))
		}
	}, [pinnedChatIds])
	const stickerUploadRef = useRef<HTMLInputElement>(null)
	const messageInputRef = useRef<HTMLTextAreaElement>(null)

	// Voice Recording State
	const [isRecording, setIsRecording] = useState(false)
	const [recordingTime, setRecordingTime] = useState(0)
	const mediaRecorderRef = useRef<MediaRecorder | null>(null)
	const chunksRef = useRef<Blob[]>([])
	const timerRef = useRef<NodeJS.Timeout | null>(null)

	// File Attachments State
	const [files, setFiles] = useState<File[]>([])
	const [isUploading, setIsUploading] = useState(false)
	const fileInputRef = useRef<HTMLInputElement>(null)

	const fileToDataUrl = (file: File) =>
		new Promise<string>((resolve, reject) => {
			const reader = new FileReader()
			reader.onload = () => resolve(String(reader.result))
			reader.onerror = () => reject(new Error('File read error'))
			reader.readAsDataURL(file)
		})

	const uploadFile = async (file: File) => {
		const maxSize = (user?.premium ? 100 : 20) * 1024 * 1024
		if (file.size > maxSize) {
			showToast(
				`Файл ${file.name} превышает лимит ${user?.premium ? '100' : '20'} МБ`,
				'error',
			)
			throw new Error('File too large')
		}
		const THROTTLE_BPS = 1750000
		if (!user?.premium) {
			const delayMs = Math.ceil((file.size / THROTTLE_BPS) * 1000)
			await new Promise(resolve => setTimeout(resolve, delayMs))
		}
		const dataUrl = await fileToDataUrl(file)
		const res = await fetch('/api/upload/file', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				file: dataUrl,
				filename: file.name,
			}),
		})
		if (!res.ok) {
			const text = await res.text()
			throw new Error(text || 'Upload failed')
		}
		const data: any = await res.json().catch(() => ({}))
		const url = data?.url || data?.file_url || data?.path
		if (!url) throw new Error('Invalid upload response')
		const ext = file.name.includes('.')
			? file.name.split('.').pop()!.toLowerCase()
			: ''
		return {
			url,
			name: file.name,
			ext,
			size: file.size,
		}
	}

	const handlePickFiles = () => {
		fileInputRef.current?.click()
	}

	const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
		const list = e.target.files ? Array.from(e.target.files) : []
		if (list.length === 0) return
		setFiles(prev => [...prev, ...list])
		e.target.value = ''
	}

	const removeFile = (index: number) => {
		setFiles(prev => prev.filter((_, i) => i !== index))
	}

	const handleStartRecording = async () => {
		if (isAiChat || isBotChat) {
			showToast('В этом чате доступны только текстовые сообщения', 'info')
			return
		}
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
			const mediaRecorder = new MediaRecorder(stream)
			mediaRecorderRef.current = mediaRecorder
			chunksRef.current = []

			mediaRecorder.ondataavailable = e => {
				if (e.data.size > 0) {
					chunksRef.current.push(e.data)
				}
			}

			mediaRecorder.start()
			setIsRecording(true)
			setRecordingTime(0)

			timerRef.current = setInterval(() => {
				setRecordingTime(prev => prev + 1)
			}, 1000)
		} catch (err) {
			console.error('Error accessing microphone:', err)
			showToast('Не удалось получить доступ к микрофону', 'error')
		}
	}

	const handleCancelRecording = () => {
		if (mediaRecorderRef.current && isRecording) {
			mediaRecorderRef.current.stop()
			mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
			setIsRecording(false)
			if (timerRef.current) {
				clearInterval(timerRef.current)
				timerRef.current = null
			}
			chunksRef.current = []
			setRecordingTime(0)
		}
	}

	const handleSendVoice = () => {
		if (isAiChat || isBotChat) {
			showToast('В этом чате доступны только текстовые сообщения', 'info')
			return
		}
		if (!mediaRecorderRef.current || !isRecording) return

		mediaRecorderRef.current.onstop = async () => {
			const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
			const file = new File([blob], 'voice_message.webm', {
				type: 'audio/webm',
			})

			const formData = new FormData()
			formData.append('file', file)

			try {
				const res = await fetch('/api/v1/upload/voice', {
					method: 'POST',
					body: formData,
				})

				if (!res.ok) throw new Error('Upload failed')

				const data = await res.json()
				sendChatMessage(data.url, 'voice')
			} catch (err) {
				console.error('Failed to send voice message', err)
				showToast('Ошибка отправки голосового сообщения', 'error')
			}
		}

		mediaRecorderRef.current.stop()
		mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
		setIsRecording(false)
		if (timerRef.current) {
			clearInterval(timerRef.current)
			timerRef.current = null
		}
	}

	const formatTime = (seconds: number) => {
		const mins = Math.floor(seconds / 60)
		const secs = seconds % 60
		return `${mins}:${secs.toString().padStart(2, '0')}`
	}

	// Chat Settings State
	const [isSettingsOpen, setIsSettingsOpen] = useState(false)
	const [currentBackground, setCurrentBackground] = useState(BACKGROUNDS[0])
	const [chatBackgroundImage, setChatBackgroundImage] = useState<string | null>(
		null,
	)
	const [messageTheme, setMessageTheme] = useState(BACKGROUNDS[0])
	const [isCustomBgOpen, setIsCustomBgOpen] = useState(false)
	const [customBgUrl, setCustomBgUrl] = useState('')
	const [bgImageOpacity, setBgImageOpacity] = useState(1)
	const [bgImageBlur, setBgImageBlur] = useState(0)
	const [showGridPattern, setShowGridPattern] = useState(true)
	const settingsRef = useRef<HTMLDivElement>(null)

	// Load saved theme
	useEffect(() => {
		const savedThemeId = localStorage.getItem('chat_theme')
		const savedBgImage = localStorage.getItem('chat_background_image')
		const savedMessageThemeId = localStorage.getItem('message_theme')
		const savedOpacity = localStorage.getItem('chat_bg_opacity')
		const savedBlur = localStorage.getItem('chat_bg_blur')
		const savedGrid = localStorage.getItem('chat_bg_grid')
		if (savedBgImage) setChatBackgroundImage(savedBgImage)
		if (savedOpacity) {
			const v = Number(savedOpacity)
			if (!Number.isNaN(v)) setBgImageOpacity(Math.min(1, Math.max(0.1, v)))
		}
		if (savedBlur) {
			const v = Number(savedBlur)
			if (!Number.isNaN(v)) setBgImageBlur(Math.min(24, Math.max(0, v)))
		}
		if (savedGrid === 'false') setShowGridPattern(false)
		if (savedMessageThemeId) {
			const theme = BACKGROUNDS.find(bg => bg.id === savedMessageThemeId)
			if (theme) setMessageTheme(theme)
		} else if (savedThemeId) {
			const theme = BACKGROUNDS.find(bg => bg.id === savedThemeId)
			if (theme) {
				setCurrentBackground(theme)
				setMessageTheme(theme)
			}
		}
	}, [])

	useEffect(() => {
		localStorage.setItem('chat_bg_opacity', String(bgImageOpacity))
	}, [bgImageOpacity])
	useEffect(() => {
		localStorage.setItem('chat_bg_blur', String(bgImageBlur))
	}, [bgImageBlur])
	useEffect(() => {
		localStorage.setItem('chat_bg_grid', showGridPattern ? 'true' : 'false')
	}, [showGridPattern])

	// Fetch channels when tab is active
	useEffect(() => {
		if (activeTab === 'community') {
			fetchMyChannels()
			;(async () => {
				try {
					const res = await fetch('/api/v1/communities/my', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
					})
					if (res.ok) {
						const data = await res.json()
						if (Array.isArray(data)) {
							setMyCommunities(data)
						}
					}
				} catch (e) {
					console.error('Failed to load communities', e)
				}
			})()
		} else if (activeTab === 'direct') {
			fetchMyGroups()
		}
	}, [activeTab, fetchMyChannels, fetchMyGroups])

	// Load my communities when opening create community channel modal
	useEffect(() => {
		const loadMyCommunities = async () => {
			try {
				const res = await fetch('/api/v1/communities/my', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
				})
				if (res.ok) {
					const data = await res.json()
					if (Array.isArray(data)) {
						setMyCommunities(data)
						if (data.length > 0) {
							setSelectedCommunityId(data[0].id)
						}
					}
				}
			} catch (e) {
				console.error('Failed to load communities', e)
			}
		}
		if (isCreateCommChannelOpen) loadMyCommunities()
	}, [isCreateCommChannelOpen])

	// Fetch group participants when group is selected
	useEffect(() => {
		const fetchParticipants = async () => {
			if (!selectedGroup) {
				setGroupParticipants({})
				return
			}
			try {
				const participants = await getGroupParticipants(selectedGroup.id)
				const participantsMap = participants.reduce(
					(acc: any, user: any) => {
						acc[user.id] = user
						return acc
					},
					{} as Record<string, User>,
				)
				setGroupParticipants(participantsMap)
			} catch (e) {
				console.error('Failed to fetch participants', e)
			}
		}
		fetchParticipants()
	}, [selectedGroup, getGroupParticipants])

	const handleCreateChannel = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!newChannelName.trim()) return
		try {
			await createChannel(newChannelName, newChannelDesc)
			setIsCreateChannelOpen(false)
			setNewChannelName('')
			setNewChannelDesc('')
			showToast('Канал успешно создан!', 'success')
		} catch (e) {
			console.error(e)
			showToast('Не удалось создать канал', 'error')
		}
	}

	const handleCreateCommunity = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!communityName.trim()) return
		try {
			const res = await fetch('/api/v1/communities', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: communityName,
					description: communityDesc,
				}),
			})
			if (!res.ok) {
				const text = await res.text()
				throw new Error(text || 'Failed to create community')
			}
			const created = await res.json()
			setMyCommunities(prev => {
				if (Array.isArray(prev)) return [created, ...prev]
				return [created]
			})
			setIsCreateCommunityOpen(false)
			setCommunityName('')
			setCommunityDesc('')
			showToast('Сообщество успешно создано!', 'success')
		} catch (e) {
			console.error(e)
			showToast('Не удалось создать сообщество', 'error')
		}
	}

	const handleCreateCommunityChannel = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!commChannelName.trim() || !selectedCommunityId) return
		try {
			const res = await fetch(
				`/api/v1/communities/${selectedCommunityId}/channels`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						name: commChannelName,
						description: commChannelDesc,
						type: commChannelType,
					}),
				},
			)
			if (!res.ok) {
				const text = await res.text()
				throw new Error(text || 'Failed to create channel')
			}
			const created = await res.json()
			setCommunityChannels(prev => [created, ...prev])
			setIsCreateCommChannelOpen(false)
			setCommChannelName('')
			setCommChannelDesc('')
			setCommChannelType('text')
			showToast('Канал сообщества успешно создан!', 'success')
		} catch (e) {
			console.error(e)
			showToast('Не удалось создать канал сообщества', 'error')
		}
	}

	const selectCommunity = async (community: any) => {
		setSelectedCommunity(community)
		setSelectedCommunityId(community?.id || '')
		try {
			const res = await fetch(
				`/api/v1/communities/${community.id}/channels/list`,
				{
					method: 'GET',
					headers: { 'Content-Type': 'application/json' },
				},
			)
			if (res.ok) {
				const data = await res.json()
				setCommunityChannels(Array.isArray(data) ? data : [])
			}
		} catch (e) {
			console.error('Failed to load community channels', e)
		}
	}

	const handleBackToCommunity = () => {
		setSelectedFriend(null)
		setSelectedChannel(null)
		setSelectedGroup(null)
		setIsChatSearchOpen(false)
		setChatSearchQuery('')
		setFoundMessages([])
		setSelectedCommunity(null)
		setSelectedCommunityId('')
		setActiveTab('community')
	}

	const handleJoinChannel = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!joinInviteCode.trim()) return
		try {
			const channel = await joinChannel(joinInviteCode)
			setIsJoinChannelOpen(false)
			setJoinInviteCode('')
			setSelectedChannel(channel)
			setSelectedFriend(null)
			setSelectedGroup(null)
			showToast('Вы вступили в канал!', 'success')
		} catch (e) {
			console.error(e)
			showToast('Неверный код приглашения', 'error')
		}
	}

	const handleJoinGroup = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!joinGroupInviteCode.trim()) return

		try {
			const group = await joinGroup(joinGroupInviteCode.trim())
			setSelectedGroup(group)
			setSelectedFriend(null)
			setSelectedChannel(null)
			setIsJoinGroupOpen(false)
			setJoinGroupInviteCode('')
			showToast('Вы вступили в группу!', 'success')
		} catch (e: any) {
			console.error(e)
			showToast('Не удалось вступить в группу', 'error')
		}
	}

	const handleJoinCommunity = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!joinCommunityInviteCode.trim()) return

		try {
			const community = await joinCommunity(joinCommunityInviteCode.trim())
			setSelectedCommunity(community)
			setSelectedCommunityId(community.id)
			setSelectedFriend(null)
			setSelectedChannel(null)
			setSelectedGroup(null)
			setIsJoinCommunityOpen(false)
			setJoinCommunityInviteCode('')
			setActiveTab('community')
			showToast('Вы вступили в сообщество!', 'success')
		} catch (e: any) {
			console.error(e)
			showToast('Не удалось вступить в сообщество', 'error')
		}
	}

	const handleShowInviteCode = async () => {
		if (!selectedCommunity) return

		try {
			const inviteCode = await getCommunityInviteCode(selectedCommunity.id)
			setCommunityInviteCode(inviteCode)
			setShowInviteCode(true)
		} catch (e: any) {
			console.error(e)
			showToast('Не удалось получить код приглашения', 'error')
		}
	}

	const handleAddMember = async (userId: string) => {
		if (!selectedGroup) return
		try {
			const details = await getGroupDetails(selectedGroup.id)
			if (!details || !details.invite_code) {
				throw new Error('Не удалось получить код приглашения')
			}

			if (socket) {
				socket.emit('send_message', {
					group_id: selectedGroup.id,
					target_user_id: userId,
					content: `Привет! Присоединяйся к моей группе "${selectedGroup.name}"!\nКод приглашения: ${details.invite_code}`,
					attachments: [],
				})
				showToast('Приглашение отправлено!', 'success')
				setIsAddMemberOpen(false)
			} else {
				throw new Error('Нет соединения с сервером')
			}
		} catch (e: any) {
			console.error(e)
			showToast(e.message || 'Ошибка при отправке приглашения', 'error')
		}
	}

	const handleCreateGroup = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!newGroupName.trim()) return
		try {
			await createGroup(newGroupName, newGroupDesc)
			setIsCreateGroupOpen(false)
			setNewGroupName('')
			setNewGroupDesc('')
			showToast('Группа успешно создана!', 'success')
		} catch (e) {
			console.error(e)
			showToast('Не удалось создать группу', 'error')
		}
	}

	const handleThemeChange = (theme: (typeof BACKGROUNDS)[0]) => {
		setCurrentBackground(theme)
		setChatBackgroundImage(null)
		localStorage.setItem('chat_theme', theme.id)
		localStorage.removeItem('chat_background_image')
	}

	const handleMessageThemeChange = (theme: (typeof BACKGROUNDS)[0]) => {
		setMessageTheme(theme)
		localStorage.setItem('message_theme', theme.id)
	}

	const handleSetCustomBackground = (url: string) => {
		setChatBackgroundImage(url)
		setCurrentBackground(BACKGROUNDS[0])
		localStorage.setItem('chat_background_image', url)
		localStorage.removeItem('chat_theme')
		setIsCustomBgOpen(false)
		setCustomBgUrl('')
	}

	const handleClearCustomBackground = () => {
		setChatBackgroundImage(null)
		localStorage.removeItem('chat_background_image')
	}

	const isAiChat = selectedFriend?.id === aiUser.id
	const isBotChat = selectedFriend?.is_bot === true && !isAiChat
	const targetUserId = selectedFriend?.id
	const hasActiveChat = !!(selectedFriend || selectedChannel || selectedGroup)
	const accessToken = (user as any)?.access_token as string | undefined
	const isSelectedFriendOnline =
		selectedFriend?.status?.toLowerCase() === 'online'
	const isSelectedFriendInCall = selectedFriend
		? Array.from(activeCalls.values()).some(
				call => call.userId === selectedFriend.id,
			)
		: false
	const hasActiveCall = activeCalls.size > 0 || !!activeGroupCallId

	const {
		messages: chatMessages,
		deletingMessageIds,
		sendMessage: sendChatMessage,
		loadMoreMessages,
		searchMessages,
		isLoading,
		isTyping,
		sendTyping,
		sendStopTyping,
		markMessagesAsRead,
		deleteMessage,
		updateMessage,
		markMessageDeleted,
		clearHistory,
	} = useChat(
		socket,
		user?.id,
		targetUserId,
		selectedChannel?.id,
		selectedGroup?.id,
	)
	const messages = isBotChat ? botMessages : chatMessages
	const isChatLoading = isBotChat ? false : isLoading
	const isChatTyping = isBotChat ? false : isTyping

	useEffect(() => {
		if (messages.length > 0) {
			const pinned = messages.filter(m => !!m.pinned_by).map(m => m.id)
			setPinnedMessageIds(pinned)
			if (pinned.length > 0) {
				setPinnedMessageId(pinned[pinned.length - 1])
			}
		}
	}, [messages])

	useEffect(() => {
		if (typeof window === 'undefined') return
		const setActive = (kind: 'dm' | 'group' | 'channel', id: string) => {
			localStorage.setItem(
				'active_chat',
				JSON.stringify({ kind, id: String(id) }),
			)
		}
		if (selectedFriend?.id) {
			setActive('dm', selectedFriend.id)
			return
		}
		if (selectedGroup?.id) {
			setActive('group', selectedGroup.id)
			return
		}
		if (selectedChannel?.id) {
			setActive('channel', selectedChannel.id)
			return
		}
		localStorage.removeItem('active_chat')
		return () => {
			localStorage.removeItem('active_chat')
		}
	}, [selectedFriend?.id, selectedGroup?.id, selectedChannel?.id])

	// Restore call state on mount
	useEffect(() => {
		const restored = restoreCallState()
		if (
			restored &&
			(restored.activeCalls.size > 0 || restored.activeGroupCallId)
		) {
			console.log('[Call] Restored call state from localStorage')
			// The call store will be updated automatically
		}
	}, [])

	// Save call state when it changes
	useEffect(() => {
		if (hasActiveCall) {
			saveCallState()
		} else {
			clearCallState()
		}
	}, [hasActiveCall, activeCalls.size, activeGroupCallId])

	// Save user data to localStorage for CallPanel
	useEffect(() => {
		if (user) {
			localStorage.setItem(
				'user_data',
				JSON.stringify({
					id: user.id,
					username: user.username,
					avatar_url: user.avatar_url,
				}),
			)
		}
	}, [user])

	// Close call panel on page unload
	useEffect(() => {
		const handleBeforeUnload = () => {
			if (hasActiveCall) {
				saveCallState()
			}
		}
		window.addEventListener('beforeunload', handleBeforeUnload)
		return () => {
			window.removeEventListener('beforeunload', handleBeforeUnload)
		}
	}, [hasActiveCall])
	const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
	const isTypingRef = useRef(false)

	const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const newValue = e.target.value
		setInput(newValue)

		if (!selectedFriend || isAiChat || isBotChat) return

		if (!isTypingRef.current && newValue.trim()) {
			isTypingRef.current = true
			sendTyping()
		}

		if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)

		if (newValue.trim()) {
			typingTimeoutRef.current = setTimeout(() => {
				isTypingRef.current = false
				sendStopTyping()
			}, 2000)
		} else {
			isTypingRef.current = false
			sendStopTyping()
		}
	}
	const botCommandQuery =
		isBotChat && input.startsWith('/') ? input.slice(1).toLowerCase() : ''
	const botCommandToken = botCommandQuery.split(' ')[0]
	const filteredBotCommands =
		isBotChat && input.startsWith('/')
			? activeBotCommands.filter(cmd => cmd.command.startsWith(botCommandToken))
			: []
	const showBotCommandHints =
		isBotChat && input.startsWith('/') && filteredBotCommands.length > 0

	// Read Receipts Logic
	useEffect(() => {
		if (!selectedFriend || isAiChat || isBotChat || !messages.length) return

		// Find unread messages from the other user
		const unreadIds = messages
			.filter(m => !m.isOwn && !m.is_read && m.sender_id === selectedFriend.id)
			.map(m => m.id)

		if (unreadIds.length > 0) {
			markMessagesAsRead(unreadIds)
		}
	}, [messages, selectedFriend, markMessagesAsRead])

	// Listen for user status updates
	useEffect(() => {
		if (!socket) return

		const handleStatusChange = (data: { user_id: string; status: string }) => {
			console.log('User status changed:', data)
			setFriends(prev =>
				prev.map(friend =>
					friend.id === data.user_id
						? {
								...friend,
								status: data.status,
								last_seen:
									data.status.toLowerCase() === 'offline'
										? new Date()
										: friend.last_seen,
							}
						: friend,
				),
			)
			setSelectedFriend(prev => {
				if (prev && prev.id === data.user_id) {
					return {
						...prev,
						status: data.status,
						last_seen:
							data.status.toLowerCase() === 'offline'
								? new Date()
								: prev.last_seen,
					}
				}
				return prev
			})
		}

		const handleUserConnected = (data: { user_id: string }) => {
			handleStatusChange({ user_id: data.user_id, status: 'Online' })
		}

		const handleUserDisconnected = (data: { user_id: string }) => {
			handleStatusChange({ user_id: data.user_id, status: 'Offline' })
		}

		const handleOnlineUsers = (data: string[]) => {
			// Update friends status based on online users list
			setFriends(prev =>
				prev.map(friend =>
					data.includes(friend.id)
						? { ...friend, status: 'Online' }
						: {
								...friend,
								status: 'Offline',
								last_seen: friend.last_seen || new Date(),
							},
				),
			)
		}

		// Voice channel participant handlers
		const handleVoiceChannelParticipantJoined = (data: {
			channel_id: string
			user_id: string
			socket_id: string
			username: string
			avatar_url?: string
		}) => {
			if (data.channel_id && data.user_id && data.username) {
				setVoiceChannelParticipants(prev => ({
					...prev,
					[data.channel_id]: {
						...(prev[data.channel_id] || {}),
						[data.user_id]: {
							userId: data.user_id,
							username: data.username,
							avatarUrl: data.avatar_url,
						},
					},
				}))
			}
		}

		const handleVoiceChannelParticipantLeft = (data: {
			channel_id: string
			user_id: string
			username: string
		}) => {
			if (data.channel_id && data.user_id) {
				setVoiceChannelParticipants(prev => {
					const channelParticipants = { ...(prev[data.channel_id] || {}) }
					delete channelParticipants[data.user_id]

					const next = { ...prev }
					if (Object.keys(channelParticipants).length > 0) {
						next[data.channel_id] = channelParticipants
					} else {
						delete next[data.channel_id] // Remove channel if no participants left
					}

					return next
				})
			}
		}

		socket.on('user_status_change', handleStatusChange)
		socket.on('user_connected', handleUserConnected)
		socket.on('user_disconnected', handleUserDisconnected)
		socket.on('online_users', handleOnlineUsers)
		socket.on(
			'voice_channel_participant_joined',
			handleVoiceChannelParticipantJoined,
		)
		socket.on(
			'voice_channel_participant_left',
			handleVoiceChannelParticipantLeft,
		)

		// Request initial online users list
		socket.emit('get_online_users')

		// Set up periodic status updates
		const statusUpdateInterval = setInterval(() => {
			socket.emit('get_online_users')
		}, 30000) // Update every 30 seconds

		return () => {
			socket.off('user_status_change', handleStatusChange)
			socket.off('user_connected', handleUserConnected)
			socket.off('user_disconnected', handleUserDisconnected)
			socket.off('online_users', handleOnlineUsers)
			socket.off(
				'voice_channel_participant_joined',
				handleVoiceChannelParticipantJoined,
			)
			socket.off(
				'voice_channel_participant_left',
				handleVoiceChannelParticipantLeft,
			)
			clearInterval(statusUpdateInterval)
		}
	}, [socket])

	// Fetch friends
	useEffect(() => {
		const fetchFriends = async () => {
			if (!user) return
			try {
				const res = await fetch('/api/friends/list', {
					method: 'POST',
				})
				if (res.ok) {
					const data = await res.json()
					const friendList = Array.isArray(data) ? data : []
					const cleaned = friendList.filter(
						f => f.username !== 'Вондик AI' && f.username !== 'vondic_ai',
					)
					setFriends(
						cleaned.map((f: any) => ({
							...f,
							is_bot: f.is_bot === true ? true : false,
							last_seen:
								f.status?.toLowerCase() === 'offline'
									? f.last_seen || new Date()
									: f.last_seen,
						})),
					)
				}
			} catch (e) {
				console.error(e)
			}
		}
		fetchFriends()
	}, [user])

	const fetchRecent = useCallback(async () => {
		if (!accessToken) {
			setRecentContacts([])
			return
		}
		try {
			const res = await fetch(`/api/v1/dm/recent?limit=50`, {
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
			})
			if (!res.ok) return
			const data: any = await res.json().catch(() => ({}))
			const items = Array.isArray(data?.items) ? data.items : []
			const cleaned = items
				.filter((item: any) => {
					const id = item?.id
					if (!id) return false
					if (user?.id && String(id) === String(user.id)) return false
					if (aiUser?.id && String(id) === String(aiUser.id)) return false
					const username = String(item?.username || '')
					if (username === 'Вондик AI' || username === 'vondic_ai') return false
					return true
				})
				.map((item: any) => ({
					...item,
					is_bot: item.is_bot === true ? true : false,
				}))
			setRecentContacts(cleaned)
		} catch {}
	}, [accessToken, user?.id, aiUser?.id])

	useEffect(() => {
		let active = true
		fetchRecent()
		return () => {
			active = false
		}
	}, [fetchRecent])

	// Listen for new messages to update recent contacts
	useEffect(() => {
		if (!socket) return
		const handleMessageUpdate = () => {
			fetchRecent()
		}
		socket.on('message_sent', handleMessageUpdate)
		socket.on('receive_message', handleMessageUpdate)
		return () => {
			socket.off('message_sent', handleMessageUpdate)
			socket.off('receive_message', handleMessageUpdate)
		}
	}, [socket, fetchRecent])

	useEffect(() => {
		if (typeof window === 'undefined') return
		const params = new URLSearchParams(window.location.search)
		const botId = params.get('bot_id')
		const groupId = params.get('group_id')
		const directId = params.get('direct_id') || params.get('user_id')
		const channelId = params.get('channel_id')
		const serverId = params.get('server_id')
		if (botId) {
			const loadBot = async () => {
				try {
					const res = await fetch(`/api/v1/bots?bot_id=${botId}`)
					if (!res.ok) return
					const data: any = await res.json().catch(() => ({}))
					if (!data?.id || !data?.name) return
					setSelectedFriend({
						id: data.id,
						email: `${data.name}@bot.local`,
						username: data.name,
						role: 'Bot',
						avatar_url: data.avatar_url ?? null,
						status: data.is_active === 0 ? 'Offline' : 'Online',
						premium: false,
						is_bot: true,
					})
					setSelectedGroup(null)
					setSelectedChannel(null)
					setIsChatSearchOpen(false)
					setChatSearchQuery('')
					setFoundMessages([])
				} catch (error) {
					console.error('Failed to load bot by id:', error)
				}
			}
			loadBot()
			return
		}
		if (groupId) {
			const loadGroup = async () => {
				try {
					const group = await getGroupDetails(groupId)
					if (!group?.id) return
					setSelectedGroup(group)
					setSelectedFriend(null)
					setSelectedChannel(null)
					setSelectedCommunity(null)
					setSelectedCommunityId('')
					setActiveTab('direct')
					setIsChatSearchOpen(false)
					setChatSearchQuery('')
					setFoundMessages([])
				} catch (error) {
					console.error('Failed to load group by id:', error)
				}
			}
			loadGroup()
			return
		}
		if (serverId) {
			const loadServer = async () => {
				try {
					const res = await fetch('/api/v1/communities/my', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
					})
					if (!res.ok) return
					const data = await res.json().catch(() => [])
					const communities = Array.isArray(data) ? data : []
					const community = communities.find(
						(item: any) => String(item?.id) === String(serverId),
					)
					if (!community?.id) return
					setMyCommunities(communities)
					setSelectedCommunity(community)
					setSelectedCommunityId(community.id)
					setActiveTab('community')
					setSelectedFriend(null)
					setSelectedGroup(null)
					setSelectedChannel(null)
					setIsChatSearchOpen(false)
					setChatSearchQuery('')
					setFoundMessages([])
					const channelsRes = await fetch(
						`/api/v1/communities/${community.id}/channels/list`,
						{
							method: 'GET',
							headers: { 'Content-Type': 'application/json' },
						},
					)
					if (channelsRes.ok) {
						const channelsData = await channelsRes.json()
						const list = Array.isArray(channelsData) ? channelsData : []
						setCommunityChannels(list)
						if (channelId) {
							const selected = list.find(
								(ch: any) => String(ch?.id) === String(channelId),
							)
							if (selected?.id) {
								setSelectedChannel({
									id: selected.id,
									name: selected.name,
									description: selected.description || '',
									invite_code: '',
									owner_id: '',
									participants_count: 0,
								})
							}
						}
					}
				} catch (error) {
					console.error('Failed to load server by id:', error)
				}
			}
			loadServer()
			return
		}
		if (channelId) {
			const loadChannel = async () => {
				try {
					const channel = await getChannelInfo(channelId)
					if (!channel?.id) return
					setSelectedChannel(channel)
					setSelectedFriend(null)
					setSelectedGroup(null)
					setSelectedCommunity(null)
					setSelectedCommunityId('')
					setActiveTab('community')
					setIsChatSearchOpen(false)
					setChatSearchQuery('')
					setFoundMessages([])
				} catch (error) {
					console.error('Failed to load channel by id:', error)
				}
			}
			loadChannel()
			return
		}
		if (!directId) return
		const loadUser = async () => {
			try {
				const res = await fetch(`/api/users/${directId}`)
				if (!res.ok) return
				const payload = await res.json().catch(() => ({}))
				const data = payload?.user || payload
				if (!data?.id || !data?.username) return
				setSelectedFriend({
					id: data.id,
					email: data.email || `${data.username}@user.local`,
					username: data.username,
					role: data.role || 'User',
					avatar_url: data.avatar_url ?? null,
					status: data.status || 'Offline',
					premium: !!data.premium,
					is_bot: data.is_bot === true,
				})
				setSelectedGroup(null)
				setSelectedChannel(null)
				setSelectedCommunity(null)
				setSelectedCommunityId('')
				setActiveTab('direct')
				setIsChatSearchOpen(false)
				setChatSearchQuery('')
				setFoundMessages([])
			} catch (error) {
				console.error('Failed to load user by id:', error)
			}
		}
		loadUser()
	}, [getGroupDetails, getChannelInfo])

	useEffect(() => {
		if (selectedFriend?.id) {
			if (selectedFriend.is_bot) {
				updateChatUrl({ botId: selectedFriend.id })
				return
			}
			updateChatUrl({ directId: selectedFriend.id })
			return
		}
		if (selectedGroup?.id) {
			updateChatUrl({ groupId: selectedGroup.id })
			return
		}
		if (selectedCommunity?.id && selectedChannel?.id) {
			updateChatUrl({
				serverId: selectedCommunity.id,
				channelId: selectedChannel.id,
			})
			return
		}
		if (selectedChannel?.id) {
			updateChatUrl({ channelId: selectedChannel.id })
			return
		}
		if (selectedCommunity?.id) {
			updateChatUrl({ serverId: selectedCommunity.id })
			return
		}
		updateChatUrl(null)
	}, [
		selectedFriend?.id,
		selectedFriend?.is_bot,
		selectedGroup?.id,
		selectedChannel?.id,
		selectedCommunity?.id,
		updateChatUrl,
	])

	// Sidebar Search Effect
	useEffect(() => {
		const searchUsers = async () => {
			const trimmedQuery = debouncedSearchQuery.trim()
			if (!trimmedQuery) {
				setUserSearchResults([])
				setBotSearchResults([])
				setIsSearchingUsers(false)
				return
			}

			setIsSearchingUsers(true)
			try {
				// Получаем токен для запросов к API
				const token = accessToken || localStorage.getItem('access_token')

				const [usersRes, botsRes] = await Promise.all([
					fetch('/api/chats/search', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ query: trimmedQuery }),
					}),
					fetch('/api/v1/bots/search', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							query: trimmedQuery,
							access_token: token || undefined,
						}),
					}),
				])

				if (usersRes.ok) {
					const data = await usersRes.json()
					const raw = Array.isArray(data) ? data : []
					const cleaned = raw.filter((item: any) => {
						if (!item?.id) return false
						if (String(item.id) === String(aiUser.id)) return false
						const username = String(item?.username || '').toLowerCase()
						if (username === 'vondic ai' || username === 'vondic_ai')
							return false
						if (item.is_bot === true) return false
						return true
					})
					setUserSearchResults(cleaned)
				} else {
					setUserSearchResults([])
				}

				if (botsRes.ok) {
					const data = await botsRes.json()
					const bots = Array.isArray(data) ? data : []
					const mappedBots = bots
						.filter((bot: any) => bot?.id && bot?.name)
						.map((bot: any) => ({
							id: bot.id,
							email: `${bot.name}@bot.local`,
							username: bot.name,
							role: 'Bot',
							is_bot: true,
							avatar_url: bot.avatar_url ?? null,
							status: bot.is_active === 0 ? 'Offline' : 'Online',
							premium: false,
						}))
						.filter((bot: User) => bot.id !== botUser.id)
					setBotSearchResults(mappedBots)
				} else {
					setBotSearchResults([])
				}
			} catch (error) {
				console.error('User search error:', error)
			} finally {
				setIsSearchingUsers(false)
			}
		}

		searchUsers()
	}, [debouncedSearchQuery, aiUser.id])

	// Close settings menu when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				settingsRef.current &&
				!settingsRef.current.contains(event.target as Node)
			) {
				setIsSettingsOpen(false)
			}
		}

		if (isSettingsOpen) {
			document.addEventListener('mousedown', handleClickOutside)
		}

		return () => {
			document.removeEventListener('mousedown', handleClickOutside)
		}
	}, [isSettingsOpen])

	// Message Search Handler
	const handleMessageSearch = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!chatSearchQuery.trim()) return

		setIsSearchingMessages(true)
		if (isAiChat || isBotChat) {
			const query = chatSearchQuery.trim().toLowerCase()
			const results = messages.filter(m =>
				m.content?.toLowerCase().includes(query),
			)
			setFoundMessages(results)
			setIsSearchingMessages(false)
			return
		}
		const results = messages.filter(m =>
			m.content?.toLowerCase().includes(chatSearchQuery.toLowerCase()),
		)
		setFoundMessages(results)
		setIsSearchingMessages(false)
	}

	const sendAiMessage = async () => {
		const text = input.trim()
		if (!text) return
		if (files.length > 0) {
			showToast('В AI чате доступны только текстовые сообщения', 'info')
			setFiles([])
			return
		}
		if (aiUser.id === 'vondic-ai') {
			showToast('AI ещё загружается', 'info')
			return
		}
		forceScrollToBottomRef.current = true
		if (replyToMessage) {
			pendingReplyRef.current = {
				content: text,
				reply: replyToMessage,
				sentAt: Date.now(),
				attachmentsCount: 0,
			}
		}
		setInput('')
		setReplyToMessage(null)
		sendChatMessage(text, 'text', undefined, replyToMessage?.id)
	}

	const parseBotCommandArgs = (raw: string) => {
		const args: Record<string, string> = {}
		const keyRegex = /(\w+)=/g
		const matches: { key: string; start: number; end: number }[] = []
		let match = keyRegex.exec(raw)
		while (match) {
			matches.push({
				key: match[1],
				start: match.index,
				end: match.index + match[0].length,
			})
			match = keyRegex.exec(raw)
		}
		for (let i = 0; i < matches.length; i++) {
			const current = matches[i]
			const next = matches[i + 1]
			const valueEnd = next ? next.start : raw.length
			let value = raw.slice(current.end, valueEnd).trim()
			if (
				(value.startsWith('"') && value.endsWith('"')) ||
				(value.startsWith("'") && value.endsWith("'"))
			) {
				value = value.slice(1, -1)
			}
			if (value) {
				args[current.key] = value
			}
		}
		return args
	}

	const getBotHintsStorageKey = (botId: string) =>
		user?.id
			? `bot_command_hints_${user.id}_${botId}`
			: `bot_command_hints_${botId}`

	const extractCommandsFromText = (text: string) => {
		const matches = text.match(/\/[a-zа-я0-9_]+/gi) || []
		const unique = Array.from(
			new Set(matches.map(item => item.slice(1).toLowerCase())),
		)
		return unique.map(command => ({
			command,
			title: `/${command}`,
			description: 'Команда',
		}))
	}

	const mergeBotCommandHints = (botId: string, text: string) => {
		const extracted = extractCommandsFromText(text)
		if (!extracted.length) return
		setBotCommandHintsById(prev => {
			const existing = prev[botId] || []
			const map = new Map(existing.map(item => [item.command, item]))
			for (const item of extracted) {
				if (!map.has(item.command)) {
					map.set(item.command, item)
				}
			}
			const next = Array.from(map.values())
			try {
				const key = getBotHintsStorageKey(botId)
				localStorage.setItem(key, JSON.stringify(next))
			} catch {}
			return { ...prev, [botId]: next }
		})
	}

	const appendBotOutboxItems = (botId: string, items: any[]) => {
		if (!Array.isArray(items) || !items.length) return
		const texts: string[] = []
		setBotMessages(prev => {
			const next = [...prev]
			for (const item of items) {
				const rawMessageId = String(
					item?.message_id || `${Date.now()}-${Math.random()}`,
				)
				const dedupeKey = `${botId}:${rawMessageId}:${String(item?.date || '')}`
				if (botMessageIdsRef.current.has(dedupeKey)) continue
				botMessageIdsRef.current.add(dedupeKey)
				const rawDate = item?.date ? Number(item.date) : NaN
				const dateMs = Number.isFinite(rawDate) ? rawDate * 1000 : Date.now()
				next.push({
					id: dedupeKey,
					sender_id: botId,
					content: String(item?.text || ''),
					timestamp: new Date(dateMs).toISOString(),
					isOwn: false,
					is_read: true,
					type: 'text',
					reply_markup: item?.reply_markup || undefined,
				})
				if (item?.text) texts.push(String(item.text))
			}
			return next
		})
		for (const text of texts) {
			mergeBotCommandHints(botId, text)
		}
	}

	const sendBotMessage = async () => {
		const text = input.trim()
		if (!text) return
		if (files.length > 0) {
			showToast('В этом чате доступны только текстовые сообщения', 'info')
			setFiles([])
			return
		}
		forceScrollToBottomRef.current = true
		if (replyToMessage) {
			pendingReplyRef.current = {
				content: text,
				reply: replyToMessage,
				sentAt: Date.now(),
				attachmentsCount: 0,
			}
		}
		const nextMessage: Message = {
			id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
			sender_id: user?.id || 'me',
			content: text,
			timestamp: new Date().toISOString(),
			isOwn: true,
			is_read: true,
			reply_to: replyToMessage?.id,
			type: 'text',
		}
		const activeBot = selectedFriend?.is_bot === true ? selectedFriend : botUser
		const buildBotReply = (content: string): Message => ({
			id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
			sender_id: activeBot.id,
			content,
			timestamp: new Date().toISOString(),
			isOwn: false,
			is_read: true,
			type: 'text',
		})
		const isBotikChat =
			selectedFriend?.is_bot === true && selectedFriend.id === botUser.id
		if (!isBotikChat) {
			const targetBotId = selectedFriend?.id
			setBotMessages(prev => [...prev, nextMessage])
			if (!accessToken || !user?.id) {
				setBotMessages(prev => [
					...prev,
					buildBotReply('Нужна авторизация для отправки боту.'),
				])
				setInput('')
				setReplyToMessage(null)
				return
			}
			if (!targetBotId) {
				setBotMessages(prev => [
					...prev,
					buildBotReply('Не удалось определить чат бота.'),
				])
				setInput('')
				setReplyToMessage(null)
				return
			}
			try {
				const requestBody = JSON.stringify({
					wait_for_reply: 5,
					message: {
						text,
						from_user: {
							id: user.id,
							username: user.username,
							avatar_url: user.avatar_url,
						},
						chat: {
							id: user.id,
							type: 'private',
							title: user.username,
						},
					},
				})
				let res: Response | null = null
				let lastError: unknown = null
				for (let attempt = 0; attempt < 2; attempt++) {
					try {
						res = await fetch(
							`/api/v1/bots/${targetBotId}/updates/push`,
							{
								method: 'POST',
								headers: {
									'Content-Type': 'application/json',
									Authorization: `Bearer ${accessToken}`,
								},
								body: requestBody,
							},
						)
						break
					} catch (error) {
						lastError = error
						if (attempt === 0) {
							await new Promise(resolve => setTimeout(resolve, 600))
						}
					}
				}
				if (!res) {
					throw lastError ?? new Error('Failed to push bot update')
				}
				const textResponse = await res.text()
				let data: any = {}
				try {
					data = textResponse ? JSON.parse(textResponse) : {}
				} catch {
					data = {}
				}
				if (!res.ok) {
					setBotMessages(prev => [
						...prev,
						buildBotReply('Не удалось отправить сообщение боту.'),
					])
				} else if (Array.isArray(data?.outbox) && data.outbox.length > 0) {
					appendBotOutboxItems(targetBotId, data.outbox)
				}
			} catch (error) {
				try {
					const outboxRes = await fetch(
						`/api/v1/bots?bot_id=${targetBotId}&chat_id=${user.id}&mode=outbox`,
						{
							headers: {
								Authorization: `Bearer ${accessToken}`,
							},
						},
					)
					if (outboxRes.ok) {
						const outboxData: any = await outboxRes.json().catch(() => ({}))
						const items = Array.isArray(outboxData?.items) ? outboxData.items : []
						if (items.length > 0) {
							appendBotOutboxItems(targetBotId, items)
							setInput('')
							setReplyToMessage(null)
							return
						}
					}
				} catch {}
				console.error('Bot push network error:', error)
				setBotMessages(prev => [
					...prev,
					buildBotReply('Ошибка сети при отправке сообщения боту.'),
				])
			}
			setInput('')
			setReplyToMessage(null)
			return
		}
		if (text.startsWith('/')) {
			const raw = text.slice(1).trim()
			const [cmdRaw, ...rest] = raw.split(' ')
			const cmd = (cmdRaw || '').toLowerCase()
			const argText = rest.join(' ').trim()
			if (cmd === 'help') {
				const list = botCommands.map(c => `${c.title} — ${c.description}`)
				setBotMessages(prev => [
					...prev,
					nextMessage,
					buildBotReply(`Команды:\n${list.join('\n')}`),
				])
			} else if (cmd === 'about') {
				setBotMessages(prev => [
					...prev,
					nextMessage,
					buildBotReply(
						'Botik — встроенный бот для быстрых команд и подсказок.',
					),
				])
			} else if (cmd === 'time') {
				setBotMessages(prev => [
					...prev,
					nextMessage,
					buildBotReply(`Сейчас ${new Date().toLocaleString()}`),
				])
			} else if (cmd === 'ping') {
				setBotMessages(prev => [...prev, nextMessage, buildBotReply('pong')])
			} else if (cmd === 'echo') {
				setBotMessages(prev => [
					...prev,
					nextMessage,
					buildBotReply(argText || 'Нечего повторять.'),
				])
			} else if (cmd === 'createbot') {
				// Проверяем наличие accessToken несколькими способами
				const token = accessToken || localStorage.getItem('access_token')

				// Отладочная информация
				console.log('[CreateBot] Debug info:', {
					hasAccessToken: !!accessToken,
					accessTokenLength: accessToken?.length,
					hasLocalStorageToken: !!localStorage.getItem('access_token'),
					localStorageTokenLength: localStorage.getItem('access_token')?.length,
					user: user ? { id: user.id, username: user.username } : null,
				})

				if (!token) {
					console.error('[CreateBot] No token found!')
					setBotMessages(prev => [
						...prev,
						nextMessage,
						buildBotReply(
							'Нужна авторизация для создания бота. Пожалуйста, войдите в аккаунт. Если вы уже вошли, попробуйте обновить страницу.',
						),
					])
				} else {
					console.log('[CreateBot] Using token with length:', token.length)
					const args = parseBotCommandArgs(argText)
					const name = args.name?.trim()
					if (!name) {
						setBotMessages(prev => [
							...prev,
							nextMessage,
							buildBotReply(
								'Укажите name=. Пример: /createbot name=Botik description="Описание"',
							),
						])
					} else {
						const payload: any = {
							name,
						}
						if (args.description) payload.description = args.description
						if (args.avatar_url) payload.avatar_url = args.avatar_url
						if (args.is_active !== undefined) {
							const rawVal = args.is_active.toLowerCase()
							if (
								rawVal === '1' ||
								rawVal === 'true' ||
								rawVal === 'yes' ||
								rawVal === 'on'
							) {
								payload.is_active = 1
							} else if (
								rawVal === '0' ||
								rawVal === 'false' ||
								rawVal === 'no' ||
								rawVal === 'off'
							) {
								payload.is_active = 0
							}
						}
						try {
							// Отправляем напрямую на backend, чтобы избежать проблем с redirect в Next.js proxy
							const backendUrl =
								process.env.NEXT_PUBLIC_BACKEND_URL ||
								'https://api.vondic.knopusmedia.ru'
							console.log(
								'[CreateBot] Sending directly to backend:',
								`${backendUrl}/api/v1/bots/`,
							)

							const res = await fetch(`${backendUrl}/api/v1/bots/`, {
								method: 'POST',
								headers: {
									'Content-Type': 'application/json',
								},
								body: JSON.stringify({
									...payload,
									access_token: token,
								}),
							})

							console.log('[CreateBot] Response status:', res.status)
							const text = await res.text()
							console.log('[CreateBot] Response body:', text.substring(0, 500))
							let data: any = {}
							try {
								data = JSON.parse(text)
							} catch {
								data = {}
							}
							if (!res.ok) {
								const errorText =
									data?.error || text || 'Не удалось создать бота'
								setBotMessages(prev => [
									...prev,
									nextMessage,
									buildBotReply(errorText),
								])
							} else {
								const chatUrl = data?.chat_url
									? `${window.location.origin}${data.chat_url}`
									: ''
								const parts = [
									`Бот создан: ${data?.name || name}.`,
									data?.id ? `ID: ${data.id}` : '',
									data?.bot_token ? `Токен: ${data.bot_token}` : '',
									chatUrl ? `Чат: ${chatUrl}` : '',
								].filter(Boolean)
								setBotMessages(prev => [
									...prev,
									nextMessage,
									buildBotReply(parts.join('\n')),
								])
							}
						} catch (error) {
							setBotMessages(prev => [
								...prev,
								nextMessage,
								buildBotReply('Ошибка сети при создании бота.'),
							])
						}
					}
				}
			} else if (cmd === 'clear') {
				setBotMessages([])
			} else {
				setBotMessages(prev => [
					...prev,
					nextMessage,
					buildBotReply('Команда не найдена. Введите /help для списка.'),
				])
			}
		} else {
			setBotMessages(prev => [
				...prev,
				nextMessage,
				buildBotReply('Используйте команды. Список: /help'),
			])
		}
		setInput('')
		setReplyToMessage(null)
	}

	const handleSendMessage = () => {
		if (isAiChat) {
			sendAiMessage()
			return
		}
		if (isBotChat) {
			sendBotMessage()
			return
		}
		const hasText = !!input.trim()
		if (!hasText && files.length === 0) return
		if (isUploading) return
		const run = async () => {
			setIsUploading(true)
			try {
				let attachments: any[] | undefined = undefined
				if (files.length > 0) {
					if (user?.premium) {
						attachments = await Promise.all(files.map(uploadFile))
					} else {
						const list: any[] = []
						for (const f of files) {
							const a = await uploadFile(f)
							list.push(a)
						}
						attachments = list
					}
				}
				if (replyToMessage) {
					pendingReplyRef.current = {
						content: hasText ? input.trim() : '',
						reply: replyToMessage,
						sentAt: Date.now(),
						attachmentsCount: attachments?.length ?? 0,
					}
				}
				forceScrollToBottomRef.current = true
				sendChatMessage(
					hasText ? input.trim() : '',
					'text',
					attachments,
					replyToMessage?.id,
				)
				setInput('')
				setFiles([])
				setReplyToMessage(null)
			} catch (e) {
				console.error('Message send failed', e)
				showToast('Не удалось отправить сообщение', 'error')
			} finally {
				setIsUploading(false)
			}
		}
		run()
	}

	const handleSendSticker = (stickerUrl: string) => {
		if (isAiChat || isBotChat) {
			showToast('В этом чате доступны только текстовые сообщения', 'info')
			setIsPickerOpen(false)
			return
		}
		if (isUploading) return
		const stickerPayload = JSON.stringify({
			type: 'sticker',
			url: stickerUrl,
		})
		if (replyToMessage) {
			pendingReplyRef.current = {
				content: stickerPayload,
				reply: replyToMessage,
				sentAt: Date.now(),
				attachmentsCount: 0,
			}
		}
		forceScrollToBottomRef.current = true
		sendChatMessage(stickerPayload, 'text', [], replyToMessage?.id)
		setInput('')
		setReplyToMessage(null)
		setIsPickerOpen(false)
	}

	const handleUploadSticker = () => {
		stickerUploadRef.current?.click()
	}

	const handleStickerFileChange = async (
		e: React.ChangeEvent<HTMLInputElement>,
	) => {
		const file = e.target.files?.[0]
		if (!file) return

		// Check file size (max 1MB)
		if (file.size > 1024 * 1024) {
			alert('Файл слишком большой. Максимум 1MB')
			return
		}

		// Check file type
		if (!file.type.match('image/(png|jpeg|webp)')) {
			alert('Только PNG, JPEG или WebP')
			return
		}

		try {
			setIsUploading(true)

			// Convert file to base64
			const base64 = await new Promise<string>((resolve, reject) => {
				const reader = new FileReader()
				reader.onload = () => {
					const result = reader.result as string
					// Remove data:image/png;base64, prefix
					const base64Data = result.split(',')[1] || result
					resolve(base64Data)
				}
				reader.onerror = reject
				reader.readAsDataURL(file)
			})

			const response = await fetch('/api/v1/upload/file', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					file: base64,
					filename: file.name,
				}),
			})

			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(errorData.error || 'Ошибка загрузки')
			}

			const data = await response.json()
			const fileUrl = data.url

			// Add to custom stickers
			const newSticker = {
				id: `custom-${Date.now()}`,
				url: fileUrl,
			}

			const updated = [...customStickers, newSticker]
			setCustomStickers(updated)
			localStorage.setItem('custom_stickers', JSON.stringify(updated))

			// Clear input
			e.target.value = ''
			setIsUploading(false)
		} catch (error) {
			console.error('Failed to upload sticker:', error)
			alert('Ошибка загрузки стикера: ' + (error as Error).message)
			setIsUploading(false)
		}
	}

	const deleteCustomSticker = (stickerId: string) => {
		const updated = customStickers.filter(s => s.id !== stickerId)
		setCustomStickers(updated)
		localStorage.setItem('custom_stickers', JSON.stringify(updated))
	}

	useEffect(() => {
		const pending = pendingReplyRef.current
		if (!pending) return
		const match = [...messages]
			.reverse()
			.find(
				m =>
					m.isOwn &&
					m.content === pending.content &&
					(m.attachments?.length ?? 0) === pending.attachmentsCount,
			)
		if (match && !replyMap[match.id]) {
			setReplyMap(prev => ({ ...prev, [match.id]: pending.reply }))
			pendingReplyRef.current = null
		}
	}, [messages, replyMap])

	useEffect(() => {
		const withReplies = messages.filter(m => m.reply_to && !replyMap[m.id])
		if (!withReplies.length) return
		setReplyMap(prev => {
			const next = { ...prev }
			for (const msg of withReplies) {
				if (next[msg.id]) continue
				const referenced = messages.find(item => item.id === msg.reply_to)
				if (referenced) {
					next[msg.id] = referenced
				}
			}
			return next
		})
	}, [messages, replyMap])

	const getMessagePreview = (msg: Message) => {
		if (msg.is_deleted) return 'Сообщение удалено'
		const stickerPayload = (() => {
			try {
				if (!msg.content?.trim().startsWith('{')) return null
				const data = JSON.parse(msg.content)
				if (data?.type === 'sticker' && typeof data?.url === 'string') {
					return data
				}
			} catch {}
			return null
		})()
		if (stickerPayload) return 'Стикер'
		if (msg.attachments && msg.attachments.length > 0) {
			const a = msg.attachments[0]
			const ext = (typeof a === 'object' && a.ext ? a.ext : '').toLowerCase()
			const isImage =
				ext === 'png' ||
				ext === 'jpg' ||
				ext === 'jpeg' ||
				ext === 'gif' ||
				ext === 'webp' ||
				ext === 'bmp' ||
				ext === 'svg'
			if (isImage) return 'Изображение'
			return typeof a === 'object' && a.name ? a.name : 'Файл'
		}
		const text = msg.content?.trim()
		if (!text) return 'Сообщение'
		return text.length > 120 ? `${text.slice(0, 120)}…` : text
	}

	const getSenderName = (msg: Message) => {
		if (msg.sender_id === user?.id) return 'Вы'
		if (msg.group_id || selectedGroup?.id) {
			return groupParticipants[msg.sender_id]?.username || 'Участник'
		}
		if (selectedFriend?.id) {
			return selectedFriend.username
		}
		return 'Пользователь'
	}

	const isSharedPostPayload = (content: string) => {
		try {
			if (!content.trim().startsWith('{')) return false
			const data = JSON.parse(content)
			return data?.type === 'shared_post' && !!data?.post
		} catch {
			return false
		}
	}

	const jumpToMessage = (id: string) => {
		const el = messageRefs.current[id]
		if (el) {
			el.scrollIntoView({ behavior: 'smooth', block: 'center' })
		}
	}

	const handlePinMessage = (msg: Message) => {
		if (!socket || !isConnected) {
			setPinnedMessageIds(prev => {
				if (prev.includes(msg.id)) {
					const next = prev.filter(id => id !== msg.id)
					setPinnedMessageId(current =>
						current === msg.id ? next[next.length - 1] || null : current,
					)
					return next
				}
				const next = [...prev, msg.id]
				setPinnedMessageId(msg.id)
				return next
			})
			return
		}

		socket.emit('pin_message', { message_id: msg.id })
	}

	const handleReplyMessage = (msg: Message) => {
		if (msg.isOwn) return
		setReplyToMessage(msg)
	}

	const handleDeleteMessage = (msg: Message) => {
		if (!msg.isOwn) {
			showToast('Можно удалить только свои сообщения', 'error')
			return
		}
		
		if (isAiChat) {
			// Start animation
			setDeletingAiBotMessageIds(prev => new Set(prev).add(msg.id))
			// Wait for animation, then delete
			setTimeout(() => {
				setAiMessages(prev => prev.filter(m => m.id !== msg.id))
				setDeletingAiBotMessageIds(prev => {
					const next = new Set(prev)
					next.delete(msg.id)
					return next
				})
			}, 400)
			// Clean up pinned messages
			if (pinnedMessageId === msg.id) {
				setPinnedMessageId(null)
			}
			if (pinnedMessageIds.includes(msg.id)) {
				setPinnedMessageIds(prev => prev.filter(id => id !== msg.id))
			}
			showToast('Сообщение удалено', 'success')
		} else if (isBotChat) {
			// Start animation
			setDeletingAiBotMessageIds(prev => new Set(prev).add(msg.id))
			// Wait for animation, then delete
			setTimeout(() => {
				setBotMessages(prev => prev.filter(m => m.id !== msg.id))
				setDeletingAiBotMessageIds(prev => {
					const next = new Set(prev)
					next.delete(msg.id)
					return next
				})
			}, 400)
			// Clean up pinned messages
			if (pinnedMessageId === msg.id) {
				setPinnedMessageId(null)
			}
			if (pinnedMessageIds.includes(msg.id)) {
				setPinnedMessageIds(prev => prev.filter(id => id !== msg.id))
			}
			showToast('Сообщение удалено', 'success')
		} else {
			// For normal DMs, trigger deletion via socket (which will also broadcast to other user)
			// The animation will be triggered by useChat's handleMessageDeleted
			deleteMessage(msg.id)
			
			// Clean up pinned messages
			if (pinnedMessageId === msg.id) {
				setPinnedMessageId(null)
			}
			if (pinnedMessageIds.includes(msg.id)) {
				setPinnedMessageIds(prev => prev.filter(id => id !== msg.id))
			}
		}
	}

	// Selection mode handlers
	const handleToggleSelectionMode = () => {
		setIsSelectionMode(prev => !prev)
		setSelectedMessageIds(new Set())
	}

	const handleToggleMessageSelection = (msg: Message) => {
		if (!msg.isOwn) {
			showToast('Можно выбрать только свои сообщения', 'error')
			return
		}
		setSelectedMessageIds(prev => {
			const next = new Set(prev)
			if (next.has(msg.id)) {
				next.delete(msg.id)
			} else {
				next.add(msg.id)
			}
			// Exit selection mode if no messages selected
			if (next.size === 0) {
				setIsSelectionMode(false)
			}
			return next
		})
	}

	const handleSelectAllMessages = () => {
		const ownMessageIds = messagesToDisplay.filter(m => m.isOwn).map(m => m.id)
		setSelectedMessageIds(new Set(ownMessageIds))
		if (ownMessageIds.length > 0) {
			setIsSelectionMode(true)
		}
	}

	const handleClearSelection = () => {
		setSelectedMessageIds(new Set())
		setIsSelectionMode(false)
	}

	const handleDeleteSelectedMessages = async () => {
		if (selectedMessageIds.size === 0) return

		const confirmed = window.confirm(
			`Удалить ${selectedMessageIds.size} сообще${selectedMessageIds.size % 10 === 1 && selectedMessageIds.size % 100 !== 11 ? 'ние' : selectedMessageIds.size % 10 >= 2 && selectedMessageIds.size % 10 <= 4 && (selectedMessageIds.size % 100 < 12 || selectedMessageIds.size % 100 > 14) ? 'ния' : 'ний'} без возможности восстановления?`,
		)
		if (!confirmed) return

		const messagesToDelete = messagesToDisplay.filter(m =>
			selectedMessageIds.has(m.id),
		)

		if (isAiChat) {
			// Start animation for all selected messages
			setDeletingAiBotMessageIds(new Set(selectedMessageIds))
			// Wait for animation, then delete
			setTimeout(() => {
				setAiMessages(prev => prev.filter(m => !selectedMessageIds.has(m.id)))
				setDeletingAiBotMessageIds(new Set())
			}, 400)
		} else if (isBotChat) {
			// Start animation for all selected messages
			setDeletingAiBotMessageIds(new Set(selectedMessageIds))
			// Wait for animation, then delete
			setTimeout(() => {
				setBotMessages(prev => prev.filter(m => !selectedMessageIds.has(m.id)))
				setDeletingAiBotMessageIds(new Set())
			}, 400)
		} else {
			// For normal DMs, delete via socket for each message
			for (const msg of messagesToDelete) {
				if (msg.isOwn) {
					deleteMessage(msg.id)
				}
			}
		}

		// Clear pinned messages if they were deleted
		setPinnedMessageIds(prev => prev.filter(id => !selectedMessageIds.has(id)))
		if (pinnedMessageId && selectedMessageIds.has(pinnedMessageId)) {
			setPinnedMessageId(null)
		}

		handleClearSelection()
		showToast(
			`${messagesToDelete.length} сообще${messagesToDelete.length % 10 === 1 && messagesToDelete.length % 100 !== 11 ? 'ние' : messagesToDelete.length % 10 >= 2 && messagesToDelete.length % 10 <= 4 && (messagesToDelete.length % 100 < 12 || messagesToDelete.length % 100 > 14) ? 'ния' : 'ний'} удалено`,
			'success',
		)
	}

	const handleDeleteAllHistory = async () => {
		if (isAiChat || isBotChat) {
			showToast('В этом чате нельзя удалить историю', 'info')
			return
		}
		if (!accessToken) {
			showToast('Необходима авторизация', 'error')
			return
		}
		if (!selectedFriend && !selectedChannel && !selectedGroup) return
		const confirmed = window.confirm(
			'Удалить всю переписку без восстановления?',
		)
		if (!confirmed) return

		try {
			let res: Response | null = null

			if (selectedChannel) {
				if (
					selectedChannel.owner_id &&
					user &&
					String(selectedChannel.owner_id) !== String(user.id)
				) {
					showToast('Недостаточно прав', 'error')
					return
				}
				res = await fetch(`${webrtcUrl()}/channels/history`, {
					method: 'DELETE',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						token: accessToken,
						channel_id: selectedChannel.id,
					}),
				})
			} else if (selectedGroup) {
				if (
					selectedGroup.owner_id &&
					user &&
					String(selectedGroup.owner_id) !== String(user.id)
				) {
					showToast('Недостаточно прав', 'error')
					return
				}
				res = await fetch(`${apiUrl()}/api/v1/groups/history`, {
					method: 'DELETE',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						token: accessToken,
						group_id: selectedGroup.id,
					}),
				})
			} else if (selectedFriend) {
				res = await fetch(`${apiUrl()}/api/v1/messages/history`, {
					method: 'DELETE',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						token: accessToken,
						target_id: selectedFriend.id,
					}),
				})
			}

			if (!res) return
			if (!res.ok) {
				const errorText = await res.text()
				showToast(
					errorText
						? `Не удалось удалить историю: ${errorText}`
						: 'Не удалось удалить историю',
					'error',
				)
				return
			}

			clearHistory()
			setPinnedMessageIds([])
			setPinnedMessageId(null)
			setIsChatSearchOpen(false)
			setChatSearchQuery('')
			setFoundMessages([])
			setReplyMap({})
			setIsSettingsOpen(false)
			showToast('История удалена', 'success')
		} catch (e) {
			console.error(e)
			showToast('Не удалось удалить историю', 'error')
		}
	}

	const handleEditMessage = (msg: Message, text: string) => {
		if (isAiChat) {
			setAiMessages(prev =>
				prev.map(m =>
					m.id === msg.id ? { ...m, content: text, is_deleted: false } : m,
				),
			)
		} else if (isBotChat) {
			setBotMessages(prev =>
				prev.map(m =>
					m.id === msg.id ? { ...m, content: text, is_deleted: false } : m,
				),
			)
		} else {
			updateMessage(msg.id, { content: text, is_deleted: false })
		}
	}

	const handleReactMessage = (msg: Message, emoji: string) => {
		setMyReactions(prev => {
			const current = prev[msg.id] || {}
			const reacted = !!current[emoji]
			const nextForMsg = { ...current }
			if (reacted) {
				delete nextForMsg[emoji]
			} else {
				nextForMsg[emoji] = true
			}
			return {
				...prev,
				[msg.id]: nextForMsg,
			}
		})

		if (!socket || !isConnected) {
			setReactionCounts(prev => {
				const current = prev[msg.id] || {}
				const count = current[emoji] ?? 0
				const reacted = !!(myReactions[msg.id] && myReactions[msg.id][emoji])
				const nextCount = reacted ? Math.max(0, count - 1) : count + 1
				const nextForMsg = { ...current }
				if (nextCount <= 0) {
					delete nextForMsg[emoji]
				} else {
					nextForMsg[emoji] = nextCount
				}
				return {
					...prev,
					[msg.id]: nextForMsg,
				}
			})
			return
		}

		socket.emit('react_message', { message_id: msg.id, emoji })
	}

	const handleForwardMessage = (msg: Message) => {
		setForwardMessage(msg)
		setIsForwardOpen(true)
		setForwardQuery('')
	}

	const handleForwardToTarget = (target: {
		id: string
		kind: 'user' | 'group' | 'channel' | 'community'
		label: string
	}) => {
		if (!socket || !forwardMessage) return
		if (forwardMessage.is_deleted) return
		const payload: any = {
			content: forwardMessage.content,
			type: forwardMessage.type || 'text',
			attachments: Array.isArray(forwardMessage.attachments)
				? forwardMessage.attachments
				: [],
		}
		if (forwardMessage.type === 'voice') {
			payload.type = 'voice'
			payload.attachments = []
			payload.content = forwardMessage.content
		}
		if (isSharedPostPayload(forwardMessage.content)) {
			payload.content = forwardMessage.content
		}
		if (target.kind === 'user') payload.target_user_id = target.id
		if (target.kind === 'group') payload.group_id = target.id
		if (target.kind === 'channel' || target.kind === 'community')
			payload.channel_id = target.id
		socket.emit('send_message', payload)
		setIsForwardOpen(false)
		setForwardMessage(null)
		showToast(`Переслано в ${target.label}`, 'success')
	}

	const handleForwardSelectedMessages = (target: {
		id: string
		kind: 'user' | 'group' | 'channel' | 'community'
		label: string
	}) => {
		if (!socket || selectedMessageIds.size === 0) return

		const messagesToForward = messagesToDisplay.filter(
			m => selectedMessageIds.has(m.id) && !m.is_deleted,
		)

		if (messagesToForward.length === 0) {
			showToast('Нет сообщений для пересылки', 'error')
			return
		}

		let sentCount = 0
		messagesToForward.forEach(msg => {
			const payload: any = {
				content: msg.content,
				type: msg.type || 'text',
				attachments: Array.isArray(msg.attachments) ? msg.attachments : [],
			}
			if (msg.type === 'voice') {
				payload.type = 'voice'
				payload.attachments = []
				payload.content = msg.content
			}
			if (isSharedPostPayload(msg.content)) {
				payload.content = msg.content
			}
			// Add forwarded_from information
			if (user && msg.sender_id !== user.id) {
				payload.forwarded_from = {
					sender_id: msg.sender_id,
					sender_name:
						user.username || user.email?.split('@')[0] || 'Пользователь',
					sender_avatar: user.avatar_url,
				}
			}
			if (target.kind === 'user') payload.target_user_id = target.id
			if (target.kind === 'group') payload.group_id = target.id
			if (target.kind === 'channel' || target.kind === 'community')
				payload.channel_id = target.id
			socket.emit('send_message', payload)
			sentCount++
		})

		handleClearSelection()
		setIsForwardOpen(false)
		showToast(
			`Переслано ${sentCount} сообще${sentCount % 10 === 1 && sentCount % 100 !== 11 ? 'ние' : sentCount % 10 >= 2 && sentCount % 10 <= 4 && (sentCount % 100 < 12 || sentCount % 100 > 14) ? 'ния' : 'ний'} в ${target.label}`,
			'success',
		)
	}

	const resolvePinnedForScroll = (scrollTop: number) => {
		if (!pinnedMessageIds.length) return
		let bestId: string | null = null
		let bestTop = -Infinity
		let earliestId: string | null = null
		let earliestTop = Infinity
		const visibleTop = scrollTop + 24
		for (const id of pinnedMessageIds) {
			const el = messageRefs.current[id]
			if (!el) continue
			const top = el.offsetTop
			if (top <= visibleTop && top > bestTop) {
				bestTop = top
				bestId = id
			}
			if (top < earliestTop) {
				earliestTop = top
				earliestId = id
			}
		}
		if (!bestId) {
			bestId = earliestId
		}
		if (bestId && bestId !== pinnedMessageId) {
			setPinnedMessageId(bestId)
		}
	}

	// WebRTC Handlers
	const handleCallInitiate = async (userId: string, userName: string) => {
		console.log('Call button clicked for:', userId, userName)
		console.log('WebRTC initialized:', isInitialized)
		console.log('WebRTC supported:', isWebRTCSupported)

		try {
			await initiateCall(userId, userName)
			showToast('Инициация звонка...', 'info')
		} catch (error) {
			console.error('Failed to initiate call:', error)
			showToast('Не удалось начать звонок', 'error')
		}
	}

	// Track first Socket.IO connection
	useEffect(() => {
		if (isConnected && !hasConnectedBefore) {
			setHasConnectedBefore(true)
		}
	}, [isConnected, hasConnectedBefore])

	const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
		// Disable infinite scroll loading when searching messages
		if (isChatSearchOpen && chatSearchQuery) return
		const { scrollTop, scrollHeight } = e.currentTarget
		requestAnimationFrame(() => resolvePinnedForScroll(scrollTop))
		if (scrollTop < 30 && !isChatLoading && !isBotChat && messages.length > 0) {
			setPrevScrollHeight(scrollHeight)
			setIsRestoringScroll(true)
			loadMoreMessages()
		}
	}

	// Handle scroll position
	useLayoutEffect(() => {
		if (isChatSearchOpen && chatSearchQuery) return // Don't handle scroll for search results

		if (scrollToBottomOnOpenRef.current) {
			scrollToBottomOnOpenRef.current = false
			setIsRestoringScroll(false)
			requestAnimationFrame(() => {
				messagesEndRef.current?.scrollIntoView({
					behavior: 'auto',
					block: 'end',
				})
			})
			if (containerRef.current) {
				resolvePinnedForScroll(containerRef.current.scrollTop)
			}
			return
		}

		if (forceScrollToBottomRef.current) {
			forceScrollToBottomRef.current = false
			setIsRestoringScroll(false)
			requestAnimationFrame(() => {
				messagesEndRef.current?.scrollIntoView({
					behavior: 'smooth',
					block: 'end',
				})
			})
			if (containerRef.current) {
				resolvePinnedForScroll(containerRef.current.scrollTop)
			}
			return
		}

		if (isRestoringScroll && containerRef.current) {
			const newScrollHeight = containerRef.current.scrollHeight
			containerRef.current.scrollTop = newScrollHeight - prevScrollHeight
			setIsRestoringScroll(false)
		} else {
			// Scroll to bottom for new messages or initial load
			messagesEndRef.current?.scrollIntoView({
				behavior: 'smooth',
				block: 'end',
			})
		}
		if (containerRef.current) {
			resolvePinnedForScroll(containerRef.current.scrollTop)
		}
	}, [messages, isChatSearchOpen, chatSearchQuery])

	useEffect(() => {
		scrollToBottomOnOpenRef.current = true
		setIsRestoringScroll(false)
	}, [selectedFriend?.id, selectedChannel?.id, selectedGroup?.id])

	useEffect(() => {
		setPinnedMessageIds([])
		setPinnedMessageId(null)
	}, [selectedFriend?.id, selectedChannel?.id, selectedGroup?.id])

	useEffect(() => {
		if (!socket) return

		const handleReactionUpdate = (data: {
			id?: string
			emoji?: string
			count?: number
		}) => {
			if (!data?.id || !data.emoji || typeof data.count !== 'number') return
			setReactionCounts(prev => {
				const current = prev[data.id!] || {}
				const nextForMsg = { ...current }
				if (data.count! <= 0) {
					delete nextForMsg[data.emoji!]
				} else {
					nextForMsg[data.emoji!] = data.count!
				}
				return {
					...prev,
					[data.id!]: nextForMsg,
				}
			})
		}

		const handlePinnedUpdate = (data: {
			id?: string
			pinned?: boolean
			pinned_by?: string
		}) => {
			if (!data?.id || typeof data.pinned !== 'boolean') return
			updateMessage(data.id, {
				pinned_by: data.pinned ? data.pinned_by || 'system' : null,
			})
			setPinnedMessageIds(prev => {
				if (data.pinned) {
					if (prev.includes(data.id!)) return prev
					const next = [...prev, data.id!]
					setPinnedMessageId(data.id!)
					return next
				}
				if (!prev.includes(data.id!)) return prev
				const next = prev.filter(id => id !== data.id!)
				setPinnedMessageId(current =>
					current === data.id! ? next[next.length - 1] || null : current,
				)
				return next
			})
		}

		socket.on('message_reaction_update', handleReactionUpdate)
		socket.on('message_pinned', handlePinnedUpdate)

		return () => {
			socket.off('message_reaction_update', handleReactionUpdate)
			socket.off('message_pinned', handlePinnedUpdate)
		}
	}, [socket])

	// Separate AI from other entities
	const aiFriend = aiUser
	const botFriend = botUser
	const otherFriends = friends
	const otherGroups = groups.filter(
		g => g.name !== 'Вондик AI' && g.name !== 'AI Assistant',
	)
	// Determine list to show in sidebar
	const normalizedSearch = searchQuery.trim().toLowerCase()
	const searchResultsWithBot = useMemo(() => {
		if (!normalizedSearch) return []
		const items: User[] = []
		if (botFriend.username.toLowerCase().includes(normalizedSearch)) {
			items.push(botFriend)
		}
		items.push(...userSearchResults)
		items.push(...botSearchResults)
		const unique = new Map<string, User>()
		for (const item of items) unique.set(item.id, item)
		return Array.from(unique.values())
	}, [normalizedSearch, userSearchResults, botSearchResults, botFriend])
	const showBotInHistory = hasBotHistory && !normalizedSearch

	const sidebarList = useMemo(() => {
		if (normalizedSearch) return searchResultsWithBot

		// Create a Set of IDs to avoid duplicates
		const addedIds = new Set<string>()
		const list: User[] = []

		// 1. Add recent contacts sorted by backend (recency)
		for (const contact of recentContacts) {
			if (contact && contact.id && !addedIds.has(contact.id)) {
				list.push(contact)
				addedIds.add(contact.id)
			}
		}

		// 2. Append friends who are NOT in recent contacts
		for (const friend of otherFriends) {
			if (friend && friend.id && !addedIds.has(friend.id)) {
				list.push(friend)
				addedIds.add(friend.id)
			}
		}

		// 3. Sort with pinned chats first
		const finalUser =
			user ||
			(typeof window !== 'undefined'
				? JSON.parse(localStorage.getItem('user') || 'null')
				: null)
		return sortChatsWithPinned(list, pinnedChatIds, finalUser)
	}, [
		normalizedSearch,
		searchResultsWithBot,
		recentContacts,
		otherFriends,
		pinnedChatIds,
		user,
	])
	const recentContactsById = useMemo(() => {
		const map = new Map<string, any>()
		for (const contact of recentContacts) {
			if (contact?.id) map.set(String(contact.id), contact)
		}
		return map
	}, [recentContacts])
	const getSidebarPreview = useCallback(
		(friend: User) => {
			if (selectedFriend?.id === friend.id) {
				return getLastMessage(friend.id, messages)
			}
			const recentMeta = recentContactsById.get(String(friend.id))
			const raw =
				recentMeta?.last_message_text ||
				recentMeta?.last_message_preview ||
				recentMeta?.last_message ||
				recentMeta?.preview ||
				''
			const text = String(raw || '')
			return text.length > 30 ? `${text.substring(0, 30)}...` : text
		},
		[messages, recentContactsById, selectedFriend?.id],
	)
	const getSidebarPreviewTime = useCallback(
		(friend: User) => {
			if (selectedFriend?.id === friend.id) {
				return getLastMessageTime(friend.id, messages)
			}
			const recentMeta = recentContactsById.get(String(friend.id))
			const raw =
				recentMeta?.last_message_at ||
				recentMeta?.last_message_time ||
				recentMeta?.updated_at
			if (!raw) return ''
			try {
				return new Date(raw).toLocaleTimeString('ru-RU', {
					hour: '2-digit',
					minute: '2-digit',
				})
			} catch {
				return ''
			}
		},
		[messages, recentContactsById, selectedFriend?.id],
	)

	// Determine messages to show in chat
	let messagesToDisplay =
		isChatSearchOpen && chatSearchQuery ? foundMessages : messages

	// Apply message type filter
	if (messageFilter !== 'all') {
		messagesToDisplay = messagesToDisplay.filter(msg => {
			const hasAttachments =
				msg.attachments &&
				(Array.isArray(msg.attachments)
					? msg.attachments.length > 0
					: msg.attachments !== '')
			const attachmentsArray = Array.isArray(msg.attachments)
				? msg.attachments
				: []

			if (messageFilter === 'files') {
				// Show messages with file attachments (documents, etc.)
				return (
					hasAttachments &&
					attachmentsArray.some(a => {
						const ext = (a.ext || '').toLowerCase()
						return !['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)
					})
				)
			}
			if (messageFilter === 'photos') {
				// Show messages with image attachments
				return (
					hasAttachments &&
					attachmentsArray.some(a => {
						const ext = (a.ext || '').toLowerCase()
						return ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)
					})
				)
			}
			if (messageFilter === 'links') {
				// Show messages containing links
				const urlRegex = /(https?:\/\/[^\s]+)/g
				return urlRegex.test(msg.content)
			}
			return true
		})
	}

	// Check if all selected messages are owned by current user
	const allSelectedMessagesAreOwn =
		selectedMessageIds.size === 0 ||
		messagesToDisplay.every(msg => !selectedMessageIds.has(msg.id) || msg.isOwn)

	const pinnedMessage = pinnedMessageId
		? messages.find(m => m.id === pinnedMessageId)
		: null
	const forwardTargets = [
		...otherFriends.map(f => ({
			id: f.id,
			label: f.username,
			kind: 'user' as const,
			sub: 'Личный чат',
		})),
		...groups.map(g => ({
			id: g.id,
			label: g.name,
			kind: 'group' as const,
			sub: 'Группа',
		})),
		...channels.map(c => ({
			id: c.id,
			label: c.name,
			kind: 'channel' as const,
			sub: 'Канал',
		})),
		...communityChannels
			.filter((c: any) => c?.type !== 'voice')
			.map((c: any) => ({
				id: c.id,
				label: c.name || c.title || 'Канал',
				kind: 'community' as const,
				sub: 'Сервер',
			})),
	].filter(t =>
		forwardQuery
			? t.label.toLowerCase().includes(forwardQuery.toLowerCase())
			: true,
	)

	return (
		<div className='flex h-[100dvh] w-full overflow-hidden bg-[color:var(--app-bg)] text-[color:var(--app-fg)] font-sans'>
			<div
				className={`w-80 border-r border-white/10 bg-black/20 flex-shrink-0 z-20 shadow-xl flex-col ${
					hasActiveChat ? 'hidden md:flex' : 'flex'
				}`}
			>
				<div className='p-4 border-b border-white/10 bg-black/20 backdrop-blur-sm'>
					<div className='flex justify-between items-center mb-4'>
						<div className='flex items-center gap-3'>
							<Link
								href='/feed'
								className='p-2 -ml-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition-colors'
							>
								<ArrowLeftIcon className='w-5 h-5' />
							</Link>
							<h2 className='text-xl font-bold tracking-tight text-white flex items-center gap-2'>
								<span className='bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent transition-all duration-500'>
									Vondic
								</span>
							</h2>
						</div>
					</div>

					<div className='flex p-1 bg-black/30 rounded-lg border border-white/10 relative'>
						<div
							className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white/10 rounded-md transition-all duration-300 ease-out ${
								activeTab === 'direct' ? 'left-1' : 'left-[calc(50%+4px)]'
							}`}
						/>
						<button
							onClick={() => setActiveTab('direct')}
							className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md relative z-10 transition-colors ${
								activeTab === 'direct'
									? 'text-white'
									: 'text-gray-400 hover:text-gray-200'
							}`}
						>
							<MessageSquareIcon className='w-4 h-4' />
							Директ
						</button>
						<button
							onClick={() => setActiveTab('community')}
							className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md relative z-10 transition-colors ${
								activeTab === 'community'
									? 'text-white'
									: 'text-gray-400 hover:text-gray-200'
							}`}
						>
							<UsersIcon className='w-4 h-4' />
							Сообщество
						</button>
					</div>
				</div>

				{activeTab !== 'community' && (
					<div className='px-4 py-3'>
						<div className='relative'>
							<SearchIcon className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500' />
							<input
								type='text'
								placeholder='Поиск чатов...'
								value={searchQuery}
								onChange={e => setSearchQuery(e.target.value)}
								className={`w-full bg-gray-900 rounded-xl py-2 pl-10 pr-4 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 transition-all duration-300 ${currentBackground.ringColor}`}
							/>
							{isSearchingUsers && (
								<div
									className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-t-transparent rounded-full animate-spin ${currentBackground.borderColor.replace(
										'/20',
										'',
									)}`}
								/>
							)}
						</div>
					</div>
				)}

				<div className='flex-1 overflow-y-auto custom-scrollbar px-2 space-y-1 pb-4'>
					{activeTab === 'direct' ? (
						<>
							{aiFriend && !searchQuery && (
								<div
									onClick={() => {
										setSelectedFriend(aiFriend)
										setSelectedGroup(null)
										setIsChatSearchOpen(false)
										setChatSearchQuery('')
										setFoundMessages([])
									}}
									className={`group p-3 rounded-xl cursor-pointer flex items-center gap-3 transition-all duration-200 border border-transparent ${
										selectedFriend?.id === aiFriend.id
											? `bg-gray-800/50 ${currentBackground.borderColor} shadow-sm`
											: 'hover:bg-gray-900 border-transparent'
									}`}
								>
									<div className='relative'>
										<img
											src={getAvatarUrl(aiFriend.avatar_url)}
											alt={aiFriend.username}
											className={`w-12 h-12 rounded-full object-cover bg-gray-800 ring-2 transition-all duration-300 ${
												selectedFriend?.id === aiFriend.id
													? currentBackground.accentColor.replace(
															'text-',
															'ring-',
														)
													: 'ring-gray-950'
											}`}
										/>
										<div className='absolute bottom-0 right-0 w-3.5 h-3.5 bg-gray-950 rounded-full flex items-center justify-center'>
											<div className='w-2.5 h-2.5 rounded-full bg-emerald-500' />
										</div>
									</div>
									<div className='flex flex-col flex-1 min-w-0'>
										<div className='flex justify-between items-baseline'>
											<span
												className={`font-semibold truncate transition-colors duration-300 ${
													selectedFriend?.id === aiFriend.id
														? currentBackground.accentColor
														: 'text-gray-200 group-hover:text-white'
												}`}
											>
												Вондик AI
											</span>
											<span className='text-[10px] text-gray-600'>AI</span>
										</div>
										<span className='text-xs text-gray-500 truncate group-hover:text-gray-400 transition-colors'>
											Всегда онлайн
										</span>
									</div>
								</div>
							)}
							{botFriend && showBotInHistory && (
								<div
									onClick={() => {
										setSelectedFriend(botFriend)
										setSelectedGroup(null)
										setIsChatSearchOpen(false)
										setChatSearchQuery('')
										setFoundMessages([])
									}}
									className={`group p-3 rounded-xl cursor-pointer flex items-center gap-3 transition-all duration-200 border border-transparent ${
										selectedFriend?.id === botFriend.id
											? `bg-gray-800/50 ${currentBackground.borderColor} shadow-sm`
											: 'hover:bg-gray-900 border-transparent'
									}`}
								>
									<div className='relative'>
										<img
											src={getAvatarUrl(botFriend.avatar_url)}
											alt={botFriend.username}
											className={`w-12 h-12 rounded-full object-cover bg-gray-800 ring-2 transition-all duration-300 ${
												selectedFriend?.id === botFriend.id
													? currentBackground.accentColor.replace(
															'text-',
															'ring-',
														)
													: 'ring-gray-950'
											}`}
										/>
										<div className='absolute bottom-0 right-0 w-3.5 h-3.5 bg-gray-950 rounded-full flex items-center justify-center'>
											<div className='w-2.5 h-2.5 rounded-full bg-emerald-500' />
										</div>
									</div>
									<div className='flex flex-col flex-1 min-w-0'>
										<div className='flex justify-between items-baseline'>
											<span
												className={`font-semibold truncate transition-colors duration-300 ${
													selectedFriend?.id === botFriend.id
														? currentBackground.accentColor
														: 'text-gray-200 group-hover:text-white'
												}`}
											>
												{botFriend.username}
											</span>
											<span className='text-[10px] text-gray-600'>BOT</span>
										</div>
										<span className='text-xs text-gray-500 truncate group-hover:text-gray-400 transition-colors'>
											Всегда онлайн
										</span>
									</div>
								</div>
							)}

							{sidebarList.length === 0 &&
								(!aiFriend || searchQuery) &&
								!showBotInHistory && (
									<div className='p-8 text-center text-gray-500 flex flex-col items-center gap-3'>
										<div className='w-12 h-12 bg-gray-900 rounded-full flex items-center justify-center text-gray-700'>
											<SearchIcon className='w-6 h-6' />
										</div>
										<span className='text-sm'>
											{searchQuery
												? 'Пользователи не найдены'
												: 'Ничего не найдено'}
										</span>
									</div>
								)}
							{sidebarList.map(friend => (
								<div
									key={friend.id}
									onClick={() => {
										setSelectedFriend(friend)
										setSelectedGroup(null)
										// Reset message search when changing chat
										setIsChatSearchOpen(false)
										setChatSearchQuery('')
										setFoundMessages([])
									}}
									className={`group p-3 rounded-xl cursor-pointer flex items-center gap-3 transition-all duration-200 border border-transparent hover:bg-gray-900 ${
										selectedFriend?.id === friend.id
											? `bg-gray-800/50 ${currentBackground.borderColor} shadow-sm`
											: 'bg-transparent'
									}`}
								>
									<div className='relative'>
										<img
											src={getAvatarUrl(friend.avatar_url)}
											className={`w-12 h-12 rounded-full object-cover bg-gray-800 ring-2 transition-all duration-300 ${
												selectedFriend?.id === friend.id
													? currentBackground.accentColor.replace(
															'text-',
															'ring-',
														)
													: 'ring-gray-950'
											}`}
											alt={friend.username}
										/>

										{!friend.is_bot && (
											<div className='absolute bottom-0 right-0 w-3.5 h-3.5 bg-gray-950 rounded-full flex items-center justify-center'>
												<div
													className={`w-2.5 h-2.5 rounded-full ${
														friend.status?.toLowerCase() === 'online'
															? 'bg-emerald-500'
															: 'bg-gray-500'
													}`}
												/>
											</div>
										)}
									</div>
									<div className='flex flex-col flex-1 min-w-0'>
										<div className='flex justify-between items-baseline'>
											<span
												className={`font-semibold truncate transition-colors duration-300 flex items-center gap-1 ${
													selectedFriend?.id === friend.id
														? currentBackground.accentColor
														: 'text-gray-200 group-hover:text-white'
												}`}
											>
												{pinnedChatIds.includes(friend.id) && (
													<span className='text-amber-400 text-[10px]'>📌</span>
												)}
												{friend.username}
												{friend.premium && (
													<span className='text-amber-400'>★</span>
												)}
											</span>
											<span className='text-[10px] text-gray-600'>
												{getSidebarPreviewTime(friend)}
											</span>
										</div>
										<span className='text-xs text-gray-500 truncate group-hover:text-gray-400 transition-colors'>
											{getSidebarPreview(friend)}
										</span>
									</div>

									<div className='opacity-0 group-hover:opacity-100 transition-opacity'>
										<ChatMenu
											chatId={friend.id}
											chatType='user'
											isPinned={pinnedChatIds.includes(friend.id)}
											isOnline={friend.status?.toLowerCase() === 'online'}
											canPin={canPinChats(user)}
											onPin={() => {
												console.log(
													'Pin clicked for:',
													friend.id,
													'current pinned:',
													pinnedChatIds,
												)
												togglePinChat(
													friend.id,
													pinnedChatIds,
													setPinnedChatIds,
													user,
													async newPinnedIds => {
														console.log('Saving to backend:', newPinnedIds)
														try {
															const response = await fetch(
																'/api/v1/users/pinned-chats',
																{
																	method: 'POST',
																	headers: {
																		'Content-Type': 'application/json',
																		Authorization: `Bearer ${user?.access_token}`,
																	},
																	body: JSON.stringify({
																		pinned_chats: newPinnedIds,
																	}),
																},
															)
															const data = await response.json()
															console.log('Backend response:', data)
															if (!response.ok) {
																console.error('Backend error:', data)
															}
														} catch (err) {
															console.error('Failed to save pinned chats:', err)
														}
													},
												)
											}}
											onCall={() =>
												handleCallInitiate(friend.id, friend.username)
											}
											onVideoCall={() => {
												console.log('Video call to:', friend.id)
											}}
										/>
									</div>
								</div>
							))}

							{!searchQuery && (
								<div className='mt-4 px-2'>
									<div className='flex items-center justify-between mb-2 px-2'>
										<h3 className='text-xs font-semibold text-gray-500 uppercase tracking-wider'>
											Группы
										</h3>
										<div className='flex gap-1'>
											<button
												onClick={() => setIsJoinGroupOpen(true)}
												className='p-1 hover:bg-gray-800 rounded-md transition-colors text-gray-400 hover:text-white'
												title='Вступить в группу'
											>
												<LogInIcon className='w-3 h-3' />
											</button>
											<button
												onClick={() => setIsCreateGroupOpen(true)}
												className='p-1 hover:bg-gray-800 rounded-md transition-colors text-gray-400 hover:text-white'
												title='Создать группу'
											>
												<PlusIcon className='w-3 h-3' />
											</button>
										</div>
									</div>
									<div className='space-y-1'>
										{otherGroups.map(group => (
											<div
												key={group.id}
												onClick={() => {
													setSelectedGroup(group)
													setSelectedFriend(null)
													setIsChatSearchOpen(false)
													setChatSearchQuery('')
													setFoundMessages([])
												}}
												className={`group p-3 rounded-xl cursor-pointer flex items-center gap-3 transition-all duration-200 border border-transparent ${
													selectedGroup?.id === group.id
														? `bg-gray-800/50 ${currentBackground.borderColor} shadow-sm`
														: 'hover:bg-gray-900 border-transparent'
												}`}
											>
												<div className='relative'>
													<div
														className={`w-12 h-12 rounded-full flex items-center justify-center bg-gray-800 ring-2 transition-all duration-300 ${
															selectedGroup?.id === group.id
																? currentBackground.accentColor.replace(
																		'text-',
																		'ring-',
																	)
																: 'ring-gray-950'
														}`}
													>
														<UsersIcon className='w-6 h-6 text-gray-400' />
													</div>
												</div>
												<div className='flex flex-col flex-1 min-w-0'>
													<div className='flex justify-between items-center gap-2'>
														<span
															className={`font-semibold truncate transition-colors duration-300 ${
																selectedGroup?.id === group.id
																	? currentBackground.accentColor
																	: 'text-gray-200 group-hover:text-white'
															}`}
														>
															{group.name}
														</span>
														<button
															type='button'
															onClick={e => {
																e.stopPropagation()
																initiateGroupCall(group.id)
															}}
															className='p-1.5 rounded-full text-emerald-400 hover:text-white hover:bg-emerald-500/20 transition-colors'
															title='Голосовой звонок в группе'
														>
															<PhoneIcon className='w-4 h-4' />
														</button>
													</div>
												</div>
											</div>
										))}
									</div>
								</div>
							)}
						</>
					) : (
						<div className='flex flex-col gap-2'>
							{!selectedCommunity && (
								<div className='mt-2 space-y-4'>
									<div className='px-2'>
										<div className='flex items-center justify-between mb-2 px-2'>
											<h3 className='text-xs font-semibold text-gray-500 uppercase tracking-wider'>
												Каналы
											</h3>
											<div className='flex gap-1'>
												<button
													onClick={() => setIsJoinChannelOpen(true)}
													className='p-1 hover:bg-gray-800 rounded-md transition-colors text-gray-400 hover:text-white'
													title='Вступить в канал'
												>
													<LogInIcon className='w-3 h-3' />
												</button>
												<button
													onClick={() => {
														setIsCreateChannelOpen(true)
														setNewChannelName('')
														setNewChannelDesc('')
													}}
													className='p-1 hover:bg-gray-800 rounded-md transition-colors text-gray-400 hover:text-white'
													title='Создать канал'
												>
													<PlusIcon className='w-3 h-3' />
												</button>
											</div>
										</div>
										{channels.filter(ch => !ch.community_id).length > 0 ? (
											<div className='space-y-1'>
												{channels
													.filter(ch => !ch.community_id)
													.map(channel => (
														<div
															key={channel.id}
															onClick={() => {
																setSelectedChannel(channel)
																setSelectedFriend(null)
																setSelectedGroup(null)
																setIsChatSearchOpen(false)
																setChatSearchQuery('')
																setFoundMessages([])
															}}
															className={`group p-3 rounded-xl cursor-pointer flex items-center gap-3 transition-all duration-200 border border-transparent ${
																selectedChannel?.id === channel.id
																	? `bg-gray-800/50 ${currentBackground.borderColor} shadow-sm`
																	: 'hover:bg-gray-900 border-transparent'
															}`}
														>
															<div className='relative'>
																<div
																	className={`w-12 h-12 rounded-full flex items-center justify-center bg-gray-800 ring-2 transition-all duration-300 ${
																		selectedChannel?.id === channel.id
																			? currentBackground.accentColor.replace(
																					'text-',
																					'ring-',
																				)
																			: 'ring-gray-950'
																	}`}
																>
																	<HashIcon className='w-6 h-6 text-gray-400' />
																</div>
															</div>
															<div className='flex flex-col flex-1 min-w-0'>
																<div className='flex justify-between items-baseline'>
																	<span
																		className={`font-semibold truncate transition-colors duration-300 ${
																			selectedChannel?.id === channel.id
																				? currentBackground.accentColor
																				: 'text-gray-200 group-hover:text-white'
																		}`}
																	>
																		{channel.name}
																	</span>
																</div>
																<span className='text-xs text-gray-500 truncate group-hover:text-gray-400 transition-colors'>
																	{channel.participants_count} участников
																</span>
															</div>
														</div>
													))}
											</div>
										) : (
											<div className='p-4 text-center text-gray-500'>
												Нет каналов
											</div>
										)}
									</div>

									<div>
										<div className='flex items-center justify-between mb-2 px-2'>
											<h3 className='text-xs font-semibold text-gray-500 uppercase tracking-wider'>
												Сообщества
											</h3>
											<div className='flex gap-1'>
												<button
													onClick={() => setIsJoinCommunityOpen(true)}
													className='p-1 hover:bg-gray-800 rounded-md transition-colors text-gray-400 hover:text-white'
													title='Вступить в сообщество'
												>
													<LogInIcon className='w-3 h-3' />
												</button>
												<button
													onClick={() => setIsCreateCommunityOpen(true)}
													className='p-1 hover:bg-gray-800 rounded-md transition-colors text-gray-400 hover:text-white'
													title='Создать сообщество'
												>
													<PlusIcon className='w-3 h-3' />
												</button>
											</div>
										</div>
										<div className='space-y-1'>
											{myCommunities.map(comm => (
												<div
													key={comm.id}
													onClick={() => selectCommunity(comm)}
													className={`group p-3 rounded-xl cursor-pointer flex items-center gap-3 transition-all duration-200 border border-transparent ${
														selectedCommunity?.id === comm.id
															? `bg-gray-800/50 ${currentBackground.borderColor} shadow-sm`
															: 'hover:bg-gray-900 border-transparent'
													}`}
												>
													<div className='relative'>
														<div
															className={`w-12 h-12 rounded-full flex items-center justify-center bg-gray-800 ring-2 transition-all duration-300 ${
																selectedCommunity?.id === comm.id
																	? currentBackground.accentColor.replace(
																			'text-',
																			'ring-',
																		)
																	: 'ring-gray-950'
															}`}
														>
															<UsersIcon className='w-6 h-6 text-gray-400' />
														</div>
													</div>
													<div className='flex flex-col flex-1 min-w-0'>
														<div className='flex justify-between items-baseline'>
															<span
																className={`font-semibold truncate transition-colors duration-300 ${
																	selectedCommunity?.id === comm.id
																		? currentBackground.accentColor
																		: 'text-gray-200 group-hover:text-white'
																}`}
															>
																{comm.name}
															</span>
														</div>
														<span className='text-xs text-gray-500 truncate group-hover:text-gray-400 transition-colors'>
															{comm.members_count && comm.members_count > 0
																? `${comm.members_count} участников`
																: ''}
														</span>
													</div>
												</div>
											))}
											{myCommunities.length === 0 && (
												<div className='p-4 text-center text-gray-500'>
													Нет сообществ
												</div>
											)}
										</div>
									</div>
								</div>
							)}

							{selectedCommunity && (
								<div className='mt-2 px-2'>
									<div className='flex items-center justify-between mb-2 px-2'>
										<div className='flex items-center gap-2'>
											<button
												onClick={() => {
													setSelectedCommunity(null)
													setSelectedCommunityId('')
												}}
												className='p-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors'
												title='Назад к сообществам'
											>
												<ArrowLeftIcon className='w-4 h-4' />
											</button>
											<h3 className='text-xs font-semibold text-gray-500 uppercase tracking-wider'>
												{selectedCommunity.name}
											</h3>
										</div>
										<div className='flex gap-1'>
											<button
												onClick={handleShowInviteCode}
												className='px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors'
											>
												Код
											</button>
											<button
												onClick={() => {
													setSelectedCommunityId(selectedCommunity?.id || '')
													setIsCreateCommChannelOpen(true)
												}}
												className='px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors'
											>
												Создать канал
											</button>
										</div>
									</div>
									<div className='mb-3'>
										<h4 className='text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-2 mb-1'>
											Текстовые
										</h4>
										<div className='space-y-1'>
											{communityChannels
												.filter(ch => (ch.type || 'text') === 'text')
												.map(ch => (
													<div
														key={ch.id}
														onClick={() => {
															setSelectedChannel({
																id: ch.id,
																name: ch.name,
																description: ch.description || '',
																invite_code: '',
																owner_id: '',
																participants_count: 0,
															})
															setSelectedFriend(null)
															setSelectedGroup(null)
															setIsChatSearchOpen(false)
															setChatSearchQuery('')
															setFoundMessages([])
														}}
														className={`group p-3 rounded-xl cursor-pointer flex items-center gap-3 transition-all duration-200 border border-transparent ${
															selectedChannel?.id === ch.id
																? `bg-gray-800/50 ${currentBackground.borderColor} shadow-sm`
																: 'hover:bg-gray-900 border-transparent'
														}`}
													>
														<div className='relative'>
															<div className='w-12 h-12 rounded-full flex items-center justify-center bg-gray-800 ring-2 ring-gray-950'>
																<HashIcon className='w-6 h-6 text-gray-400' />
															</div>
														</div>
														<div className='flex flex-col flex-1 min-w-0'>
															<div className='flex justify-between items-baseline'>
																<span className='font-semibold truncate text-gray-200 group-hover:text-white transition-colors'>
																	{ch.name}
																</span>
															</div>
															<span className='text-xs text-gray-500 truncate group-hover:text-gray-400 transition-colors'>
																Текстовый
															</span>
														</div>
													</div>
												))}
											{communityChannels.filter(
												ch => (ch.type || 'text') === 'text',
											).length === 0 && (
												<div className='p-2 text-center text-gray-500'>
													Нет текстовых каналов
												</div>
											)}
										</div>
									</div>
									<div>
										<h4 className='text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-2 mb-1'>
											Голосовые
										</h4>
										<div className='space-y-1'>
											{communityChannels
												.filter(ch => ch.type === 'voice')
												.map(ch => (
													<div
														key={ch.id}
														onClick={() => {
															if (ch.type === 'voice') {
																joinVoiceChannel(ch.id)
																// Clear selection to avoid confusion with text chats
																setSelectedChannel(null)
																setSelectedFriend(null)
																setSelectedGroup(null)
																setIsChatSearchOpen(false)
																setChatSearchQuery('')
																setFoundMessages([])
															} else {
																setSelectedChannel({
																	id: ch.id,
																	name: ch.name,
																	description: ch.description || '',
																	invite_code: '',
																	owner_id: '',
																	participants_count: 0,
																})
																setSelectedFriend(null)
																setSelectedGroup(null)
																setIsChatSearchOpen(false)
																setChatSearchQuery('')
																setFoundMessages([])
															}
														}}
														className={`group p-3 rounded-xl cursor-pointer flex items-center gap-3 transition-all duration-200 border border-transparent ${
															selectedChannel?.id === ch.id
																? `bg-gray-800/50 ${currentBackground.borderColor} shadow-sm`
																: 'hover:bg-gray-900 border-transparent'
														}`}
													>
														<div className='relative'>
															<div className='w-12 h-12 rounded-full flex items-center justify-center bg-gray-800 ring-2 ring-gray-950'>
																<PhoneIcon className='w-6 h-6 text-gray-400' />
															</div>
														</div>
														<div className='flex flex-col flex-1 min-w-0'>
															<div className='flex justify-between items-baseline'>
																<span className='font-semibold truncate text-gray-200 group-hover:text-white transition-colors'>
																	{ch.name}
																</span>
															</div>
															<span className='text-xs text-gray-500 truncate group-hover:text-gray-400 transition-colors'>
																Голосовой
															</span>

															{voiceChannelParticipants[ch.id] &&
																Object.keys(voiceChannelParticipants[ch.id])
																	.length > 0 && (
																	<div className='mt-1 flex flex-wrap gap-1'>
																		{Object.values(
																			voiceChannelParticipants[ch.id],
																		).map((participant, idx) => (
																			<div
																				key={`${participant.userId}-${idx}`}
																				className='flex items-center gap-1 text-[8px] bg-gray-700/50 px-1.5 py-0.5 rounded-full'
																			>
																				<span className='w-2 h-2 rounded-full bg-green-500'></span>
																				<span className='truncate max-w-[60px]'>
																					{participant.username}
																				</span>
																			</div>
																		))}
																	</div>
																)}
														</div>
													</div>
												))}
											{communityChannels.filter(ch => ch.type === 'voice')
												.length === 0 && (
												<div className='p-2 text-center text-gray-500'>
													Нет голосовых каналов
												</div>
											)}
										</div>
									</div>
								</div>
							)}
						</div>
					)}
				</div>
			</div>

			<div
				className={`flex-1 flex flex-col relative min-w-0 ${!hasActiveChat ? 'hidden md:flex' : ''}`}
			>
				<div
					className='absolute inset-0 transition-opacity duration-500'
					style={
						chatBackgroundImage
							? {
									backgroundImage: `url(${chatBackgroundImage})`,
									backgroundSize: 'cover',
									backgroundPosition: 'center',
									backgroundRepeat: 'no-repeat',
									opacity: bgImageOpacity,
									filter: bgImageBlur ? `blur(${bgImageBlur}px)` : undefined,
								}
							: undefined
					}
				/>

				<div
					className={`absolute inset-0 transition-colors duration-500 ${
						chatBackgroundImage ? 'bg-black/30' : currentBackground.class
					}`}
				/>

				{showGridPattern && (
					<div className='absolute inset-0 bg-grid-pattern pointer-events-none opacity-10' />
				)}

				<div className='relative z-10 flex flex-col flex-1 min-h-0'>
					{selectedFriend || selectedChannel || selectedGroup ? (
						<>
							<div className='h-16 px-6 border-b border-white/10 flex items-center justify-between bg-black/20 backdrop-blur-md z-10 sticky top-0'>
								{isChatSearchOpen ? (
									<div className='flex items-center gap-2 w-full animate-in fade-in slide-in-from-top-2 duration-200'>
										<SearchIcon className='w-5 h-5 text-gray-400' />
										<form onSubmit={handleMessageSearch} className='flex-1'>
											<input
												autoFocus
												type='text'
												placeholder='Поиск сообщений...'
												value={chatSearchQuery}
												onChange={e => setChatSearchQuery(e.target.value)}
												className='w-full bg-transparent border-none text-[color:var(--app-fg)] placeholder:text-gray-500 focus:ring-0 text-sm'
											/>
										</form>
										{isSearchingMessages && (
											<div
												className={`w-4 h-4 border-2 border-t-transparent rounded-full animate-spin ${currentBackground.borderColor.replace(
													'/20',
													'',
												)}`}
											/>
										)}
										<button
											onClick={() => {
												setIsChatSearchOpen(false)
												setChatSearchQuery('')
												setFoundMessages([])
											}}
											className='p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition-colors'
										>
											<XIcon className='w-5 h-5' />
										</button>
									</div>
								) : (
									<>
										<div className='flex items-center gap-4'>
											<button
												onClick={() => {
													setSelectedFriend(null)
													setSelectedGroup(null)
													setSelectedChannel(null)
												}}
												className='p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors'
												title='Назад к сообществам'
											>
												<ArrowLeftIcon className='w-5 h-5' />
											</button>
											{selectedFriend ? (
												<>
													<div
														className='relative cursor-pointer hover:opacity-80 transition-opacity'
														onClick={() => {
															setSelectedUserForModal(selectedFriend)
															setIsUserProfileModalOpen(true)
														}}
													>
														<img
															src={getAvatarUrl(selectedFriend.avatar_url)}
															className='w-10 h-10 rounded-full object-cover bg-gray-800 ring-2 ring-gray-800/50'
															alt={selectedFriend.username}
														/>
														{selectedFriend.status?.toLowerCase() ===
															'online' && (
															<div className='absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-gray-900 rounded-full animate-pulse' />
														)}
													</div>
													<button
														onClick={() => setIsFilterOpen(true)}
														className='flex flex-col text-left hover:bg-gray-800/50 rounded-lg p-2 -ml-2 transition-colors'
														title='Показать фильтры сообщений'
													>
														<span className='font-bold text-white text-base leading-tight flex items-center gap-2'>
															{selectedFriend.username}
															{selectedFriend.premium && (
																<span className='ml-1 text-amber-400'>★</span>
															)}
															{messageFilter !== 'all' && (
																<span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-600/30 text-emerald-300'>
																	<svg
																		className='w-3 h-3'
																		viewBox='0 0 24 24'
																		fill='none'
																		stroke='currentColor'
																		strokeWidth='2'
																	>
																		<polygon points='22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3'></polygon>
																	</svg>
																	{messageFilter === 'photos'
																		? 'Фото'
																		: messageFilter === 'files'
																			? 'Файлы'
																			: messageFilter === 'links'
																				? 'Ссылки'
																				: ''}
																</span>
															)}
														</span>
														<span className='text-xs text-emerald-500 font-medium flex items-center gap-1.5'>
															{isChatTyping ? (
																<>
																	<span className='w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse' />
																	Печатает...
																</>
															) : selectedFriend.status?.toLowerCase() ===
															  'online' ? (
																<>
																	<span className='w-1.5 h-1.5 rounded-full bg-emerald-500' />
																	В сети
																</>
															) : (
																<span className='text-gray-500'>
																	{formatLastSeen(selectedFriend.last_seen)}
																</span>
															)}
														</span>
													</button>
												</>
											) : selectedChannel ? (
												<>
													<div className='relative'>
														<div className='w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center ring-2 ring-gray-800/50'>
															<HashIcon className='w-5 h-5 text-gray-400' />
														</div>
													</div>
													<button
														onClick={() => setIsFilterOpen(true)}
														className='flex flex-col text-left hover:bg-gray-800/50 rounded-lg p-2 -ml-2 transition-colors'
														title='Показать фильтры сообщений'
													>
														<span className='font-bold text-white text-base leading-tight flex items-center gap-2'>
															{selectedChannel.name}
															{messageFilter !== 'all' && (
																<span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-600/30 text-emerald-300'>
																	<svg
																		className='w-3 h-3'
																		viewBox='0 0 24 24'
																		fill='none'
																		stroke='currentColor'
																		strokeWidth='2'
																	>
																		<polygon points='22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3'></polygon>
																	</svg>
																	{messageFilter === 'photos'
																		? 'Фото'
																		: messageFilter === 'files'
																			? 'Файлы'
																			: messageFilter === 'links'
																				? 'Ссылки'
																				: ''}
																</span>
															)}
														</span>
														<span className='text-xs text-gray-500 font-medium flex items-center gap-1.5'>
															<UsersIcon className='w-3 h-3' />
															{selectedChannel.participants_count &&
															selectedChannel.participants_count > 0
																? `${selectedChannel.participants_count} участников`
																: ''}
														</span>
													</button>
													<button
														onClick={() => setIsChannelInfoOpen(true)}
														className='ml-2 p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors'
														title='Информация о канале'
													>
														<InfoIcon className='w-4 h-4' />
													</button>
												</>
											) : selectedGroup ? (
												<>
													<div className='relative'>
														<div className='w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center ring-2 ring-gray-800/50'>
															<UsersIcon className='w-5 h-5 text-gray-400' />
														</div>
													</div>
													<button
														onClick={() => setIsFilterOpen(true)}
														className='flex flex-col text-left hover:bg-gray-800/50 rounded-lg p-2 -ml-2 transition-colors'
														title='Показать фильтры сообщений'
													>
														<span className='font-bold text-white text-base leading-tight flex items-center gap-2'>
															{selectedGroup.name}
															{messageFilter !== 'all' && (
																<span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-600/30 text-emerald-300'>
																	<svg
																		className='w-3 h-3'
																		viewBox='0 0 24 24'
																		fill='none'
																		stroke='currentColor'
																		strokeWidth='2'
																	>
																		<polygon points='22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3'></polygon>
																	</svg>
																	{messageFilter === 'photos'
																		? 'Фото'
																		: messageFilter === 'files'
																			? 'Файлы'
																			: messageFilter === 'links'
																				? 'Ссылки'
																				: ''}
																</span>
															)}
														</span>
														<span className='text-xs text-gray-500 font-medium flex items-center gap-1.5'>
															<UsersIcon className='w-3 h-3' />
															Группа
														</span>
													</button>
													<button
														onClick={() => {
															if (!isInitialized) {
																console.warn(
																	'[Group Call] WebRTC not initialized yet',
																)
																return
															}
															initiateGroupCall(selectedGroup.id)
														}}
														className='ml-2 p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
														title='Начать групповой звонок'
														disabled={!isInitialized}
													>
														<PhoneIcon className='w-4 h-4' />
													</button>
													{user?.id === selectedGroup.owner_id && (
														<button
															onClick={() => setIsAddMemberOpen(true)}
															className='ml-2 p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors'
															title='Добавить участника'
														>
															<UserPlusIcon className='w-4 h-4' />
														</button>
													)}
												</>
											) : null}
										</div>

										<div className='flex items-center gap-2'>
											{selectedFriend && !isAiChat && !isBotChat && (
												<button
													onClick={() =>
														handleCallInitiate(
															selectedFriend.id,
															selectedFriend.username,
														)
													}
													disabled={
														!isSelectedFriendOnline || isSelectedFriendInCall
													}
													className={`p-2 sm:px-3 sm:py-2 rounded-full sm:rounded-lg flex items-center gap-2 transition-colors ${
														!isSelectedFriendOnline || isSelectedFriendInCall
															? 'text-gray-600 cursor-not-allowed'
															: 'text-emerald-400 hover:text-white hover:bg-emerald-500/20'
													}`}
													title={
														!isSelectedFriendOnline
															? 'Пользователь не в сети'
															: isSelectedFriendInCall
																? 'Уже идет звонок'
																: 'Позвонить'
													}
												>
													<PhoneIcon className='w-5 h-5' />
													<span className='hidden sm:inline text-xs font-medium'>
														Позвонить
													</span>
												</button>
											)}
											{hasActiveCall && (
												<button
													onClick={async () => {
														if (!isScreenSharing) {
															await toggleScreenShare()
															setIsScreenViewerOpen(true)
														} else {
															await toggleScreenShare()
															setIsScreenViewerOpen(false)
														}
													}}
													disabled={
														!isInitialized ||
														!isWebRTCSupported ||
														!isScreenShareSupported
													}
													className={`p-2 sm:px-3 sm:py-2 rounded-full sm:rounded-lg flex items-center gap-2 transition-colors ${
														!isInitialized ||
														!isWebRTCSupported ||
														!isScreenShareSupported
															? 'text-gray-600 cursor-not-allowed'
															: isScreenSharing
																? 'text-emerald-400 hover:text-white hover:bg-emerald-500/20'
																: 'text-gray-400 hover:text-white hover:bg-gray-800'
													}`}
													title={
														!isInitialized ||
														!isWebRTCSupported ||
														!isScreenShareSupported
															? 'Демонстрация экрана недоступна'
															: isScreenSharing
																? 'Остановить демонстрацию'
																: 'Демонстрация экрана'
													}
												>
													<ScreenShareIcon className='w-5 h-5' />
													<span className='hidden sm:inline text-xs font-medium'>
														{isScreenSharing ? 'Стоп экран' : 'Экран'}
													</span>
												</button>
											)}
											<button
												onClick={() => setIsChatSearchOpen(true)}
												className='p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors'
											>
												<SearchIcon className='w-5 h-5' />
											</button>
											{!isSelectionMode && (
												<button
													onClick={handleToggleSelectionMode}
													className='p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors'
													title='Выбрать сообщения'
												>
													<svg
														className='w-5 h-5'
														viewBox='0 0 24 24'
														fill='none'
														stroke='currentColor'
														strokeWidth='2'
														strokeLinecap='round'
														strokeLinejoin='round'
													>
														<polyline points='9 11 12 14 22 4'></polyline>
														<path d='M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11'></path>
													</svg>
												</button>
											)}
											{isSelectionMode && (
												<button
													onClick={handleClearSelection}
													className='p-2 text-rose-400 hover:text-white hover:bg-rose-500/20 rounded-full transition-colors'
													title='Отменить выделение'
												>
													<XIcon className='w-5 h-5' />
												</button>
											)}
											<div className='relative' ref={settingsRef}>
												<button
													onClick={() => setIsSettingsOpen(!isSettingsOpen)}
													className={`p-2 rounded-full transition-colors ${
														isSettingsOpen
															? 'text-white bg-gray-800'
															: 'text-gray-400 hover:text-white hover:bg-gray-800'
													}`}
												>
													<MoreVerticalIcon className='w-5 h-5' />
												</button>

												{isSettingsOpen && (
													<div className='absolute right-0 top-full mt-2 w-72 bg-gray-900/95 backdrop-blur-xl border border-gray-800 rounded-xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-200'>
														<h3 className='text-sm font-semibold text-gray-300 mb-3'>
															Настройки чата
														</h3>

														<div className='space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar'>
															<div>
																<label className='text-xs text-gray-500 mb-2 block uppercase tracking-wider font-medium'>
																	Фон чата
																</label>
																<div className='grid grid-cols-5 gap-2 mb-2'>
																	{BACKGROUNDS.map(bg => (
																		<button
																			key={bg.id}
																			onClick={() => handleThemeChange(bg)}
																			title={bg.name}
																			className={`w-8 h-8 rounded-full border-2 transition-all ${
																				!chatBackgroundImage &&
																				currentBackground.id === bg.id
																					? `${bg.borderColor.replace(
																							'/20',
																							'',
																						)} scale-110 shadow-lg`
																					: 'border-transparent hover:scale-105 hover:border-gray-600'
																			} overflow-hidden ring-1 ring-gray-950/50`}
																		>
																			<div
																				className={`w-full h-full ${bg.preview}`}
																			/>
																		</button>
																	))}
																</div>
																<div className='flex gap-2'>
																	<button
																		onClick={() => setIsCustomBgOpen(true)}
																		className='flex-1 py-2 px-3 text-xs font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors flex items-center justify-center gap-2'
																	>
																		<svg
																			className='w-4 h-4'
																			viewBox='0 0 24 24'
																			fill='none'
																			stroke='currentColor'
																			strokeWidth='2'
																		>
																			<rect
																				x='3'
																				y='3'
																				width='18'
																				height='18'
																				rx='2'
																				ry='2'
																			></rect>
																			<circle
																				cx='8.5'
																				cy='8.5'
																				r='1.5'
																			></circle>
																			<polyline points='21 15 16 10 5 21'></polyline>
																		</svg>
																		Картинка
																	</button>
																	{chatBackgroundImage && (
																		<button
																			onClick={handleClearCustomBackground}
																			className='py-2 px-3 text-xs font-medium text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg transition-colors'
																			title='Убрать картинку'
																		>
																			<svg
																				className='w-4 h-4'
																				viewBox='0 0 24 24'
																				fill='none'
																				stroke='currentColor'
																				strokeWidth='2'
																			>
																				<polyline points='3 6 5 6 21 6'></polyline>
																				<path d='M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'></path>
																			</svg>
																		</button>
																	)}
																</div>

																{chatBackgroundImage && (
																	<div className='mt-3 space-y-3'>
																		<div>
																			<label className='text-[10px] text-gray-500 mb-1 block uppercase tracking-wider font-medium'>
																				Прозрачность картинки
																			</label>
																			<input
																				type='range'
																				min='0.1'
																				max='1'
																				step='0.05'
																				value={bgImageOpacity}
																				onChange={e =>
																					setBgImageOpacity(
																						parseFloat(e.target.value),
																					)
																				}
																				className='w-full'
																			/>
																		</div>
																		<div>
																			<label className='text-[10px] text-gray-500 mb-1 block uppercase tracking-wider font-medium'>
																				Размытие картинки
																			</label>
																			<input
																				type='range'
																				min='0'
																				max='24'
																				step='1'
																				value={bgImageBlur}
																				onChange={e =>
																					setBgImageBlur(
																						parseInt(e.target.value, 10),
																					)
																				}
																				className='w-full'
																			/>
																		</div>
																	</div>
																)}
															</div>

															<div className='pt-3 border-t border-gray-800'>
																<label className='text-xs text-gray-500 mb-2 block uppercase tracking-wider font-medium'>
																	Стиль сообщений
																</label>
																<div className='grid grid-cols-5 gap-2'>
																	{BACKGROUNDS.map(bg => (
																		<button
																			key={bg.id}
																			onClick={() =>
																				handleMessageThemeChange(bg)
																			}
																			title={bg.name}
																			className={`w-8 h-8 rounded-full border-2 transition-all ${
																				messageTheme.id === bg.id
																					? `${bg.borderColor.replace(
																							'/20',
																							'',
																						)} scale-110 shadow-lg`
																					: 'border-transparent hover:scale-105 hover:border-gray-600'
																			} overflow-hidden ring-1 ring-gray-950/50`}
																		>
																			<div
																				className={`w-full h-full ${bg.preview}`}
																			/>
																		</button>
																	))}
																</div>
															</div>

															<div className='pt-3 border-t border-gray-800'>
																<label className='text-xs text-gray-500 mb-2 block uppercase tracking-wider font-medium'>
																	Эффекты
																</label>
																<button
																	onClick={() => setShowGridPattern(v => !v)}
																	className='w-full flex items-center justify-between rounded-lg bg-gray-800/60 hover:bg-gray-800 px-3 py-2 text-sm text-gray-200 transition-colors'
																>
																	<span>Сетка на фоне</span>
																	<span className='text-xs text-gray-400'>
																		{showGridPattern ? 'Вкл' : 'Выкл'}
																	</span>
																</button>
															</div>

															<div className='pt-3 border-t border-gray-800'>
																<button
																	onClick={handleDeleteAllHistory}
																	className='w-full text-left text-sm text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 px-3 py-2 rounded-lg transition-colors'
																>
																	Удалить всю переписку без восстановления
																</button>
															</div>
														</div>
													</div>
												)}
											</div>
										</div>
									</>
								)}
							</div>

							{pinnedMessage && (
								<div className='px-6 py-2 border-b border-gray-800/60 bg-gray-900/60 backdrop-blur-md'>
									<button
										onClick={() => jumpToMessage(pinnedMessage.id)}
										className='w-full flex items-center gap-3 rounded-xl border border-gray-800/60 bg-gray-800/40 px-3 py-2 text-left text-xs text-gray-200 hover:bg-gray-800/70 transition'
									>
										<span className='text-amber-400'>📌</span>
										<div className='flex-1 min-w-0'>
											<div className='text-[10px] uppercase tracking-wider text-gray-400'>
												Закреплено
											</div>
											<div className='truncate'>
												{getMessagePreview(pinnedMessage)}
											</div>
										</div>
										{pinnedMessage.attachments &&
											pinnedMessage.attachments.length > 0 && (
												<div className='flex items-center gap-2'>
													{(() => {
														const a = pinnedMessage.attachments[0]
														const ext = (
															typeof a === 'object' && a.ext ? a.ext : ''
														).toLowerCase()
														const isImage =
															ext === 'png' ||
															ext === 'jpg' ||
															ext === 'jpeg' ||
															ext === 'gif' ||
															ext === 'webp' ||
															ext === 'bmp' ||
															ext === 'svg'
														if (isImage) {
															return (
																<img
																	src={
																		typeof a === 'object'
																			? getAttachmentUrl(a.url)
																			: ''
																	}
																	alt={typeof a === 'object' ? a.name : ''}
																	className='h-10 w-10 rounded-md object-cover'
																/>
															)
														}
														return (
															<span className='rounded-md border border-gray-700/60 bg-gray-900/60 px-2 py-1 text-[10px] text-gray-300'>
																{a.ext ? a.ext.toUpperCase() : 'FILE'}
															</span>
														)
													})()}
												</div>
											)}
									</button>
								</div>
							)}

							{isSelectionMode && (
								<div className='px-6 py-3 border-b border-gray-800/60 bg-emerald-900/60 backdrop-blur-md animate-in slide-in-from-top-2 duration-200'>
									<div className='max-w-4xl mx-auto flex items-center justify-between'>
										<div className='flex items-center gap-3'>
											<div className='flex items-center gap-2'>
												<div className='w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center'>
													<svg
														className='w-3 h-3 text-white'
														viewBox='0 0 24 24'
														fill='none'
														stroke='currentColor'
														strokeWidth='3'
														strokeLinecap='round'
														strokeLinejoin='round'
													>
														<polyline points='20 6 9 17 4 12'></polyline>
													</svg>
												</div>
												<span className='text-sm font-medium text-emerald-200'>
													{selectedMessageIds.size} сообще
													{selectedMessageIds.size % 10 === 1 &&
													selectedMessageIds.size % 100 !== 11
														? 'ние'
														: selectedMessageIds.size % 10 >= 2 &&
															  selectedMessageIds.size % 10 <= 4 &&
															  (selectedMessageIds.size % 100 < 12 ||
																	selectedMessageIds.size % 100 > 14)
															? 'ния'
															: 'ний'}{' '}
													выбрано
												</span>
											</div>
										</div>
										<div className='flex items-center gap-2'>
											<button
												onClick={handleSelectAllMessages}
												className='rounded-lg px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-800/50 transition'
											>
												Выбрать все
											</button>
											<button
												onClick={handleClearSelection}
												className='rounded-lg px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-700/50 transition'
											>
												Отмена
											</button>
											<button
												onClick={() => {
													setIsForwardOpen(true)
													setForwardQuery('')
												}}
												disabled={selectedMessageIds.size === 0}
												className='flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition'
											>
												<svg
													className='w-4 h-4'
													viewBox='0 0 24 24'
													fill='none'
													stroke='currentColor'
													strokeWidth='2'
													strokeLinecap='round'
													strokeLinejoin='round'
												>
													<polyline points='17 1 21 5 17 9'></polyline>
													<path d='M3 11V9a4 4 0 0 1 4-4h14'></path>
													<polyline points='7 23 3 19 7 15'></polyline>
													<path d='M21 13v2a4 4 0 0 1-4 4H3'></path>
												</svg>
												Переслать
											</button>
											<button
												onClick={handleDeleteSelectedMessages}
												disabled={
													selectedMessageIds.size === 0 ||
													!allSelectedMessagesAreOwn
												}
												className='flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition'
												title={
													!allSelectedMessagesAreOwn
														? 'Нельзя удалить чужие сообщения'
														: undefined
												}
											>
												<svg
													className='w-4 h-4'
													viewBox='0 0 24 24'
													fill='none'
													stroke='currentColor'
													strokeWidth='2'
													strokeLinecap='round'
													strokeLinejoin='round'
												>
													<polyline points='3 6 5 6 21 6'></polyline>
													<path d='M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'></path>
													<line x1='10' y1='11' x2='10' y2='17'></line>
													<line x1='14' y1='11' x2='14' y2='17'></line>
												</svg>
												Удалить
												{!allSelectedMessagesAreOwn &&
												selectedMessageIds.size > 0
													? ' (только свои)'
													: ''}
											</button>
										</div>
									</div>
								</div>
							)}

							{isFilterOpen && (
								<div
									className='fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-start justify-center pt-20 p-4'
									onClick={() => setIsFilterOpen(false)}
								>
									<div
										className='bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200'
										onClick={e => e.stopPropagation()}
									>
										<div className='flex items-center justify-between p-4 border-b border-gray-800'>
											<h3 className='text-lg font-bold text-white flex items-center gap-2'>
												<svg
													className='w-5 h-5 text-emerald-400'
													viewBox='0 0 24 24'
													fill='none'
													stroke='currentColor'
													strokeWidth='2'
												>
													<polygon points='22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3'></polygon>
												</svg>
												Фильтр сообщений
											</h3>
											<button
												onClick={() => setIsFilterOpen(false)}
												className='p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors'
											>
												<XIcon className='w-5 h-5' />
											</button>
										</div>
										<div className='p-3 space-y-1'>
											<button
												onClick={() => {
													setMessageFilter('all')
													setIsFilterOpen(false)
												}}
												className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
													messageFilter === 'all'
														? 'bg-emerald-600/20 text-emerald-300'
														: 'text-gray-300 hover:bg-gray-800'
												}`}
											>
												<div
													className={`w-10 h-10 rounded-full flex items-center justify-center ${
														messageFilter === 'all'
															? 'bg-emerald-600/30'
															: 'bg-gray-800'
													}`}
												>
													<svg
														className='w-5 h-5'
														viewBox='0 0 24 24'
														fill='none'
														stroke='currentColor'
														strokeWidth='2'
													>
														<rect
															x='3'
															y='3'
															width='18'
															height='18'
															rx='2'
															ry='2'
														></rect>
														<line x1='9' y1='9' x2='15' y2='15'></line>
														<line x1='15' y1='9' x2='9' y2='15'></line>
													</svg>
												</div>
												<div className='flex-1 text-left'>
													<div className='font-medium'>Все сообщения</div>
													<div className='text-xs text-gray-500'>
														Показать все сообщения
													</div>
												</div>
												{messageFilter === 'all' && (
													<svg
														className='w-5 h-5 text-emerald-400'
														viewBox='0 0 24 24'
														fill='none'
														stroke='currentColor'
														strokeWidth='2'
													>
														<polyline points='20 6 9 17 4 12'></polyline>
													</svg>
												)}
											</button>
											<button
												onClick={() => {
													setMessageFilter('photos')
													setIsFilterOpen(false)
												}}
												className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
													messageFilter === 'photos'
														? 'bg-emerald-600/20 text-emerald-300'
														: 'text-gray-300 hover:bg-gray-800'
												}`}
											>
												<div
													className={`w-10 h-10 rounded-full flex items-center justify-center ${
														messageFilter === 'photos'
															? 'bg-emerald-600/30'
															: 'bg-gray-800'
													}`}
												>
													<svg
														className='w-5 h-5'
														viewBox='0 0 24 24'
														fill='none'
														stroke='currentColor'
														strokeWidth='2'
													>
														<rect
															x='3'
															y='3'
															width='18'
															height='18'
															rx='2'
															ry='2'
														></rect>
														<circle cx='8.5' cy='8.5' r='1.5'></circle>
														<polyline points='21 15 16 10 5 21'></polyline>
													</svg>
												</div>
												<div className='flex-1 text-left'>
													<div className='font-medium'>Фотографии</div>
													<div className='text-xs text-gray-500'>
														Только изображения
													</div>
												</div>
												{messageFilter === 'photos' && (
													<svg
														className='w-5 h-5 text-emerald-400'
														viewBox='0 0 24 24'
														fill='none'
														stroke='currentColor'
														strokeWidth='2'
													>
														<polyline points='20 6 9 17 4 12'></polyline>
													</svg>
												)}
											</button>
											<button
												onClick={() => {
													setMessageFilter('files')
													setIsFilterOpen(false)
												}}
												className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
													messageFilter === 'files'
														? 'bg-emerald-600/20 text-emerald-300'
														: 'text-gray-300 hover:bg-gray-800'
												}`}
											>
												<div
													className={`w-10 h-10 rounded-full flex items-center justify-center ${
														messageFilter === 'files'
															? 'bg-emerald-600/30'
															: 'bg-gray-800'
													}`}
												>
													<svg
														className='w-5 h-5'
														viewBox='0 0 24 24'
														fill='none'
														stroke='currentColor'
														strokeWidth='2'
													>
														<path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'></path>
														<polyline points='14 2 14 8 20 8'></polyline>
														<line x1='16' y1='13' x2='8' y2='13'></line>
														<line x1='16' y1='17' x2='8' y2='17'></line>
														<polyline points='10 9 9 9 8 9'></polyline>
													</svg>
												</div>
												<div className='flex-1 text-left'>
													<div className='font-medium'>Файлы</div>
													<div className='text-xs text-gray-500'>
														Документы и файлы
													</div>
												</div>
												{messageFilter === 'files' && (
													<svg
														className='w-5 h-5 text-emerald-400'
														viewBox='0 0 24 24'
														fill='none'
														stroke='currentColor'
														strokeWidth='2'
													>
														<polyline points='20 6 9 17 4 12'></polyline>
													</svg>
												)}
											</button>
											<button
												onClick={() => {
													setMessageFilter('links')
													setIsFilterOpen(false)
												}}
												className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
													messageFilter === 'links'
														? 'bg-emerald-600/20 text-emerald-300'
														: 'text-gray-300 hover:bg-gray-800'
												}`}
											>
												<div
													className={`w-10 h-10 rounded-full flex items-center justify-center ${
														messageFilter === 'links'
															? 'bg-emerald-600/30'
															: 'bg-gray-800'
													}`}
												>
													<svg
														className='w-5 h-5'
														viewBox='0 0 24 24'
														fill='none'
														stroke='currentColor'
														strokeWidth='2'
													>
														<circle cx='12' cy='12' r='10'></circle>
														<line x1='2' y1='12' x2='22' y2='12'></line>
														<path d='M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'></path>
													</svg>
												</div>
												<div className='flex-1 text-left'>
													<div className='font-medium'>Ссылки</div>
													<div className='text-xs text-gray-500'>
														Сообщения со ссылками
													</div>
												</div>
												{messageFilter === 'links' && (
													<svg
														className='w-5 h-5 text-emerald-400'
														viewBox='0 0 24 24'
														fill='none'
														stroke='currentColor'
														strokeWidth='2'
													>
														<polyline points='20 6 9 17 4 12'></polyline>
													</svg>
												)}
											</button>
										</div>
										<div className='p-4 border-t border-gray-800'>
											<button
												onClick={() => {
													setMessageFilter('all')
													setIsFilterOpen(false)
												}}
												className='w-full py-2.5 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-colors'
											>
												Сбросить фильтр
											</button>
										</div>
									</div>
								</div>
							)}

							{!isConnected && <ConnectingModal isVisible={!isConnected} />}

							{isCustomBgOpen && (
								<div
									className='fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4'
									onClick={() => setIsCustomBgOpen(false)}
								>
									<div
										className='bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200'
										onClick={e => e.stopPropagation()}
									>
										<div className='flex items-center justify-between p-4 border-b border-gray-800'>
											<h3 className='text-lg font-bold text-white flex items-center gap-2'>
												<svg
													className='w-5 h-5 text-emerald-400'
													viewBox='0 0 24 24'
													fill='none'
													stroke='currentColor'
													strokeWidth='2'
												>
													<rect
														x='3'
														y='3'
														width='18'
														height='18'
														rx='2'
														ry='2'
													></rect>
													<circle cx='8.5' cy='8.5' r='1.5'></circle>
													<polyline points='21 15 16 10 5 21'></polyline>
												</svg>
												Установить фон чата
											</h3>
											<button
												onClick={() => setIsCustomBgOpen(false)}
												className='p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors'
											>
												<XIcon className='w-5 h-5' />
											</button>
										</div>
										<div className='p-4 space-y-4'>
											<div>
												<label className='block text-sm font-medium text-gray-400 mb-2'>
													URL изображения
												</label>
												<div className='flex gap-2'>
													<input
														type='url'
														value={customBgUrl}
														onChange={e => setCustomBgUrl(e.target.value)}
														placeholder='https://example.com/image.jpg'
														className='flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50'
														onKeyDown={e => {
															if (e.key === 'Enter' && customBgUrl.trim()) {
																handleSetCustomBackground(customBgUrl.trim())
															}
														}}
													/>
													<button
														onClick={() =>
															customBgUrl.trim() &&
															handleSetCustomBackground(customBgUrl.trim())
														}
														disabled={!customBgUrl.trim()}
														className='px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-xl transition-colors font-medium'
													>
														Применить
													</button>
												</div>
											</div>

											<div className='relative'>
												<div className='absolute inset-0 flex items-center'>
													<div className='w-full border-t border-gray-800'></div>
												</div>
												<div className='relative flex justify-center text-xs uppercase'>
													<span className='bg-gray-900 px-2 text-gray-500'>
														или
													</span>
												</div>
											</div>

											<div>
												<label className='block text-sm font-medium text-gray-400 mb-2'>
													Загрузить файл
												</label>
												<div className='relative'>
													<input
														type='file'
														accept='image/*'
														onChange={async e => {
															const file = e.target.files?.[0]
															if (!file) return
															const formData = new FormData()
															formData.append('file', file)
															try {
																const res = await fetch('/api/upload/file', {
																	method: 'POST',
																	body: formData,
																})
																if (res.ok) {
																	const data = await res.json()
																	if (data.url) {
																		handleSetCustomBackground(data.url)
																	}
																} else {
																	showToast('Ошибка загрузки файла', 'error')
																}
															} catch (err) {
																showToast('Ошибка загрузки файла', 'error')
															}
														}}
														className='hidden'
														id='bg-upload'
													/>
													<label
														htmlFor='bg-upload'
														className='flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-700 rounded-xl cursor-pointer hover:border-emerald-500/50 hover:bg-gray-800/50 transition-colors'
													>
														<svg
															className='w-8 h-8 text-gray-500 mb-2'
															viewBox='0 0 24 24'
															fill='none'
															stroke='currentColor'
															strokeWidth='2'
														>
															<path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'></path>
															<polyline points='17 8 12 3 7 8'></polyline>
															<line x1='12' y1='3' x2='12' y2='15'></line>
														</svg>
														<span className='text-sm text-gray-400'>
															Нажмите для загрузки
														</span>
														<span className='text-xs text-gray-600 mt-1'>
															PNG, JPG, GIF до 5MB
														</span>
													</label>
												</div>
											</div>

											{customBgUrl && (
												<div>
													<label className='block text-sm font-medium text-gray-400 mb-2'>
														Предпросмотр
													</label>
													<div className='relative h-32 rounded-xl overflow-hidden border border-gray-800'>
														<img
															src={customBgUrl}
															alt='Preview'
															className='w-full h-full object-cover'
															onError={e => {
																e.currentTarget.src =
																	'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%23666" stroke-width="2"%3E%3Crect x="3" y="3" width="18" height="18" rx="2" ry="2"%3E%3C/rect%3E%3Ccircle cx="8.5" cy="8.5" r="1.5"%3E%3C/circle%3E%3Cpolyline points="21 15 16 10 5 21"%3E%3C/polyline%3E%3C/svg%3E'
															}}
														/>
													</div>
												</div>
											)}
										</div>
										<div className='p-4 border-t border-gray-800 flex gap-2'>
											<button
												onClick={() => {
													setIsCustomBgOpen(false)
													setCustomBgUrl('')
												}}
												className='flex-1 py-2.5 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-colors'
											>
												Отмена
											</button>
										</div>
									</div>
								</div>
							)}

							<div
								ref={containerRef}
								onScroll={handleScroll}
								className='flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar scroll-smooth'
							>
								{isChatLoading && messages.length > 0 && !isChatSearchOpen && (
									<div className='flex justify-center py-4'>
										<div
											className={`w-6 h-6 border-2 border-t-transparent rounded-full animate-spin ${currentBackground.borderColor.replace(
												'/20',
												'',
											)}`}
										/>
									</div>
								)}

								{!isChatSearchOpen && (
									<div className='flex justify-center my-4'>
										<span className='text-[10px] font-medium text-gray-500 bg-gray-900/60 px-3 py-1 rounded-full backdrop-blur-sm'>
											Сегодня
										</span>
									</div>
								)}

								{isChatSearchOpen && chatSearchQuery && (
									<div className='flex justify-center my-4'>
										<span className='text-[10px] font-medium text-gray-400 bg-gray-900/80 px-4 py-1.5 rounded-full border border-gray-800'>
											{foundMessages.length > 0
												? `Найдено сообщений: ${foundMessages.length}`
												: isSearchingMessages
													? 'Поиск...'
													: 'Ничего не найдено'}
										</span>
									</div>
								)}

								{messagesToDisplay.length === 0 &&
									!isChatLoading &&
									!isSearchingMessages && (
										<div className='flex flex-col h-full items-center justify-center text-gray-500 space-y-4 opacity-0 animate-in fade-in duration-700 fill-mode-forwards'>
											<div className='w-24 h-24 rounded-3xl bg-gray-900/50 flex items-center justify-center border border-gray-800/50 rotate-3 transition-transform hover:rotate-6 duration-500'>
												{messageFilter !== 'all' ? (
													<svg
														className='w-12 h-12 text-gray-700'
														viewBox='0 0 24 24'
														fill='none'
														stroke='currentColor'
														strokeWidth='2'
													>
														<polygon points='22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3'></polygon>
													</svg>
												) : (
													<MessageSquareIcon className='w-12 h-12 text-gray-700' />
												)}
											</div>
											<div className='text-center space-y-2'>
												<p className='text-lg font-medium text-gray-300'>
													{isChatSearchOpen
														? 'Ничего не найдено'
														: messageFilter !== 'all'
															? 'Нет сообщений с таким фильтром'
															: 'Нет сообщений'}
												</p>
												{!isChatSearchOpen && (
													<p className='text-sm text-gray-600'>
														{messageFilter !== 'all'
															? `Фильтр: ${messageFilter === 'photos' ? 'Фотографии' : messageFilter === 'files' ? 'Файлы' : 'Ссылки'}. Выберите другой фильтр или сбросьте его`
															: 'Напишите первое сообщение, чтобы начать диалог'}
													</p>
												)}
											</div>
										</div>
									)}

								{messagesToDisplay.map((msg, index) => {
									const isLast = index === messagesToDisplay.length - 1
									const replyMessage = replyMap[msg.id]
									const replyPreview = replyMessage
										? {
												sender: getSenderName(replyMessage),
												text: getMessagePreview(replyMessage),
											}
										: undefined
									return (
										<div
											key={msg.id || index}
											ref={el => {
												messageRefs.current[msg.id] = el
												if (isLast) messagesEndRef.current = el
											}}
											className='w-full'
										>
											<MessageBubble
												msg={msg}
												theme={messageTheme}
												sender={
													msg.group_id || selectedGroup?.id
														? groupParticipants[msg.sender_id]
														: undefined
												}
												isPinned={pinnedMessageIds.includes(msg.id)}
												replyPreview={replyPreview}
												reactions={getReactionsForMessage(msg.id)}
												onReply={handleReplyMessage}
												onPin={handlePinMessage}
												onDelete={handleDeleteMessage}
												onEdit={handleEditMessage}
												onReact={handleReactMessage}
												onForward={handleForwardMessage}
												isSelectionMode={isSelectionMode}
												isSelected={selectedMessageIds.has(msg.id)}
												onToggleSelect={handleToggleMessageSelection}
												isDeleting={deletingMessageIds.has(msg.id) || deletingAiBotMessageIds.has(msg.id)}
												currentUserId={user?.id}
												botAccessToken={accessToken}
												onBotOutboxItems={appendBotOutboxItems}
											/>
										</div>
									)
								})}

								{isChatTyping && (
									<div className='flex items-center gap-2 px-5 py-2 animate-in fade-in slide-in-from-bottom-2 duration-300'>
										<div className='bg-gray-800/80 border border-gray-700 px-4 py-2 rounded-2xl rounded-tl-sm flex items-center gap-1.5'>
											<span className='w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]'></span>
											<span className='w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]'></span>
											<span className='w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce'></span>
										</div>
										<span className='text-xs text-gray-500 animate-pulse'>
											печатает...
										</span>
									</div>
								)}
							</div>

							<div className='p-4 bg-gray-900/40 backdrop-blur-md border-t border-gray-800/50'>
								{replyToMessage && (
									<div className='max-w-4xl mx-auto mb-2 flex items-center gap-3 rounded-2xl border border-gray-800/60 bg-gray-800/40 px-4 py-2 text-xs text-gray-200'>
										<div className='flex-1 min-w-0'>
											<div className='text-[10px] uppercase tracking-wider text-gray-400'>
												Ответ на: {getSenderName(replyToMessage)}
											</div>
											<div className='truncate text-gray-300'>
												{getMessagePreview(replyToMessage)}
											</div>
										</div>
										<button
											onClick={() => setReplyToMessage(null)}
											className='rounded-full px-2 py-1 text-gray-400 hover:bg-gray-700/60 hover:text-white transition'
										>
											✕
										</button>
									</div>
								)}
								<div
									className={`max-w-4xl mx-auto flex items-end gap-3 bg-gray-800/50 p-2 rounded-3xl shadow-lg focus-within:ring-2 transition-all duration-300 ${currentBackground.ringColor.replace('focus:', 'focus-within:').replace('/50', '/20')}`}
								>
									{isRecording ? (
										<div className='flex-1 flex items-center justify-between px-4 py-2'>
											<div className='flex items-center gap-3'>
												<div className='w-3 h-3 bg-red-500 rounded-full animate-pulse' />
												<span className='text-white font-mono text-lg'>
													{formatTime(recordingTime)}
												</span>
											</div>
											<div className='flex items-center gap-2'>
												<button
													onClick={handleCancelRecording}
													className='p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700/50 rounded-full transition-all'
													title='Отмена'
												>
													<StopIcon className='w-6 h-6' />
												</button>
												<button
													onClick={handleSendVoice}
													className={`p-2 rounded-full transition-all ${currentBackground.buttonBg} ${currentBackground.buttonHover} text-white`}
													title='Отправить'
												>
													<CheckIcon className='w-6 h-6' />
												</button>
											</div>
										</div>
									) : (
										<>
											<button
												onClick={handlePickFiles}
												className={`p-2.5 text-gray-400 hover:bg-gray-700/50 rounded-full transition-all ${currentBackground.accentColor.replace('text-', 'hover:text-')}`}
											>
												<PaperclipIcon className='w-5 h-5' />
											</button>
											<input
												ref={fileInputRef}
												type='file'
												accept='*/*'
												multiple
												onChange={handleFilesSelected}
												className='hidden'
											/>

											{files.length > 0 && (
												<div className='absolute bottom-full left-0 right-0 mb-2 px-2'>
													<div className='flex flex-wrap gap-2'>
														{files.map((f, idx) => (
															<div
																key={`${f.name}-${f.size}-${idx}`}
																className='flex items-center gap-2 rounded-lg border border-gray-700/50 bg-gray-800/40 px-3 py-2 text-xs text-gray-200'
															>
																<span className='max-w-[180px] truncate'>
																	{f.name}
																</span>
																<button
																	onClick={() => removeFile(idx)}
																	className='rounded-md px-2 py-1 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors'
																	type='button'
																>
																	✕
																</button>
															</div>
														))}
													</div>
												</div>
											)}
											{showBotCommandHints && (
												<div className='absolute bottom-full left-0 right-0 mb-2 px-2'>
													<div className='rounded-xl border border-gray-700/60 bg-gray-900/95 shadow-xl overflow-hidden'>
														{filteredBotCommands.map(item => (
															<button
																key={item.command}
																onClick={() => {
																	setInput(
																		`/${item.command}${
																			item.command === 'echo' ? ' ' : ''
																		}`,
																	)
																	messageInputRef.current?.focus()
																}}
																className='w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-800 transition-colors flex items-center justify-between gap-3'
															>
																<span className='font-medium'>
																	{item.title}
																</span>
																<span className='text-xs text-gray-500'>
																	{item.description}
																</span>
															</button>
														))}
													</div>
												</div>
											)}

											{isPickerOpen && (
												<div
													ref={pickerRef}
													className='absolute bottom-full right-12 mb-2 w-80 rounded-2xl border border-gray-800 bg-gray-900/95 shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200 flex flex-col'
												>
													<div className='flex p-1 bg-gray-950/50 border-b border-gray-800'>
														<button
															onClick={() => setPickerTab('emoji')}
															className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
																pickerTab === 'emoji'
																	? 'bg-gray-800 text-white shadow-sm'
																	: 'text-gray-500 hover:text-gray-300'
															}`}
														>
															Эмодзи
														</button>
														<button
															onClick={() => setPickerTab('sticker')}
															className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
																pickerTab === 'sticker'
																	? 'bg-gray-800 text-white shadow-sm'
																	: 'text-gray-500 hover:text-gray-300'
															}`}
														>
															Стикеры
														</button>
													</div>

													<div className='h-72 overflow-y-auto custom-scrollbar p-3'>
														{pickerTab === 'emoji' ? (
															<div className='grid grid-cols-6 gap-1'>
																{EMOJIS.map(emoji => (
																	<button
																		key={emoji}
																		onClick={() =>
																			setInput(prev => prev + emoji)
																		}
																		className='text-2xl p-2 hover:bg-gray-800/50 rounded-xl transition-all hover:scale-110 active:scale-90'
																	>
																		<AppleEmoji emoji={emoji} size={28} />
																	</button>
																))}
															</div>
														) : (
															<div className='space-y-4'>
																<div className='flex items-center justify-between px-1'>
																	<span className='text-[10px] font-bold uppercase tracking-widest text-gray-500'>
																		Ваши стикеры
																	</span>
																	<button
																		onClick={handleUploadSticker}
																		className='text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-widest'
																	>
																		+ Загрузить
																	</button>
																</div>
																<div className='grid grid-cols-4 gap-2'>
																	{STICKERS.map(sticker => (
																		<button
																			key={sticker.id}
																			onClick={() =>
																				handleSendSticker(sticker.url)
																			}
																			className='aspect-square rounded-xl bg-gray-800/40 hover:bg-gray-700/60 transition-all p-2 group hover:scale-105 active:scale-95'
																		>
																			<img
																				src={getAttachmentUrl(sticker.url)}
																				alt={sticker.id}
																				className='w-full h-full object-contain transition-transform group-hover:scale-110'
																			/>
																		</button>
																	))}
																	{customStickers.map(sticker => (
																		<button
																			key={sticker.id}
																			onClick={() =>
																				handleSendSticker(sticker.url)
																			}
																			className='aspect-square rounded-xl bg-gray-800/40 hover:bg-gray-700/60 transition-all p-2 group relative hover:scale-105 active:scale-95'
																		>
																			<img
																				src={getAttachmentUrl(sticker.url)}
																				alt={sticker.id}
																				className='w-full h-full object-contain transition-transform group-hover:scale-110'
																			/>
																			<button
																				onClick={e => {
																					e.stopPropagation()
																					deleteCustomSticker(sticker.id)
																				}}
																				className='absolute -top-1 -right-1 p-1 bg-rose-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-600 shadow-lg'
																				title='Удалить стикер'
																			>
																				<XIcon className='w-3 h-3' />
																			</button>
																		</button>
																	))}
																</div>
															</div>
														)}
													</div>
												</div>
											)}

											<textarea
												ref={messageInputRef}
												value={input}
												onChange={handleInputChange}
												onKeyDown={e => {
													if (e.key === 'Enter' && !e.shiftKey) {
														e.preventDefault()
														handleSendMessage()
													}
												}}
												rows={1}
												className='flex-1 bg-transparent border-none text-white placeholder-gray-500 focus:ring-0 resize-none py-2.5 max-h-32 min-h-[44px] custom-scrollbar'
												placeholder='Напишите сообщение...'
												style={{ height: 'auto', minHeight: '44px' }}
												onInput={e => {
													const target = e.target as HTMLTextAreaElement
													target.style.height = 'auto'
													target.style.height = `${Math.min(
														target.scrollHeight,
														128,
													)}px`
												}}
											/>

											<button
												onClick={() => {
													setIsPickerOpen(!isPickerOpen)
												}}
												className={`p-2.5 text-gray-400 hover:bg-gray-700/50 rounded-full transition-all ${
													isPickerOpen
														? 'text-indigo-400 bg-gray-700/50'
														: 'hover:text-indigo-400'
												}`}
												title='Эмодзи и стикеры'
											>
												<SmileIcon className='w-6 h-6' />
											</button>

											{input.trim() ? (
												<button
													onClick={handleSendMessage}
													className={`p-3 rounded-2xl transition-all duration-300 shadow-lg flex items-center justify-center ${currentBackground.buttonBg} ${currentBackground.buttonHover} text-white translate-x-0 rotate-0`}
												>
													<SendIcon className='w-5 h-5' />
												</button>
											) : (
												<button
													onClick={handleStartRecording}
													className='p-3 rounded-2xl transition-all duration-300 shadow-lg flex items-center justify-center bg-gray-700 hover:bg-gray-600 text-white translate-x-0 rotate-0'
												>
													<MicIcon className='w-5 h-5' />
												</button>
											)}
										</>
									)}
								</div>
							</div>
						</>
					) : (
						<div className='flex-1 flex flex-col items-center justify-center text-gray-500 gap-6 p-8 relative overflow-hidden'>
							<div className='absolute inset-0 bg-gradient-to-tr from-blue-900/10 via-transparent to-purple-900/10 pointer-events-none' />

							<div className='w-32 h-32 rounded-[2rem] bg-gray-900 shadow-2xl flex items-center justify-center border border-gray-800 rotate-12 transition-transform duration-700 hover:rotate-6 group'>
								<MessageSquareIcon className='w-16 h-16 text-gray-700 group-hover:text-blue-500/50 transition-colors duration-500' />
							</div>

							<div className='text-center space-y-2 max-w-sm z-10'>
								<h3 className='text-2xl font-bold text-gray-200'>
									Вондик Мессенджер
								</h3>
								<p className='text-gray-500'>
									Выберите чат слева или найдите друга, чтобы начать общение.
								</p>
							</div>
						</div>
					)}
				</div>
			</div>

			{isForwardOpen && (forwardMessage || selectedMessageIds.size > 0) && (
				<div className='fixed inset-0 bg-black/50 backdrop-blur-sm z-[99999] flex items-center justify-center p-4'>
					<div className='bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200'>
						<div className='flex items-center justify-between mb-4'>
							<h3 className='text-xl font-bold text-white'>
								Переслать{' '}
								{selectedMessageIds.size > 0
									? `${selectedMessageIds.size} сообще${selectedMessageIds.size % 10 === 1 && selectedMessageIds.size % 100 !== 11 ? 'ние' : selectedMessageIds.size % 10 >= 2 && selectedMessageIds.size % 10 <= 4 && (selectedMessageIds.size % 100 < 12 || selectedMessageIds.size % 100 > 14) ? 'ния' : 'ний'}`
									: 'сообщение'}
							</h3>
							<button
								onClick={() => {
									setIsForwardOpen(false)
									setForwardMessage(null)
								}}
								className='p-1 text-gray-400 hover:text-white transition-colors'
							>
								<XIcon className='w-5 h-5' />
							</button>
						</div>
						<div className='mb-3'>
							<input
								type='text'
								value={forwardQuery}
								onChange={e => setForwardQuery(e.target.value)}
								className='w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50'
								placeholder='Поиск чатов, групп, каналов...'
							/>
						</div>
						<div className='max-h-80 overflow-y-auto space-y-2 custom-scrollbar'>
							{forwardTargets.length === 0 && (
								<div className='text-center text-sm text-gray-500 py-6'>
									Ничего не найдено
								</div>
							)}
							{forwardTargets.map(target => (
								<button
									key={`${target.kind}-${target.id}`}
									onClick={() => {
										if (selectedMessageIds.size > 0) {
											handleForwardSelectedMessages(target)
										} else {
											handleForwardToTarget(target)
										}
									}}
									className='w-full flex items-center justify-between gap-3 rounded-xl border border-gray-800/60 bg-gray-800/40 px-4 py-3 text-left text-sm text-gray-200 hover:bg-gray-800/70 transition'
								>
									<div className='min-w-0'>
										<div className='truncate font-medium'>{target.label}</div>
										<div className='text-[11px] uppercase tracking-wider text-gray-500'>
											{target.sub}
										</div>
									</div>
									<span className='text-xs text-gray-500'>Отправить</span>
								</button>
							))}
						</div>
						{forwardMessage && (
							<div className='mt-4 rounded-xl border border-gray-800/60 bg-gray-800/30 px-4 py-3 text-xs text-gray-300'>
								<div className='text-[10px] uppercase tracking-wider text-gray-500 mb-1'>
									Сообщение
								</div>
								<div className='truncate'>
									{getMessagePreview(forwardMessage)}
								</div>
							</div>
						)}
						{selectedMessageIds.size > 0 && (
							<div className='mt-4 rounded-xl border border-gray-800/60 bg-gray-800/30 px-4 py-3 text-xs text-gray-300'>
								<div className='text-[10px] uppercase tracking-wider text-gray-500 mb-1'>
									Выбрано сообщений
								</div>
								<div>
									{selectedMessageIds.size} сообще
									{selectedMessageIds.size % 10 === 1 &&
									selectedMessageIds.size % 100 !== 11
										? 'ние'
										: selectedMessageIds.size % 10 >= 2 &&
											  selectedMessageIds.size % 10 <= 4 &&
											  (selectedMessageIds.size % 100 < 12 ||
													selectedMessageIds.size % 100 > 14)
											? 'ния'
											: 'ний'}
								</div>
							</div>
						)}
					</div>
				</div>
			)}

			{isCreateChannelOpen && (
				<div className='fixed inset-0 bg-black/50 backdrop-blur-sm z-[99999] flex items-center justify-center p-4'>
					<div className='bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200'>
						<div className='flex items-center justify-between mb-6'>
							<h3 className='text-xl font-bold text-white'>Создать канал</h3>
							<button
								onClick={() => setIsCreateChannelOpen(false)}
								className='p-1 text-gray-400 hover:text-white transition-colors'
							>
								<XIcon className='w-5 h-5' />
							</button>
						</div>
						<form onSubmit={handleCreateChannel} className='space-y-4'>
							<div>
								<label className='block text-sm font-medium text-gray-400 mb-1'>
									Название
								</label>
								<input
									type='text'
									value={newChannelName}
									onChange={e => setNewChannelName(e.target.value)}
									className='w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50'
									placeholder='Например: Новости'
									required
								/>
							</div>
							<div>
								<label className='block text-sm font-medium text-gray-400 mb-1'>
									Описание
								</label>
								<textarea
									value={newChannelDesc}
									onChange={e => setNewChannelDesc(e.target.value)}
									className='w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none h-24'
									placeholder='О чем этот канал?'
								/>
							</div>
							<button
								type='submit'
								disabled={!newChannelName.trim()}
								className='w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
							>
								Создать
							</button>
						</form>
					</div>
				</div>
			)}

			{isCreateCommunityOpen && (
				<div className='fixed inset-0 bg-black/50 backdrop-blur-sm z-[99999] flex items-center justify-center p-4'>
					<div className='bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200'>
						<div className='flex items-center justify-between mb-6'>
							<h3 className='text-xl font-bold text-white'>
								Создать сообщество
							</h3>
							<button
								onClick={() => setIsCreateCommunityOpen(false)}
								className='p-1 text-gray-400 hover:text-white transition-colors'
							>
								<XIcon className='w-5 h-5' />
							</button>
						</div>
						<form onSubmit={handleCreateCommunity} className='space-y-4'>
							<div>
								<label className='block text-sm font-medium text-gray-400 mb-1'>
									Название
								</label>
								<input
									type='text'
									value={communityName}
									onChange={e => setCommunityName(e.target.value)}
									className='w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50'
									placeholder='Например: Мой сервер'
									required
								/>
							</div>
							<div>
								<label className='block text-sm font-medium text-gray-400 mb-1'>
									Описание
								</label>
								<textarea
									value={communityDesc}
									onChange={e => setCommunityDesc(e.target.value)}
									className='w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none h-24'
									placeholder='О чем это сообщество?'
								/>
							</div>
							<button
								type='submit'
								disabled={!communityName.trim()}
								className='w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
							>
								Создать
							</button>
						</form>
					</div>
				</div>
			)}

			{isCreateCommChannelOpen && (
				<div className='fixed inset-0 bg-black/50 backdrop-blur-sm z-[99999] flex items-center justify-center p-4'>
					<div className='bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200'>
						<div className='flex items-center justify-between mb-6'>
							<h3 className='text-xl font-bold text-white'>
								Создать канал сообщества
							</h3>
							<button
								onClick={() => setIsCreateCommChannelOpen(false)}
								className='p-1 text-gray-400 hover:text-white transition-colors'
							>
								<XIcon className='w-5 h-5' />
							</button>
						</div>
						<form onSubmit={handleCreateCommunityChannel} className='space-y-4'>
							<div>
								<label className='block text-sm font-medium text-gray-400 mb-1'>
									Сообщество
								</label>
								<select
									value={selectedCommunityId}
									onChange={e => setSelectedCommunityId(e.target.value)}
									className='w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50'
								>
									{myCommunities.map(c => (
										<option key={c.id} value={c.id}>
											{c.name}
										</option>
									))}
								</select>
							</div>
							<div>
								<label className='block text-sm font-medium text-gray-400 mb-1'>
									Название канала
								</label>
								<input
									type='text'
									value={commChannelName}
									onChange={e => setCommChannelName(e.target.value)}
									className='w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50'
									placeholder='Например: общий-чат'
									required
								/>
							</div>
							<div>
								<label className='block text-sm font-medium text-gray-400 mb-1'>
									Описание
								</label>
								<textarea
									value={commChannelDesc}
									onChange={e => setCommChannelDesc(e.target.value)}
									className='w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none h-24'
									placeholder='О чем этот канал?'
								/>
							</div>
							<div>
								<label className='block text-sm font-medium text-gray-400 mb-1'>
									Тип
								</label>
								<div className='flex gap-3'>
									<label className='text-sm text-gray-300 flex items-center gap-2'>
										<input
											type='radio'
											name='commChannelType'
											value='text'
											checked={commChannelType === 'text'}
											onChange={() => setCommChannelType('text')}
										/>
										Text
									</label>
									<label className='text-sm text-gray-300 flex items-center gap-2'>
										<input
											type='radio'
											name='commChannelType'
											value='voice'
											checked={commChannelType === 'voice'}
											onChange={() => setCommChannelType('voice')}
										/>
										Voice
									</label>
								</div>
							</div>
							<button
								type='submit'
								disabled={!commChannelName.trim() || !selectedCommunityId}
								className='w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
							>
								Создать
							</button>
						</form>
					</div>
				</div>
			)}

			{isJoinChannelOpen && (
				<div className='fixed inset-0 bg-black/50 backdrop-blur-sm z-[99999] flex items-center justify-center p-4'>
					<div className='bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200'>
						<div className='flex items-center justify-between mb-6'>
							<h3 className='text-xl font-bold text-white'>Вступить в канал</h3>
							<button
								onClick={() => setIsJoinChannelOpen(false)}
								className='p-1 text-gray-400 hover:text-white transition-colors'
							>
								<XIcon className='w-5 h-5' />
							</button>
						</div>
						<form onSubmit={handleJoinChannel} className='space-y-4'>
							<div>
								<label className='block text-sm font-medium text-gray-400 mb-1'>
									Код приглашения
								</label>
								<input
									type='text'
									value={joinInviteCode}
									onChange={e => setJoinInviteCode(e.target.value)}
									className='w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50'
									placeholder='Введите код'
									required
								/>
							</div>
							<button
								type='submit'
								disabled={!joinInviteCode.trim()}
								className='w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
							>
								Вступить
							</button>
						</form>
					</div>
				</div>
			)}

			{isCreateGroupOpen && (
				<div className='fixed inset-0 bg-black/50 backdrop-blur-sm z-[99999] flex items-center justify-center p-4'>
					<div className='bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200'>
						<div className='flex items-center justify-between mb-6'>
							<h3 className='text-xl font-bold text-white'>Создать группу</h3>
							<button
								onClick={() => setIsCreateGroupOpen(false)}
								className='p-1 text-gray-400 hover:text-white transition-colors'
							>
								<XIcon className='w-5 h-5' />
							</button>
						</div>
						<form onSubmit={handleCreateGroup} className='space-y-4'>
							<div>
								<label className='block text-sm font-medium text-gray-400 mb-1'>
									Название группы
								</label>
								<input
									type='text'
									value={newGroupName}
									onChange={e => setNewGroupName(e.target.value)}
									className='w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50'
									placeholder='Например: Рабочий чат'
									required
								/>
							</div>
							<div>
								<label className='block text-sm font-medium text-gray-400 mb-1'>
									Описание (опционально)
								</label>
								<textarea
									value={newGroupDesc}
									onChange={e => setNewGroupDesc(e.target.value)}
									className='w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 min-h-[100px] resize-none'
									placeholder='О чем будет эта группа...'
								/>
							</div>
							<button
								type='submit'
								disabled={!newGroupName.trim()}
								className='w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
							>
								Создать группу
							</button>
						</form>
					</div>
				</div>
			)}

			{isJoinGroupOpen && (
				<div className='fixed inset-0 bg-black/50 backdrop-blur-sm z-[99999] flex items-center justify-center p-4'>
					<div className='bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200'>
						<div className='flex items-center justify-between mb-6'>
							<h3 className='text-xl font-bold text-white'>
								Вступить в группу
							</h3>
							<button
								onClick={() => setIsJoinGroupOpen(false)}
								className='p-1 text-gray-400 hover:text-white transition-colors'
							>
								<XIcon className='w-5 h-5' />
							</button>
						</div>
						<form onSubmit={handleJoinGroup} className='space-y-4'>
							<div>
								<label className='block text-sm font-medium text-gray-400 mb-1'>
									Код приглашения
								</label>
								<input
									type='text'
									value={joinGroupInviteCode}
									onChange={e => setJoinGroupInviteCode(e.target.value)}
									className='w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50'
									placeholder='Введите код приглашения'
									required
								/>
							</div>
							<button
								type='submit'
								disabled={!joinGroupInviteCode.trim()}
								className='w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
							>
								Вступить
							</button>
						</form>
					</div>
				</div>
			)}

			{isJoinCommunityOpen && (
				<div className='fixed inset-0 bg-black/50 backdrop-blur-sm z-[99999] flex items-center justify-center p-4'>
					<div className='bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200'>
						<div className='flex items-center justify-between mb-6'>
							<h3 className='text-xl font-bold text-white'>
								Вступить в сообщество
							</h3>
							<button
								onClick={() => setIsJoinCommunityOpen(false)}
								className='p-1 text-gray-400 hover:text-white transition-colors'
							>
								<XIcon className='w-5 h-5' />
							</button>
						</div>
						<form onSubmit={handleJoinCommunity} className='space-y-4'>
							<div>
								<label className='block text-sm font-medium text-gray-400 mb-1'>
									Код приглашения
								</label>
								<input
									type='text'
									value={joinCommunityInviteCode}
									onChange={e => setJoinCommunityInviteCode(e.target.value)}
									className='w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50'
									placeholder='Введите код приглашения'
									autoFocus
								/>
							</div>
							<button
								type='submit'
								disabled={!joinCommunityInviteCode.trim()}
								className='w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
							>
								Вступить
							</button>
						</form>
					</div>
				</div>
			)}

			{isAddMemberOpen && (
				<div className='fixed inset-0 bg-black/50 backdrop-blur-sm z-[99999] flex items-center justify-center p-4'>
					<div className='bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200'>
						<div className='flex items-center justify-between mb-6'>
							<h3 className='text-xl font-bold text-white'>
								Добавить участника
							</h3>
							<button
								onClick={() => setIsAddMemberOpen(false)}
								className='p-1 text-gray-400 hover:text-white transition-colors'
							>
								<XIcon className='w-5 h-5' />
							</button>
						</div>
						<div className='space-y-4'>
							{friends.length === 0 ? (
								<p className='text-center text-gray-500 py-8'>
									У вас нет друзей для добавления.
								</p>
							) : (
								<div className='max-h-60 overflow-y-auto custom-scrollbar space-y-2'>
									{friends.map(friend => (
										<div
											key={friend.id}
											onClick={() => handleAddMember(friend.id)}
											className='flex items-center gap-3 p-3 rounded-xl hover:bg-gray-800 cursor-pointer transition-colors border border-transparent hover:border-gray-700'
										>
											<img
												src={getAvatarUrl(friend.avatar_url)}
												alt={friend.username}
												className='w-10 h-10 rounded-full object-cover bg-gray-800'
											/>
											<div className='flex-1 min-w-0'>
												<div className='font-medium text-white truncate'>
													{friend.username}
													{friend.premium && (
														<span className='ml-1 text-amber-400'>★</span>
													)}
												</div>
												<div className='text-xs text-gray-500 truncate'>
													{friend.email}
												</div>
											</div>
											<div className='p-2 bg-gray-800 rounded-full text-gray-400 group-hover:text-white group-hover:bg-blue-600 transition-all'>
												<PlusIcon className='w-4 h-4' />
											</div>
										</div>
									))}
								</div>
							)}
						</div>
					</div>
				</div>
			)}

			{showInviteCode && (
				<div className='fixed inset-0 bg-black/50 backdrop-blur-sm z-[99999] flex items-center justify-center p-4'>
					<div className='bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200'>
						<div className='flex items-center justify-between mb-6'>
							<h3 className='text-xl font-bold text-white'>Код приглашения</h3>
							<button
								onClick={() => setShowInviteCode(false)}
								className='p-1 text-gray-400 hover:text-white transition-colors'
							>
								<XIcon className='w-5 h-5' />
							</button>
						</div>
						<div className='space-y-4'>
							<div className='bg-gray-800 border border-gray-700 rounded-xl p-4'>
								<div className='flex items-center justify-between'>
									<span className='text-lg font-mono text-white'>
										{communityInviteCode}
									</span>
									<button
										onClick={() => {
											navigator.clipboard.writeText(communityInviteCode)
											showToast('Код скопирован!', 'success')
										}}
										className='p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white'
										title='Скопировать код'
									>
										<CopyIcon className='w-4 h-4' />
									</button>
								</div>
							</div>
							<p className='text-sm text-gray-400 text-center'>
								Поделитесь этим кодом с другими пользователями, чтобы они могли
								вступить в сообщество
							</p>
						</div>
					</div>
				</div>
			)}

			{isChannelInfoOpen && selectedChannel && (
				<div className='fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4'>
					<div className='bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200'>
						<div className='flex items-center justify-between mb-6'>
							<h3 className='text-xl font-bold text-white'>
								Информация о канале
							</h3>
							<button
								onClick={() => setIsChannelInfoOpen(false)}
								className='p-1 text-gray-400 hover:text-white transition-colors'
							>
								<XIcon className='w-5 h-5' />
							</button>
						</div>
						<div className='space-y-6'>
							<div className='flex items-center gap-4'>
								<div className='w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center ring-4 ring-gray-800/50'>
									<HashIcon className='w-8 h-8 text-gray-400' />
								</div>
								<div>
									<h4 className='text-lg font-bold text-white'>
										{selectedChannel.name}
									</h4>
									<p className='text-sm text-gray-500'>
										{selectedChannel.participants_count &&
										selectedChannel.participants_count > 0
											? `${selectedChannel.participants_count} участников`
											: ''}
									</p>
								</div>
							</div>

							{selectedChannel.description && (
								<div>
									<label className='block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2'>
										Описание
									</label>
									<p className='text-gray-300 text-sm bg-gray-800/50 p-3 rounded-xl border border-gray-800'>
										{selectedChannel.description}
									</p>
								</div>
							)}

							<div>
								<label className='block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2'>
									Код приглашения
								</label>
								<div className='flex gap-2'>
									<code className='flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-blue-400 font-mono text-sm'>
										{selectedChannel.invite_code}
									</code>
									<button
										onClick={() => {
											navigator.clipboard.writeText(selectedChannel.invite_code)
											showToast('Код приглашения скопирован', 'success')
										}}
										className='px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl border border-gray-700 transition-colors text-sm font-medium'
									>
										Копировать
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			)}

			{isScreenViewerOpen && isScreenSharing && (
				<ScreenShareViewer onClose={() => setIsScreenViewerOpen(false)} />
			)}

			{((hasActiveCall && selectedFriend) || activeGroupCallId) && (
				<IntegratedCallPanel />
			)}

			{hasActiveCall && !selectedFriend && !activeGroupCallId && (
				<FloatingCallBar
					onReturnToCall={() => {
						// Return to the chat with the active call
						const call = Array.from(activeCalls.values()).find(
							c => !c.isGroupCall,
						)
						if (call) {
							// Find and select the friend
							const friend = otherFriends.find(f => f.id === call.userId)
							if (friend) {
								setSelectedFriend(friend)
							}
						}
					}}
				/>
			)}

			<input
				ref={stickerUploadRef}
				type='file'
				accept='image/png,image/jpeg,image/webp'
				onChange={handleStickerFileChange}
				className='hidden'
			/>

			<AnimatePresence>
				{isUserProfileModalOpen && selectedUserForModal && (
					<div
						className='fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200'
						onClick={() => setIsUserProfileModalOpen(false)}
					>
						<motion.div
							initial={{ scale: 0.9, opacity: 0 }}
							animate={{ scale: 1, opacity: 1 }}
							exit={{ scale: 0.9, opacity: 0 }}
							className='w-full max-w-sm bg-gray-900 rounded-3xl overflow-hidden border border-white/10 shadow-2xl'
							onClick={e => e.stopPropagation()}
						>
							<div className='relative h-32 bg-gradient-to-br from-indigo-600 to-purple-700'>
								<div className='absolute -bottom-12 left-6'>
									<img
										src={getAvatarUrl(selectedUserForModal.avatar_url)}
										className='w-24 h-24 rounded-full object-cover border-4 border-gray-900 shadow-xl'
										alt={selectedUserForModal.username}
									/>
								</div>
							</div>
							<div className='pt-14 p-6'>
								<div className='mb-6'>
									<h2 className='text-2xl font-bold text-white flex items-center gap-2'>
										{selectedUserForModal.username}
										{selectedUserForModal.premium && (
											<span className='text-amber-400 text-xl'>★</span>
										)}
									</h2>
									<p className='text-gray-400 text-sm'>
										{selectedUserForModal.email}
									</p>
									<div className='mt-2 flex items-center gap-2'>
										<span
											className={`w-2 h-2 rounded-full ${selectedUserForModal.status?.toLowerCase() === 'online' ? 'bg-emerald-500' : 'bg-gray-500'}`}
										/>
										<span className='text-xs font-medium text-gray-300'>
											{selectedUserForModal.status?.toLowerCase() === 'online'
												? 'В сети'
												: formatLastSeen(selectedUserForModal.last_seen)}
										</span>
									</div>
								</div>
								<div className='flex flex-col gap-2'>
									<Link
										href={`/feed/profile/${selectedUserForModal.id}`}
										className='w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-center font-semibold transition-all shadow-lg shadow-indigo-500/20 active:scale-95'
									>
										Перейти к профилю
									</Link>
									<button
										onClick={() => setIsUserProfileModalOpen(false)}
										className='w-full py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-white text-center font-semibold transition-all active:scale-95'
									>
										Закрыть
									</button>
								</div>
							</div>
						</motion.div>
					</div>
				)}
			</AnimatePresence>
		</div>
	)
}

