const STORAGE_KEY = 'post_login_redirect'
const COOKIE_KEY = 'post_login_redirect'

/** Сохранить путь возврата после входа (invite-ссылки и т.п.). */
export function storePostLoginRedirect(path: string): void {
	if (typeof window === 'undefined' || !path.startsWith('/')) return
	sessionStorage.setItem(STORAGE_KEY, path)
	document.cookie = `${COOKIE_KEY}=${encodeURIComponent(path)}; path=/; max-age=600; SameSite=Lax`
}

/** Куда отправить пользователя после успешного входа. */
export function consumePostLoginRedirect(fallback = '/feed'): string {
	if (typeof window === 'undefined') return fallback

	const params = new URLSearchParams(window.location.search)
	const fromQuery =
		params.get('returnTo') || params.get('redirect') || params.get('from')
	if (fromQuery && fromQuery.startsWith('/')) {
		sessionStorage.removeItem(STORAGE_KEY)
		return fromQuery
	}

	const stored = sessionStorage.getItem(STORAGE_KEY)
	if (stored?.startsWith('/')) {
		sessionStorage.removeItem(STORAGE_KEY)
		return stored
	}

	return fallback
}

export const POST_LOGIN_REDIRECT_COOKIE = COOKIE_KEY
