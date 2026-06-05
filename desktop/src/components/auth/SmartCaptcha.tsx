'use client'

import Script from 'next/script'
import { useEffect, useId, useRef, useState } from 'react'

type Props = {
	onTokenChange: (token: string) => void
}

declare global {
	interface Window {
		smartCaptcha?: {
			render: (
				container: HTMLElement,
				options: {
					sitekey: string
					hl?: string
					callback?: (token: string) => void
					'expired-callback'?: () => void
				},
			) => string
			destroy?: (widgetId: string) => void
		}
	}
}

export default function SmartCaptcha({ onTokenChange }: Props) {
	const siteKey = process.env.NEXT_PUBLIC_YANDEX_SMARTCAPTCHA_SITE_KEY || ''
	const containerRef = useRef<HTMLDivElement>(null)
	const widgetIdRef = useRef<string | null>(null)
	const [scriptLoaded, setScriptLoaded] = useState(false)
	const instanceId = useId().replace(/:/g, '')

	useEffect(() => {
		if (!siteKey || !scriptLoaded || !containerRef.current) return

		const container = containerRef.current
		container.innerHTML = ''

		const renderWidget = () => {
			if (!window.smartCaptcha?.render || !containerRef.current) return
			if (widgetIdRef.current) {
				try {
					window.smartCaptcha.destroy?.(widgetIdRef.current)
				} catch {}
				widgetIdRef.current = null
			}
			widgetIdRef.current = window.smartCaptcha.render(containerRef.current, {
				sitekey: siteKey,
				hl: 'ru',
				callback: (token: string) => onTokenChange(token || ''),
				'expired-callback': () => onTokenChange(''),
			})
		}

		if (window.smartCaptcha?.render) {
			renderWidget()
		} else {
			const interval = window.setInterval(() => {
				if (window.smartCaptcha?.render) {
					window.clearInterval(interval)
					renderWidget()
				}
			}, 50)
			return () => window.clearInterval(interval)
		}

		return () => {
			if (widgetIdRef.current && window.smartCaptcha?.destroy) {
				try {
					window.smartCaptcha.destroy(widgetIdRef.current)
				} catch {}
				widgetIdRef.current = null
			}
			onTokenChange('')
		}
	}, [siteKey, scriptLoaded, onTokenChange, instanceId])

	if (!siteKey) {
		return (
			<div className='rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs text-yellow-200'>
				Капча не настроена. Добавьте NEXT_PUBLIC_YANDEX_SMARTCAPTCHA_SITE_KEY в
				переменные окружения и перезапустите приложение.
			</div>
		)
	}

	return (
		<div className='rounded-xl border border-white/10 bg-white/5 p-3'>
			<Script
				src='https://smartcaptcha.yandexcloud.net/captcha.js'
				strategy='afterInteractive'
				onLoad={() => setScriptLoaded(true)}
			/>
			<div ref={containerRef} id={`smart-captcha-${instanceId}`} />
		</div>
	)
}
