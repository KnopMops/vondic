import type { ChatFolder } from '@/lib/chatFolderTypes'

const API = '/api/v1/chat-folders'

async function authHeaders(): Promise<Record<string, string>> {
	try {
		const res = await fetch('/api/auth/me')
		const data = await res.json()
		const token = data?.user?.access_token || data?.access_token
		if (token) return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
	} catch {}
	return { 'Content-Type': 'application/json' }
}

export async function fetchFolders(): Promise<ChatFolder[]> {
	const headers = await authHeaders()
	const res = await fetch(API, { headers })
	if (!res.ok) return []
	const data = await res.json()
	return (Array.isArray(data) ? data : []).map((f: any) => ({
		id: f.id,
		name: f.name,
		icon: f.icon,
		chats: (f.chats || []).map((c: any) => ({ type: c.type, id: c.chat_id })),
	}))
}

export async function createFolder(name: string, icon: string): Promise<ChatFolder | null> {
	const headers = await authHeaders()
	const res = await fetch(API, { method: 'POST', headers, body: JSON.stringify({ name, icon }) })
	if (!res.ok) return null
	const f = await res.json()
	return { id: f.id, name: f.name, icon: f.icon, chats: [] }
}

export async function updateFolder(id: string, data: { name?: string; icon?: string }): Promise<boolean> {
	const headers = await authHeaders()
	const res = await fetch(`${API}/${id}`, { method: 'PUT', headers, body: JSON.stringify(data) })
	return res.ok
}

export async function deleteFolder(id: string): Promise<boolean> {
	const headers = await authHeaders()
	const res = await fetch(`${API}/${id}`, { method: 'DELETE', headers })
	return res.ok
}

export async function addChatToFolder(folderId: string, chatType: string, chatId: string): Promise<boolean> {
	const headers = await authHeaders()
	const res = await fetch(`${API}/${folderId}/items`, {
		method: 'POST', headers, body: JSON.stringify({ type: chatType, chat_id: chatId }),
	})
	return res.ok
}

export async function removeChatFromFolder(folderId: string, chatType: string, chatId: string): Promise<boolean> {
	const headers = await authHeaders()
	const res = await fetch(`${API}/${folderId}/items`, {
		method: 'DELETE', headers, body: JSON.stringify({ type: chatType, chat_id: chatId }),
	})
	return res.ok
}
