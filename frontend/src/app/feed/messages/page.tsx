'use client'

import BotGameUploadModal from '@/components/bots/BotGameUploadModal'
import { ChatMenu } from '@/components/calls'
import { ConnectingModal } from '@/components/calls/ConnectingModal'
import { FloatingCallBar } from '@/components/calls/FloatingCallBar'
import { IntegratedCallPanel } from '@/components/calls/IntegratedCallPanel'
import { ScreenShareViewer } from '@/components/calls/ScreenShareViewer'
import { AppleEmoji } from '@/components/ui/AppleEmoji'
import { useAuth } from '@/lib/AuthContext'
import {
	assignChatToFolder,
	chatInFolder,
	createFolderId,
	loadActiveFolderId,
	loadChatFolders,
	matchesActiveFolder,
	saveActiveFolderId,
	saveChatFolders,
	type ChatFolder,
	type ChatRef
} from '@/lib/chatFolders'
import { buildChatListItems, getMessageTimestamp, formatChatDateLabel, isSameMessageCluster, type MessageGroupPosition } from '@/lib/chatMessageLayout'
import {
	canPinChats,
	sortChatsWithPinned,
	togglePinChat,
} from '@/lib/chatUtils'
import {
	applyE2eKeyExchange,
	requestE2eKeyExchange,
} from '@/lib/e2eGlobalExchange'
import {
	beginServerKeysRestore,
	ensureBackupMaterial,
	normalizeE2eKeyId,
	persistKeyLocally,
	resetE2eRestoreCache,
	restoreKeyFromServer,
} from '@/lib/e2eKeySync'
import { getEncProxyClient, isEncProxyEnabled, getEncProxyUrl } from '@/lib/encproxy'
import { useChannels } from '@/lib/hooks/useChannels'
import { decryptDmPreviewText, tryDecryptE2EPreviewWithKeyIds, useChat } from '@/lib/hooks/useChat'
import { useCommunities } from '@/lib/hooks/useCommunities'
import { useDebounce } from '@/lib/hooks/useDebounce'
import { useFileDrop } from '@/lib/hooks/useFileDrop'
import { useGroups } from '@/lib/hooks/useGroups'
import {
	channelJoinUrl,
	groupJoinUrl,
	parseInviteToken,
	serverJoinUrl,
} from '@/lib/inviteLinks'
import {
	createScheduledMessageId,
	getDueScheduledMessages,
	getPendingForTarget,
	loadScheduledMessages,
	saveScheduledMessages,
	type ScheduledMessage,
} from '@/lib/scheduledMessages'
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
import { getAttachmentUrl, getAvatarUrl, parseAsUtc } from '@/lib/utils'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import {
	Fragment,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react'
import { FiMoreVertical as MoreVertical } from 'react-icons/fi'
import {
	LuArrowLeft as ArrowLeft,
	LuCheck as Check,
	LuClock as Clock,
	LuCopy as Copy,
	LuFilter as Filter,
	LuFolder as Folder,
	LuHash as Hash,
	LuInfo as Info,
	LuLogIn as LogIn,
	LuMessageSquare as MessageSquare,
	LuMic as Mic,
	LuPaperclip as Paperclip,
	LuPhone as Phone,
	LuPlus as Plus,
	LuScreenShare as ScreenShare,
	LuSearch as Search,
	LuSend as Send,
	LuServer as Server,
	LuSmile as Smile,
	LuSticker as Sticker,
	LuSquare as Stop,
	LuTrash2 as Trash2Icon,
	LuUserPlus as UserPlus,
	LuUsers as Users,
	LuX as X,
	LuLifeBuoy as LifeBuoyIcon,
} from 'react-icons/lu'
import ChannelSettingsModal from './ChannelSettingsModal'
import ChatDateSeparator from './ChatDateSeparator'
import CommunitySettingsModal from './CommunitySettingsModal'
import SmartChatInput from './components/SmartChatInput'
import DeleteChatHistoryModal, {
	type DeleteHistoryScope,
} from './DeleteChatHistoryModal'
import DiscoveryModal from './DiscoveryModal'
import MessageBubble from './MessageBubble'
import ScheduleMessageModal from './ScheduleMessageModal'
import ProfileModal from '@/components/messenger/ProfileModal'

const formatLastSeen = (
	lastSeen?: string | Date,
	privacy?: { show_last_seen?: boolean } | null,
): string => {
	if (!lastSeen) return 'Не в сети'

	const allowShow =
		!privacy || typeof privacy !== 'object' || privacy.show_last_seen !== false
	if (!allowShow) return 'Был недавно'

	const now = new Date()
	const lastSeenDate = parseAsUtc(lastSeen)
	if (isNaN(lastSeenDate.getTime())) return 'Не в сети'
	const diffMs = now.getTime() - lastSeenDate.getTime()
	const diffMins = Math.floor(diffMs / 60000)
	const diffHours = Math.floor(diffMins / 60)
	const diffDays = Math.floor(diffHours / 24)

	if (diffMins < 1) return 'Был только что'
	if (diffMins < 60) {
		const word =
			diffMins % 10 === 1 && diffMins % 100 !== 11
				? 'минуту'
				: [2, 3, 4].includes(diffMins % 10) && ![12, 13, 14].includes(diffMins % 100)
					? 'минуты'
					: 'минут'
		return `Был ${diffMins} ${word} назад`
	}
	if (diffHours < 24) {
		const h = diffHours
		const word =
			h % 10 === 1 && h % 100 !== 11
				? 'час'
				: [2, 3, 4].includes(h % 10) && ![12, 13, 14].includes(h % 100)
					? 'часа'
					: 'часов'
		return `Был ${h} ${word} назад`
	}
	if (diffDays === 1) {
		return `Был вчера в ${lastSeenDate.toLocaleTimeString('ru-RU', {
			hour: '2-digit',
			minute: '2-digit',
		})}`
	}
	if (diffDays < 7) {
		return `Был ${lastSeenDate.toLocaleDateString('ru-RU', {
			weekday: 'long',
		})} в ${lastSeenDate.toLocaleTimeString('ru-RU', {
			hour: '2-digit',
			minute: '2-digit',
		})}`
	}

	const sameYear = lastSeenDate.getFullYear() === now.getFullYear()
	const datePart = lastSeenDate.toLocaleDateString('ru-RU', {
		day: 'numeric',
		month: 'short',
		...(sameYear ? {} : { year: 'numeric' }),
	})
	const timePart = lastSeenDate.toLocaleTimeString('ru-RU', {
		hour: '2-digit',
		minute: '2-digit',
	})
	return `Был ${datePart} в ${timePart}`
}

const getLastMessage = (
	friendId: string,
	messages: Message[],
	selfId?: string,
): string => {
	const thread = (messages || []).filter(
		m =>
			m &&
			(m.channel_id === undefined || m.channel_id === null) &&
			(m.group_id === undefined || m.group_id === null) &&
			selfId &&
			(m.sender_id === friendId || m.sender_id === selfId),
	)
	const friendMessages = selfId
		? thread
		: (messages || []).filter(
				m =>
					m &&
					(m.channel_id === undefined || m.channel_id === null) &&
					(m.group_id === undefined || m.group_id === null) &&
					m.sender_id === friendId,
			)
	if (friendMessages.length === 0) return ''

	const sorted = [...friendMessages].sort((a, b) => {
		const ta = new Date(a.timestamp || 0).getTime()
		const tb = new Date(b.timestamp || 0).getTime()
		return ta - tb
	})
	const lastMessage = sorted[sorted.length - 1]
	if (!lastMessage) return ''
	if (lastMessage.type === 'voice') return 'Голосовое сообщение'
	if (lastMessage.type === 'image') return 'Фото'
	if (lastMessage.type === 'file') return 'Файл'
	if (lastMessage.type === 'call_invite')
		return (lastMessage.content || '').slice(0, 80)

	let content = lastMessage.content || ''
	if (selfId && content.startsWith('e2e:')) {
		const keyIds = buildE2eKeyIdCandidates(
			selfId,
			friendId,
			String(lastMessage.sender_id || ''),
			String(
				(lastMessage as Message & { target_id?: string }).target_id ||
					friendId,
			),
		)
		content =
			tryDecryptE2EPreviewWithKeyIds(content, keyIds) ||
			decryptDmPreviewText(selfId, friendId, content)
	}
	if (content.startsWith('mt:')) {
		content = '🔒 Зашифрованное сообщение'
	}
	if (content.startsWith('e2e:')) {
		content = '🔐 Зашифрованное сообщение'
	}
	return content.length > 30 ? content.substring(0, 30) + '...' : content
}

function buildE2eKeyIdCandidates(
	selfId: string,
	friendId: string,
	senderId?: string,
	targetId?: string,
): string[] {
	return Array.from(
		new Set(
			[
				[selfId, friendId].filter(Boolean).sort().join(':'),
				`${selfId}:${friendId}`,
				`${friendId}:${selfId}`,
				senderId && targetId
					? [senderId, targetId].filter(Boolean).sort().join(':')
					: '',
				senderId && targetId ? `${senderId}:${targetId}` : '',
				senderId && targetId ? `${targetId}:${senderId}` : '',
			].filter(Boolean),
		),
	)
}

function decryptSidebarPreview(
	selfId: string,
	friendId: string,
	recentMeta: Record<string, unknown> | undefined,
	fallbackText: string,
): string {
	const rawCipher = String(recentMeta?.last_message_raw || '')
	const source =
		rawCipher.startsWith('e2e:') ? rawCipher : String(fallbackText || '')
	if (!source.startsWith('e2e:')) return source
	const keyIds = buildE2eKeyIdCandidates(
		selfId,
		friendId,
		String(recentMeta?.last_message_sender_id || recentMeta?.sender_id || ''),
		String(recentMeta?.last_message_target_id || recentMeta?.target_id || ''),
	)
	const decrypted = tryDecryptE2EPreviewWithKeyIds(source, keyIds)
	return decrypted || '🔐 Зашифрованное сообщение'
}

const getLastMessageTime = (friendId: string, messages: Message[]): string => {
	// Filter only direct messages (no channel_id or group_id) between current user and friend
	const friendMessages = (messages || []).filter(
		m =>
			m &&
			// Direct message: no channel or group
			(m.channel_id === undefined || m.channel_id === null) &&
			(m.group_id === undefined || m.group_id === null) &&
			// Messages from this friend in current direct context
			m.sender_id === friendId,
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

// --- Icons (react-icons) ---
const ArrowLeftIcon = ArrowLeft
const SendIcon = Send
const PaperclipIcon = Paperclip
const SmileIcon = Smile
const StickerIcon = Sticker
const XIcon = X
const MoreVerticalIcon = MoreVertical
const ScreenShareIcon = ScreenShare
const SearchIcon = Search
const UserPlusIcon = UserPlus
const FilterIcon = Filter
const UsersIcon = Users
const MessageSquareIcon = MessageSquare
const PlusIcon = Plus
const InfoIcon = Info
const HashIcon = Hash
const LogInIcon = LogIn

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
		class: 'bg-[#1a2232]',
		preview: 'bg-[#1a2232]',
		accentColor: 'text-[#2dd4a8]',
		buttonBg: 'bg-[#2dd4a8]',
		buttonHover: 'hover:bg-[#25c49d]',
		ownMessageBg: 'chat-bubble-own',
		borderColor: 'border-[#2dd4a8]/20',
		ringColor: 'focus:ring-[#2dd4a8]/50',
		gradientText: 'from-[#2dd4a8] to-[#22b893]',
	},
	{
		id: 'blue',
		name: 'Синий',
		class:
			'bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-800/30 via-[#1a2232] to-[#1a2232]',
		preview: 'bg-gradient-to-tr from-blue-600 to-[#1a2232]',
		accentColor: 'text-blue-400',
		buttonBg: 'bg-blue-600',
		buttonHover: 'hover:bg-blue-700',
		ownMessageBg: 'chat-bubble-own-blue',
		borderColor: 'border-blue-500/20',
		ringColor: 'focus:ring-blue-500/50',
		gradientText: 'from-blue-400 to-indigo-500',
	},
	{
		id: 'purple',
		name: 'Фиолетовый',
		class:
			'bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-800/30 via-[#1a2232] to-[#1a2232]',
		preview: 'bg-gradient-to-tr from-purple-600 to-[#1a2232]',
		accentColor: 'text-purple-400',
		buttonBg: 'bg-purple-600',
		buttonHover: 'hover:bg-purple-700',
		ownMessageBg: 'chat-bubble-own-purple',
		borderColor: 'border-purple-500/20',
		ringColor: 'focus:ring-purple-500/50',
		gradientText: 'from-purple-400 to-fuchsia-500',
	},
	{
		id: 'emerald',
		name: 'Изумрудный',
		class:
			'bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-800/30 via-[#1a2232] to-[#1a2232]',
		preview: 'bg-gradient-to-tr from-emerald-600 to-[#1a2232]',
		accentColor: 'text-[#2dd4a8]',
		buttonBg: 'bg-[#2dd4a8]',
		buttonHover: 'hover:bg-[#25c49d]',
		ownMessageBg: 'chat-bubble-own-emerald',
		borderColor: 'border-[#2dd4a8]/20',
		ringColor: 'focus:ring-[#2dd4a8]/50',
		gradientText: 'from-[#2dd4a8] to-teal-500',
	},
	{
		id: 'rose',
		name: 'Розовый',
		class:
			'bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-rose-800/30 via-[#1a2232] to-[#1a2232]',
		preview: 'bg-gradient-to-tr from-rose-600 to-[#1a2232]',
		accentColor: 'text-rose-400',
		buttonBg: 'bg-rose-600',
		buttonHover: 'hover:bg-rose-700',
		ownMessageBg: 'chat-bubble-own-rose',
		borderColor: 'border-rose-500/20',
		ringColor: 'focus:ring-rose-500/50',
		gradientText: 'from-rose-400 to-pink-500',
	},
]

const PhoneIcon = Phone
const MicIcon = Mic
const StopIcon = Stop
const CheckIcon = Check
const CopyIcon = Copy

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
	const [previewRevision, setPreviewRevision] = useState(0)
	const [, setLastSeenTick] = useState(0)
	const [selectedFriend, setSelectedFriend] = useState<User | null>(null)
	const [isBlockedByMeChat, setIsBlockedByMeChat] = useState(false)
	const [hasBlockedMeChat, setHasBlockedMeChat] = useState(false)
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
	const [botGameUploadOpen, setBotGameUploadOpen] = useState(false)
	const [activeBotGame, setActiveBotGame] = useState<{ embed_url: string; title?: string; download_url?: string } | null>(null)
	const [botGamesModalBotId, setBotGamesModalBotId] = useState<string | null>(
		null,
	)
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
	const activeBotsStorageKey = user?.id
		? `active_bots_${user.id}`
		: `active_bots`
	const [activeBots, setActiveBots] = useState<User[]>([])
	useEffect(() => {
		try {
			const raw = localStorage.getItem(activeBotsStorageKey)
			if (raw) {
				const parsed = JSON.parse(raw)
				if (Array.isArray(parsed)) setActiveBots(parsed)
			}
		} catch {}
	}, [activeBotsStorageKey])
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
		if (!selectedFriend || !user) {
			setIsBlockedByMeChat(false)
			setHasBlockedMeChat(false)
			return
		}
		let active = true
		const checkBlock = async () => {
			try {
				const res = await fetch('/api/users/block-status', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ user_id: selectedFriend.id }),
				})
				if (!active) return
				if (res.ok) {
					const data = await res.json()
					setIsBlockedByMeChat(Boolean(data.is_blocked_by_me))
					setHasBlockedMeChat(Boolean(data.has_blocked_me))
				}
			} catch (e) {
				console.error(e)
			}
		}
		checkBlock()
		return () => {
			active = false
		}
	}, [selectedFriend?.id, user?.id])

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
				} else {
					const data: any = await res.json().catch(() => ({}))
					const items = Array.isArray(data?.items) ? data.items : []
					if (items.length && active) {
						appendBotOutboxItems(selectedFriend.id, items)
					}
				}
			} catch {}
			if (active) {
				pollTimeout = window.setTimeout(poll, 500)
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
		searchCommunities,
		updateCommunity,
	} = communitiesHook
	const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
	const [groupParticipants, setGroupParticipants] = useState<
		Record<string, User>
	>({})
	const [channelParticipants, setChannelParticipants] = useState<
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
	const [activeTab, setActiveTab] = useState<'direct' | 'community' | 'support'>('direct')
	const [hubTab, setHubTab] = useState<'channels' | 'servers'>('channels')

	const [supportChats, setSupportChats] = useState<{id:number;question:string;status:string;created_at:number;last_message:string;last_message_at:number;last_sender:string;unread_count:number}[]>([])
	const [selectedSupportId, setSelectedSupportId] = useState<number | null>(null)
	const [supportMessages, setSupportMessages] = useState<{id:number;sender:string;content:string;created_at:number}[]>([])
	const [supportInput, setSupportInput] = useState('')
	const [supportStatus, setSupportStatus] = useState('open')
	const supportChatRef = useRef<HTMLDivElement | null>(null)
	const supportPollRef = useRef<number | null>(null)
	const lastSupportMsgIdRef = useRef(0)
	const messagesEndRef = useRef<HTMLDivElement>(null)
	const messageRefs = useRef<Record<string, HTMLDivElement | null>>({})
	const containerRef = useRef<HTMLDivElement>(null)
	const forceScrollToBottomRef = useRef(false)
	const scrollToBottomOnOpenRef = useRef(false)
	const [showScrollToBottom, setShowScrollToBottom] = useState(false)
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
		getChannelParticipants,
		searchChannels,
		updateChannel,
	} = useChannels()
	const { showToast } = useToast()
	const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
	const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false)
	const [isJoinChannelOpen, setIsJoinChannelOpen] = useState(false)
	const [isChannelInfoOpen, setIsChannelInfoOpen] = useState(false)
	const [isDiscoveryOpen, setIsDiscoveryOpen] = useState(false)
	const [isChannelSettingsOpen, setIsChannelSettingsOpen] = useState(false)
	const [isCommunitySettingsOpen, setIsCommunitySettingsOpen] = useState(false)
	const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false)
	const [isCommunityInfoOpen, setIsCommunityInfoOpen] = useState(false)

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
				supportId?: number
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
			params.delete('support_id')
			if (next?.botId) params.set('bot_id', next.botId)
			if (next?.directId) params.set('direct_id', next.directId)
			if (next?.groupId) params.set('group_id', next.groupId)
			if (next?.channelId) params.set('channel_id', next.channelId)
			if (next?.serverId) params.set('server_id', next.serverId)
			if (next?.supportId) params.set('support_id', String(next.supportId))
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
	const [archivedChatIds, setArchivedChatIds] = useState<string[]>(() => {
		if (typeof window !== 'undefined') {
			const saved = localStorage.getItem('archived_chats')
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
	const [showArchivedChats, setShowArchivedChats] = useState(false)
	const [chatFolders, setChatFolders] = useState<ChatFolder[]>(() =>
		loadChatFolders(),
	)
	const [activeFolderId, setActiveFolderId] = useState(() => loadActiveFolderId())
	const [isFoldersManageOpen, setIsFoldersManageOpen] = useState(false)
	const [newFolderName, setNewFolderName] = useState('')
	const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>(
		() => loadScheduledMessages(),
	)
	const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)

	// Save pinned chats to localStorage when changed
	useEffect(() => {
		if (typeof window !== 'undefined') {
			localStorage.setItem('pinned_chats', JSON.stringify(pinnedChatIds))
		}
	}, [pinnedChatIds])
	useEffect(() => {
		if (typeof window !== 'undefined') {
			localStorage.setItem('archived_chats', JSON.stringify(archivedChatIds))
		}
	}, [archivedChatIds])
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

	const loadSupportChats = async () => {
		try {
			const res = await fetch('/api/support/messenger/chats')
			const text = await res.text()
			let data: any = {}
			try { data = JSON.parse(text) } catch { return }
			if (data?.ok && Array.isArray(data.chats)) {
				setSupportChats(data.chats)
			}
		} catch {}
	}

	const loadSupportMessages = async (escId: number, sinceId = 0) => {
		try {
			const url = sinceId > 0
				? `/api/support/messenger/${escId}/messages?since_id=${sinceId}`
				: `/api/support/messenger/${escId}/messages`
			const res = await fetch(url)
			const text = await res.text()
			let data: any = {}
			try { data = JSON.parse(text) } catch { return }
			if (data?.ok && Array.isArray(data.messages)) {
				if (sinceId > 0) {
					setSupportMessages(prev => {
						const existingIds = new Set(prev.map(m => m.id))
						const newMsgs = data.messages.filter((m: {id:number}) => !existingIds.has(m.id))
						return newMsgs.length > 0 ? [...prev, ...newMsgs] : prev
					})
				} else {
					setSupportMessages(data.messages)
				}
				if (data.status) setSupportStatus(data.status)
				const maxId = Math.max(...data.messages.map((m: {id:number}) => m.id), 0)
				if (maxId > lastSupportMsgIdRef.current) lastSupportMsgIdRef.current = maxId
			}
		} catch {}
	}

	const sendSupportMessage = async () => {
		if (!selectedSupportId || !supportInput.trim() || supportStatus === 'closed') return
		const text = supportInput.trim()
		setSupportInput('')
		const tempId = Date.now()
		setSupportMessages(prev => [
			...prev,
			{ id: tempId, sender: 'user', content: text, created_at: Date.now() },
		])
		try {
			const res = await fetch(`/api/support/messenger/${selectedSupportId}/send`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: text }),
			})
			const data = await res.json()
			if (data?.ok && data?.id) {
				setSupportMessages(prev =>
					prev.map(m => m.id === tempId ? { ...m, id: data.id } : m)
				)
				lastSupportMsgIdRef.current = data.id
			}
		} catch {}
	}

	useEffect(() => {
		loadSupportChats()
	}, [activeTab === 'support'])

	useEffect(() => {
		if (selectedSupportId) {
			lastSupportMsgIdRef.current = 0
			loadSupportMessages(selectedSupportId)
			if (supportPollRef.current) window.clearInterval(supportPollRef.current)
			supportPollRef.current = window.setInterval(() => {
				if (selectedSupportId) {
					loadSupportMessages(selectedSupportId, lastSupportMsgIdRef.current)
				}
			}, 3000)
		} else {
			if (supportPollRef.current) {
				window.clearInterval(supportPollRef.current)
				supportPollRef.current = null
			}
		}
		return () => {
			if (supportPollRef.current) {
				window.clearInterval(supportPollRef.current)
				supportPollRef.current = null
			}
		}
	}, [selectedSupportId])

	const supportChatsPollRef = useRef<number | null>(null)
	useEffect(() => {
		if (activeTab === 'support') {
			loadSupportChats()
			if (supportChatsPollRef.current) window.clearInterval(supportChatsPollRef.current)
			supportChatsPollRef.current = window.setInterval(loadSupportChats, 10000)
		} else {
			if (supportChatsPollRef.current) {
				window.clearInterval(supportChatsPollRef.current)
				supportChatsPollRef.current = null
			}
		}
		return () => {
			if (supportChatsPollRef.current) {
				window.clearInterval(supportChatsPollRef.current)
				supportChatsPollRef.current = null
			}
		}
	}, [activeTab === 'support'])

	useEffect(() => {
		if (!supportChatRef.current) return
		supportChatRef.current.scrollTop = supportChatRef.current.scrollHeight
	}, [supportMessages.length, selectedSupportId])

	useEffect(() => {
		const params = new URLSearchParams(window.location.search)
		const supportId = params.get('support_id')
		if (supportId) {
			const numId = Number(supportId)
			if (numId > 0) {
				setSelectedSupportId(numId)
				setActiveTab('support')
				setSelectedFriend(null)
				setSelectedChannel(null)
				setSelectedGroup(null)
			}
		}
	}, [])

	const deleteSupportChat = async (escId: number) => {
		try {
			const res = await fetch('/api/support/chats/delete', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ escId }),
			})
			const data = await res.json()
			if (res.ok && data?.ok) {
				setSupportChats(prev => prev.filter(c => c.id !== escId))
				if (selectedSupportId === escId) {
					setSelectedSupportId(null)
					setSupportMessages([])
				}
			}
		} catch {}
	}

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

	const addDroppedFiles = useCallback((list: File[]) => {
		if (list.length === 0) return
		setFiles(prev => [...prev, ...list])
	}, [])

	const { dragOver: composerDragOver, dropHandlers: composerDropHandlers } =
		useFileDrop(addDroppedFiles)

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
	const [isE2eKeyModalOpen, setIsE2eKeyModalOpen] = useState(false)
	const [e2eKeyPassword, setE2eKeyPassword] = useState('')
	const [e2eKeyRevealed, setE2eKeyRevealed] = useState<string | null>(null)
	const [e2eKeyVerifyError, setE2eKeyVerifyError] = useState<string | null>(
		null,
	)
	const [isVerifyingE2ePassword, setIsVerifyingE2ePassword] = useState(false)
	const [deleteHistoryModalOpen, setDeleteHistoryModalOpen] = useState(false)
	const [isDeletingHistory, setIsDeletingHistory] = useState(false)
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
		}
		if (savedThemeId) {
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

	const isStandaloneChannel =
		!!selectedChannel?.id && !selectedChannel.community_id && !selectedCommunity?.id

	useEffect(() => {
		const fetchParticipants = async () => {
			if (!isStandaloneChannel || !selectedChannel?.id) {
				setChannelParticipants({})
				return
			}
			try {
				const participants = await getChannelParticipants(selectedChannel.id)
				const participantsMap = participants.reduce(
					(acc: Record<string, User>, u: User) => {
						if (u?.id) acc[String(u.id)] = u
						return acc
					},
					{},
				)
				if (user?.id) {
					participantsMap[String(user.id)] = {
						...(participantsMap[String(user.id)] || {}),
						id: String(user.id),
						username: user.username || participantsMap[String(user.id)]?.username,
						avatar_url:
							user.avatar_url || participantsMap[String(user.id)]?.avatar_url,
					} as User
				}
				setChannelParticipants(participantsMap)
			} catch (e) {
				console.error('Failed to fetch channel participants', e)
			}
		}
		fetchParticipants()
	}, [isStandaloneChannel, selectedChannel?.id, getChannelParticipants, user?.id, user?.username, user?.avatar_url])

	useEffect(() => {
		if (!isStandaloneChannel || !selectedChannel?.id) return
		let cancelled = false
		;(async () => {
			const info = await getChannelInfo(selectedChannel.id)
			if (!cancelled && info?.id) {
				setSelectedChannel(prev =>
					prev?.id === info.id ? { ...prev, ...info } : prev,
				)
			}
		})()
		return () => {
			cancelled = true
		}
	}, [isStandaloneChannel, selectedChannel?.id, getChannelInfo])

	useEffect(() => {
		saveChatFolders(chatFolders)
	}, [chatFolders])

	useEffect(() => {
		saveActiveFolderId(activeFolderId)
	}, [activeFolderId])

	useEffect(() => {
		saveScheduledMessages(scheduledMessages)
	}, [scheduledMessages])

	const getCurrentChatTarget = useCallback((): ScheduledMessage['target'] | null => {
		if (selectedFriend?.id) {
			return { type: 'user', id: String(selectedFriend.id) }
		}
		if (selectedGroup?.id) {
			return { type: 'group', id: String(selectedGroup.id) }
		}
		if (isStandaloneChannel && selectedChannel?.id) {
			return { type: 'channel', id: String(selectedChannel.id) }
		}
		return null
	}, [selectedFriend?.id, selectedGroup?.id, isStandaloneChannel, selectedChannel?.id])

	const pendingScheduledForChat = useMemo(() => {
		const target = getCurrentChatTarget()
		if (!target) return []
		return getPendingForTarget(scheduledMessages, target)
	}, [scheduledMessages, getCurrentChatTarget])

	const moveChatToFolder = useCallback(
		(ref: ChatRef, folderId: string | null) => {
			setChatFolders(prev => assignChatToFolder(prev, ref, folderId))
		},
		[],
	)

	const openStandaloneChannel = useCallback(
		(channel: Channel) => {
			setSelectedChannel(channel)
			setSelectedFriend(null)
			setSelectedGroup(null)
			setSelectedCommunity(null)
			setSelectedCommunityId('')
			setIsChatSearchOpen(false)
			setChatSearchQuery('')
			setFoundMessages([])
			void getChannelInfo(channel.id).then(info => {
				if (info?.id) {
					setSelectedChannel(prev =>
						prev?.id === info.id ? { ...prev, ...info } : prev,
					)
				}
			})
		},
		[getChannelInfo],
	)

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
			showToast('Сервер успешно создан!', 'success')
		} catch (e) {
			console.error(e)
			showToast('Не удалось создать сервер', 'error')
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
			showToast('Канал на сервере создан!', 'success')
		} catch (e) {
			console.error(e)
			showToast('Не удалось создать канал', 'error')
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
			const channel = await joinChannel(parseInviteToken(joinInviteCode))
			setIsJoinChannelOpen(false)
			setJoinInviteCode('')
			setSelectedChannel(channel)
			setSelectedFriend(null)
			setSelectedGroup(null)
			showToast('Вы вступили в канал!', 'success')
		} catch (e) {
			console.error(e)
			showToast('Неверная ссылка приглашения', 'error')
		}
	}

	const handleJoinGroup = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!joinGroupInviteCode.trim()) return

		try {
			const group = await joinGroup(parseInviteToken(joinGroupInviteCode))
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
		const token = parseInviteToken(joinCommunityInviteCode)
		if (!token) return

		try {
			const community = await joinCommunity(token)
			setSelectedCommunity(community)
			setSelectedCommunityId(community.id)
			setSelectedFriend(null)
			setSelectedChannel(null)
			setSelectedGroup(null)
			setIsJoinCommunityOpen(false)
			setJoinCommunityInviteCode('')
			setActiveTab('community')
			showToast('Вы вступили на сервер!', 'success')
		} catch (e: any) {
			console.error(e)
			showToast('Не удалось вступить на сервер', 'error')
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
			showToast('Не удалось получить ссылку приглашения', 'error')
		}
	}

	const handleAddMember = async (userId: string) => {
		const entity = selectedGroup || selectedChannel || selectedCommunity
		if (!entity) return
		try {
			let inviteCode: string | undefined
			let entityType = 'группе'
			let entityName = entity.name

			if (selectedGroup) {
				const details = await getGroupDetails(selectedGroup.id)
				inviteCode = details?.invite_code
				entityType = 'группе'
			} else if (selectedChannel) {
				const details = await getChannelInfo(selectedChannel.id)
				inviteCode = details?.invite_code
				entityType = 'каналу'
			} else if (selectedCommunity) {
				const details = await getCommunityDetails(selectedCommunity.id)
				inviteCode = details?.invite_code
				entityType = 'серверу'
			}

			if (!inviteCode) {
				throw new Error('Не удалось получить ссылку приглашения')
			}

			const inviteLink = selectedGroup
				? groupJoinUrl(inviteCode)
				: selectedChannel
					? channelJoinUrl(inviteCode)
					: serverJoinUrl(inviteCode)

			if (socket) {
				socket.emit('send_message', {
					target_user_id: userId,
					content: `Привет! Присоединяйся к ${entityType} "${entityName}"!\n${inviteLink}`,
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
	const isBlockedChat =
		!!selectedFriend && Boolean((selectedFriend as any).is_blocked)
	const isBlockedUserChat = isBlockedByMeChat || hasBlockedMeChat
	const targetUserId = selectedFriend?.id
	const hasActiveChat = !!(selectedFriend || selectedChannel || selectedGroup || selectedSupportId)
	const isCommunityChannelActive =
		!!selectedCommunity?.id || !!selectedChannel?.community_id
	const canWriteToSelectedChannel = !selectedChannel
		? true
		: isCommunityChannelActive
			? true
			: selectedChannel.type !== 'broadcast' ||
				!selectedChannel.owner_id ||
				!user?.id ||
				String(selectedChannel.owner_id) === String(user.id)
	const accessToken = (user as any)?.access_token as string | undefined
	const [secretChatEnabled, setSecretChatEnabled] = useState(false)
	const [isEncProxyActive, setIsEncProxyActive] = useState(false)

	useEffect(() => {
		setIsEncProxyActive(isEncProxyEnabled())
		const client = getEncProxyClient()
		const unsub = client.on('statusChange', (s) => {
			setIsEncProxyActive(s === 'connected')
		})
		const encProxyUrl = getEncProxyUrl()
		if (encProxyUrl && user?.id && accessToken) {
			client.connect({
				serverUrl: encProxyUrl,
				accessToken,
				userId: String(user.id),
			})
		}
		return unsub
	}, [user?.id, accessToken])

	useEffect(() => {
		if (!selectedFriend?.id || isAiChat || isBotChat || !accessToken) {
			setSecretChatEnabled(false)
			return
		}
		let cancelled = false
		;(async () => {
			try {
				const res = await fetch(
					`/api/v1/dm/${selectedFriend.id}/settings`,
					{ headers: { Authorization: `Bearer ${accessToken}` } },
				)
				if (!res.ok || cancelled) return
				const data = await res.json()
				if (!cancelled) setSecretChatEnabled(Boolean(data.is_secret))
			} catch {
				if (!cancelled) setSecretChatEnabled(false)
			}
		})()
		return () => {
			cancelled = true
		}
	}, [selectedFriend?.id, isAiChat, isBotChat, accessToken])

	const toggleSecretChat = async () => {
		if (!selectedFriend?.id || isAiChat || isBotChat || !accessToken) return
		const next = !secretChatEnabled
		try {
			const res = await fetch(
				`/api/v1/dm/${selectedFriend.id}/settings`,
				{
					method: 'PATCH',
					headers: {
						Authorization: `Bearer ${accessToken}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ is_secret: next }),
				},
			)
			if (!res.ok) {
				showToast('Не удалось изменить режим чата', 'error')
				return
			}
			setSecretChatEnabled(next)
			setRecentContacts(prev =>
				prev.map(c =>
					String(c.id) === String(selectedFriend.id)
						? { ...c, is_secret: next }
						: c,
				),
			)
			showToast(
				next
					? 'Секретный чат: сквозное шифрование (E2E)'
					: 'Облачный чат: стандартное шифрование на сервере',
				'success',
			)
		} catch {
			showToast('Не удалось изменить режим чата', 'error')
		}
	}

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
		secretChatEnabled,
	)
	const messages = isBotChat ? botMessages : chatMessages
	const isChatLoading = isBotChat ? false : isLoading
	const isChatTyping = isBotChat ? false : isTyping

	const mentionUsers = useMemo(() => {
		if (selectedGroup) {
			return Object.values(groupParticipants)
		}
		if (selectedChannel) {
			return Object.values(channelParticipants)
		}
		if (selectedFriend) {
			return [selectedFriend]
		}
		return []
	}, [selectedGroup, groupParticipants, selectedChannel, channelParticipants, selectedFriend, user])

	const dispatchScheduledMessage = useCallback(
		(item: ScheduledMessage) => {
			if (item.target.type === 'user') {
				if (selectedFriend?.id !== item.target.id) return false
			} else if (item.target.type === 'group') {
				if (selectedGroup?.id !== item.target.id) return false
			} else if (item.target.type === 'channel') {
				if (selectedChannel?.id !== item.target.id) return false
			}
			sendChatMessage(item.content, 'text', undefined, item.replyToId)
			return true
		},
		[selectedFriend?.id, selectedGroup?.id, selectedChannel?.id, sendChatMessage],
	)

	useEffect(() => {
		const tick = () => {
			const due = getDueScheduledMessages(scheduledMessages)
			if (!due.length) return
			const sentIds: string[] = []
			for (const item of due) {
				if (dispatchScheduledMessage(item)) {
					sentIds.push(item.id)
				}
			}
			if (sentIds.length) {
				setScheduledMessages(prev => prev.filter(m => !sentIds.includes(m.id)))
				showToast(`Отправлено отложенных: ${sentIds.length}`, 'success')
			}
		}
		tick()
		const id = window.setInterval(tick, 5000)
		return () => window.clearInterval(id)
	}, [scheduledMessages, dispatchScheduledMessage, showToast])

	useEffect(() => {
		if (!isStandaloneChannel || !messages.length) return
		setChannelParticipants(prev => {
			const next = { ...prev }
			let changed = false
			for (const msg of messages) {
				const sid = String(msg.sender_id || '')
				if (!sid || next[sid]) continue
				const friend = friends.find(f => String(f.id) === sid)
				if (friend) {
					next[sid] = friend
					changed = true
				}
			}
			return changed ? next : prev
		})
	}, [messages, isStandaloneChannel, friends])

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

	// Refresh relative last-seen labels (e.g. "5 минут назад")
	useEffect(() => {
		const interval = setInterval(() => setLastSeenTick(t => t + 1), 60_000)
		return () => clearInterval(interval)
	}, [])

	// Listen for user status updates
	useEffect(() => {
		if (!socket) return

		const handleStatusChange = (data: { user_id: string; status: string; last_seen?: string }) => {
			console.log('User status changed:', data)
			setFriends(prev =>
				prev.map(friend =>
					friend.id === data.user_id
						? {
								...friend,
								status: data.status,
								last_seen:
									data.status.toLowerCase() === 'offline'
										? data.last_seen ?? friend.last_seen
										: friend.last_seen,
							}
						: friend,
				),
			)
			setRecentContacts(prev =>
				prev.map(contact =>
					contact.id === data.user_id
						? {
								...contact,
								status: data.status,
								last_seen:
									data.status.toLowerCase() === 'offline'
										? data.last_seen ?? contact.last_seen
										: contact.last_seen,
							}
						: contact,
				),
			)
			setSelectedFriend(prev => {
				if (prev && prev.id === data.user_id) {
					return {
						...prev,
						status: data.status,
						last_seen:
							data.status.toLowerCase() === 'offline'
								? data.last_seen ?? prev.last_seen
								: prev.last_seen,
					}
				}
				return prev
			})
		}

		const handleUserConnected = (data: { user_id: string }) => {
			handleStatusChange({ user_id: data.user_id, status: 'Online' })
		}

		const handleUserDisconnected = (data: { user_id: string; last_seen?: string }) => {
			handleStatusChange({ user_id: data.user_id, status: 'Offline', last_seen: data.last_seen })
		}

		const handleOnlineUsers = (data: Array<{ user_id: string; last_seen?: string } | string>) => {
			const onlineIds = new Set<string>()
			const lastSeenMap = new Map<string, string>()
			for (const item of data) {
				if (typeof item === 'string') {
					onlineIds.add(item)
				} else if (item?.user_id) {
					onlineIds.add(item.user_id)
					if (item.last_seen) lastSeenMap.set(item.user_id, item.last_seen)
				}
			}
			const patchUser = (u: User): User => {
				if (onlineIds.has(u.id)) return { ...u, status: 'Online' }
				return {
					...u,
					status: 'Offline',
					last_seen: lastSeenMap.get(u.id) || u.last_seen,
				}
			}
			setFriends(prev => prev.map(patchUser))
			setRecentContacts(prev => prev.map(patchUser))
			setSelectedFriend(prev => (prev ? patchUser(prev) : prev))
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

		socket.on('user_status_changed', handleStatusChange)
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
			socket.off('user_status_changed', handleStatusChange)
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

	// Сброс чатов при смене аккаунта (не показывать статусы прошлой сессии)
	useEffect(() => {
		if (!user?.id) return
		setSelectedFriend(null)
		setSelectedUserForModal(null)
		setFriends([])
		setRecentContacts([])
	}, [user?.id])

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
			const res = await fetch(`/api/v1/dm/recent?limit=30`, {
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
			setPreviewRevision(v => v + 1)
			// Decrypt E2E previews immediately after fetch
			if (user?.id && cleaned.length > 0) {
				const myId = String(user.id)
				;(async () => {
					let updated = false
					const nextContacts = cleaned.map((c: any) => ({ ...c }))
					for (let i = 0; i < nextContacts.length; i++) {
						const contact = nextContacts[i]
						const raw = String(contact.last_message_raw || '')
						if (!raw.startsWith('e2e:')) continue
						const peerId = String(contact.id)
						const keyIds = buildE2eKeyIdCandidates(myId, peerId)
						let decrypted = tryDecryptE2EPreviewWithKeyIds(raw, keyIds)
						if (!decrypted) {
							try {
								const keyId = normalizeE2eKeyId(
									[myId, peerId].sort().join(':'),
								)
								const keyBytes = await restoreKeyFromServer(
									accessToken,
									keyId,
									myId,
								)
								if (keyBytes) {
									persistKeyLocally(keyId, keyBytes)
									decrypted = tryDecryptE2EPreviewWithKeyIds(raw, keyIds)
								}
							} catch {
								// ignore
							}
						}
						if (decrypted) {
							const newText =
								decrypted.length > 120
									? `${decrypted.slice(0, 120)}…`
									: decrypted
							const currentText = String(
								contact.last_message_text || '',
							)
							if (currentText !== newText) {
								nextContacts[i] = {
									...contact,
									last_message_text: newText,
								}
								updated = true
							}
						}
					}
					if (updated) {
						setRecentContacts(nextContacts)
						setPreviewRevision(v => v + 1)
					}
				})()
			}
		} catch {}
	}, [accessToken, user?.id, aiUser?.id, buildE2eKeyIdCandidates, normalizeE2eKeyId, persistKeyLocally, tryDecryptE2EPreviewWithKeyIds, restoreKeyFromServer])

	useEffect(() => {
		let active = true
		fetchRecent()
		return () => {
			active = false
		}
	}, [fetchRecent])

	// E2E: restore all keys so DM previews decrypt in list.
	useEffect(() => {
		if (!accessToken || !user?.id) return
		let cancelled = false
		const base64FromBytes = (bytes: Uint8Array) => {
			let binary = ''
			for (let i = 0; i < bytes.length; i++) {
				binary += String.fromCharCode(bytes[i])
			}
			return btoa(binary)
		}
		;(async () => {
			try {
				resetE2eRestoreCache()
				await ensureBackupMaterial(accessToken, user.id)
				const keys = await beginServerKeysRestore(accessToken, user.id)
				if (cancelled) return
				for (const [keyId, keyBytes] of keys.entries()) {
					try {
						localStorage.setItem(`e2e_key_${keyId}`, base64FromBytes(keyBytes))
					} catch {
						// ignore storage errors
					}
				}
				if (!cancelled) {
					await fetchRecent()
					setPreviewRevision(v => v + 1)
					window.dispatchEvent(new CustomEvent('e2e-keys-updated'))
				}
			} catch {
				// ignore
			}
		})()
		return () => {
			cancelled = true
		}
	}, [accessToken, user?.id])

	// Decrypt E2E previews in sidebar list after recent contacts load
	useEffect(() => {
		if (!accessToken || !user?.id || recentContacts.length === 0) return
		let cancelled = false
		const myId = String(user.id)

		const decryptAll = async () => {
			let updated = false
			const nextContacts = recentContacts.map(c => ({
				...c,
			})) as Array<User & Record<string, unknown>>

			for (let i = 0; i < nextContacts.length; i++) {
				const contact = nextContacts[i]
				const raw = String(
					(contact as Record<string, unknown>).last_message_raw || '',
				)
				if (!raw.startsWith('e2e:')) continue

				const peerId = String(contact.id)
				const keyIds = buildE2eKeyIdCandidates(myId, peerId)
				let decrypted = tryDecryptE2EPreviewWithKeyIds(raw, keyIds)

				if (!decrypted) {
					try {
						const keyId = normalizeE2eKeyId(
							[myId, peerId].sort().join(':'),
						)
						const keyBytes = await restoreKeyFromServer(
							accessToken,
							keyId,
							myId,
						)
						if (keyBytes) {
							persistKeyLocally(keyId, keyBytes)
							decrypted = tryDecryptE2EPreviewWithKeyIds(raw, keyIds)
						}
					} catch {
						// ignore
					}
				}

				if (decrypted && !cancelled) {
					const newText =
						decrypted.length > 120
							? `${decrypted.slice(0, 120)}…`
							: decrypted
					const currentText = String(
						(contact as Record<string, unknown>).last_message_text ||
							'',
					)
					if (currentText !== newText) {
						nextContacts[i] = {
							...(contact as User & Record<string, unknown>),
							last_message_text: newText,
						} as User & Record<string, unknown>
						updated = true
					}
				}
			}

			if (updated && !cancelled) {
				setRecentContacts(nextContacts)
				setPreviewRevision(v => v + 1)
			}
		}

		decryptAll()

		return () => {
			cancelled = true
		}
	}, [recentContacts, accessToken, user?.id])

	// Listen for new messages — обновляем превью сразу (как в Telegram)
	useEffect(() => {
		if (!socket || !user?.id) return
		const myId = String(user.id)

		const bumpPreview = () => setPreviewRevision(v => v + 1)

		const tryRestoreAndDecrypt = async (
			peerId: string,
			cipher: string,
		): Promise<string | null> => {
			if (!cipher.startsWith('e2e:') || !accessToken) return null
			const keyId = normalizeE2eKeyId([myId, peerId].sort().join(':'))
			const keyBytes = await restoreKeyFromServer(accessToken, keyId, myId)
			if (!keyBytes) {
				await requestE2eKeyExchange(socket, myId, peerId)
				return null
			}
			persistKeyLocally(keyId, keyBytes)
			const decrypted = tryDecryptE2EPreviewWithKeyIds(cipher, buildE2eKeyIdCandidates(myId, peerId))
			if (decrypted) bumpPreview()
			return decrypted
		}

		const patchContactPreview = (
			peerId: string,
			content: string,
			senderId: string,
			targetId: string,
			timestamp?: string,
			incrementUnread?: boolean,
		) => {
			const cipher = String(content || '')
			setRecentContacts(prev => {
				const exists = prev.some(c => String(c.id) === peerId)
				const list = exists
					? prev
					: [
							...prev,
							{
								id: peerId,
								username: peerId,
							} as User,
						]
				return list.map(contact => {
					if (String(contact.id) !== peerId) return contact
					const isOpen =
						!!selectedFriend?.id &&
						String(selectedFriend.id) === peerId
					const meta = contact as User & Record<string, unknown>
					let previewText = cipher
					if (cipher.startsWith('e2e:')) {
						previewText =
							decryptSidebarPreview(myId, peerId, {
								last_message_raw: cipher,
								last_message_sender_id: senderId,
								last_message_target_id: targetId,
							}, cipher) || '🔐 Зашифрованное сообщение'
					} else if (cipher.length > 120) {
						previewText = `${cipher.slice(0, 120)}…`
					}
					return {
						...meta,
						last_message_text: previewText,
						last_message_raw: cipher,
						last_message_sender_id: senderId,
						last_message_target_id: targetId,
						last_message_at:
							timestamp || new Date().toISOString(),
						unread_count: incrementUnread && !isOpen
							? Number(meta.unread_count || 0) + 1
							: isOpen
								? 0
								: Number(meta.unread_count || 0),
					}
				})
			})
			bumpPreview()
			if (cipher.startsWith('e2e:')) {
				void tryRestoreAndDecrypt(peerId, cipher).then(dec => {
					if (!dec) return
					setRecentContacts(prev =>
						prev.map(contact => {
							if (String(contact.id) !== peerId) return contact
							return {
								...(contact as User & Record<string, unknown>),
								last_message_text:
									dec.length > 120
										? `${dec.slice(0, 120)}…`
										: dec,
							}
						}),
					)
					bumpPreview()
				})
			}
		}

		const handleReceiveRealtime = (data: Record<string, unknown>) => {
			if (!data || data.channel_id || data.group_id) return
			const senderId = String(data.sender_id || '')
			const targetId = String(
				data.target_id || data.target_user_id || '',
			)
			if (!senderId || targetId !== myId) return
			patchContactPreview(
				senderId,
				String(data.content || ''),
				senderId,
				targetId,
				String(data.timestamp || ''),
				true,
			)
		}

		const handleSentRealtime = (payload: Record<string, unknown>) => {
			const data = (payload?.message || payload) as Record<string, unknown>
			if (!data || data.channel_id || data.group_id) return
			const senderId = String(data.sender_id || '')
			const targetId = String(
				data.target_id || data.target_user_id || '',
			)
			if (!senderId || senderId !== myId || !targetId) return
			patchContactPreview(
				targetId,
				String(data.content || ''),
				senderId,
				targetId,
				String(data.timestamp || ''),
				false,
			)
		}

		const handleKeyExchange = async (data: Record<string, unknown>) => {
			const fromId = String(data.from_user_id || '')
			const peerIsSecret = recentContacts.some(
				c => String(c.id) === fromId && (c as any).is_secret,
			)
			const activeSecret =
				selectedFriend?.id === fromId && secretChatEnabled
			if (!peerIsSecret && !activeSecret) return

			const ok = await applyE2eKeyExchange(
				socket,
				data,
				myId,
				accessToken || '',
				{ activeDmPeerId: selectedFriend?.id ?? null },
			)
			if (ok) bumpPreview()
		}

		const handleKeysUpdated = () => bumpPreview()

		socket.on('receive_message', handleReceiveRealtime)
		socket.on('message_sent', handleSentRealtime)
		socket.on('e2e_key_exchange', handleKeyExchange)
		window.addEventListener('e2e-keys-updated', handleKeysUpdated)

		if (isEncProxyEnabled()) {
			const encProxyClient = getEncProxyClient()
			const unsubMsg = encProxyClient.on('message', (msg) => {
				const syntheticPayload = {
					id: `encproxy_${Date.now()}_${Math.random().toString(36).slice(2)}`,
					sender_id: msg.from_user_id,
					content: msg.encrypted_content,
					attachments: msg.encrypted_attachments || '',
					target_id: myId,
					timestamp: msg.timestamp || Date.now(),
					type: msg.message_type || 'text',
					reply_to: msg.reply_to || null,
				}
				handleReceiveRealtime(syntheticPayload)
			})
			const unsubKey = encProxyClient.on('keyExchange', (data) => {
				handleKeyExchange({
					from_user_id: data.from_user_id,
					public_key: data.public_key,
					key_id: data.key_id,
					type: data.type,
				})
			})
			return () => {
				socket.off('receive_message', handleReceiveRealtime)
				socket.off('message_sent', handleSentRealtime)
				socket.off('e2e_key_exchange', handleKeyExchange)
				window.removeEventListener('e2e-keys-updated', handleKeysUpdated)
				unsubMsg()
				unsubKey()
			}
		}

		return () => {
			socket.off('receive_message', handleReceiveRealtime)
			socket.off('message_sent', handleSentRealtime)
			socket.off('e2e_key_exchange', handleKeyExchange)
			window.removeEventListener('e2e-keys-updated', handleKeysUpdated)
		}
	}, [socket, user?.id, accessToken, selectedFriend?.id, secretChatEnabled, recentContacts])

	useEffect(() => {
		if (!selectedFriend?.id) return
		const selectedId = String(selectedFriend.id)
		setRecentContacts(prev =>
			prev.map(contact =>
				String(contact.id) === selectedId
					? { ...(contact as User & { unread_count?: number }), unread_count: 0 }
					: contact,
			),
		)
	}, [selectedFriend?.id])

	useEffect(() => {
		setPreviewRevision(v => v + 1)
	}, [messages])

	useEffect(() => {
		if (typeof window === 'undefined') return
		const params = new URLSearchParams(window.location.search)
		const joinGroupCode = params.get('join_group')
		const joinChannelCode = params.get('join_channel')
		const joinCommunityCode = params.get('join_community')
		if (joinCommunityCode) {
			window.location.replace(serverJoinUrl(joinCommunityCode))
			return
		}
		if (joinChannelCode) {
			window.location.replace(channelJoinUrl(joinChannelCode))
			return
		}
		if (joinGroupCode) {
			window.location.replace(groupJoinUrl(joinGroupCode))
			return
		}
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
									owner_id: community.owner_id || '',
									participants_count: 0,
									type: 'text',
									community_id: community.id,
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
					last_seen: data.last_seen ?? undefined,
					privacy_settings: data.privacy_settings,
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
		if (selectedSupportId) {
			updateChatUrl({ supportId: selectedSupportId })
			return
		}
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
		selectedSupportId,
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

	const resetE2eKeyModal = useCallback(() => {
		setIsE2eKeyModalOpen(false)
		setE2eKeyPassword('')
		setE2eKeyRevealed(null)
		setE2eKeyVerifyError(null)
		setIsVerifyingE2ePassword(false)
	}, [])

	const getLocalE2eKeyForChat = useCallback(() => {
		if (!user?.id || !selectedFriend?.id) return null
		const keyId = normalizeE2eKeyId(
			[String(user.id), String(selectedFriend.id)].sort().join(':'),
		)
		return (
			localStorage.getItem(`e2e_key_${keyId}`) ||
			sessionStorage.getItem(`e2e_key_${keyId}`)
		)
	}, [user?.id, selectedFriend?.id])

	const handleVerifyE2eKeyPassword = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!accessToken || !e2eKeyPassword.trim()) return

		setIsVerifyingE2ePassword(true)
		setE2eKeyVerifyError(null)
		try {
			const res = await fetch('/api/v1/auth/verify-password', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${accessToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ password: e2eKeyPassword }),
			})
			if (!res.ok) {
				setE2eKeyVerifyError('Неверный пароль')
				return
			}
			const key = getLocalE2eKeyForChat()
			if (!key) {
				setE2eKeyVerifyError(
					'Ключ шифрования не найден на этом устройстве. Дождитесь обмена ключами.',
				)
				return
			}
			setE2eKeyRevealed(key)
		} catch {
			setE2eKeyVerifyError('Не удалось проверить пароль')
		} finally {
			setIsVerifyingE2ePassword(false)
		}
	}

	useEffect(() => {
		resetE2eKeyModal()
	}, [selectedFriend?.id, resetE2eKeyModal])

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

	const handleBotModal = useCallback((botId: string, modal: string) => {
		setBotGamesModalBotId(botId)
		if (modal === 'upload_game') {
			setBotGameUploadOpen(true)
		}
	}, [])

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
					type: item?.game ? 'game' : (item?.type || 'text'),
					game: item?.game || undefined,
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
			if (selectedFriend && selectedFriend.is_bot === true && selectedFriend.id !== botUser.id) {
				setActiveBots(prev => {
					if (prev.some(b => b.id === selectedFriend.id)) return prev
					const next = [...prev, selectedFriend]
					try { localStorage.setItem(activeBotsStorageKey, JSON.stringify(next)) } catch {}
					return next
				})
			}
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
							const backendUrl = ''
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
		if (selectedSupportId) {
			sendSupportMessage()
			return
		}
		if (isAiChat) {
			sendAiMessage()
			return
		}
		if (isBotChat) {
			sendBotMessage()
			return
		}
		if (!canWriteToSelectedChannel) {
			showToast(
				isCommunityChannelActive
					? 'Нет доступа к каналу сообщества'
					: 'В этом канале писать может только владелец',
				'error',
			)
			return
		}
		if (isBlockedChat || isBlockedUserChat) {
			if (isBlockedByMeChat) {
				showToast('Вы заблокировали этого пользователя', 'error')
			} else if (hasBlockedMeChat) {
				showToast('Пользователь заблокировал вас', 'error')
			} else {
				showToast('Пользователь заблокирован, отправка сообщений недоступна', 'error')
			}
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
		if (!canWriteToSelectedChannel) {
			showToast('В этом канале писать может только владелец', 'error')
			setIsPickerOpen(false)
			return
		}
		if (isBlockedChat || isBlockedUserChat) {
			if (isBlockedByMeChat) {
				showToast('Вы заблокировали этого пользователя', 'error')
			} else if (hasBlockedMeChat) {
				showToast('Пользователь заблокировал вас', 'error')
			} else {
				showToast('Пользователь заблокирован, отправка сообщений недоступна', 'error')
			}
			setIsPickerOpen(false)
			return
		}
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
		if (text.startsWith('e2e:')) return '🔒 Зашифрованное сообщение'
		return text.length > 120 ? `${text.slice(0, 120)}…` : text
	}

	const getSenderName = (msg: Message) => {
		if (msg.sender_id === user?.id) return 'Вы'
		if (msg.group_id || selectedGroup?.id) {
			return groupParticipants[msg.sender_id]?.username || 'Участник'
		}
		if (msg.channel_id || isStandaloneChannel) {
			return channelParticipants[msg.sender_id]?.username || 'Участник'
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

	const canDeleteHistoryForAll =
		!!selectedFriend ||
		(!!selectedGroup &&
			!!user &&
			String(selectedGroup.owner_id) === String(user.id)) ||
		(!!selectedChannel &&
			!!user &&
			String(selectedChannel.owner_id) === String(user.id))

	const activeChatLabel =
		selectedFriend?.username ||
		selectedGroup?.name ||
		selectedChannel?.name ||
		''

	const handleDeleteAllHistory = async (scope: DeleteHistoryScope) => {
		if (isAiChat) {
			showToast('В этом чате нельзя удалить историю', 'info')
			return
		}
		if (isBotChat && selectedFriend) {
			try {
				localStorage.removeItem(botStorageKey)
				setBotMessages([])
				botMessageIdsRef.current.clear()
				setHasBotHistory(false)
				setActiveBots(prev => {
					const next = prev.filter(b => b.id !== selectedFriend.id)
					try { localStorage.setItem(activeBotsStorageKey, JSON.stringify(next)) } catch {}
					return next
				})
				setDeleteHistoryModalOpen(false)
				showToast('История с ботом удалена', 'success')
			} catch {
				showToast('Не удалось удалить историю', 'error')
			}
			return
		}
		if (!selectedFriend && !selectedChannel && !selectedGroup) return
		if (scope === 'for_all' && !canDeleteHistoryForAll) {
			showToast('Удалить у всех может только владелец', 'error')
			return
		}

		setIsDeletingHistory(true)
		try {
			let res: Response | null = null
			const body = { scope, access_token: accessToken }

			if (selectedChannel) {
				res = await fetch('/api/channels/history', {
					method: 'DELETE',
					credentials: 'include',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						...body,
						channel_id: selectedChannel.id,
					}),
				})
			} else if (selectedGroup) {
				res = await fetch('/api/groups/history', {
					method: 'DELETE',
					credentials: 'include',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						...body,
						group_id: selectedGroup.id,
					}),
				})
			} else if (selectedFriend) {
				res = await fetch('/api/messages/history', {
					method: 'DELETE',
					credentials: 'include',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						...body,
						target_id: selectedFriend.id,
					}),
				})
			}

			if (!res) return
			if (!res.ok) {
				let errMsg = 'Не удалось удалить историю'
				try {
					const errData = await res.json()
					errMsg =
						errData?.error ||
						errData?.details ||
						errData?.message ||
						errMsg
				} catch {
					const errorText = await res.text()
					if (errorText) errMsg = errorText
				}
				showToast(errMsg, 'error')
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
			setDeleteHistoryModalOpen(false)
			fetchRecent()
			showToast(
				scope === 'for_me'
					? 'Переписка удалена только у вас'
					: 'Переписка удалена у всех',
				'success',
			)
		} catch (e) {
			console.error(e)
			showToast('Не удалось удалить историю', 'error')
		} finally {
			setIsDeletingHistory(false)
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
	const handleCallInitiate = async (userId: string, userName: string, avatarUrl?: string) => {
		console.log('Call button clicked for:', userId, userName, avatarUrl)
		console.log('WebRTC initialized:', isInitialized)
		console.log('WebRTC supported:', isWebRTCSupported)

		try {
			await initiateCall(userId, userName, avatarUrl)
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
		const distanceFromBottom =
			scrollHeight - (scrollTop + e.currentTarget.clientHeight)
		setShowScrollToBottom(distanceFromBottom > 220)
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
			setShowScrollToBottom(false)
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
			setShowScrollToBottom(false)
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
		setShowScrollToBottom(false)
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

		// 1.5 Add active bot chats (not yet in recent contacts)
		for (const bot of activeBots) {
			if (bot?.id && !addedIds.has(bot.id)) {
				list.push(bot)
				addedIds.add(bot.id)
			}
		}

		// 2. Friends stay visible after clearing history (empty chat, not blocked)
		for (const friend of otherFriends) {
			if (friend?.id && !addedIds.has(friend.id)) {
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
		const sorted = sortChatsWithPinned(list, pinnedChatIds, finalUser)
		const archivedSet = new Set((archivedChatIds || []).map(String))
		return showArchivedChats
			? sorted.filter(u => archivedSet.has(String(u.id)))
			: sorted.filter(u => !archivedSet.has(String(u.id)))
	}, [
		normalizedSearch,
		searchResultsWithBot,
		recentContacts,
		activeBots,
		otherFriends,
		pinnedChatIds,
		user,
		archivedChatIds,
		showArchivedChats,
	])
	const folderFilteredSidebarList = useMemo(() => {
		if (normalizedSearch || activeFolderId === 'all') return sidebarList
		return sidebarList.filter(friend =>
			matchesActiveFolder(chatFolders, activeFolderId, {
				type: 'user',
				id: String(friend.id),
			}),
		)
	}, [sidebarList, normalizedSearch, activeFolderId, chatFolders])
	const folderFilteredGroups = useMemo(() => {
		if (normalizedSearch || activeFolderId === 'all') return otherGroups
		return otherGroups.filter(group =>
			matchesActiveFolder(chatFolders, activeFolderId, {
				type: 'group',
				id: String(group.id),
			}),
		)
	}, [otherGroups, normalizedSearch, activeFolderId, chatFolders])
	const standaloneChannels = useMemo(
		() => channels.filter(ch => !ch.community_id),
		[channels],
	)
	const folderFilteredStandaloneChannels = useMemo(() => {
		if (activeFolderId === 'all') return standaloneChannels
		return standaloneChannels.filter(channel =>
			matchesActiveFolder(chatFolders, activeFolderId, {
				type: 'channel',
				id: String(channel.id),
			}),
		)
	}, [standaloneChannels, activeFolderId, chatFolders])
	const recentContactsById = useMemo(() => {
		const map = new Map<string, any>()
		for (const contact of recentContacts) {
			if (contact?.id) map.set(String(contact.id), contact)
		}
		return map
	}, [recentContacts])
	const getBotLastMessageFromStorage = useCallback(
		(botId: string): { text: string; time: string } | null => {
			try {
				const key = user?.id
					? `bot_history_${user.id}_${botId}`
					: `bot_history_${botId}`
				const raw = localStorage.getItem(key)
				if (!raw) return null
				const parsed = JSON.parse(raw)
				if (!Array.isArray(parsed) || parsed.length === 0) return null
				const last = parsed[parsed.length - 1]
				return {
					text: String(last?.content || ''),
					time: String(last?.timestamp || ''),
				}
			} catch {
				return null
			}
		},
		[user?.id],
	)
	const getSidebarPreview = useCallback(
		(friend: User) => {
			if (selectedFriend?.id === friend.id) {
				return getLastMessage(friend.id, messages, user?.id)
			}
			const recentMeta = recentContactsById.get(String(friend.id)) as
				| Record<string, unknown>
				| undefined
			const rawPreview =
				recentMeta?.last_message_text ||
				recentMeta?.last_message_preview ||
				recentMeta?.last_message ||
				recentMeta?.preview ||
				''
			let text = decryptSidebarPreview(
				String(user?.id || ''),
				String(friend.id),
				recentMeta,
				String(rawPreview || ''),
			)
			if (text.startsWith('mt:')) {
				text = '🔒 Зашифрованное сообщение'
			}
			if (text.startsWith('e2e:')) {
				text = '🔐 Зашифрованное сообщение'
			}
			if (!text && friend.is_bot === true) {
				const botLast = getBotLastMessageFromStorage(String(friend.id))
				if (botLast?.text) {
					text = botLast.text
				}
			}
			return text.length > 30 ? `${text.substring(0, 30)}...` : text
		},
		[messages, recentContactsById, selectedFriend?.id, user?.id, previewRevision, getBotLastMessageFromStorage],
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
			if (!raw && friend.is_bot === true) {
				const botLast = getBotLastMessageFromStorage(String(friend.id))
				if (botLast?.time) {
					try {
						return new Date(botLast.time).toLocaleTimeString('ru-RU', {
							hour: '2-digit',
							minute: '2-digit',
						})
					} catch {
						return ''
					}
				}
			}
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
		[messages, recentContactsById, selectedFriend?.id, getBotLastMessageFromStorage],
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

	const sortedMessagesForList = [...messagesToDisplay].sort((a, b) => {
		const ta = new Date(
			(a as any).timestamp || (a as any).created_at || 0,
		).getTime()
		const tb = new Date(
			(b as any).timestamp || (b as any).created_at || 0,
		).getTime()
		return ta - tb
	})
	const chatListItems = buildChatListItems(sortedMessagesForList)

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
				className={`w-80 border-r border-white/6 bg-black/25 flex-shrink-0 z-20 shadow-xl flex-col backdrop-blur-md ${
					hasActiveChat ? 'hidden md:flex' : 'flex'
				}`}
			>
				<div className='p-4 border-b border-white/6 bg-black/20 backdrop-blur-sm'>
					<div className='flex justify-between items-center mb-4'>
						<div className='flex items-center gap-3'>
							<Link
								href='/feed'
								className='p-2 -ml-2 text-[var(--app-muted)] hover:text-[var(--app-fg)] hover:bg-white/5 rounded-full transition-colors'
							>
								<ArrowLeftIcon className='w-5 h-5' />
							</Link>
							<h2 className='text-xl font-bold tracking-tight text-[var(--app-fg)] flex items-center gap-2'>
								<span className='bg-gradient-to-r from-[#2dd4a8] to-[#22b893] bg-clip-text text-transparent transition-all duration-500'>
									Vondic
								</span>
							</h2>
						</div>
					</div>

					<div className='flex p-1 bg-black/20 rounded-lg border border-white/6 relative'>
						<div
							className={`absolute top-1 bottom-1 w-[calc(33.33%-3px)] bg-white/8 rounded-md transition-all duration-300 ease-out ${
								activeTab === 'direct' ? 'left-1' : activeTab === 'community' ? 'left-[calc(33.33%+2px)]' : 'left-[calc(66.66%+3px)]'
							}`}
						/>
						<button
							onClick={() => setActiveTab('direct')}
							className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md relative z-10 transition-colors ${
								activeTab === 'direct'
									? 'text-[var(--app-fg)]'
									: 'text-[var(--app-muted)] hover:text-[var(--app-fg)]'
							}`}
						>
							<MessageSquareIcon className='w-4 h-4' />
							Директ
						</button>
						<button
							onClick={() => setActiveTab('community')}
							className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md relative z-10 transition-colors ${
								activeTab === 'community'
									? 'text-[var(--app-fg)]'
									: 'text-[var(--app-muted)] hover:text-[var(--app-fg)]'
							}`}
							title='Каналы (Telegram) и серверы (Discord)'
						>
							<HashIcon className='w-4 h-4' />
							Каналы
						</button>
						<button
							onClick={() => setActiveTab('support')}
							className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md relative z-10 transition-colors ${
								activeTab === 'support'
									? 'text-[var(--app-fg)]'
									: 'text-[var(--app-muted)] hover:text-[var(--app-fg)]'
							}`}
						>
							<LifeBuoyIcon className='w-4 h-4' />
							Поддержка
						</button>
					</div>
				</div>

				{activeTab === 'direct' && (
					<div className='px-4 py-3'>
						<div className='relative'>
							<SearchIcon className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--app-muted)]' />
							<input
								type='text'
								placeholder='Поиск чатов...'
								value={searchQuery}
								onChange={e => setSearchQuery(e.target.value)}
								className={`w-full bg-white/5 rounded-xl py-2 pl-10 pr-4 text-sm text-[var(--app-fg)] placeholder-[var(--app-muted)] focus:outline-none focus:ring-2 transition-all duration-300 ${currentBackground.ringColor}`}
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
						{!normalizedSearch && (
							<div className='flex items-center gap-1.5 mt-3 overflow-x-auto custom-scrollbar pb-0.5'>
								<button
									type='button'
									onClick={() => setActiveFolderId('all')}
									className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
										activeFolderId === 'all'
											? 'bg-[var(--app-accent)]/15 text-[var(--app-accent)]'
											: 'bg-white/5 text-[var(--app-muted)] hover:text-[var(--app-fg)]'
									}`}
								>
									Все
								</button>
								{chatFolders.map(folder => (
									<button
										key={folder.id}
										type='button'
										onClick={() => setActiveFolderId(folder.id)}
										className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
											activeFolderId === folder.id
												? 'bg-[var(--app-accent)]/15 text-[var(--app-accent)]'
												: 'bg-white/5 text-[var(--app-muted)] hover:text-[var(--app-fg)]'
										}`}
									>
										{folder.icon ? `${folder.icon} ` : ''}
										{folder.name}
									</button>
								))}
								<button
									type='button'
									onClick={() => setIsFoldersManageOpen(true)}
									className='shrink-0 p-1.5 rounded-lg bg-white/5 text-[var(--app-muted)] hover:text-[var(--app-fg)] transition-colors'
									title='Управление папками'
								>
									<Folder className='w-4 h-4' />
								</button>
							</div>
						)}
					</div>
				)}

				<div className='flex-1 overflow-y-auto custom-scrollbar px-2 space-y-1 pb-4'>
					{activeTab === 'direct' && (
						<>
							{aiFriend && !searchQuery && !showArchivedChats && (
								<div
									onClick={() => {
										setSelectedFriend(aiFriend)
										setSelectedChannel(null)
										setSelectedGroup(null)
										setIsChatSearchOpen(false)
										setChatSearchQuery('')
										setFoundMessages([])
									}}
									className={`group p-3 rounded-xl cursor-pointer flex items-center gap-3 transition-all duration-200 border border-transparent ${
										selectedFriend?.id === aiFriend.id
											? `bg-white/8 ${currentBackground.borderColor} shadow-sm`
											: 'hover:bg-white/5 border-transparent'
									}`}
								>
									<div className='relative'>
										<img
											src={getAvatarUrl(aiFriend.avatar_url)}
											alt={aiFriend.username}
											className={`w-12 h-12 rounded-full object-cover bg-white/5 ring-2 transition-all duration-300 ${
												selectedFriend?.id === aiFriend.id
													? currentBackground.accentColor.replace(
															'text-',
															'ring-',
														)
													: 'ring-[var(--app-bg)]'
											}`}
										/>
										<div className='absolute bottom-0 right-0 w-3.5 h-3.5 bg-[var(--app-bg)] rounded-full flex items-center justify-center'>
											<div className='w-2.5 h-2.5 rounded-full bg-[var(--app-accent)]' />
										</div>
									</div>
									<div className='flex flex-col flex-1 min-w-0'>
										<div className='flex justify-between items-baseline'>
											<span
												className={`font-semibold truncate transition-colors duration-300 ${
													selectedFriend?.id === aiFriend.id
														? currentBackground.accentColor
														: 'text-[var(--app-fg)] group-hover:text-[var(--app-fg)]'
												}`}
											>
												Вондик AI
											</span>
											<span className='text-[10px] text-[var(--app-muted)]'>AI</span>
										</div>
										<span className='text-xs text-[var(--app-muted)] truncate group-hover:text-[var(--app-muted)] transition-colors'>
											Всегда онлайн
										</span>
									</div>
								</div>
							)}
							{botFriend && showBotInHistory && !showArchivedChats && (
								<div
									onClick={() => {
										setSelectedFriend(botFriend)
										setSelectedChannel(null)
										setSelectedGroup(null)
										setIsChatSearchOpen(false)
										setChatSearchQuery('')
										setFoundMessages([])
									}}
									className={`group p-3 rounded-xl cursor-pointer flex items-center gap-3 transition-all duration-200 border border-transparent ${
										selectedFriend?.id === botFriend.id
											? `bg-white/8 ${currentBackground.borderColor} shadow-sm`
											: 'hover:bg-white/5 border-transparent'
									}`}
								>
									<div className='relative'>
										<img
											src={getAvatarUrl(botFriend.avatar_url)}
											alt={botFriend.username}
											className={`w-12 h-12 rounded-full object-cover bg-white/5 ring-2 transition-all duration-300 ${
												selectedFriend?.id === botFriend.id
													? currentBackground.accentColor.replace(
															'text-',
															'ring-',
														)
													: 'ring-[var(--app-bg)]'
											}`}
										/>
										<div className='absolute bottom-0 right-0 w-3.5 h-3.5 bg-[var(--app-bg)] rounded-full flex items-center justify-center'>
											<div className='w-2.5 h-2.5 rounded-full bg-[var(--app-accent)]' />
										</div>
									</div>
									<div className='flex flex-col flex-1 min-w-0'>
										<div className='flex justify-between items-baseline'>
											<span
												className={`font-semibold truncate transition-colors duration-300 ${
													selectedFriend?.id === botFriend.id
														? currentBackground.accentColor
														: 'text-[var(--app-fg)] group-hover:text-[var(--app-fg)]'
												}`}
											>
												{botFriend.username}
											</span>
											<span className='text-[10px] text-[var(--app-muted)]'>BOT</span>
										</div>
										<span className='text-xs text-[var(--app-muted)] truncate group-hover:text-[var(--app-muted)] transition-colors'>
											Всегда онлайн
										</span>
									</div>
								</div>
							)}

							{folderFilteredSidebarList.length === 0 &&
								(!aiFriend || searchQuery) &&
								!showBotInHistory && (
									<div className='p-8 text-center text-[var(--app-muted)] flex flex-col items-center gap-3'>
										<div className='w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-[var(--app-muted)]'>
											<SearchIcon className='w-6 h-6' />
										</div>
										<span className='text-sm'>
											{searchQuery
												? 'Пользователи не найдены'
												: 'Ничего не найдено'}
										</span>
									</div>
								)}
							{folderFilteredSidebarList.map(friend => (
								<div
									key={friend.id}
									onClick={() => {
										setSelectedFriend(friend)
										setSelectedChannel(null)
										setSelectedGroup(null)
										// Reset message search when changing chat
										setIsChatSearchOpen(false)
										setChatSearchQuery('')
										setFoundMessages([])
									}}
									className={`group p-3 rounded-xl cursor-pointer flex items-center gap-3 transition-all duration-200 border border-transparent hover:bg-white/5 ${
										selectedFriend?.id === friend.id
											? `bg-white/8 ${currentBackground.borderColor} shadow-sm`
											: 'bg-transparent'
									}`}
								>
									<div className='relative'>
										<img
											src={getAvatarUrl(friend.avatar_url)}
											className={`w-12 h-12 rounded-full object-cover bg-white/5 ring-2 transition-all duration-300 ${
												selectedFriend?.id === friend.id
													? currentBackground.accentColor.replace(
															'text-',
															'ring-',
														)
													: 'ring-[var(--app-bg)]'
											}`}
											alt={friend.username}
										/>

										{!friend.is_bot && (
											<div className='absolute bottom-0 right-0 w-3.5 h-3.5 bg-[var(--app-bg)] rounded-full flex items-center justify-center'>
												<div
													className={`w-2.5 h-2.5 rounded-full ${
														friend.status?.toLowerCase() === 'online'
															? 'bg-[var(--app-accent)]'
															: 'bg-[var(--app-muted)]'
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
														: 'text-[var(--app-fg)] group-hover:text-[var(--app-fg)]'
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
											<span className='text-[10px] text-[var(--app-muted)]'>
												{getSidebarPreviewTime(friend)}
											</span>
										</div>
										<span className='text-xs text-[var(--app-muted)] truncate group-hover:text-[var(--app-muted)] transition-colors'>
											{getSidebarPreview(friend)}
										</span>
									</div>

									<div className='opacity-0 group-hover:opacity-100 transition-opacity'>
										<ChatMenu
											chatId={friend.id}
											chatType='user'
											isPinned={pinnedChatIds.includes(friend.id)}
											isArchived={archivedChatIds.includes(friend.id)}
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
												handleCallInitiate(friend.id, friend.username, friend.avatar_url)
											}
											onVideoCall={() => {
												console.log('Video call to:', friend.id)
											}}
											onArchive={() => {
												setArchivedChatIds(prev => {
													const id = String(friend.id)
													const set = new Set((prev || []).map(String))
													if (set.has(id)) set.delete(id)
													else set.add(id)
													return Array.from(set)
												})
											}}
											onDelete={() => {
												setSelectedFriend(friend)
												setSelectedGroup(null)
												setSelectedChannel(null)
												setIsChatSearchOpen(false)
												setDeleteHistoryModalOpen(true)
											}}
											folders={chatFolders.map(f => ({
												id: f.id,
												name: f.name,
												icon: f.icon,
											}))}
											currentFolderId={chatInFolder(chatFolders, {
												type: 'user',
												id: String(friend.id),
											})}
											onMoveToFolder={folderId =>
												moveChatToFolder(
													{ type: 'user', id: String(friend.id) },
													folderId,
												)
											}
											onManageFolders={() => setIsFoldersManageOpen(true)}
										/>
									</div>
								</div>
							))}

							{!searchQuery && (
								<div className='mt-4 px-2'>
									<button
										type='button'
										onClick={() => setShowArchivedChats(v => !v)}
										className='w-full mb-3 px-3 py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-gray-200 flex items-center justify-between transition-colors'
										title='Показать/скрыть архив'
									>
										<span className='text-sm font-medium'>
											{showArchivedChats ? 'Все чаты' : 'Архив'}
										</span>
										<span className='text-xs text-gray-400'>
											{archivedChatIds.length}
										</span>
									</button>
									<div className='flex items-center justify-between mb-2 px-2'>
										<h3 className='text-xs font-semibold text-gray-500 uppercase tracking-wider'>
											Группы
										</h3>
										<div className='flex gap-1'>
											<button
												onClick={() => setIsJoinGroupOpen(true)}
												className='px-3 py-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-200 hover:text-white text-xs font-semibold flex items-center gap-2'
												title='Вступить в группу'
											>
												<LogInIcon className='w-4 h-4' />
												<span>Вступить</span>
											</button>
											<button
												onClick={() => setIsCreateGroupOpen(true)}
												className='px-3 py-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-200 hover:text-white text-xs font-semibold flex items-center gap-2'
												title='Создать группу'
											>
												<PlusIcon className='w-4 h-4' />
												<span>Создать</span>
											</button>
										</div>
									</div>
									<div className='space-y-1'>
										{folderFilteredGroups.map(group => (
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
													{group.avatar_url ? (
														<img
															src={getAvatarUrl(group.avatar_url)}
															alt={group.name}
															className={`w-12 h-12 rounded-full object-cover bg-gray-800 ring-2 transition-all duration-300 ${
																selectedGroup?.id === group.id
																	? currentBackground.accentColor.replace(
																			'text-',
																			'ring-',
																		)
																	: 'ring-gray-950'
															}`}
														/>
													) : (
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
													)}
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
					)}
					{activeTab === 'community' && (
						<div className='flex flex-col gap-2'>
							{!selectedCommunity && (
								<div className='mt-2 space-y-3 px-2'>
									<div className='flex rounded-lg bg-gray-900/80 p-0.5'>
										<button
											type='button'
											onClick={() => setHubTab('channels')}
											className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
												hubTab === 'channels'
													? 'bg-gray-800 text-white'
													: 'text-gray-500 hover:text-gray-300'
											}`}
										>
											<HashIcon className='w-3.5 h-3.5' />
											Каналы
										</button>
										<button
											type='button'
											onClick={() => setHubTab('servers')}
											className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
												hubTab === 'servers'
													? 'bg-gray-800 text-white'
													: 'text-gray-500 hover:text-gray-300'
											}`}
										>
											<Server className='w-3.5 h-3.5' />
											Серверы
										</button>
									</div>

									{hubTab === 'channels' ? (
										<div>
											{activeFolderId !== 'all' && (
												<div className='flex items-center gap-1.5 mb-2 overflow-x-auto custom-scrollbar px-1'>
													<button
														type='button'
														onClick={() => setActiveFolderId('all')}
														className='shrink-0 px-2 py-1 rounded-md text-[10px] font-medium bg-gray-900 text-gray-400 hover:text-gray-200'
													>
														Все
													</button>
													{chatFolders
														.filter(f => f.id === activeFolderId)
														.map(folder => (
															<span
																key={folder.id}
																className='shrink-0 px-2 py-1 rounded-md text-[10px] font-medium bg-emerald-500/20 text-emerald-300'
															>
																{folder.icon ? `${folder.icon} ` : ''}
																{folder.name}
															</span>
														))}
												</div>
											)}
											<div className='flex items-center justify-between mb-2 px-1'>
												<h3 className='text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5'>
													<HashIcon className='w-3.5 h-3.5' />
													Мои каналы
												</h3>
												<div className='flex gap-1'>
													<button
														type='button'
														onClick={() => setIsJoinChannelOpen(true)}
														className='p-1 hover:bg-gray-800 rounded-md transition-colors text-gray-400 hover:text-white'
														title='Вступить по ссылке'
													>
														<LogInIcon className='w-3 h-3' />
													</button>
													<button
														type='button'
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
											{folderFilteredStandaloneChannels.length > 0 ? (
												<div className='space-y-1'>
													{folderFilteredStandaloneChannels.map(channel => (
															<div
																key={channel.id}
																onClick={() => openStandaloneChannel(channel)}
																className={`group p-3 rounded-xl cursor-pointer flex items-center gap-3 transition-all duration-200 border border-transparent ${
																	selectedChannel?.id === channel.id
																		? `bg-gray-800/50 ${currentBackground.borderColor} shadow-sm`
																		: 'hover:bg-gray-900 border-transparent'
																}`}
															>
																{channel.avatar_url ? (
																	<img
																		src={getAvatarUrl(channel.avatar_url)}
																		alt={channel.name}
																		className={`w-12 h-12 rounded-full object-cover bg-gray-800 ring-2 transition-all duration-300 ${
																			selectedChannel?.id === channel.id
																				? currentBackground.accentColor.replace(
																						'text-',
																						'ring-',
																					)
																				: 'ring-gray-950'
																		}`}
																	/>
																) : (
																	<div
																		className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-sky-950/80 ring-2 transition-all duration-300 ${
																			selectedChannel?.id === channel.id
																				? currentBackground.accentColor.replace(
																						'text-',
																						'ring-',
																					)
																				: 'ring-gray-950'
																		}`}
																	>
																		<HashIcon className='w-6 h-6 text-sky-300' />
																	</div>
																)}
																<div className='flex flex-col flex-1 min-w-0'>
																	<span
																		className={`font-semibold truncate transition-colors duration-300 ${
																			selectedChannel?.id === channel.id
																				? currentBackground.accentColor
																				: 'text-gray-200 group-hover:text-white'
																		}`}
																	>
																		{channel.name}
																	</span>
																	<span className='text-xs text-gray-500 truncate'>
																		Публичный канал
																	</span>
																</div>
															</div>
														))}
												</div>
											) : (
												<div className='rounded-xl border border-dashed border-gray-700 p-4 text-center text-sm text-gray-500'>
													<p className='mb-2'>Нет каналов</p>
													<button
														type='button'
														onClick={() => {
															setIsCreateChannelOpen(true)
															setNewChannelName('')
															setNewChannelDesc('')
														}}
														className='text-indigo-400 hover:text-indigo-300 text-xs'
													>
														Создать канал
													</button>
												</div>
											)}
										</div>
									) : (
										<div>
											<div className='flex items-center justify-between mb-2 px-1'>
												<h3 className='text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5'>
													<Server className='w-3.5 h-3.5' />
													Мои серверы
												</h3>
												<div className='flex gap-1'>
													<button
														onClick={() => setIsDiscoveryOpen(true)}
														className='p-1 hover:bg-gray-800 rounded-md transition-colors text-gray-400 hover:text-white'
														title='Найти сервер'
													>
														<SearchIcon className='w-3 h-3' />
													</button>
													<button
														onClick={() => setIsJoinCommunityOpen(true)}
														className='p-1 hover:bg-gray-800 rounded-md transition-colors text-gray-400 hover:text-white'
														title='Вступить по ссылке'
													>
														<LogInIcon className='w-3 h-3' />
													</button>
													<button
														onClick={() => setIsCreateCommunityOpen(true)}
														className='p-1 hover:bg-gray-800 rounded-md transition-colors text-gray-400 hover:text-white'
														title='Создать сервер'
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
														<div className='relative shrink-0'>
															<div
																className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-indigo-950/80 ring-2 transition-all duration-300 ${
																	selectedCommunity?.id === comm.id
																		? currentBackground.accentColor.replace(
																				'text-',
																				'ring-',
																			)
																		: 'ring-gray-950'
																}`}
															>
																<Server className='w-6 h-6 text-indigo-300' />
															</div>
														</div>
														<div className='flex flex-col flex-1 min-w-0'>
															<span
																className={`font-semibold truncate transition-colors duration-300 ${
																	selectedCommunity?.id === comm.id
																		? currentBackground.accentColor
																		: 'text-gray-200 group-hover:text-white'
																}`}
															>
																{comm.name}
															</span>
															<span className='text-xs text-gray-500 truncate'>
																{comm.members_count && comm.members_count > 0
																	? `${comm.members_count} участников`
																	: 'Сервер'}
															</span>
														</div>
													</div>
												))}
												{myCommunities.length === 0 && (
													<div className='rounded-xl border border-dashed border-gray-700 p-4 text-center text-sm text-gray-500'>
														<p className='mb-2'>Нет серверов</p>
														<button
															type='button'
															onClick={() => setIsCreateCommunityOpen(true)}
															className='text-indigo-400 hover:text-indigo-300 text-xs'
														>
															Создать первый сервер
														</button>
													</div>
												)}
											</div>
										</div>
									)}
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
												title='К списку серверов'
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
												title='Ссылка-приглашение на сервер'
											>
												Пригласить
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
																owner_id:
																	selectedCommunity?.owner_id || '',
																participants_count: 0,
																type: 'text',
																community_id:
																	selectedCommunity?.id ||
																	ch.community_id,
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
																	owner_id:
																		selectedCommunity?.owner_id || '',
																	participants_count: 0,
																	type: 'text',
																	community_id:
																		selectedCommunity?.id ||
																		ch.community_id,
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
					{activeTab === 'support' && (
						<div className='space-y-1'>
							{supportChats.length === 0 && (
								<div className='p-4 text-center text-gray-500 text-sm'>
									Нет обращений
								</div>
							)}
							{supportChats.map(chat => (
								<div
									key={chat.id}
									onClick={() => {
										setSelectedSupportId(chat.id)
										setSelectedFriend(null)
										setSelectedChannel(null)
										setSelectedGroup(null)
									}}
									className={`p-3 rounded-xl cursor-pointer flex items-center gap-3 transition-all duration-200 border ${
										selectedSupportId === chat.id
											? `bg-gray-800/50 ${currentBackground.borderColor} shadow-sm`
											: 'hover:bg-gray-900 border-transparent'
									}`}
								>
									<div className='relative shrink-0'>
										<div className='w-10 h-10 rounded-full bg-emerald-900/60 flex items-center justify-center'>
											<LifeBuoyIcon className='w-5 h-5 text-emerald-300' />
										</div>
										{chat.unread_count > 0 && (
											<div className='absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center'>
												{chat.unread_count > 9 ? '9+' : chat.unread_count}
											</div>
										)}
									</div>
									<div className='flex-1 min-w-0'>
										<div className='flex items-center justify-between'>
											<span className='text-sm font-medium text-gray-200 truncate'>
												Заявка #{chat.id}
											</span>
											<div className='flex items-center gap-1 shrink-0 ml-2'>
												{chat.status === 'closed' && (
													<span className='text-[10px] text-gray-500'>закрыта</span>
												)}
												{chat.status === 'closed' && (
													<button
														onClick={e => {
															e.stopPropagation()
															deleteSupportChat(chat.id)
														}}
														className='p-1 rounded-md text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors'
														title='Удалить чат'
													>
														<Trash2Icon className='w-3.5 h-3.5' />
													</button>
												)}
											</div>
										</div>
										<div className='text-xs text-gray-500 truncate mt-0.5'>
											{chat.question?.slice(0, 40)}
										</div>
										<div className='text-[10px] text-gray-600 truncate mt-0.5'>
											{chat.last_message?.slice(0, 50)}
										</div>
									</div>
								</div>
							))}
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
					{selectedSupportId ? (
						<>
							<div className='h-16 px-6 border-b border-white/10 flex items-center justify-between bg-black/20 backdrop-blur-md z-10 sticky top-0'>
								<div className='flex items-center gap-3'>
									<div className='w-9 h-9 rounded-full bg-emerald-900/60 flex items-center justify-center'>
										<LifeBuoyIcon className='w-5 h-5 text-emerald-300' />
									</div>
									<div>
										<div className='font-medium text-white'>Заявка #{selectedSupportId}</div>
										<div className='text-xs text-gray-400'>
											{supportStatus === 'closed' ? 'Закрыта' : 'Техническая поддержка'}
										</div>
									</div>
								</div>
								<div className='flex items-center gap-2'>
									<button
										onClick={() => {
											setSelectedSupportId(null)
											setSupportMessages([])
										}}
										className='p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition-colors'
									>
										<XIcon className='w-5 h-5' />
									</button>
								</div>
							</div>
							<div
								ref={supportChatRef}
								className='flex-1 overflow-y-auto custom-scrollbar px-4 py-4 space-y-3'
							>
								{supportMessages.map(msg => (
									<div
										key={`${msg.id}-${msg.created_at}`}
										className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
									>
										<div
											className={`max-w-[70%] px-3 py-2 rounded-lg ${
												msg.sender === 'user'
													? 'bg-blue-600 text-white'
													: msg.sender === 'support'
														? 'bg-emerald-700 text-white'
														: 'bg-gray-800 text-gray-100'
											}`}
										>
											<div className='text-[10px] opacity-70 mb-1'>
												{msg.sender === 'user' ? 'Вы' : msg.sender === 'support' ? 'Оператор' : 'Бот'}
											</div>
											<div className='text-sm whitespace-pre-wrap break-words'>{msg.content}</div>
											<div className='text-[10px] opacity-50 mt-1'>
												{new Date(msg.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
											</div>
										</div>
									</div>
								))}
							</div>
							{supportStatus !== 'closed' ? (
								<div className='p-4 border-t border-white/10 bg-black/20 backdrop-blur-md'>
									<div className='flex gap-2 items-center'>
										<input
											value={supportInput}
											onChange={e => setSupportInput(e.target.value)}
											onKeyDown={e => { if (e.key === 'Enter') sendSupportMessage() }}
											placeholder='Сообщение поддержке...'
											className='flex-1 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-600'
										/>
										<button
											onClick={sendSupportMessage}
											disabled={!supportInput.trim()}
											className='px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium'
										>
											<SendIcon className='w-4 h-4' />
										</button>
									</div>
								</div>
							) : (
								<div className='p-4 border-t border-white/10 bg-black/20 backdrop-blur-md text-center text-sm text-gray-500'>
									Чат закрыт
								</div>
							)}
						</>
					) : selectedFriend || selectedChannel || selectedGroup ? (
						<>
							<div className='h-16 px-6 border-b border-white/6 flex items-center justify-between bg-black/20 backdrop-blur-lg z-10 sticky top-0'>
								{isChatSearchOpen ? (
									<div className='flex flex-col gap-2 w-full animate-in fade-in slide-in-from-top-2 duration-200'>
										<div className='flex items-center gap-2'>
											<SearchIcon className='w-5 h-5 text-[var(--app-muted)] shrink-0' />
											<form
												onSubmit={handleMessageSearch}
												className='flex-1 min-w-0'
											>
												<input
													autoFocus
													type='text'
													placeholder='Поиск сообщений...'
													value={chatSearchQuery}
													onChange={e => setChatSearchQuery(e.target.value)}
													className='w-full bg-transparent border-none text-[color:var(--app-fg)] placeholder:text-[var(--app-muted)] focus:ring-0 text-sm'
												/>
											</form>
											{isSearchingMessages && (
												<div
													className={`w-4 h-4 border-2 border-t-transparent rounded-full animate-spin shrink-0 ${currentBackground.borderColor.replace(
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
												className='p-2 text-[var(--app-muted)] hover:text-[var(--app-fg)] hover:bg-white/5 rounded-full transition-colors shrink-0'
											>
												<XIcon className='w-5 h-5' />
											</button>
										</div>
										<div className='flex items-center gap-1.5 overflow-x-auto pb-0.5'>
											{(
												[
													{ id: 'all', label: 'Все' },
													{ id: 'photos', label: 'Фото' },
													{ id: 'files', label: 'Файлы' },
													{ id: 'links', label: 'Ссылки' },
												] as const
											).map(option => (
												<button
													key={option.id}
													type='button'
													onClick={() => setMessageFilter(option.id)}
													className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
														messageFilter === option.id
															? 'bg-[var(--app-accent)]/25 text-[var(--app-accent)]'
															: 'bg-white/5 text-[var(--app-muted)] hover:text-[var(--app-fg)]'
													}`}
												>
													{option.label}
												</button>
											))}
											{messageFilter !== 'all' && (
												<button
													type='button'
													onClick={() => setMessageFilter('all')}
													className='shrink-0 px-2 py-1 text-xs text-[var(--app-muted)] hover:text-[var(--app-fg)]'
												>
													Сбросить
												</button>
											)}
										</div>
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
												className='p-2 text-[var(--app-muted)] hover:text-[var(--app-fg)] hover:bg-white/8 rounded-full transition-colors'
												title='К списку серверов'
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
															className='w-10 h-10 rounded-full object-cover bg-white/5 ring-2 ring-white/10'
															alt={selectedFriend.username}
														/>
														{selectedFriend.status?.toLowerCase() ===
															'online' && (
															<div className='absolute bottom-0 right-0 w-3 h-3 bg-[var(--app-accent)] border-2 border-[var(--app-bg)] rounded-full animate-pulse' />
														)}
													</div>
													<button
														onClick={() => setIsSettingsOpen(true)}
														className='flex flex-col text-left hover:bg-white/5 rounded-lg p-2 -ml-2 transition-colors'
														title='Настройки чата'
													>
														<span className='font-bold text-[var(--app-fg)] text-base leading-tight flex items-center gap-2'>
															{selectedFriend.username}
															{secretChatEnabled && (
																<span
																	className='text-[10px] px-1.5 py-0.5 rounded-md bg-[var(--app-accent)]/15 text-[var(--app-accent)] font-medium'
																	title='Секретный чат (E2E)'
																>
																	🔐
																</span>
															)}
															{isEncProxyActive && (
																<span
																	className='text-[10px] px-1.5 py-0.5 rounded-md bg-violet-500/15 text-violet-400 font-medium'
																	title='Использует EncProxy'
																>
																	Использует EncProxy
																</span>
															)}
															{selectedFriend.premium && (
																<span className='ml-1 text-amber-400'>★</span>
															)}
														</span>
														<span className='text-xs text-[var(--app-accent)] font-medium flex items-center gap-1.5'>
															{isChatTyping ? (
																<>
																	<span className='w-1.5 h-1.5 rounded-full bg-[var(--app-accent)] animate-pulse' />
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
																	{formatLastSeen(
																		selectedFriend.last_seen,
																		selectedFriend.privacy_settings,
																	)}
																</span>
															)}
														</span>
													</button>
												</>
											) : selectedChannel ? (
												<>
													<div
														className='relative cursor-pointer hover:opacity-80 transition-opacity'
														onClick={() =>
															isStandaloneChannel
																? setIsChannelInfoOpen(true)
																: undefined
														}
													>
														{isStandaloneChannel && selectedChannel.avatar_url ? (
															<img
																src={getAvatarUrl(selectedChannel.avatar_url)}
																alt={selectedChannel.name}
																className='w-10 h-10 rounded-full object-cover bg-gray-800 ring-2 ring-gray-800/50'
															/>
														) : (
															<div className='w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center ring-2 ring-gray-800/50'>
																<HashIcon className='w-5 h-5 text-gray-400' />
															</div>
														)}
													</div>
													<button
														onClick={() => setIsSettingsOpen(true)}
														className='flex flex-col text-left hover:bg-gray-800/50 rounded-lg p-2 -ml-2 transition-colors'
														title='Настройки чата'
													>
														<span className='font-bold text-white text-base leading-tight flex items-center gap-2'>
															{selectedChannel.name}
														</span>
														<span className='text-xs text-gray-500 font-medium flex items-center gap-1.5'>
															<UsersIcon className='w-3 h-3' />
															{isStandaloneChannel
																? selectedChannel.participants_count &&
																  selectedChannel.participants_count > 0
																	? `${selectedChannel.participants_count} участников`
																	: 'Канал'
																: 'Канал сервера'}
														</span>
													</button>
													{isStandaloneChannel && (
														<button
															onClick={() => setIsChannelInfoOpen(true)}
															className='ml-2 p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors'
															title='Информация о канале'
														>
															<InfoIcon className='w-4 h-4' />
														</button>
													)}
												</>
											) : selectedGroup ? (
												<>
													<div className='relative'>
														{selectedGroup.avatar_url ? (
															<img
																src={getAvatarUrl(selectedGroup.avatar_url)}
																alt={selectedGroup.name}
																className='w-10 h-10 rounded-full object-cover bg-gray-800 ring-2 ring-gray-800/50'
															/>
														) : (
															<div className='w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center ring-2 ring-gray-800/50'>
																<UsersIcon className='w-5 h-5 text-gray-400' />
															</div>
														)}
													</div>
													<button
														onClick={() => setIsSettingsOpen(true)}
														className='flex flex-col text-left hover:bg-gray-800/50 rounded-lg p-2 -ml-2 transition-colors'
														title='Настройки чата'
													>
														<span className='font-bold text-white text-base leading-tight flex items-center gap-2'>
															{selectedGroup.name}
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
															selectedFriend.avatar_url,
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
											<button
												onClick={() => setIsSettingsOpen(true)}
												className='p-2 rounded-full transition-colors text-gray-400 hover:text-white hover:bg-gray-800'
												title='Настройки чата'
											>
												<MoreVerticalIcon className='w-5 h-5' />
											</button>
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

							{isSettingsOpen && (
								<div
									className='fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-start justify-center pt-20 p-4'
									onClick={() => setIsSettingsOpen(false)}
								>
									<div
										className='bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col'
										onClick={e => e.stopPropagation()}
									>
										<div className='flex items-center justify-between p-4 border-b border-gray-800 shrink-0'>
											<h3 className='text-lg font-bold text-white'>
												Настройки чата
											</h3>
											<button
												onClick={() => setIsSettingsOpen(false)}
												className='p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors'
											>
												<XIcon className='w-5 h-5' />
											</button>
										</div>
										<div className='p-4 space-y-4 overflow-y-auto custom-scrollbar'>
											{selectedFriend &&
												!selectedChannel &&
												!selectedGroup &&
												!isAiChat &&
												!isBotChat && (
													<div className='rounded-xl border border-gray-800 bg-gray-950/60 p-3'>
														<div className='flex items-start justify-between gap-3'>
															<div>
																<p className='text-sm font-medium text-white'>
																	{secretChatEnabled
																		? '🔐 Секретный чат'
																		: '☁️ Облачный чат'}
																</p>
																<p className='text-xs text-gray-500 mt-1 leading-relaxed'>
																	{secretChatEnabled
																		? 'Сквозное шифрование: ключи только на устройствах, сервер не читает сообщения.'
																		: 'Стандартное шифрование: сообщения защищены при передаче и хранятся на сервере (как облачные чаты в Telegram).'}
																</p>
															</div>
															<button
																type='button'
																onClick={toggleSecretChat}
																className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${
																	secretChatEnabled
																		? 'bg-emerald-600'
																		: 'bg-gray-700'
																}`}
																aria-pressed={secretChatEnabled}
															>
																<span
																	className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
																		secretChatEnabled ? 'translate-x-5' : ''
																	}`}
																/>
															</button>
														</div>
														{secretChatEnabled && (
															<button
																type='button'
																onClick={() => {
																	setIsSettingsOpen(false)
																	setIsE2eKeyModalOpen(true)
																}}
																className='mt-3 w-full py-2 px-3 text-xs font-medium text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-colors'
															>
																Показать ключ шифрования
															</button>
														)}
													</div>
												)}

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
														className='flex-1 py-2 px-3 text-xs font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors'
													>
														Картинка
													</button>
													{chatBackgroundImage && (
														<button
															onClick={handleClearCustomBackground}
															className='py-2 px-3 text-xs font-medium text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg transition-colors'
														>
															Убрать
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
															onClick={() => handleMessageThemeChange(bg)}
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
													type='button'
													onClick={() => {
														setIsSettingsOpen(false)
														setDeleteHistoryModalOpen(true)
													}}
													className='w-full text-left text-sm text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 px-3 py-2 rounded-lg transition-colors'
												>
													Удалить переписку…
												</button>
											</div>
										</div>
									</div>
								</div>
							)}

							{isE2eKeyModalOpen && (
								<div
									className='fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4'
									onClick={resetE2eKeyModal}
								>
									<div
										className='bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200'
										onClick={e => e.stopPropagation()}
									>
										<div className='flex items-center justify-between p-4 border-b border-gray-800'>
											<h3 className='text-lg font-bold text-white'>
												Ключ шифрования
											</h3>
											<button
												onClick={resetE2eKeyModal}
												className='p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors'
											>
												<XIcon className='w-5 h-5' />
											</button>
										</div>
										<div className='p-4 space-y-4'>
											{e2eKeyRevealed ? (
												<>
													<p className='text-xs text-gray-500'>
														Ключ хранится только на этом устройстве. Не
														передавайте его третьим лицам.
													</p>
													<div className='rounded-xl border border-gray-800 bg-gray-950/60 p-3'>
														<div className='text-[10px] uppercase tracking-wider text-gray-500 mb-1'>
															ID ключа
														</div>
														<div className='text-xs text-gray-300 break-all font-mono'>
															{user?.id && selectedFriend?.id
																? normalizeE2eKeyId(
																		[
																			String(user.id),
																			String(selectedFriend.id),
																		]
																			.sort()
																			.join(':'),
																	)
																: '—'}
														</div>
														<div className='text-[10px] uppercase tracking-wider text-gray-500 mt-3 mb-1'>
															Ключ (base64)
														</div>
														<div className='text-xs text-emerald-300 break-all font-mono select-all'>
															{e2eKeyRevealed}
														</div>
													</div>
													<button
														type='button'
														onClick={() => {
															void navigator.clipboard.writeText(e2eKeyRevealed)
														}}
														className='w-full py-2.5 text-sm font-medium text-gray-200 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors'
													>
														Скопировать ключ
													</button>
												</>
											) : (
												<form
													onSubmit={handleVerifyE2eKeyPassword}
													className='space-y-4'
												>
													<p className='text-sm text-gray-400'>
														Введите пароль от аккаунта, чтобы увидеть ключ
														сквозного шифрования для этого чата.
													</p>
													<input
														type='password'
														autoFocus
														value={e2eKeyPassword}
														onChange={e => setE2eKeyPassword(e.target.value)}
														placeholder='Пароль'
														className='w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50'
													/>
													{e2eKeyVerifyError && (
														<p className='text-sm text-rose-400'>
															{e2eKeyVerifyError}
														</p>
													)}
													<button
														type='submit'
														disabled={
															isVerifyingE2ePassword ||
															!e2eKeyPassword.trim()
														}
														className='w-full py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors'
													>
														{isVerifyingE2ePassword
															? 'Проверка…'
															: 'Показать ключ'}
													</button>
												</form>
											)}
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
								className='flex-1 overflow-y-auto px-4 md:px-6 py-4 custom-scrollbar scroll-smooth'
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

								{isChatSearchOpen && chatSearchQuery && (
									<div className='flex justify-center my-4 py-1'>
										<span className='chat-date-pill'>
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

								{sortedMessagesForList.map((msg, index) => {
									const prevMsg = sortedMessagesForList[index - 1]
									const nextMsg = sortedMessagesForList[index + 1]
									const groupPosition = ((): MessageGroupPosition => {
										const a = prevMsg && !isSameMessageCluster(prevMsg, msg)
										const b = nextMsg && !isSameMessageCluster(msg, nextMsg)
										if (!prevMsg && !nextMsg) return 'single'
										if (!prevMsg && nextMsg) return b ? 'single' : 'first'
										if (prevMsg && !nextMsg) return a ? 'single' : 'last'
										if (a && b) return 'single'
										if (a) return 'first'
										if (b) return 'last'
										return 'middle'
									})()

									const lastMessageIndex = sortedMessagesForList.length - 1
									const isLastMessageItem = index === lastMessageIndex
									const replyMessage = replyMap[msg.id]
									const replyPreview = replyMessage
										? {
												sender: getSenderName(replyMessage),
												text: getMessagePreview(replyMessage),
											}
										: undefined

									let showDateDivider = false
									let dateDividerText = ''
									const ts = getMessageTimestamp(msg)
									if (ts) {
										const currentMsgDate = new Date(ts)
										if (!isNaN(currentMsgDate.getTime())) {
											if (index === 0) {
												showDateDivider = true
											} else if (prevMsg) {
												const prevTs = getMessageTimestamp(prevMsg)
												if (prevTs) {
													const prevMsgDate = new Date(prevTs)
													if (
														!isNaN(prevMsgDate.getTime()) &&
														(currentMsgDate.getDate() !== prevMsgDate.getDate() ||
															currentMsgDate.getMonth() !== prevMsgDate.getMonth() ||
															currentMsgDate.getFullYear() !== prevMsgDate.getFullYear())
													) {
														showDateDivider = true
													}
												}
											}
										}
									}

									if (showDateDivider && ts) {
										const d = new Date(ts)
										if (!isNaN(d.getTime())) {
											const now = new Date()
											const isToday =
												d.getDate() === now.getDate() &&
												d.getMonth() === now.getMonth() &&
												d.getFullYear() === now.getFullYear()
											const yesterday = new Date(now)
											yesterday.setDate(yesterday.getDate() - 1)
											const isYesterday =
												d.getDate() === yesterday.getDate() &&
												d.getMonth() === yesterday.getMonth() &&
												d.getFullYear() === yesterday.getFullYear()
											if (isToday) {
												dateDividerText = 'Сегодня'
											} else if (isYesterday) {
												dateDividerText = 'Вчера'
											} else {
												dateDividerText = d.toLocaleDateString('ru-RU', {
													day: 'numeric',
													month: 'long',
													...(d.getFullYear() !== now.getFullYear()
														? { year: 'numeric' as const }
														: {}),
												})
											}
										}
									}

									return (
										<Fragment key={msg.id || `msg-${index}`}>
											{showDateDivider && (
												<ChatDateSeparator label={dateDividerText} />
											)}
											<div
												ref={el => {
													messageRefs.current[msg.id] = el
													if (isLastMessageItem) messagesEndRef.current = el
												}}
												className='w-full px-0.5'
											>
												<MessageBubble
													msg={msg}
													theme={messageTheme}
													groupPosition={groupPosition}
													sender={
														msg.group_id || selectedGroup?.id
															? groupParticipants[msg.sender_id]
															: msg.channel_id || isStandaloneChannel
																? channelParticipants[msg.sender_id]
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
													onBotModal={handleBotModal}
												onBotGamePlay={game => setActiveBotGame(game)}
												onSenderClick={(senderId) => {
													const friend = friends?.find((f: any) => String(f.id) === String(senderId))
													const groupUser = groupParticipants[senderId]
													const channelUser = channelParticipants[senderId]
													const target = friend || groupUser || channelUser
													if (target) { setSelectedUserForModal(target); setIsUserProfileModalOpen(true) }
												}}
											/>
											</div>
										</Fragment>
									)
								})}

								{isChatTyping && (
									<motion.div
										initial={{ opacity: 0, y: 4 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ duration: 0.2 }}
										className='flex items-end gap-2 pl-11 py-2'
									>
										<div className='chat-bubble-other px-4 py-3 rounded-2xl rounded-bl-md flex items-center gap-1.5'>
											<span className='w-1.5 h-1.5 bg-[color:var(--app-muted)] rounded-full animate-bounce [animation-delay:-0.3s]' />
											<span className='w-1.5 h-1.5 bg-[color:var(--app-muted)] rounded-full animate-bounce [animation-delay:-0.15s]' />
											<span className='w-1.5 h-1.5 bg-[color:var(--app-muted)] rounded-full animate-bounce' />
										</div>
									</motion.div>
								)}
							</div>
							{showScrollToBottom && (
								<button
									type='button'
									onClick={() => {
										forceScrollToBottomRef.current = true
										messagesEndRef.current?.scrollIntoView({
											behavior: 'smooth',
											block: 'end',
										})
										setShowScrollToBottom(false)
									}}
									className='absolute bottom-28 right-6 z-30 rounded-full bg-black/40 border border-white/10 px-4 py-2.5 text-xs text-gray-300 shadow-lg hover:bg-black/55 hover:text-white transition backdrop-blur-md'
								>
									Вниз
								</button>
							)}

							<div
								className={`chat-composer-bar p-4 backdrop-blur-md relative transition-all ${
									composerDragOver
										? 'ring-2 ring-indigo-500/40 bg-indigo-950/20'
										: ''
								}`}
								{...composerDropHandlers}
							>
								{composerDragOver && (
									<div className='pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-indigo-500/10 backdrop-blur-[1px]'>
										<p className='text-sm font-medium text-indigo-300'>
											Отпустите файлы для прикрепления
										</p>
									</div>
								)}
								{replyToMessage && (
									<div className='max-w-4xl mx-auto mb-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-2.5 text-xs text-gray-300'>
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
									className={`chat-composer-input max-w-4xl mx-auto flex items-end gap-3 p-2.5 rounded-2xl shadow-sm focus-within:ring-2 transition-all duration-300 ${currentBackground.ringColor.replace('focus:', 'focus-within:').replace('/50', '/25')}`}
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
												disabled={isBlockedChat || isBlockedUserChat || !canWriteToSelectedChannel || isUploading}
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
																	disabled={isBlockedChat || isBlockedUserChat || !canWriteToSelectedChannel}
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

											{pendingScheduledForChat.length > 0 && (
												<div className='absolute bottom-full left-0 right-0 mb-2 px-2'>
													<div className='flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200'>
														<Clock className='w-3.5 h-3.5 shrink-0' />
														<span>
															{pendingScheduledForChat.length}{' '}
															{pendingScheduledForChat.length === 1
																? 'отложенное сообщение'
																: 'отложенных сообщения'}
														</span>
													</div>
												</div>
											)}

											<SmartChatInput
												inputRef={messageInputRef}
												value={input}
												onChange={handleInputChange}
												onSend={handleSendMessage}
												disabled={!canWriteToSelectedChannel || isBlockedChat || isBlockedUserChat}
												placeholder={
													!canWriteToSelectedChannel
														? 'В этом канале писать может только владелец'
														: isBlockedChat || isBlockedUserChat
															? isBlockedByMeChat
																? 'Вы заблокировали этого пользователя'
																: hasBlockedMeChat
																	? 'Пользователь заблокировал вас'
																	: 'Пользователь заблокирован'
															: 'Напишите сообщение...'
												}
												users={mentionUsers}
												messages={messages}
												onScrollToMessage={jumpToMessage}
												className='flex-1 bg-transparent border-none text-white placeholder-gray-500 focus:ring-0 resize-none py-2.5 max-h-32 min-h-[44px] custom-scrollbar'
											/>

											<button
												onClick={() => {
													setIsPickerOpen(!isPickerOpen)
												}}
												disabled={isBlockedChat || !canWriteToSelectedChannel}
												className={`p-2.5 text-gray-400 hover:bg-gray-700/50 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
													isPickerOpen
														? 'text-indigo-400 bg-gray-700/50'
														: 'hover:text-indigo-400'
												}`}
												title='Эмодзи и стикеры'
											>
												<SmileIcon className='w-6 h-6' />
											</button>

											{input.trim() || files.length > 0 ? (
												<>
													{input.trim() && !isBotChat && !isAiChat && (
														<button
															type='button'
															onClick={() => setIsScheduleModalOpen(true)}
															disabled={
																!canWriteToSelectedChannel ||
																isBlockedChat ||
																isBlockedUserChat
															}
															className='p-2.5 text-gray-400 hover:text-amber-300 hover:bg-gray-700/50 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed'
															title='Отложенная отправка'
														>
															<Clock className='w-5 h-5' />
														</button>
													)}
													<button
														onClick={handleSendMessage}
														disabled={
															!canWriteToSelectedChannel || isBlockedChat || isBlockedUserChat || isUploading
														}
														className={`p-3 rounded-2xl transition-all duration-300 shadow-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed ${currentBackground.buttonBg} ${currentBackground.buttonHover} text-white translate-x-0 rotate-0`}
													>
														<SendIcon className='w-5 h-5' />
													</button>
												</>
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
						<div className='flex-1 flex flex-col items-center justify-center text-[var(--app-muted)] gap-6 p-8 relative overflow-hidden'>
							<div className='absolute inset-0 bg-gradient-to-tr from-[#2dd4a8]/5 via-transparent to-[#22b893]/5 pointer-events-none' />

							<div className='w-32 h-32 rounded-[2rem] bg-white/5 shadow-2xl flex items-center justify-center border border-white/6 rotate-12 transition-transform duration-700 hover:rotate-6 group'>
								<MessageSquareIcon className='w-16 h-16 text-[var(--app-muted)] group-hover:text-[var(--app-accent)]/50 transition-colors duration-500' />
							</div>

							<div className='text-center space-y-2 max-w-sm z-10'>
								<h3 className='text-2xl font-bold text-[var(--app-fg)]'>
									<span className='bg-gradient-to-r from-[#2dd4a8] to-[#22b893] bg-clip-text text-transparent'>
										Vondic
									</span>{' '}
									Мессенджер
								</h3>
								<p className='text-[var(--app-muted)]'>
									Выберите чат слева или найдите друга, чтобы начать общение.
								</p>
							</div>
						</div>
					)}
				</div>

				{/* Правая панель скрыта — вместо неё модалка профиля */}
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
								Создать сервер
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
									placeholder='О чём этот сервер?'
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
								Создать канал на сервере
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
									Сервер
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
									Ссылка-приглашение
								</label>
								<input
									type='text'
									value={joinInviteCode}
									onChange={e => setJoinInviteCode(e.target.value)}
									className='w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50'
									placeholder='https://…/feed/messages/join/channel/…'
									required
								/>
								<p className='mt-1 text-xs text-gray-500'>
									Можно вставить полную ссылку или путь /feed/messages/join/channel/…
								</p>
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
									Ссылка-приглашение
								</label>
								<input
									type='text'
									value={joinGroupInviteCode}
									onChange={e => setJoinGroupInviteCode(e.target.value)}
									className='w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50'
									placeholder='https://…/feed/messages/join/group/…'
									required
								/>
								<p className='mt-1 text-xs text-gray-500'>
									Можно вставить полную ссылку или путь /feed/messages/join/group/…
								</p>
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
								Вступить на сервер
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
									Ссылка-приглашение
								</label>
								<input
									type='text'
									value={joinCommunityInviteCode}
									onChange={e => setJoinCommunityInviteCode(e.target.value)}
									className='w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50'
									placeholder='https://…/feed/messages/join/…'
									autoFocus
								/>
							</div>
							<p className='text-xs text-gray-500'>
								Можно вставить полную ссылку-приглашение на сервер
							</p>
							<button
								type='submit'
								disabled={!joinCommunityInviteCode.trim()}
								className='w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
							>
								Вступить на сервер
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
												{friend.privacy_settings?.show_email === true &&
													friend.email && (
														<div className='text-xs text-gray-500 truncate'>
															{friend.email}
														</div>
													)}
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
							<h3 className='text-xl font-bold text-white'>
								Приглашение на сервер
							</h3>
							<button
								onClick={() => setShowInviteCode(false)}
								className='p-1 text-gray-400 hover:text-white transition-colors'
							>
								<XIcon className='w-5 h-5' />
							</button>
						</div>
						<div className='space-y-4'>
							<div className='bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3'>
								<div>
									<p className='text-xs text-gray-500 mb-1'>Ссылка-приглашение</p>
									<p className='text-sm text-indigo-300 break-all'>
										{serverJoinUrl(communityInviteCode)}
									</p>
								</div>
								<div className='flex gap-2'>
									<button
										type='button'
										onClick={() => {
											navigator.clipboard.writeText(
												serverJoinUrl(communityInviteCode),
											)
											showToast('Ссылка скопирована!', 'success')
										}}
										className='w-full rounded-lg bg-indigo-600 py-2 text-sm hover:bg-indigo-500'
									>
										Копировать ссылку
									</button>
								</div>
							</div>
							<p className='text-sm text-gray-400 text-center'>
								Как в Discord: по ссылке откроется{' '}
								<code className='text-gray-300'>/feed/messages/join/…</code>
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
								<div className='w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center ring-4 ring-gray-800/50 overflow-hidden'>
									{selectedChannel.avatar_url ? (
										<img src={getAvatarUrl(selectedChannel.avatar_url)} alt={selectedChannel.name} className='w-full h-full object-cover' />
									) : (
										<HashIcon className='w-8 h-8 text-gray-400' />
									)}
								</div>
								<div className='flex-1 min-w-0'>
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
								{String(selectedChannel.owner_id) === String(user?.id) && (
									<button
										onClick={() => {
											setIsChannelInfoOpen(false)
											setIsChannelSettingsOpen(true)
										}}
										className='px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors'
									>
										Редактировать
									</button>
								)}
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
									Приглашение
								</label>
								<p className='mb-2 text-sm text-indigo-300 break-all'>
									{channelJoinUrl(selectedChannel.invite_code)}
								</p>
								<div className='flex gap-2'>
									<button
										type='button'
										onClick={() => {
											navigator.clipboard.writeText(
												channelJoinUrl(selectedChannel.invite_code),
											)
											showToast('Ссылка скопирована', 'success')
										}}
										className='w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium'
									>
										Копировать ссылку
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			)}

			
				<DiscoveryModal
					isOpen={isDiscoveryOpen}
					onClose={() => setIsDiscoveryOpen(false)}
					searchChannels={searchChannels}
					searchCommunities={searchCommunities}
					joinChannel={joinChannel}
					joinCommunity={joinCommunity}
				/>

				<ChannelSettingsModal
					isOpen={isChannelSettingsOpen}
					onClose={() => setIsChannelSettingsOpen(false)}
					channel={selectedChannel}
					onUpdate={updateChannel}
				/>

				<CommunitySettingsModal
					isOpen={isCommunitySettingsOpen}
					onClose={() => setIsCommunitySettingsOpen(false)}
					community={selectedCommunity}
					onUpdate={updateCommunity}
				/>

{isScreenViewerOpen && isScreenSharing && (
				<ScreenShareViewer onClose={() => setIsScreenViewerOpen(false)} />
			)}

			{hasActiveCall && selectedFriend && (
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

			{isUserProfileModalOpen && selectedUserForModal && (
				<ProfileModal
					userId={selectedUserForModal.id}
					onClose={() => setIsUserProfileModalOpen(false)}
					onOpenSettings={() => { setIsUserProfileModalOpen(false); setIsSettingsOpen(true) }}
					onDeleteHistory={() => { setIsUserProfileModalOpen(false); setDeleteHistoryModalOpen(true) }}
					onDiscovery={() => { setIsUserProfileModalOpen(false); setIsDiscoveryOpen(true) }}
				/>
			)}

			<DeleteChatHistoryModal
				isOpen={deleteHistoryModalOpen}
				isLoading={isDeletingHistory}
				chatLabel={activeChatLabel}
				canDeleteForAll={canDeleteHistoryForAll}
				onClose={() => setDeleteHistoryModalOpen(false)}
				onConfirm={handleDeleteAllHistory}
			/>

			<BotGameUploadModal
				isOpen={botGameUploadOpen}
				botId={botGamesModalBotId || selectedFriend?.id || ''}
				botName={selectedFriend?.username}
				onClose={() => setBotGameUploadOpen(false)}
			/>

			{activeBotGame && (
				<div
					className='fixed inset-0 z-[100002] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4'
					onClick={() => setActiveBotGame(null)}
				>
					<div
						className='w-full max-w-2xl rounded-2xl border border-white/10 bg-gradient-to-br from-[#0b1220] to-[#1a1035] shadow-2xl overflow-hidden flex flex-col'
						style={{ height: '80vh' }}
						onClick={e => e.stopPropagation()}
					>
						<div className='flex items-center justify-between px-5 py-3 border-b border-white/10'>
							<h2 className='text-lg font-semibold text-white'>
								{activeBotGame.title || 'Игра'}
							</h2>
							<button
								type='button'
								onClick={() => setActiveBotGame(null)}
								className='p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10'
							>
								✕
							</button>
						</div>
						<div className='flex-1 relative'>
							<iframe
								title={activeBotGame.title || 'Игра'}
								src={activeBotGame.embed_url}
								className='absolute inset-0 w-full h-full border-0 bg-black'
								sandbox='allow-scripts allow-same-origin allow-pointer-lock'
								allow='fullscreen'
							/>
						</div>
					</div>
				</div>
			)}

			<ScheduleMessageModal
				isOpen={isScheduleModalOpen}
				onClose={() => setIsScheduleModalOpen(false)}
				chatLabel={activeChatLabel}
				onConfirm={scheduledAt => {
					const target = getCurrentChatTarget()
					const content = input.trim()
					if (!target || !content) return
					setScheduledMessages(prev => [
						...prev,
						{
							id: createScheduledMessageId(),
							scheduledAt,
							content,
							target,
							replyToId: replyToMessage?.id,
						},
					])
					setInput('')
					setReplyToMessage(null)
					setIsScheduleModalOpen(false)
					showToast('Сообщение запланировано', 'success')
				}}
			/>

			{isFoldersManageOpen && (
				<div
					className='fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4'
					onClick={() => setIsFoldersManageOpen(false)}
				>
					<div
						className='bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl'
						onClick={e => e.stopPropagation()}
					>
						<div className='flex items-center justify-between p-4 border-b border-gray-800'>
							<h3 className='text-lg font-bold text-white'>Папки чатов</h3>
							<button
								onClick={() => setIsFoldersManageOpen(false)}
								className='p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg'
							>
								<XIcon className='w-5 h-5' />
							</button>
						</div>
						<div className='p-4 space-y-4'>
							<div className='space-y-2 max-h-48 overflow-y-auto custom-scrollbar'>
								{chatFolders.length === 0 ? (
									<p className='text-sm text-gray-500 text-center py-4'>
										Папок пока нет
									</p>
								) : (
									chatFolders.map(folder => (
										<div
											key={folder.id}
											className='flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-gray-800/50'
										>
											<span className='text-sm text-gray-200 truncate'>
												{folder.icon ? `${folder.icon} ` : ''}
												{folder.name}
											</span>
											<span className='text-xs text-gray-500 shrink-0'>
												{folder.chats.length}
											</span>
											<button
												type='button'
												onClick={() => {
													setChatFolders(prev =>
														prev.filter(f => f.id !== folder.id),
													)
													if (activeFolderId === folder.id) {
														setActiveFolderId('all')
													}
												}}
												className='p-1 text-gray-400 hover:text-rose-400 rounded-lg'
												title='Удалить папку'
											>
												<Trash2Icon className='w-4 h-4' />
											</button>
										</div>
									))
								)}
							</div>
							<div className='flex gap-2'>
								<input
									type='text'
									value={newFolderName}
									onChange={e => setNewFolderName(e.target.value)}
									placeholder='Название папки'
									className='flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50'
								/>
								<button
									type='button'
									onClick={() => {
										const name = newFolderName.trim()
										if (!name) return
										setChatFolders(prev => [
											...prev,
											{ id: createFolderId(), name, chats: [] },
										])
										setNewFolderName('')
									}}
									className='px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl'
								>
									Добавить
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

		</div>
	)
}

