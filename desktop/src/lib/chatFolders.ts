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

const STORAGE_KEY = 'chat_folders_v1'
const ACTIVE_KEY = 'active_chat_folder_v1'

export function chatRefKey(ref: ChatRef): string {
	return `${ref.type}:${ref.id}`
}

export function parseChatRefKey(key: string): ChatRef | null {
	const [type, ...rest] = key.split(':')
	const id = rest.join(':')
	if (!id) return null
	if (type === 'user' || type === 'group' || type === 'channel') {
		return { type, id }
	}
	return null
}

export function loadChatFolders(): ChatFolder[] {
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

export function saveChatFolders(folders: ChatFolder[]) {
	if (typeof window === 'undefined') return
	localStorage.setItem(STORAGE_KEY, JSON.stringify(folders))
}

export function loadActiveFolderId(): string {
	if (typeof window === 'undefined') return 'all'
	return localStorage.getItem(ACTIVE_KEY) || 'all'
}

export function saveActiveFolderId(folderId: string) {
	if (typeof window === 'undefined') return
	localStorage.setItem(ACTIVE_KEY, folderId)
}

export function createFolderId() {
	return `folder_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function chatInFolder(folders: ChatFolder[], ref: ChatRef): string | null {
	const key = chatRefKey(ref)
	for (const folder of folders) {
		if (folder.chats.some(c => chatRefKey(c) === key)) {
			return folder.id
		}
	}
	return null
}

export function matchesActiveFolder(
	folders: ChatFolder[],
	activeFolderId: string,
	ref: ChatRef,
): boolean {
	if (!activeFolderId || activeFolderId === 'all') return true
	return chatInFolder(folders, ref) === activeFolderId
}

export function assignChatToFolder(
	folders: ChatFolder[],
	ref: ChatRef,
	folderId: string | null,
): ChatFolder[] {
	const key = chatRefKey(ref)
	const next = folders.map(f => ({
		...f,
		chats: f.chats.filter(c => chatRefKey(c) !== key),
	}))
	if (!folderId || folderId === 'all') {
		return next
	}
	const idx = next.findIndex(f => f.id === folderId)
	if (idx < 0) return next
	next[idx] = {
		...next[idx],
		chats: [...next[idx].chats, ref],
	}
	return next
}
