const SAVED_ACCOUNTS_KEY = 'vondic_saved_accounts'
const MAX_ACCOUNTS = 5

/** 3 дня — после этого нужен повторный вход */
export const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000

export function isAccountStale(account: SavedAccount): boolean {
	return Date.now() - account.last_login_at > THREE_DAYS_MS
}

export interface SavedAccount {
	id: string
	email: string
	username: string
	avatar_url: string | null
	auth_provider?: 'email' | 'yandex'
	last_login_at: number
	added_at: number
	refresh_token?: string
}

export function getSavedAccounts(): SavedAccount[] {
	if (typeof window === 'undefined') return []
	try {
		const raw = localStorage.getItem(SAVED_ACCOUNTS_KEY)
		if (!raw) return []
		const parsed = JSON.parse(raw)
		if (!Array.isArray(parsed)) return []
		return parsed as SavedAccount[]
	} catch {
		return []
	}
}

export function saveAccount(account: SavedAccount): void {
	if (typeof window === 'undefined') return
	const accounts = getSavedAccounts()
	const existing = accounts.find(a => a.id === account.id)
	const merged: SavedAccount = {
		...(existing || {}),
		...account,
		id: account.id,
		email: account.email,
		username: account.username,
		avatar_url: account.avatar_url ?? existing?.avatar_url ?? null,
		last_login_at: account.last_login_at ?? existing?.last_login_at ?? Date.now(),
		added_at: Date.now(),
	}
	const filtered = accounts.filter(a => a.id !== account.id)
	filtered.unshift(merged)
	const limited = filtered.slice(0, MAX_ACCOUNTS)
	localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(limited))
}

export function removeSavedAccount(userId: string): void {
	if (typeof window === 'undefined') return
	const accounts = getSavedAccounts().filter(a => a.id !== userId)
	localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(accounts))
}

/** Сохранить refresh_token текущей сессии (из httpOnly cookie) в список аккаунтов */
export async function persistCurrentSessionTokens(
	userId: string,
): Promise<string | undefined> {
	if (typeof window === 'undefined') return undefined
	try {
		const res = await fetch('/api/auth/session-tokens', {
			credentials: 'include',
		})
		if (!res.ok) return undefined
		const data = await res.json().catch(() => ({}))
		const refreshToken = data?.refresh_token as string | undefined
		if (!refreshToken) return undefined
		const existing = getSavedAccounts().find(a => a.id === userId)
		if (existing) {
			saveAccount({
				...existing,
				refresh_token: refreshToken,
			})
		}
		return refreshToken
	} catch {
		return undefined
	}
}
