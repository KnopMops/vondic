

export function canPinChats(user: any): boolean {
    return true
}

export function togglePinChat(
    chatId: string,
    pinnedChatIds: string[],
    setPinnedChatIds: (ids: string[]) => void,
    user: any,
    saveToBackend?: (ids: string[]) => Promise<void>
): boolean {
    const isPinned = pinnedChatIds.includes(chatId)
    const newPinnedIds = isPinned
        ? pinnedChatIds.filter(id => id !== chatId)
        : [...pinnedChatIds, chatId]

    setPinnedChatIds(newPinnedIds)

    
    if (saveToBackend) {
        saveToBackend(newPinnedIds).catch(err => {
            console.error('Failed to save pinned chats:', err)
            
            setPinnedChatIds(pinnedChatIds)
        })
    }

    return !isPinned
}

export function sortChatsWithPinned<T extends { id: string }>(
    chats: T[],
    pinnedChatIds: string[],
    user?: any
): T[] {
    const pinned = chats.filter(chat => pinnedChatIds.includes(chat.id))
    const unpinned = chats.filter(chat => !pinnedChatIds.includes(chat.id))
    return [...pinned, ...unpinned]
}
