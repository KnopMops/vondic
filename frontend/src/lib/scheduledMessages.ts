export type ScheduledMessageTarget = {
	type: 'user' | 'group' | 'channel'
	id: string
}

export type ScheduledMessage = {
	id: string
	scheduledAt: string
	content: string
	target: ScheduledMessageTarget
	replyToId?: string
}

const STORAGE_KEY = 'scheduled_messages_v1'

export function loadScheduledMessages(): ScheduledMessage[] {
	if (typeof window === 'undefined') return []
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		if (!raw) return []
		const parsed = JSON.parse(raw)
		return Array.isArray(parsed) ? parsed : []
	} catch {
		return []
	}
}

export function saveScheduledMessages(items: ScheduledMessage[]) {
	if (typeof window === 'undefined') return
	localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export function createScheduledMessageId() {
	return `sched_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function getDueScheduledMessages(
	items: ScheduledMessage[],
	now = Date.now(),
): ScheduledMessage[] {
	return items.filter(item => {
		const at = new Date(item.scheduledAt).getTime()
		return Number.isFinite(at) && at <= now
	})
}

export function getPendingForTarget(
	items: ScheduledMessage[],
	target: ScheduledMessageTarget,
): ScheduledMessage[] {
	return items
		.filter(
			item =>
				item.target.type === target.type && item.target.id === target.id,
		)
		.sort(
			(a, b) =>
				new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
		)
}
