'use client'

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
			<div style={{
				display: 'flex',
				justifyContent: 'center',
				alignItems: 'center',
				height: '100vh',
				fontFamily: 'system-ui, -apple-system, sans-serif',
			}}>
				<div style={{ textAlign: 'center' }}>
					<div style={{
						width: '40px',
						height: '40px',
						border: '4px solid #e5e7eb',
						borderTopColor: '#3b82f6',
						borderRadius: '50%',
						animation: 'spin 1s linear infinite',
						margin: '0 auto 16px',
					}} />
					<p style={{ color: '#6b7280', margin: 0 }}>Проверяем соединение...</p>
				</div>
			</div>
		)
	}

	return <>{children}</>
}
