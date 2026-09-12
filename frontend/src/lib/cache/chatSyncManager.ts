/**
 * Vondic Chat Delta-Sync Manager (Telegram-Style Stale-While-Revalidate).
 * 
 * Guarantees zero-millisecond UI rendering on chat switches,
 * followed by background incremental synchronization of new/edited messages.
 */

import { Message } from '@/lib/types'
import {
	getCachedMessagesForChat,
	getLatestCachedTimestamp,
	saveCachedMessages,
} from './indexedDbStorage'

export interface SyncResult {
	messages: Message[]
	isFromCache: boolean
	hasMore: boolean
}

const syncInProgress = new Set<string>()

export async function loadChatWithStaleWhileRevalidate(
	chatId: string,
	fetchRemoteDelta: (sinceTimestamp: string | null) => Promise<Message[]>,
	onDeltaMerged?: (updatedMessages: Message[]) => void,
): Promise<SyncResult> {
	// 1. Immediately read from local IndexedDB cache
	const cached = await getCachedMessagesForChat(chatId, 50)
	const latestTimestamp = await getLatestCachedTimestamp(chatId)

	// 2. Launch background delta sync if not already syncing
	if (!syncInProgress.has(chatId)) {
		syncInProgress.add(chatId)
		// Run sync asynchronously without blocking the UI
		;(async () => {
			try {
				const remoteMessages = await fetchRemoteDelta(latestTimestamp)
				if (remoteMessages && remoteMessages.length > 0) {
					// Merge cached + remote with deduplication by ID
					const map = new Map<string, Message>()
					for (const m of cached) {
						if (m.id) map.set(m.id, m)
					}
					for (const m of remoteMessages) {
						if (m.id) map.set(m.id, m)
					}

					const merged = Array.from(map.values()).sort(
						(a, b) =>
							new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
					)

					// Persist new delta into IndexedDB
					await saveCachedMessages(remoteMessages, chatId)

					if (onDeltaMerged) {
						onDeltaMerged(merged)
					}
				}
			} catch (err) {
				console.warn('[SyncManager] Background delta sync error:', err)
			} finally {
				syncInProgress.delete(chatId)
			}
		})()
	}

	return {
		messages: cached,
		isFromCache: cached.length > 0,
		hasMore: cached.length >= 30,
	}
}

/**
 * Deduplicates and merges an array of existing messages with incoming messages.
 */
export function mergeMessageLists(existing: Message[], incoming: Message[]): Message[] {
	const map = new Map<string, Message>()
	for (const m of existing) {
		if (m.id) map.set(m.id, m)
	}
	for (const m of incoming) {
		if (m.id) map.set(m.id, m)
	}
	return Array.from(map.values()).sort(
		(a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
	)
}
