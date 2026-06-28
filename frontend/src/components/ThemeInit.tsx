'use client'

import { useEffect } from 'react'
import { initColorScheme } from '@/lib/theme/colorSchemes'

type AppTheme = 'system' | 'dark' | 'light'

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

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

const applyFontFamily = (value: string) => {
	const root = document.documentElement
	root.style.setProperty('--app-font-family', value)
}

export default function ThemeInit() {
	useEffect(() => {
		const savedTheme = localStorage.getItem('app_theme')
		if (savedTheme === 'system' || savedTheme === 'dark' || savedTheme === 'light') {
			applyTheme(savedTheme)
		} else {
			applyTheme('system')
		}

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

		const savedFont = localStorage.getItem('app_font_family')
		if (savedFont) applyFontFamily(savedFont)

		initColorScheme()
	}, [])

	return null
}
