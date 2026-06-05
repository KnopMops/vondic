'use client'

import AppLoader from '@/components/ui/AppLoader'
import { useEffect, useState, ReactNode } from 'react'
import { initializeUrlFallback, restoreFallbackMode } from '../lib/url-fallback'

interface UrlFallbackProviderProps {
	children: ReactNode
}

export function UrlFallbackProvider({ children }: UrlFallbackProviderProps) {
	const [isReady, setIsReady] = useState(false)

	useEffect(() => {
		
		restoreFallbackMode()

		
		initializeUrlFallback()
			.then(() => setIsReady(true))
			.catch(() => setIsReady(true)) 
	}, [])

	
	if (!isReady) {
		return (
			<AppLoader
				fullScreen
				size='lg'
				label='Проверяем соединение...'
			/>
		)
	}

	return <>{children}</>
}
