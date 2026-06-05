const DANGEROUS_TAGS = new Set([
	'script',
	'iframe',
	'object',
	'embed',
	'link',
	'meta',
	'base',
	'form',
])

export function sanitizeMailHtml(html: string): string {
	if (typeof document === 'undefined') return html

	const template = document.createElement('template')
	template.innerHTML = html

	for (const tag of DANGEROUS_TAGS) {
		template.content.querySelectorAll(tag).forEach(el => el.remove())
	}

	template.content.querySelectorAll('*').forEach(node => {
		for (const attr of [...node.attributes]) {
			const name = attr.name.toLowerCase()
			const value = attr.value.trim().toLowerCase()
			if (
				name.startsWith('on') ||
				value.startsWith('javascript:') ||
				(name === 'href' && value.startsWith('data:'))
			) {
				node.removeAttribute(attr.name)
			}
		}
	})

	return template.innerHTML
}

export function htmlToPlainText(html: string): string {
	if (typeof document === 'undefined') {
		return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
	}
	const doc = new DOMParser().parseFromString(html, 'text/html')
	return (doc.body.textContent || '').replace(/\s+/g, ' ').trim()
}
