export interface User {
	id: string
	email: string
	username: string
	role: string
	is_bot?: boolean
	avatar_url: string | null
	displayName?: string
	handle?: string
	registeredAt?: string
	last_seen?: string | Date
	storis?: {
		id: string
		url: string
		type?: 'image' | 'video'
		created_at?: string
		text?: string
		reactions?: { user_id: string; emoji: string; created_at?: string }[]
	}[]
	description?: string
	birth_date?: string
	socket_id?: string | null
	status?: string
	premium?: boolean
	premium_expired_at?: string | Date
	balance?: number
	gifts?: GiftItem[]
	disk_usage?: number
	disk_limit?: number
	storage_bonus?: number
	telegram_id?: string | null
	profile_bg_theme?: string | null
	profile_bg_gradient?: string | null
	profile_bg_image?: string | null
	is_blocked?: boolean
	blocked_by_admin?: string | null
	is_developer?: boolean
	video_channel_id?: string | null
	video_subscribers?: number
	video_count?: number
	video_likes?: string[]
	video_watch_later?: string[]
	video_history?: { video_id: string; last_watched_at?: string; position?: number }[]
	pinned_chats?: string[] // Array of user_ids or group_ids
}

export interface GiftItem {
	gift_id: string
	quantity: number
	from_user_id?: string
	created_at?: string
	is_displayed?: boolean
	comment?: string | null
}

export interface Channel {
	id: string
	name: string
	description: string
	invite_code: string
	owner_id: string
	participants_count: number
	community_id?: string | null
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

export interface Video {
	id: string
	author_id: string
	title: string
	description?: string
	url: string
	poster?: string | null
	duration?: number
	created_at?: string
	updated_at?: string
	views?: number
	likes?: number
	is_deleted?: boolean
	tags?: string[]
	author_name?: string
	author_avatar?: string | null
	author_premium?: boolean
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
	reply_to?: string
	type?: 'text' | 'voice' | 'image' | 'file'
	attachments?: Attachment[] | string
	is_deleted?: boolean
	forwarded_from?: {
		sender_id: string
		sender_name: string
		sender_avatar?: string | null
	}
	reply_markup?: {
		inline_keyboard: Array<Array<{
			text: string
			callback_data?: string
			url?: string
		}>>
	}
}
