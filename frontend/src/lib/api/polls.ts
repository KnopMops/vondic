export interface PollOption {
	id: string
	text: string
}

export interface PollData {
	id: string
	question: string
	options: PollOption[]
	is_anonymous: boolean
	multiple_choice: boolean
	expires_at: string | null
	votes: Record<string, number>
	total_votes: number
	voter_ids?: Record<string, string[]>
}

export interface CreatePollPayload {
	question: string
	options: string[]
	is_anonymous?: boolean
	multiple_choice?: boolean
}

function getAuthHeaders(): Record<string, string> {
	const token = localStorage.getItem('access_token')
	return {
		'Content-Type': 'application/json',
		...(token ? { Authorization: `Bearer ${token}` } : {}),
	}
}

export async function createPoll(payload: CreatePollPayload): Promise<PollData> {
	const res = await fetch('/api/v1/polls', {
		method: 'POST',
		headers: getAuthHeaders(),
		body: JSON.stringify(payload),
	})
	if (!res.ok) {
		const err = await res.json().catch(() => ({}))
		throw new Error(err.error || 'Failed to create poll')
	}
	return res.json()
}

export async function getPoll(pollId: string): Promise<PollData> {
	const res = await fetch(`/api/v1/polls/${pollId}`, {
		headers: getAuthHeaders(),
	})
	if (!res.ok) {
		const err = await res.json().catch(() => ({}))
		throw new Error(err.error || 'Failed to get poll')
	}
	return res.json()
}

export async function votePoll(pollId: string, optionId: string): Promise<PollData> {
	const res = await fetch(`/api/v1/polls/${pollId}/vote`, {
		method: 'POST',
		headers: getAuthHeaders(),
		body: JSON.stringify({ option_id: optionId }),
	})
	if (!res.ok) {
		const err = await res.json().catch(() => ({}))
		throw new Error(err.error || 'Failed to vote')
	}
	return res.json()
}

export async function unvotePoll(pollId: string): Promise<PollData> {
	const res = await fetch(`/api/v1/polls/${pollId}/vote`, {
		method: 'DELETE',
		headers: getAuthHeaders(),
	})
	if (!res.ok) {
		const err = await res.json().catch(() => ({}))
		throw new Error(err.error || 'Failed to unvote')
	}
	return res.json()
}
