export interface User {
	id: string
	email: string
	username: string
	role: string
	avatar_url: string | null
	storis?: {
		id: string
		url: string
		type?: 'image' | 'video'
		created_at?: string
		reactions?: { user_id: string; emoji: string; created_at?: string }[]
	}[]
	description?: string
	birth_date?: string
	socket_id?: string | null
	status?: string
	premium?: boolean
	balance?: number
	gifts?: GiftItem[]
	disk_usage?: number
	disk_limit?: number
	telegram_id?: string | null
	profile_bg_theme?: string | null
	profile_bg_gradient?: string | null
}

export interface GiftItem {
	gift_id: string
	quantity: number
	from_user_id?: string
	created_at?: string
	is_displayed?: boolean
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
	is_deleted?: boolean
}
