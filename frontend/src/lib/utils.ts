
export const getAttachmentUrl = (url: string | undefined | null) => {
	if (!url) return ''
	if (url.startsWith('http')) return url
	const backendUrl =
		process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'
	return `${backendUrl}${url.startsWith('/') ? '' : '/'}${url}`
}
