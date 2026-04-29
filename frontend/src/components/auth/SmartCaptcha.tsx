'use client'

import Script from 'next/script'
import { useEffect, useMemo } from 'react'

type Props = {
	onTokenChange: (token: string) => void
}

declare global {
	interface Window {
		[key: string]: any
	}
}

export default function SmartCaptcha({ onTokenChange }: Props) {
	const siteKey = process.env.NEXT_PUBLIC_YANDEX_SMARTCAPTCHA_SITE_KEY || ''
	const callbackName = useMemo(
		() => `onSmartCaptchaSuccess_${Math.random().toString(36).slice(2, 10)}`,
		[],
	)
	const expiredName = useMemo(
		() => `onSmartCaptchaExpired_${Math.random().toString(36).slice(2, 10)}`,
		[],
	)

	useEffect(() => {
		window[callbackName] = (token: string) => onTokenChange(token || '')
		window[expiredName] = () => onTokenChange('')
		return () => {
			try {
				delete window[callbackName]
				delete window[expiredName]
			} catch {}
		}
	}, [callbackName, expiredName, onTokenChange])

	if (!siteKey) return null

	return (
		<div className='rounded-xl border border-white/10 bg-white/5 p-3'>
			<Script
				src='https://smartcaptcha.yandexcloud.net/captcha.js'
				strategy='afterInteractive'
			/>
			<div
				className='smart-captcha'
				data-sitekey={siteKey}
				data-hl='ru'
				data-callback={callbackName}
				data-expired-callback={expiredName}
			/>
		</div>
	)
}
