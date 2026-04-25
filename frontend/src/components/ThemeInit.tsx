'use client'

import { useEffect } from 'react'

type AppTheme = 'system' | 'dark' | 'light'

type AppPalette = {
	bg: string
	fg: string
	surface: string
	border: string
	muted: string
	accent: string
	accent2: string
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

const hexToRgbTriplet = (hex: string): string | null => {
	const raw = hex.trim().replace(/^#/, '')
	if (!/^[0-9a-fA-F]{6}$/.test(raw)) return null
	const r = Number.parseInt(raw.slice(0, 2), 16)
	const g = Number.parseInt(raw.slice(2, 4), 16)
	const b = Number.parseInt(raw.slice(4, 6), 16)
	return `${r} ${g} ${b}`
}

const applyTheme = (nextTheme: AppTheme) => {
	const root = document.documentElement
	if (nextTheme === 'system') {
		root.removeAttribute('data-theme')
		root.style.colorScheme = ''
		return
	}
	root.setAttribute('data-theme', nextTheme)
	root.style.colorScheme = nextTheme
}

const applyPalette = (palette: Partial<AppPalette>) => {
	const root = document.documentElement

	const setHex = (key: string, value?: string) => {
		if (!value) return
		root.style.setProperty(key, value)
	}

	setHex('--app-bg', palette.bg)
	setHex('--app-fg', palette.fg)
	setHex('--app-surface', palette.surface)
	setHex('--app-border', palette.border)
	setHex('--app-muted', palette.muted)
	setHex('--app-accent', palette.accent)
	setHex('--app-accent-2', palette.accent2)

	const bgRgb = palette.bg ? hexToRgbTriplet(palette.bg) : null
	const fgRgb = palette.fg ? hexToRgbTriplet(palette.fg) : null
	const surfaceRgb = palette.surface ? hexToRgbTriplet(palette.surface) : null
	const accentRgb = palette.accent ? hexToRgbTriplet(palette.accent) : null

	if (bgRgb) root.style.setProperty('--app-bg-rgb', bgRgb)
	if (fgRgb) root.style.setProperty('--app-fg-rgb', fgRgb)
	if (surfaceRgb) root.style.setProperty('--app-surface-rgb', surfaceRgb)
	if (accentRgb) root.style.setProperty('--app-accent-rgb', accentRgb)
}

const applyFontFamily = (value: string) => {
	const root = document.documentElement
	root.style.setProperty('--app-font-family', value)
}

export default function ThemeInit() {
	useEffect(() => {
		// Theme (system/dark/light)
		const savedTheme = localStorage.getItem('app_theme')
		if (savedTheme === 'system' || savedTheme === 'dark' || savedTheme === 'light') {
			applyTheme(savedTheme)
		} else {
			applyTheme('system')
		}

		// Scale + radius
		const savedFontSize = localStorage.getItem('app_font_size')
		const savedBorderRadius = localStorage.getItem('app_border_radius')
		if (savedFontSize) {
			const n = Number(savedFontSize)
			if (!Number.isNaN(n)) document.documentElement.style.fontSize = `${clamp(n, 10, 28)}px`
		}
		if (savedBorderRadius) {
			const n = Number(savedBorderRadius)
			if (!Number.isNaN(n))
				document.documentElement.style.setProperty('--app-radius', `${clamp(n, 0, 40)}px`)
		}

		// Font family
		const savedFont = localStorage.getItem('app_font_family')
		if (savedFont) applyFontFamily(savedFont)

		// Custom palette
		const rawPalette = localStorage.getItem('app_palette_v1')
		if (rawPalette) {
			try {
				const parsed = JSON.parse(rawPalette)
				if (parsed && typeof parsed === 'object') applyPalette(parsed)
			} catch {
				// ignore
			}
		}
	}, [])

	return null
}

