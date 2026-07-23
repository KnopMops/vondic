export interface CreateScheduledParams {
	content: string
	target_user_id?: string
	channel_id?: string
	group_id?: string
	scheduled_at: string
	type?: string
}

export interface ScheduledMessageApi {
	id: string
	content: string
	target_user_id?: string
	channel_id?: string
	group_id?: string
	scheduled_at: string
	type?: string
}

async function authHeaders(): Promise<Record<string, string>> {
	try {
		const res = await fetch('/api/auth/me')
		const data = await res.json()
		const token = data?.user?.access_token || data?.access_token
		if (token) return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
	} catch {}
	return { 'Content-Type': 'application/json' }
}

export async function createScheduled(params: CreateScheduledParams): Promise<ScheduledMessageApi | null> {
	const headers = await authHeaders()
	const res = await fetch('/api/v1/scheduled-messages', {
		method: 'POST', headers, body: JSON.stringify(params),
	})
	if (!res.ok) {
		const err = await res.json().catch(() => ({}))
		console.error('createScheduled error:', err)
		return null
	}
	return res.json()
}

export async function listScheduled(): Promise<ScheduledMessageApi[]> {
	const headers = await authHeaders()
	const res = await fetch('/api/v1/scheduled-messages', { headers })
	if (!res.ok) return []
	const data = await res.json()
	return Array.isArray(data) ? data : []
}

export async function listScheduledForChat(target: { type: string; id: string }): Promise<ScheduledMessageApi[]> {
	const headers = await authHeaders()
	const body: Record<string, string> = {}
	if (target.type === 'user') body.target_user_id = target.id
	else if (target.type === 'channel') body.channel_id = target.id
	else if (target.type === 'group') body.group_id = target.id
	const res = await fetch('/api/v1/scheduled-messages/chat', {
		method: 'POST', headers, body: JSON.stringify(body),
	})
	if (!res.ok) return []
	const data = await res.json()
	return Array.isArray(data) ? data : []
}

export async function cancelScheduled(id: string): Promise<boolean> {
	const headers = await authHeaders()
	const res = await fetch(`/api/v1/scheduled-messages/${id}`, { method: 'DELETE', headers })
	return res.ok
}
