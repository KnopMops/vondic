import { Message } from '@/lib/types'
import { parseAsUtc } from '@/lib/utils'

export type MessageGroupPosition = 'single' | 'first' | 'middle' | 'last'

export type ChatListItem =
	| { type: 'date'; key: string; label: string }
	| {
			type: 'message'
			key: string
			msg: Message
			groupPosition: MessageGroupPosition
	  }

const GROUP_GAP_MS = 5 * 60 * 1000

export const getMessageTimestamp = (msg: Message) =>
	(msg as Message & { created_at?: string }).timestamp ||
	(msg as Message & { created_at?: string }).created_at ||
	''

export const getMskDayKey = (input: string | number | Date): string => {
	try {
		const base = parseAsUtc(input)
		if (isNaN(base.getTime())) return ''
		return base.toLocaleDateString('en-CA', { timeZone: 'Europe/Moscow' })
	} catch {
		return ''
	}
}

export const formatChatDateLabel = (input: string | number | Date): string => {
	try {
		const base = parseAsUtc(input)
		if (isNaN(base.getTime())) return ''
		const dayKey = getMskDayKey(base)
		const todayKey = getMskDayKey(new Date())
		if (dayKey === todayKey) return 'Сегодня'

		const yesterday = new Date()
		yesterday.setTime(Date.now() - 86_400_000)
		if (dayKey === getMskDayKey(yesterday)) return 'Вчера'

		const nowMskYear = Number(
			new Date().toLocaleString('en-US', {
				timeZone: 'Europe/Moscow',
				year: 'numeric',
			}),
		)
		const msgYear = Number(
			base.toLocaleString('en-US', {
				timeZone: 'Europe/Moscow',
				year: 'numeric',
			}),
		)

		return base.toLocaleDateString('ru-RU', {
			day: 'numeric',
			month: 'long',
			...(msgYear !== nowMskYear ? { year: 'numeric' as const } : {}),
			timeZone: 'Europe/Moscow',
		})
	} catch {
		return ''
	}
}

const messageTimeMs = (msg: Message): number => {
	const raw = getMessageTimestamp(msg)
	if (!raw) return 0
	const t = parseAsUtc(raw).getTime()
	return isNaN(t) ? 0 : t
}

export const isSameMessageCluster = (a: Message, b: Message): boolean => {
	if (!a || !b) return false
	if (a.sender_id !== b.sender_id) return false
	const tsA = getMessageTimestamp(a)
	const tsB = getMessageTimestamp(b)
	if (!tsA || !tsB) return false
	if (getMskDayKey(tsA) !== getMskDayKey(tsB)) return false
	const diff = Math.abs(messageTimeMs(a) - messageTimeMs(b))
	return diff <= GROUP_GAP_MS
}

export const getMessageGroupPosition = (
	msg: Message,
	prev?: Message,
	next?: Message,
): MessageGroupPosition => {
	const hasPrev = prev ? isSameMessageCluster(prev, msg) : false
	const hasNext = next ? isSameMessageCluster(msg, next) : false
	if (hasPrev && hasNext) return 'middle'
	if (hasPrev) return 'last'
	if (hasNext) return 'first'
	return 'single'
}

export const buildChatListItems = (messages: Message[]): ChatListItem[] => {
	const items: ChatListItem[] = []
	let lastDayKey = ''

	for (let i = 0; i < messages.length; i++) {
		const msg = messages[i]
		const ts = getMessageTimestamp(msg)
		const dayKey = ts ? getMskDayKey(ts) : ''

		if (dayKey && dayKey !== lastDayKey) {
			items.push({
				type: 'date',
				key: `date-${dayKey}`,
				label: formatChatDateLabel(ts),
			})
			lastDayKey = dayKey
		}

		items.push({
			type: 'message',
			key: msg.id || `msg-${i}`,
			msg,
			groupPosition: getMessageGroupPosition(
				msg,
				messages[i - 1],
				messages[i + 1],
			),
		})
	}

	return items
}
