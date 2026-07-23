const ACTIVE_KEY = 'active_chat_folder_v1'

export function chatRefKey(ref: any) { return ref.type + ':' + ref.id }
export function parseChatRefKey(key: string) {
  const [type, ...rest] = key.split(':')
  const id = rest.join(':')
  if (!id) return null
  if (type === 'user' || type === 'group' || type === 'channel') return { type, id }
  return null
}
export async function loadChatFolders() { return [] }
export function loadActiveFolderId() {
  if (typeof window === 'undefined') return 'all'
  return localStorage.getItem(ACTIVE_KEY) || 'all'
}
export function saveActiveFolderId(folderId: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(ACTIVE_KEY, folderId)
}
export function createFolderId() {
  return 'folder_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
}
export function chatInFolder(folders: any[], ref: any): string | null {
  const key = chatRefKey(ref)
  for (const folder of folders) {
    if (folder.chats.some((c: any) => chatRefKey(c) === key)) return folder.id
  }
  return null
}
export function matchesActiveFolder(folders: any[], activeFolderId: string, ref: any): boolean {
  if (!activeFolderId || activeFolderId === 'all') return true
  return chatInFolder(folders, ref) === activeFolderId
}
export async function assignChatToFolder(folders: any[], ref: any, folderId: string | null): Promise<any[]> {
  return folders
}
