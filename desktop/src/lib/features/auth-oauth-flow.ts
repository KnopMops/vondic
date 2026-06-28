/** Страница /login открыта из OAuth (/login?redirect=/oauth/authorize?...). */
export function isOAuthLoginRedirect(): boolean {
	if (typeof window === 'undefined') return false
	const params = new URLSearchParams(window.location.search)
	const target =
		params.get('redirect') || params.get('returnTo') || params.get('from') || ''
	return target.startsWith('/oauth/')
}
