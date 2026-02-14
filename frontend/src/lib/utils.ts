
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
	const backendUrl =
		process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'
	return `${backendUrl}${url.startsWith('/') ? '' : '/'}${url}`
}

export const parseAsUtc = (input: string | number | Date) => {
	if (input instanceof Date) return new Date(input.getTime())
	if (typeof input === 'number') return new Date(input)
	const s = String(input || '')
	// If string has timezone info, let Date parse it
	if (/[zZ]|[+-]\d{2}:\d{2}$/.test(s)) return new Date(s)
	// Otherwise, treat as UTC by appending 'Z'
	return new Date(`${s}Z`)
}

export const formatMskDateTime = (
	input: string | number | Date,
	options?: Intl.DateTimeFormatOptions,
) => {
	const base = parseAsUtc(input)
	return base.toLocaleString('ru-RU', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		timeZone: 'Europe/Moscow',
		...options,
	})
}

export const formatMskTime = (input: string | number | Date) => {
	const base = parseAsUtc(input)
	return base.toLocaleTimeString('ru-RU', {
		hour: '2-digit',
		minute: '2-digit',
		timeZone: 'Europe/Moscow',
	})
}
