export interface User {
	id: string
	email: string
	username: string
	role: string
	avatar_url: string | null
	description?: string
	birth_date?: string
	socket_id?: string | null
	status?: string
}

export interface Channel {
	id: string
	name: string
	description: string
	invite_code: string
	owner_id: string
	participants_count: number
}

export interface Group {
	id: string
	name: string
	avatar_url?: string | null
	participants?: string[]
	owner_id?: string
	invite_code?: string
}

export interface Attachment {
	url: string
	name: string
	ext: string
	size: number
}

export interface Message {
	id: string
	sender_id: string
	content: string
	timestamp: string
	isOwn: boolean
	is_read?: boolean
	channel_id?: string
	group_id?: string
	type?: 'text' | 'voice'
	attachments?: Attachment[]
}
