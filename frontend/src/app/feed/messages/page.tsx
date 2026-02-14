'use client'

import { CallButton } from '@/components/calls'
import { useAuth } from '@/lib/AuthContext'
import { useChannels } from '@/lib/hooks/useChannels'
import { useChat } from '@/lib/hooks/useChat'
import { useDebounce } from '@/lib/hooks/useDebounce'
import { useGroups } from '@/lib/hooks/useGroups'
import { useSocket } from '@/lib/SocketContext'
import {
	useActiveCalls,
	useActiveGroupCallId,
	useCallStore,
	useIsInitialized,
	useIsWebRTCSupported,
} from '@/lib/stores/callStore'
import { useToast } from '@/lib/ToastContext'
import { Channel, Group, Message, User } from '@/lib/types'
import { getAttachmentUrl } from '@/lib/utils'
import Link from 'next/link'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import MessageBubble from './MessageBubble'

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
		<line x1='18' y1='6' x2='6' y2='18'></line>
		<line x1='6' y1='6' x2='18' y2='18'></line>
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
	'😂',
	'🤣',
	'😊',
	'😍',
	'🥰',
	'😘',
	'😜',
	'🤔',
	'😎',
	'🤩',
	'🥳',
	'😏',
	'😒',
	'😞',
	'😔',
	'😟',
	'😕',
	'😢',
	'😭',
	'😤',
	'😠',
	'😡',
	'🤬',
	'🤯',
	'😳',
	'🥵',
	'🥶',
	'😱',
	'😨',
	'😰',
	'😥',
	'😓',
	'🤗',
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
	'💪',
	'🧠',
	'🦴',
	'👀',
	'👁️',
	'👄',
	'💋',
	'👅',
	'👃',
	'👂',
	'🦶',
	'🦵',
	'👣',
	'🔥',
	'✨',
	'🌟',
	'💫',
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
	'👌',
	'🤏',
	'✌️',
	'🤞',
	'🤟',
	'🤘',
	'🤙',
]

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

export default function MessengerPage() {
	const { user } = useAuth()
	const { socket, isConnected } = useSocket()
	const SUPPORT_API_URL =
		process.env.NEXT_PUBLIC_SUPPORT_API_URL || 'http://127.0.0.1:8000'
	const [friends, setFriends] = useState<User[]>([])
	const [selectedFriend, setSelectedFriend] = useState<User | null>(null)
	const [isRagOpen, setIsRagOpen] = useState(false)
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
			const res = await fetch(`${SUPPORT_API_URL}/chat/send`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				mode: 'cors',
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
	const [input, setInput] = useState('')
	const [activeTab, setActiveTab] = useState<'direct' | 'community'>('direct')
	const messagesEndRef = useRef<HTMLDivElement>(null)
	const containerRef = useRef<HTMLDivElement>(null)
	const [prevScrollHeight, setPrevScrollHeight] = useState(0)
	const [isRestoringScroll, setIsRestoringScroll] = useState(false)

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

	// Sidebar Search State
	const [searchQuery, setSearchQuery] = useState('')

	// WebRTC Actions
	const {
		initiateCall,
		initiateGroupCall,
		joinVoiceChannel,
		leaveVoiceChannel,
		joinGroupCall,
	} = useCallStore()
	const activeGroupCallId = useActiveGroupCallId()
	const activeCalls = useActiveCalls()
	const isInitialized = useIsInitialized()
	const isWebRTCSupported = useIsWebRTCSupported()
	const debouncedSearchQuery = useDebounce(searchQuery, 500)
	const [userSearchResults, setUserSearchResults] = useState<User[]>([])
	const [isSearchingUsers, setIsSearchingUsers] = useState(false)

	// Message Search State
	const [isChatSearchOpen, setIsChatSearchOpen] = useState(false)
	const [chatSearchQuery, setChatSearchQuery] = useState('')
	const [foundMessages, setFoundMessages] = useState<Message[]>([])
	const [isSearchingMessages, setIsSearchingMessages] = useState(false)
	const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false)
	const emojiPickerRef = useRef<HTMLDivElement>(null)

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
	const settingsRef = useRef<HTMLDivElement>(null)

	// Load saved theme
	useEffect(() => {
		const savedThemeId = localStorage.getItem('chat_theme')
		if (savedThemeId) {
			const theme = BACKGROUNDS.find(bg => bg.id === savedThemeId)
			if (theme) setCurrentBackground(theme)
		}
	}, [])

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

	const handleAddMember = async (userId: string) => {
		if (!selectedGroup) return
		try {
			const details = await getGroupDetails(selectedGroup.id)
			if (!details || !details.invite_code) {
				throw new Error('Не удалось получить код приглашения')
			}

			if (socket) {
				socket.emit('send_message', {
					target_user_id: userId,
					content: `Привет! Присоединяйся к моей группе "${selectedGroup.name}"!\nКод приглашения: ${details.invite_code}`,
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
		localStorage.setItem('chat_theme', theme.id)
	}

	const {
		messages,
		sendMessage: sendChatMessage,
		loadMoreMessages,
		searchMessages,
		isLoading,
		isTyping,
		sendTyping,
		sendStopTyping,
		markMessagesAsRead,
	} = useChat(
		socket,
		user?.id,
		selectedFriend?.id,
		selectedChannel?.id,
		selectedGroup?.id,
	)

	// Typing Indicator Logic
	const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
	const isTypingRef = useRef(false)

	const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const newValue = e.target.value
		setInput(newValue)

		if (!selectedFriend) return

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

	// Read Receipts Logic
	useEffect(() => {
		if (!selectedFriend || !messages.length) return

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
						? { ...friend, status: data.status }
						: friend,
				),
			)
			setSelectedFriend(prev => {
				if (prev && prev.id === data.user_id) {
					return { ...prev, status: data.status }
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
			if (Array.isArray(data)) {
				setFriends(prev =>
					prev.map(friend =>
						data.includes(friend.id)
							? { ...friend, status: 'Online' }
							: { ...friend, status: 'Offline' },
					),
				)
			}
		}

		socket.on('user_status_change', handleStatusChange)
		socket.on('user_connected', handleUserConnected)
		socket.on('user_disconnected', handleUserDisconnected)
		socket.on('online_users', handleOnlineUsers)

		// Request initial online users list
		socket.emit('get_online_users')

		return () => {
			socket.off('user_status_change', handleStatusChange)
			socket.off('user_connected', handleUserConnected)
			socket.off('user_disconnected', handleUserDisconnected)
			socket.off('online_users', handleOnlineUsers)
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
					let friendList = Array.isArray(data) ? data : []

					// Add Vondic AI if not present
					const hasAI = friendList.some(
						f => f.username === 'Vondic AI' || f.username === 'vondic_ai',
					)
					if (!hasAI) {
						try {
							const aiRes = await fetch('/api/v1/auth/ai-user')
							if (aiRes.ok) {
								const aiUser = await aiRes.json()
								friendList = [aiUser, ...friendList]
							}
						} catch (e) {
							console.error('Failed to fetch AI user', e)
						}
					}

					setFriends(friendList)
				}
			} catch (e) {
				console.error(e)
			}
		}
		fetchFriends()
	}, [user])

	// Sidebar Search Effect
	useEffect(() => {
		const searchUsers = async () => {
			if (!debouncedSearchQuery.trim()) {
				setUserSearchResults([])
				setIsSearchingUsers(false)
				return
			}

			setIsSearchingUsers(true)
			try {
				const res = await fetch('/api/chats/search', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ query: debouncedSearchQuery }),
				})

				if (res.ok) {
					const data = await res.json()
					setUserSearchResults(Array.isArray(data) ? data : [])
				}
			} catch (error) {
				console.error('User search error:', error)
			} finally {
				setIsSearchingUsers(false)
			}
		}

		searchUsers()
	}, [debouncedSearchQuery])

	// Close emoji picker when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				emojiPickerRef.current &&
				!emojiPickerRef.current.contains(event.target as Node)
			) {
				setIsEmojiPickerOpen(false)
			}
		}

		if (isEmojiPickerOpen) {
			document.addEventListener('mousedown', handleClickOutside)
		}

		return () => {
			document.removeEventListener('mousedown', handleClickOutside)
		}
	}, [isEmojiPickerOpen])

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
		const results = await searchMessages(chatSearchQuery)
		setFoundMessages(results)
		setIsSearchingMessages(false)
	}

	const handleSendMessage = () => {
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
				sendChatMessage(hasText ? input.trim() : '', 'text', attachments)
				setInput('')
				setFiles([])
			} catch (e) {
				console.error('Message send failed', e)
				showToast('Не удалось отправить сообщение', 'error')
			} finally {
				setIsUploading(false)
			}
		}
		run()
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

	const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
		// Disable infinite scroll loading when searching messages
		if (isChatSearchOpen && chatSearchQuery) return

		const { scrollTop, scrollHeight } = e.currentTarget
		if (scrollTop < 30 && !isLoading && messages.length > 0) {
			setPrevScrollHeight(scrollHeight)
			setIsRestoringScroll(true)
			loadMoreMessages()
		}
	}

	// Handle scroll position
	useLayoutEffect(() => {
		if (isChatSearchOpen && chatSearchQuery) return // Don't handle scroll for search results

		if (isRestoringScroll && containerRef.current) {
			const newScrollHeight = containerRef.current.scrollHeight
			containerRef.current.scrollTop = newScrollHeight - prevScrollHeight
			setIsRestoringScroll(false)
		} else {
			// Scroll to bottom for new messages or initial load
			messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
		}
	}, [messages, isChatSearchOpen, chatSearchQuery])

	// Separate AI from other entities
	const aiFriend = friends.find(
		f => f.username === 'Vondic AI' || f.username === 'vondic_ai',
	)
	const otherFriends = friends.filter(
		f => f.username !== 'Vondic AI' && f.username !== 'vondic_ai',
	)
	const otherGroups = groups.filter(
		g => g.name !== 'Vondic AI' && g.name !== 'AI Assistant',
	)

	// Determine list to show in sidebar
	const sidebarList = searchQuery.trim() ? userSearchResults : otherFriends

	// Determine messages to show in chat
	const messagesToDisplay =
		isChatSearchOpen && chatSearchQuery ? foundMessages : messages

	return (
		<div className='flex h-[calc(100vh-4rem)] w-full overflow-hidden bg-gray-950 text-gray-100 font-sans'>
			{/* Sidebar */}
			<div className='w-80 flex flex-col border-r border-gray-800 bg-gray-950 flex-shrink-0 z-20 shadow-xl'>
				{/* Header */}
				<div className='p-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm'>
					<div className='flex justify-between items-center mb-4'>
						<div className='flex items-center gap-3'>
							<Link
								href='/feed'
								className='p-2 -ml-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors'
							>
								<ArrowLeftIcon className='w-5 h-5' />
							</Link>
							<h2 className='text-xl font-bold tracking-tight text-white flex items-center gap-2'>
								<span
									className={`bg-gradient-to-r ${currentBackground.gradientText} bg-clip-text text-transparent transition-all duration-500`}
								>
									Vondic
								</span>
								<span className='text-xs font-normal text-gray-500 px-2 py-0.5 border border-gray-700 rounded-full'>
									Beta
								</span>
							</h2>
						</div>
						<div
							className={`w-2.5 h-2.5 rounded-full ring-2 ring-gray-900 transition-colors ${
								isConnected ? 'bg-emerald-500' : 'bg-red-500'
							}`}
							title={isConnected ? 'Socket Connected' : 'Socket Disconnected'}
						/>
					</div>

					{/* Segmented control */}
					{activeTab !== 'community' && (
						<div className='flex p-1 bg-gray-900 rounded-lg border border-gray-800 relative'>
							<div
								className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-gray-700/50 rounded-md transition-all duration-300 ease-out ${
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
					)}
				</div>

				{/* Search Bar */}
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

				{/* List Area */}
				<div className='flex-1 overflow-y-auto custom-scrollbar px-2 space-y-1 pb-4'>
					{activeTab === 'direct' ? (
						<>
							{/* AI Assistant Chat */}
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
										<div
											className={`w-12 h-12 rounded-full flex items-center justify-center bg-indigo-600 ring-2 transition-all duration-300 ${
												selectedFriend?.id === aiFriend.id
													? currentBackground.accentColor.replace(
															'text-',
															'ring-',
														)
													: 'ring-gray-950'
											}`}
										>
											<svg
												viewBox='0 0 24 24'
												fill='none'
												stroke='currentColor'
												strokeWidth='2'
												strokeLinecap='round'
												strokeLinejoin='round'
												className='w-6 h-6 text-white'
											>
												<path d='M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z'></path>
												<path d='M12 16a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2z'></path>
												<path d='M5 9a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V11a2 2 0 0 1 2-2z'></path>
												<path d='M19 9a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V11a2 2 0 0 1 2-2z'></path>
												<path d='M12 8a6 6 0 0 0-6 6'></path>
												<path d='M18 14a6 6 0 0 0-6-6'></path>
											</svg>
										</div>
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
												Vondic AI
											</span>
											<span className='text-[10px] text-gray-600'>AI</span>
										</div>
										<span className='text-xs text-gray-500 truncate group-hover:text-gray-400 transition-colors'>
											Всегда онлайн
										</span>
									</div>
								</div>
							)}

							{sidebarList.length === 0 && (
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
									className={`group p-3 rounded-xl cursor-pointer flex items-center gap-3 transition-all duration-200 border border-transparent ${
										selectedFriend?.id === friend.id
											? `bg-gray-800/50 ${currentBackground.borderColor} shadow-sm`
											: 'hover:bg-gray-900 border-transparent'
									}`}
								>
									<div className='relative'>
										<img
											src={
												getAttachmentUrl(friend.avatar_url) ||
												'/default-avatar.png'
											}
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
										{/* Status Indicator (Only show for friends list, not search results usually, but API might return status) */}
										<div className='absolute bottom-0 right-0 w-3.5 h-3.5 bg-gray-950 rounded-full flex items-center justify-center'>
											<div
												className={`w-2.5 h-2.5 rounded-full ${
													friend.status?.toLowerCase() === 'online'
														? 'bg-emerald-500'
														: 'bg-gray-500'
												}`}
											/>
										</div>
									</div>
									<div className='flex flex-col flex-1 min-w-0'>
										<div className='flex justify-between items-baseline'>
											<span
												className={`font-semibold truncate transition-colors duration-300 ${
													selectedFriend?.id === friend.id
														? currentBackground.accentColor
														: 'text-gray-200 group-hover:text-white'
												}`}
											>
												{friend.username}
												{friend.premium && (
													<span className='ml-1 text-amber-400'>★</span>
												)}
											</span>
											<span className='text-[10px] text-gray-600'>12:30</span>
										</div>
										<span className='text-xs text-gray-500 truncate group-hover:text-gray-400 transition-colors'>
											{friend.status?.toLowerCase() === 'online'
												? 'В сети'
												: 'Не в сети'}
										</span>
									</div>
									{/* Call Button */}
									<CallButton
										userId={friend.id}
										userName={friend.username}
										isOnline={friend.status?.toLowerCase() === 'online'}
										isInCall={Array.from(activeCalls.values()).some(
											call => call.userId === friend.id,
										)}
										onCallInitiate={handleCallInitiate}
										className='ml-2'
									/>
								</div>
							))}

							{/* Groups Section */}
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
													<div className='flex justify-between items-baseline'>
														<span
															className={`font-semibold truncate transition-colors duration-300 ${
																selectedGroup?.id === group.id
																	? currentBackground.accentColor
																	: 'text-gray-200 group-hover:text-white'
															}`}
														>
															{group.name}
														</span>
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
							{/* Actions */}
							{!selectedCommunity && (
								<div className='flex gap-2 px-2'>
									<div className='flex-1 flex gap-2'>
										<button
											onClick={() => setIsCreateCommunityOpen(true)}
											className='flex-1 flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors'
										>
											<PlusIcon className='w-4 h-4' />
											Сообщество
										</button>
										<button
											onClick={() => setIsCreateCommChannelOpen(true)}
											className='flex-1 flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors'
										>
											<PlusIcon className='w-4 h-4' />
											Канал
										</button>
									</div>
									<button
										onClick={() => setIsJoinChannelOpen(true)}
										className='flex-1 flex items-center justify-center gap-2 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-medium rounded-lg transition-colors'
									>
										<LogInIcon className='w-4 h-4' />
										Вступить
									</button>
								</div>
							)}

							{/* Communities List */}
							{!selectedCommunity && (
								<div className='mt-2'>
									<div className='flex items-center justify-between mb-2 px-2'>
										<h3 className='text-xs font-semibold text-gray-500 uppercase tracking-wider'>
											Мои сообщества
										</h3>
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
														{comm.members_count ?? 0} участников
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
							)}

							{/* Selected Community Channels */}
							{selectedCommunity && (
								<div className='mt-2 px-2'>
									<div className='flex items-center justify-between mb-2 px-2'>
										<h3 className='text-xs font-semibold text-gray-500 uppercase tracking-wider'>
											{selectedCommunity.name}
										</h3>
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
															joinVoiceChannel(ch.id)
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

			{/* Chat Area */}
			<div
				className={`flex-1 flex flex-col relative min-w-0 transition-colors duration-500 ${currentBackground.class}`}
			>
				{/* Background Decoration */}
				<div className='absolute inset-0 bg-grid-pattern pointer-events-none opacity-20' />

				{selectedFriend || selectedChannel || selectedGroup ? (
					<>
						{/* Chat Header */}
						<div className='h-16 px-6 border-b border-gray-800/50 flex items-center justify-between bg-gray-900/40 backdrop-blur-md z-10 sticky top-0'>
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
											className='w-full bg-transparent border-none text-white placeholder-gray-500 focus:ring-0 text-sm'
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
										className='p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors'
									>
										<XIcon className='w-5 h-5' />
									</button>
								</div>
							) : (
								<>
									<div className='flex items-center gap-4'>
										<button
											onClick={() => {
												setActiveTab('community')
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
												<div className='relative'>
													<img
														src={
															getAttachmentUrl(selectedFriend.avatar_url) ||
															'/default-avatar.png'
														}
														className='w-10 h-10 rounded-full object-cover bg-gray-800 ring-2 ring-gray-800/50'
														alt={selectedFriend.username}
													/>
													{selectedFriend.status?.toLowerCase() ===
														'online' && (
														<div className='absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-gray-900 rounded-full animate-pulse' />
													)}
												</div>
												<div className='flex flex-col'>
													<span className='font-bold text-white text-base leading-tight'>
														{selectedFriend.username}
														{selectedFriend.premium && (
															<span className='ml-1 text-amber-400'>★</span>
														)}
													</span>
													<span className='text-xs text-emerald-500 font-medium flex items-center gap-1.5'>
														{selectedFriend.status?.toLowerCase() ===
														'online' ? (
															<>
																<span className='w-1.5 h-1.5 rounded-full bg-emerald-500' />
																В сети
															</>
														) : (
															<span className='text-gray-500'>Не в сети</span>
														)}
													</span>
												</div>
											</>
										) : selectedChannel ? (
											<>
												<div className='relative'>
													<div className='w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center ring-2 ring-gray-800/50'>
														<HashIcon className='w-5 h-5 text-gray-400' />
													</div>
												</div>
												<div className='flex flex-col'>
													<span className='font-bold text-white text-base leading-tight'>
														{selectedChannel.name}
													</span>
													<span className='text-xs text-gray-500 font-medium flex items-center gap-1.5'>
														<UsersIcon className='w-3 h-3' />
														{selectedChannel.participants_count} участников
													</span>
												</div>
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
												<div className='flex flex-col'>
													<span className='font-bold text-white text-base leading-tight'>
														{selectedGroup.name}
													</span>
													<span className='text-xs text-gray-500 font-medium flex items-center gap-1.5'>
														<UsersIcon className='w-3 h-3' />
														Группа
													</span>
												</div>
												<button
													onClick={() => initiateGroupCall(selectedGroup.id)}
													className='ml-2 p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors'
													title='Начать групповой звонок'
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

									{/* Header Actions */}
									<div className='flex items-center gap-2'>
										<button
											onClick={() => setIsChatSearchOpen(true)}
											className='p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors'
										>
											<SearchIcon className='w-5 h-5' />
										</button>
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

											{/* Settings Dropdown */}
											{isSettingsOpen && (
												<div className='absolute right-0 top-full mt-2 w-64 bg-gray-900/95 backdrop-blur-xl border border-gray-800 rounded-xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-200'>
													<h3 className='text-sm font-semibold text-gray-300 mb-3'>
														Настройки чата
													</h3>

													<div className='space-y-4'>
														<div>
															<label className='text-xs text-gray-500 mb-2 block uppercase tracking-wider font-medium'>
																Фон чата
															</label>
															<div className='grid grid-cols-5 gap-2'>
																{BACKGROUNDS.map(bg => (
																	<button
																		key={bg.id}
																		onClick={() => handleThemeChange(bg)}
																		title={bg.name}
																		className={`w-8 h-8 rounded-full border-2 transition-all ${
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
														</div>
													</div>
												</div>
											)}
										</div>
									</div>
								</>
							)}
						</div>

						{/* Messages */}
						<div
							ref={containerRef}
							onScroll={handleScroll}
							className='flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar scroll-smooth'
						>
							{/* Loading State for History */}
							{isLoading && messages.length > 0 && !isChatSearchOpen && (
								<div className='flex justify-center py-4'>
									<div
										className={`w-6 h-6 border-2 border-t-transparent rounded-full animate-spin ${currentBackground.borderColor.replace(
											'/20',
											'',
										)}`}
									/>
								</div>
							)}

							{/* Date Divider (Mockup) */}
							{!isChatSearchOpen && (
								<div className='flex justify-center my-4'>
									<span className='text-[10px] font-medium text-gray-500 bg-gray-900/60 px-3 py-1 rounded-full backdrop-blur-sm'>
										Сегодня
									</span>
								</div>
							)}

							{/* Search Results Header */}
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
								!isLoading &&
								!isSearchingMessages && (
									<div className='flex flex-col h-full items-center justify-center text-gray-500 space-y-4 opacity-0 animate-in fade-in duration-700 fill-mode-forwards'>
										<div className='w-24 h-24 rounded-3xl bg-gray-900/50 flex items-center justify-center border border-gray-800/50 rotate-3 transition-transform hover:rotate-6 duration-500'>
											<MessageSquareIcon className='w-12 h-12 text-gray-700' />
										</div>
										<div className='text-center space-y-1'>
											<p className='text-lg font-medium text-gray-300'>
												{isChatSearchOpen
													? 'Ничего не найдено'
													: 'Нет сообщений'}
											</p>
											{!isChatSearchOpen && (
												<p className='text-sm text-gray-600'>
													Напишите первое сообщение, чтобы начать диалог
												</p>
											)}
										</div>
									</div>
								)}

							{messagesToDisplay.map((msg, index) => {
								const isLast = index === messagesToDisplay.length - 1
								return (
									<div
										key={msg.id || index}
										ref={isLast ? messagesEndRef : null}
										className='w-full'
									>
										<MessageBubble
											msg={msg}
											theme={currentBackground}
											sender={
												msg.group_id || selectedGroup?.id
													? groupParticipants[msg.sender_id]
													: undefined
											}
										/>
									</div>
								)
							})}

							{/* Typing Indicator */}
							{isTyping && (
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

						{/* Input Area */}
						<div className='p-4 bg-gray-900/40 backdrop-blur-md border-t border-gray-800/50'>
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
										{/* Attach Button */}
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

										<textarea
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
												target.style.height = `${Math.min(target.scrollHeight, 128)}px`
											}}
										/>

										{/* Emoji Picker */}
										{isEmojiPickerOpen && (
											<div
												ref={emojiPickerRef}
												className='absolute bottom-full right-12 mb-2 p-2 bg-gray-900 border border-gray-800 rounded-xl shadow-xl w-64 h-64 overflow-y-auto grid grid-cols-6 gap-1 z-50 custom-scrollbar animate-in fade-in zoom-in-95 duration-200'
											>
												{EMOJIS.map(emoji => (
													<button
														key={emoji}
														onClick={() => setInput(prev => prev + emoji)}
														className='text-xl p-1 hover:bg-gray-800 rounded-md transition-colors'
													>
														{emoji}
													</button>
												))}
											</div>
										)}

										{/* Emoji Button */}
										<button
											onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
											className={`p-2.5 text-gray-400 hover:text-yellow-400 hover:bg-gray-700/50 rounded-full transition-all ${
												isEmojiPickerOpen
													? 'text-yellow-400 bg-gray-700/50'
													: ''
											}`}
										>
											<SmileIcon className='w-5 h-5' />
										</button>

										{/* Send/Mic Button */}
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
								Vondic Messenger
							</h3>
							<p className='text-gray-500'>
								Выберите чат слева или найдите друга, чтобы начать общение.
							</p>
						</div>
					</div>
				)}
			</div>

			{/* Create Channel Modal */}
			{isCreateChannelOpen && (
				<div className='fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4'>
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

			{/* Create Community Modal */}
			{isCreateCommunityOpen && (
				<div className='fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4'>
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

			{/* Create Community Channel Modal */}
			{isCreateCommChannelOpen && (
				<div className='fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4'>
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

			{/* Join Channel Modal */}
			{isJoinChannelOpen && (
				<div className='fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4'>
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

			{/* Create Group Modal */}
			{isCreateGroupOpen && (
				<div className='fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4'>
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

			{/* Join Group Modal */}
			{isJoinGroupOpen && (
				<div className='fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4'>
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

			{/* Add Member Modal */}
			{isAddMemberOpen && (
				<div className='fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4'>
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
												src={friend.avatar_url || '/default-avatar.png'}
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

			{/* Channel Info Modal */}
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
										{selectedChannel.participants_count} участников
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
		</div>
	)
}
