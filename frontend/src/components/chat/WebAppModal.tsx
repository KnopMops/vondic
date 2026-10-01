'use client'

import React, { useState, useEffect, useRef } from 'react'
import { LuMaximize2, LuMinimize2, LuX, LuChevronLeft, LuExternalLink, LuShieldCheck } from 'react-icons/lu'

interface WebAppModalProps {
	isOpen: boolean
	onClose: () => void
	url: string
	title?: string
	user?: any
}

interface MainButtonState {
	isVisible: boolean
	isActive: boolean
	text: string
	color: string
	textColor: string
	isLoading: boolean
}

export default function WebAppModal({
	isOpen,
	onClose,
	url,
	title,
	user,
}: WebAppModalProps) {
	const iframeRef = useRef<HTMLIFrameElement | null>(null)
	const [isFullscreen, setIsFullscreen] = useState(false)
	const [hasBackButton, setHasBackButton] = useState(false)
	const [mainButton, setMainButton] = useState<MainButtonState>({
		isVisible: false,
		isActive: true,
		text: 'Продолжить',
		color: '#0077FF',
		textColor: '#FFFFFF',
		isLoading: false,
	})

	let hostname = ''
	try {
		hostname = new URL(url).hostname
	} catch {}

	// Construct initData string
	const initData = React.useMemo(() => {
		if (!user) return ''
		const userData = JSON.stringify({
			id: user.id || 'anonymous',
			first_name: user.name || user.username || 'User',
			username: user.username || '',
			language_code: 'ru',
			is_premium: !!user.premium,
		})
		const query = new URLSearchParams({
			user: userData,
			auth_date: Math.floor(Date.now() / 1000).toString(),
			query_id: 'AA' + Math.random().toString(36).substring(2, 10),
			hash: 'vondic_signature_' + Math.random().toString(36).substring(2, 12),
		})
		return query.toString()
	}, [user])

	// WebApp URL with hash for Telegram SDK compatibility
	const fullUrl = React.useMemo(() => {
		if (!url) return ''
		const themeParams = encodeURIComponent(
			JSON.stringify({
				bg_color: '#0e1117',
				text_color: '#e6edf3',
				hint_color: '#8b949e',
				link_color: '#0077FF',
				button_color: '#0077FF',
				button_text_color: '#ffffff',
				secondary_bg_color: '#161b22',
			}),
		)
		const hash = `tgWebAppData=${encodeURIComponent(initData)}&tgWebAppVersion=7.0&tgWebAppPlatform=web&tgWebAppThemeParams=${themeParams}`
		return url.includes('#') ? `${url}&${hash}` : `${url}#${hash}`
	}, [url, initData])

	// Listen for postMessage from inside iframe (Telegram WebApp Protocol emulation)
	useEffect(() => {
		if (!isOpen) return

		const handleMessage = (e: MessageEvent) => {
			let data = e.data
			if (typeof data === 'string') {
				try {
					data = JSON.parse(data)
				} catch {
					return
				}
			}
			if (!data || typeof data !== 'object') return

			const eventType = data.eventType || data.type || data.event

			switch (eventType) {
				case 'web_app_setup_main_button':
				case 'web_app_main_button_set':
					setMainButton(prev => ({
						...prev,
						isVisible: data.eventData?.is_visible ?? data.is_visible ?? prev.isVisible,
						isActive: data.eventData?.is_active ?? data.is_active ?? prev.isActive,
						text: data.eventData?.text || data.text || prev.text,
						color: data.eventData?.color || data.color || prev.color,
						textColor: data.eventData?.text_color || data.text_color || prev.textColor,
						isLoading: data.eventData?.is_progress_visible ?? data.is_progress_visible ?? false,
					}))
					break

				case 'web_app_setup_back_button':
				case 'web_app_back_button_set':
					setHasBackButton(!!(data.eventData?.is_visible ?? data.is_visible))
					break

				case 'web_app_close':
					onClose()
					break

				case 'web_app_expand':
					setIsFullscreen(true)
					break

				case 'web_app_trigger_haptic_feedback':
					if (typeof navigator !== 'undefined' && navigator.vibrate) {
						navigator.vibrate(40)
					}
					break

				case 'web_app_open_link':
					if (data.eventData?.url || data.url) {
						window.open(data.eventData?.url || data.url, '_blank')
					}
					break
			}
		}

		window.addEventListener('message', handleMessage)
		return () => window.removeEventListener('message', handleMessage)
	}, [isOpen, onClose])

	const sendToIframe = (eventType: string, eventData: any = {}) => {
		if (!iframeRef.current?.contentWindow) return
		const payload = { eventType, eventData }
		iframeRef.current.contentWindow.postMessage(JSON.stringify(payload), '*')
	}

	const handleMainButtonClick = () => {
		if (!mainButton.isActive || mainButton.isLoading) return
		sendToIframe('main_button_pressed')
	}

	const handleBackButtonClick = () => {
		sendToIframe('back_button_pressed')
	}

	if (!isOpen) return null

	return (
		<div className='fixed inset-0 z-[100020] flex items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4'>
			<div
				className={`bg-[#0e1117] border border-white/10 shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
					isFullscreen
						? 'fixed inset-0 w-full h-full rounded-none'
						: 'w-full max-w-4xl h-[92vh] sm:rounded-2xl'
				}`}
				onClick={e => e.stopPropagation()}
			>
				{/* Top Bar / Header */}
				<div className='flex items-center justify-between px-4 py-2.5 bg-[#161b22] border-b border-white/10 shrink-0 select-none'>
					<div className='flex items-center gap-2 min-w-0'>
						{hasBackButton && (
							<button
								type='button'
								onClick={handleBackButtonClick}
								className='p-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition'
								title='Назад'
							>
								<LuChevronLeft className='w-5 h-5' />
							</button>
						)}
						<div className='flex flex-col min-w-0'>
							<div className='flex items-center gap-2'>
								<h2 className='text-sm font-semibold text-white truncate max-w-[200px] sm:max-w-md'>
									{title || hostname}
								</h2>
								<span className='shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-medium'>
									<LuShieldCheck className='w-3 h-3' /> WebApp
								</span>
							</div>
							<span className='text-[10px] text-gray-400 truncate'>{hostname}</span>
						</div>
					</div>

					<div className='flex items-center gap-1.5'>
						<a
							href={url}
							target='_blank'
							rel='noopener noreferrer'
							className='p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition'
							title='Открыть в новой вкладке'
						>
							<LuExternalLink className='w-4 h-4' />
						</a>
						<button
							type='button'
							onClick={() => setIsFullscreen(prev => !prev)}
							className='p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition hidden sm:block'
							title={isFullscreen ? 'Свернуть' : 'Во весь экран'}
						>
							{isFullscreen ? <LuMinimize2 className='w-4 h-4' /> : <LuMaximize2 className='w-4 h-4' />}
						</button>
						<button
							type='button'
							onClick={onClose}
							className='p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition ml-1'
							title='Закрыть'
						>
							<LuX className='w-5 h-5' />
						</button>
					</div>
				</div>

				{/* Iframe Content */}
				<div className='flex-1 relative bg-[#0e1117]'>
					<iframe
						ref={iframeRef}
						title={title || 'WebApp'}
						src={fullUrl}
						className='absolute inset-0 w-full h-full border-0 bg-white'
						sandbox='allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads'
						allow='camera; microphone; geolocation; fullscreen; payment'
						onLoad={() => {
							sendToIframe('theme_changed', {
								theme_params: {
									bg_color: '#0e1117',
									text_color: '#e6edf3',
									button_color: '#0077FF',
									button_text_color: '#ffffff',
								},
							})
							sendToIframe('viewport_changed', {
								is_expanded: isFullscreen,
								is_state_stable: true,
							})
						}}
					/>
				</div>

				{/* Native Telegram-Style MainButton */}
				{mainButton.isVisible && (
					<div className='p-3 bg-[#161b22] border-t border-white/10 shrink-0 shadow-lg animate-in slide-in-from-bottom-2 duration-150'>
						<button
							type='button'
							onClick={handleMainButtonClick}
							disabled={!mainButton.isActive || mainButton.isLoading}
							style={{
								backgroundColor: mainButton.color || '#0077FF',
								color: mainButton.textColor || '#FFFFFF',
							}}
							className='w-full py-3.5 px-4 rounded-xl font-bold text-sm tracking-wide transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 active:scale-[0.99]'
						>
							{mainButton.isLoading && (
								<div className='w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin' />
							)}
							<span>{mainButton.text}</span>
						</button>
					</div>
				)}
			</div>
		</div>
	)
}
