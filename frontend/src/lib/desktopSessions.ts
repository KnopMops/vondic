type DesktopSession = {
	access_token: string
	refresh_token: string
	user: any
	createdAt: number
}

const sessions = new Map<string, DesktopSession>()

export function setDesktopSession(
	cid: string,
	data: { access_token: string; refresh_token: string; user: any },
) {
	sessions.set(cid, {
		access_token: data.access_token,
		refresh_token: data.refresh_token,
		user: data.user,
		createdAt: Date.now(),
	})
}

export function consumeDesktopSession(cid: string): DesktopSession | null {
	const data = sessions.get(cid)
	if (!data) return null
	return data
}
