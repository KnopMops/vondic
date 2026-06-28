export type ColorSchemeId = 'purple' | 'blue' | 'dark-blue' | 'red'
export type AppPalette = {
	bg: string; fg: string; surface: string; border: string
	muted: string; accent: string; accent2: string
}
export const COLOR_SCHEME_STORAGE_KEY = 'app_color_scheme'
export const COLOR_SCHEMES = [
	{ id: 'purple' as const, name: 'Фиолетовая', palette: {
		bg: '#0f0e1b', fg: '#f3f2f8', surface: '#151326',
		border: 'rgba(139,92,246,0.14)', muted: '#8b89a8',
		accent: '#8b5cf6', accent2: '#a78bfa' }},
	{ id: 'blue' as const, name: 'Синяя', palette: {
		bg: '#0a0f1a', fg: '#eef2ff', surface: '#111827',
		border: 'rgba(59,130,246,0.14)', muted: '#8b9cb8',
		accent: '#3b82f6', accent2: '#60a5fa' }},
	{ id: 'dark-blue' as const, name: 'Тёмно-синяя', palette: {
		bg: '#050a14', fg: '#e8edf5', surface: '#0c1526',
		border: 'rgba(37,99,235,0.14)', muted: '#7a8ba8',
		accent: '#2563eb', accent2: '#3b82f6' }},
	{ id: 'red' as const, name: 'Красная', palette: {
		bg: '#140a0c', fg: '#f8f0f1', surface: '#1f1114',
		border: 'rgba(239,68,68,0.14)', muted: '#a89094',
		accent: '#ef4444', accent2: '#f87171' }},
]
export const DEFAULT_COLOR_SCHEME: ColorSchemeId = 'purple'
const hexToRgb = (hex: string) => {
	const r = hex.replace('#','')
	return `${parseInt(r.slice(0,2),16)} ${parseInt(r.slice(2,4),16)} ${parseInt(r.slice(4,6),16)}`
}
export const applyColorScheme = (id: ColorSchemeId | string) => {
	const scheme = COLOR_SCHEMES.find(s => s.id === id) ?? COLOR_SCHEMES[0]
	const p = scheme.palette
	const root = document.documentElement
	root.setAttribute('data-color-scheme', scheme.id)
	Object.entries(p).forEach(([k,v]) => root.style.setProperty(`--app-${k.replace('accent2','accent-2')}`, v))
	const accentRgb = hexToRgb(p.accent)
	root.style.setProperty('--app-bg-rgb', hexToRgb(p.bg))
	root.style.setProperty('--app-fg-rgb', hexToRgb(p.fg))
	root.style.setProperty('--app-surface-rgb', hexToRgb(p.surface))
	root.style.setProperty('--app-accent-rgb', accentRgb)
	root.style.setProperty('--chat-bubble-own', `linear-gradient(145deg, rgb(${accentRgb}/0.5), rgb(${accentRgb}/0.28))`)
}
export const initColorScheme = () => {
	const saved = localStorage.getItem(COLOR_SCHEME_STORAGE_KEY) as ColorSchemeId | null
	const id = COLOR_SCHEMES.some(s => s.id === saved) ? saved! : DEFAULT_COLOR_SCHEME
	applyColorScheme(id)
	return id
}
export const saveColorScheme = (id: ColorSchemeId) => {
	localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, id)
	localStorage.removeItem('app_palette_v1')
	applyColorScheme(id)
}
