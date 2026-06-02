const SAVED_ACCOUNTS_KEY = 'vondic_saved_accounts'
const MAX_ACCOUNTS = 5

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
