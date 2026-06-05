/** Ссылки-приглашения в мессенджере (каналы / серверы / группы). */

export type InviteEntity = 'server' | 'channel' | 'group' | 'community'

export type ParsedInviteLink = {
	entity: InviteEntity
	code: string
	path: string
	url: string
}

export function appOrigin(): string {
	if (typeof window !== 'undefined') return window.location.origin
	return process.env.NEXT_PUBLIC_APP_URL || ''
}

/** Сервер мессенджера (Discord: несколько каналов) */
export function serverJoinPath(codeOrId: string): string {
	return `/feed/messages/join/${encodeURIComponent(codeOrId)}`
}

export function serverJoinUrl(codeOrId: string): string {
	return `${appOrigin()}${serverJoinPath(codeOrId)}`
}

/** Канал (Telegram: один чат) */
export function channelJoinPath(codeOrId: string): string {
	return `/feed/messages/join/channel/${encodeURIComponent(codeOrId)}`
}

export function channelJoinUrl(codeOrId: string): string {
	return `${appOrigin()}${channelJoinPath(codeOrId)}`
}

/** Групповой чат */
export function groupJoinPath(codeOrId: string): string {
	return `/feed/messages/join/group/${encodeURIComponent(codeOrId)}`
}

export function groupJoinUrl(codeOrId: string): string {
	return `${appOrigin()}${groupJoinPath(codeOrId)}`
}

/** Публичное сообщество VK (стена) */
export function socialCommunityJoinPath(codeOrId: string): string {
	return `/feed/communities/join/${encodeURIComponent(codeOrId)}`
}

export function socialCommunityJoinUrl(codeOrId: string): string {
	return `${appOrigin()}${socialCommunityJoinPath(codeOrId)}`
}

export function messengerServerPath(serverId: string, channelId?: string): string {
	const params = new URLSearchParams({ server_id: serverId })
	if (channelId) params.set('channel_id', channelId)
	return `/feed/messages?${params.toString()}`
}

export function messengerChannelPath(channelId: string): string {
	return `/feed/messages?channel_id=${encodeURIComponent(channelId)}`
}

export function messengerGroupPath(groupId: string): string {
	return `/feed/messages?group_id=${encodeURIComponent(groupId)}`
}

/** Код или токен из ссылки-приглашения (или сам код, если вставлен без URL). */
export function parseInviteToken(raw: string): string {
	const s = raw.trim()
	const patterns = [
		/[?&]join_group=([^&#\s]+)/i,
		/\/join\/group\/([^/?#\s]+)/i,
		/\/join\/channel\/([^/?#\s]+)/i,
		/\/communities\/join\/([^/?#\s]+)/i,
		/\/join\/([^/?#\s]+)/i,
	]
	for (const re of patterns) {
		const match = s.match(re)
		if (match) return decodeURIComponent(match[1])
	}
	return s
}

function buildParsedInvite(entity: InviteEntity, code: string): ParsedInviteLink {
	const path =
		entity === 'group'
			? groupJoinPath(code)
			: entity === 'channel'
				? channelJoinPath(code)
				: entity === 'community'
					? socialCommunityJoinPath(code)
					: serverJoinPath(code)
	return {
		entity,
		code,
		path,
		url: `${appOrigin()}${path}`,
	}
}

/** Разбор ссылки-приглашения из текста или URL. */
export function parseInviteLink(raw: string): ParsedInviteLink | null {
	const s = raw.trim()
	if (!s) return null

	const groupMatch = s.match(
		/(?:https?:\/\/[^/]+)?\/feed\/messages\/join\/group\/([^/?#\s]+)/i,
	)
	if (groupMatch) return buildParsedInvite('group', decodeURIComponent(groupMatch[1]))

	const channelMatch = s.match(
		/(?:https?:\/\/[^/]+)?\/feed\/messages\/join\/channel\/([^/?#\s]+)/i,
	)
	if (channelMatch) return buildParsedInvite('channel', decodeURIComponent(channelMatch[1]))

	const communityMatch = s.match(
		/(?:https?:\/\/[^/]+)?\/feed\/communities\/join\/([^/?#\s]+)/i,
	)
	if (communityMatch) {
		return buildParsedInvite('community', decodeURIComponent(communityMatch[1]))
	}

	const serverMatch = s.match(
		/(?:https?:\/\/[^/]+)?\/feed\/messages\/join\/([^/?#\s]+)/i,
	)
	if (serverMatch) return buildParsedInvite('server', decodeURIComponent(serverMatch[1]))

	const queryMatch = s.match(/[?&]join_group=([^&#\s]+)/i)
	if (queryMatch) return buildParsedInvite('group', decodeURIComponent(queryMatch[1]))

	return null
}

export function isVondicInviteUrl(href: string): boolean {
	return (
		/\/feed\/(?:messages\/join|communities\/join)/i.test(href) ||
		/[?&]join_group=/i.test(href)
	)
}

export function inviteEntityLabel(entity: InviteEntity): string {
	switch (entity) {
		case 'group':
			return 'Группа'
		case 'channel':
			return 'Канал'
		case 'server':
			return 'Сервер'
		case 'community':
			return 'Сообщество'
	}
}
