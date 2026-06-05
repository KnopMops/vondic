
import { getBackendUrl } from './url-fallback'

export const formatBytes = (bytes: number, decimals = 2) => {
	if (!+bytes) return '0 B'

	const k = 1024
	const dm = decimals < 0 ? 0 : decimals
	const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

	const i = Math.floor(Math.log(bytes) / Math.log(k))

	return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

export const getAttachmentUrl = (url: string | undefined | null) => {
	if (!url) return ''
	if (url.startsWith('http')) return url
	return `${getBackendUrl()}${url.startsWith('/') ? '' : '/'}${url}`
}

export const getAvatarUrl = (url: string | undefined | null) => {
	const fallback = '/static/default-avatar.png'
	return getAttachmentUrl(url || fallback)
}

export const parseAsUtc = (input: string | number | Date) => {
	if (input instanceof Date) return new Date(input.getTime())
	if (typeof input === 'number') return new Date(input)
	let s = String(input || '').trim()
	if (!s) return new Date(NaN)
	if (s.includes(' ') && !s.includes('T')) s = s.replace(' ', 'T')
	s = s.replace(/,(\d+)/, '.$1')
	if (/UTC$/i.test(s)) s = s.replace(/UTC$/i, 'Z')
	if (/[+-]\d{4}$/.test(s)) s = s.replace(/([+-]\d{2})(\d{2})$/, '$1:$2')
	if (/[+-]\d{2}$/.test(s)) s = s.replace(/([+-]\d{2})$/, '$1:00')
	if (/[zZ]|[+-]\d{2}:\d{2}$/.test(s)) {
		const d = new Date(s)
		if (!isNaN(d.getTime())) return d
	}
	if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s = `${s}T00:00:00`
	if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) s = `${s}:00`
	if (!/[zZ]|[+-]\d{2}:\d{2}$/.test(s)) s = `${s}Z`
	return new Date(s)
}

export const formatMskDateTime = (
	input: string | number | Date,
	options?: Intl.DateTimeFormatOptions,
) => {
	try {
		const base = parseAsUtc(input)
		if (isNaN(base.getTime())) return ''
		return base.toLocaleString('ru-RU', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			timeZone: 'Europe/Moscow',
			...options,
		})
	} catch {
		return ''
	}
}

export const formatMskTime = (input: string | number | Date) => {
	try {
		const base = parseAsUtc(input)
		if (isNaN(base.getTime())) return ''
		return base.toLocaleTimeString('ru-RU', {
			hour: '2-digit',
			minute: '2-digit',
			timeZone: 'Europe/Moscow',
		})
	} catch {
		return ''
	}
}
