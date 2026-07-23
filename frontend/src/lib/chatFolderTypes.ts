export type ChatRefType = 'user' | 'group' | 'channel'

export type ChatRef = {
	type: ChatRefType
	id: string
}

export type ChatFolder = {
	id: string
	name: string
	icon?: string
	chats: ChatRef[]
}
