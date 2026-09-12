/**
 * Vondic Offline-First Multi-Tier Cache Storage (IndexedDB).
 * 
 * Provides Telegram-like instant chat opening (0ms) from local storage,
 * offline persistence, delta sync tracking, and local media/blob caching with LRU eviction.
 */

import { Message } from '@/lib/types'

const DB_NAME = 'vondic_cache_db'
const DB_VERSION = 1

export interface CachedMediaItem {
	url: string
	category: 'photo' | 'video' | 'audio' | 'file'
	blob: Blob
	sizeBytes: number
	cachedAt: number
}

export interface CacheStorageSummary {
	messagesCount: number
	photosBytes: number
	videosBytes: number
	audioBytes: number
	filesBytes: number
	totalBytes: number
}

let dbInstance: IDBDatabase | null = null
let dbOpeningPromise: Promise<IDBDatabase> | null = null

export function getIndexedDb(): Promise<IDBDatabase> {
	if (typeof window === 'undefined') {
		return Promise.reject(new Error('IndexedDB is not available in SSR'))
	}
	if (dbInstance) return Promise.resolve(dbInstance)
	if (dbOpeningPromise) return dbOpeningPromise

	dbOpeningPromise = new Promise((resolve, reject) => {
		const request = window.indexedDB.open(DB_NAME, DB_VERSION)

		request.onupgradeneeded = event => {
			const db = (event.target as IDBOpenDBRequest).result

			// 1. Messages store
			if (!db.objectStoreNames.contains('messages')) {
				const msgStore = db.createObjectStore('messages', { keyPath: 'id' })
				msgStore.createIndex('chat_id', 'chat_id', { unique: false })
				msgStore.createIndex('timestamp', 'timestamp', { unique: false })
				msgStore.createIndex('chat_and_time', ['chat_id', 'timestamp'], { unique: false })
			}

			// 2. Dialogs summary store (Sidebar instant previews)
			if (!db.objectStoreNames.contains('dialogs')) {
				const dialogStore = db.createObjectStore('dialogs', { keyPath: 'chat_id' })
				dialogStore.createIndex('updated_at', 'updated_at', { unique: false })
			}

			// 3. Media binary cache
			if (!db.objectStoreNames.contains('media')) {
				const mediaStore = db.createObjectStore('media', { keyPath: 'url' })
				mediaStore.createIndex('category', 'category', { unique: false })
				mediaStore.createIndex('cached_at', 'cachedAt', { unique: false })
			}
		}

		request.onsuccess = () => {
			dbInstance = request.result
			dbOpeningPromise = null
			resolve(dbInstance)
		}

		request.onerror = () => {
			dbOpeningPromise = null
			reject(request.error)
		}
	})

	return dbOpeningPromise
}

// ==============================================================================
// Message Caching API
// ==============================================================================

export async function getCachedMessagesForChat(
	chatId: string,
	limit = 50,
	beforeTimestamp?: string,
): Promise<Message[]> {
	try {
		const db = await getIndexedDb()
		return new Promise((resolve, reject) => {
			const tx = db.transaction('messages', 'readonly')
			const store = tx.objectStore('messages')
			const index = store.index('chat_and_time')

			let range: IDBKeyRange
			if (beforeTimestamp) {
				range = IDBKeyRange.bound([chatId, ''], [chatId, beforeTimestamp], false, true)
			} else {
				range = IDBKeyRange.bound([chatId, ''], [chatId, '\uffff'], false, false)
			}

			const messages: Message[] = []
			// Read backwards to get latest messages first
			const cursorReq = index.openCursor(range, 'prev')

			cursorReq.onsuccess = e => {
				const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result
				if (cursor && messages.length < limit) {
					messages.push(cursor.value)
					cursor.continue()
				} else {
					// Reverse to maintain chronological order
					messages.reverse()
					resolve(messages)
				}
			}

			cursorReq.onerror = () => reject(cursorReq.error)
		})
	} catch (e) {
		console.warn('[Cache] Failed to read cached messages:', e)
		return []
	}
}

export async function saveCachedMessages(messages: Message[], fallbackChatId?: string): Promise<void> {
	if (!messages || messages.length === 0) return
	try {
		const db = await getIndexedDb()
		const tx = db.transaction('messages', 'readwrite')
		const store = tx.objectStore('messages')

		for (const msg of messages) {
			if (!msg.id) continue
			const record: any = {
				...msg,
				chat_id:
					(msg as any).chat_id ||
					msg.group_id ||
					msg.channel_id ||
					fallbackChatId ||
					msg.sender_id,
				timestamp: msg.timestamp || new Date().toISOString(),
			}
			store.put(record)
		}

		return new Promise((resolve, reject) => {
			tx.oncomplete = () => resolve()
			tx.onerror = () => reject(tx.error)
		})
	} catch (e) {
		console.warn('[Cache] Failed to save messages into cache:', e)
	}
}

export async function saveCachedMessage(msg: Message, fallbackChatId?: string): Promise<void> {
	return saveCachedMessages([msg], fallbackChatId)
}

export async function deleteCachedMessage(id: string): Promise<void> {
	try {
		const db = await getIndexedDb()
		const tx = db.transaction('messages', 'readwrite')
		tx.objectStore('messages').delete(id)
	} catch (e) {
		console.warn('[Cache] Failed to delete message from cache:', e)
	}
}

export async function getLatestCachedTimestamp(chatId: string): Promise<string | null> {
	try {
		const db = await getIndexedDb()
		return new Promise(resolve => {
			const tx = db.transaction('messages', 'readonly')
			const store = tx.objectStore('messages')
			const index = store.index('chat_and_time')
			const range = IDBKeyRange.bound([chatId, ''], [chatId, '\uffff'], false, false)
			const cursorReq = index.openCursor(range, 'prev')

			cursorReq.onsuccess = e => {
				const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result
				if (cursor && cursor.value && cursor.value.timestamp) {
					resolve(cursor.value.timestamp)
				} else {
					resolve(null)
				}
			}
			cursorReq.onerror = () => resolve(null)
		})
	} catch {
		return null
	}
}

// ==============================================================================
// Media Caching API (Photos, Audio, Videos, Documents)
// ==============================================================================

export async function cacheMediaBlob(
	url: string,
	blob: Blob,
	category: 'photo' | 'video' | 'audio' | 'file' = 'photo',
): Promise<void> {
	if (!url || !blob) return
	try {
		const db = await getIndexedDb()
		const tx = db.transaction('media', 'readwrite')
		const item: CachedMediaItem = {
			url,
			category,
			blob,
			sizeBytes: blob.size,
			cachedAt: Date.now(),
		}
		tx.objectStore('media').put(item)
	} catch (e) {
		console.warn('[Cache] Failed to cache media blob:', e)
	}
}

export async function getCachedMediaUrl(url: string): Promise<string | null> {
	if (!url) return null
	try {
		const db = await getIndexedDb()
		return new Promise(resolve => {
			const tx = db.transaction('media', 'readonly')
			const req = tx.objectStore('media').get(url)

			req.onsuccess = () => {
				if (req.result && req.result.blob) {
					const objectUrl = URL.createObjectURL(req.result.blob)
					resolve(objectUrl)
				} else {
					resolve(null)
				}
			}
			req.onerror = () => resolve(null)
		})
	} catch {
		return null
	}
}

// ==============================================================================
// Telegram-Style Storage Management & Cache Cleanup
// ==============================================================================

export async function getCacheStorageSummary(): Promise<CacheStorageSummary> {
	const summary: CacheStorageSummary = {
		messagesCount: 0,
		photosBytes: 0,
		videosBytes: 0,
		audioBytes: 0,
		filesBytes: 0,
		totalBytes: 0,
	}

	try {
		const db = await getIndexedDb()

		// Count messages
		await new Promise<void>(resolve => {
			const tx = db.transaction('messages', 'readonly')
			const countReq = tx.objectStore('messages').count()
			countReq.onsuccess = () => {
				summary.messagesCount = countReq.result || 0
				// Estimate ~1.2 KB per cached text message with metadata
				const estimatedMessageBytes = summary.messagesCount * 1200
				summary.totalBytes += estimatedMessageBytes
				resolve()
			}
			countReq.onerror = () => resolve()
		})

		// Measure media categories
		await new Promise<void>(resolve => {
			const tx = db.transaction('media', 'readonly')
			const req = tx.objectStore('media').openCursor()

			req.onsuccess = e => {
				const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result
				if (cursor) {
					const item: CachedMediaItem = cursor.value
					const sz = item.sizeBytes || item.blob?.size || 0
					if (item.category === 'photo') summary.photosBytes += sz
					else if (item.category === 'video') summary.videosBytes += sz
					else if (item.category === 'audio') summary.audioBytes += sz
					else summary.filesBytes += sz

					summary.totalBytes += sz
					cursor.continue()
				} else {
					resolve()
				}
			}
			req.onerror = () => resolve()
		})
	} catch (e) {
		console.warn('[Cache] Failed to calculate cache storage summary:', e)
	}

	return summary
}

export async function clearCache(
	category?: 'all' | 'photo' | 'video' | 'audio' | 'file' | 'messages',
): Promise<void> {
	try {
		const db = await getIndexedDb()
		if (!category || category === 'all') {
			const tx = db.transaction(['messages', 'media'], 'readwrite')
			tx.objectStore('messages').clear()
			tx.objectStore('media').clear()
			return
		}

		if (category === 'messages') {
			const tx = db.transaction('messages', 'readwrite')
			tx.objectStore('messages').clear()
			return
		}

		// Clear specific media category
		const tx = db.transaction('media', 'readwrite')
		const store = tx.objectStore('media')
		const index = store.index('category')
		const range = IDBKeyRange.only(category)
		const req = index.openCursor(range)

		req.onsuccess = e => {
			const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result
			if (cursor) {
				cursor.delete()
				cursor.continue()
			}
		}
	} catch (e) {
		console.warn('[Cache] Failed to clear cache category:', category, e)
	}
}

export async function evictOldMedia(retentionDays: number): Promise<number> {
	if (!retentionDays || retentionDays <= 0) return 0
	const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000
	const cutoff = Date.now() - maxAgeMs
	let evictedCount = 0

	try {
		const db = await getIndexedDb()
		const tx = db.transaction('media', 'readwrite')
		const store = tx.objectStore('media')
		const index = store.index('cached_at')
		const range = IDBKeyRange.upperBound(cutoff, true)
		const req = index.openCursor(range)

		req.onsuccess = e => {
			const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result
			if (cursor) {
				cursor.delete()
				evictedCount++
				cursor.continue()
			}
		}
	} catch (e) {
		console.warn('[Cache] Failed to evict old media:', e)
	}

	return evictedCount
}
