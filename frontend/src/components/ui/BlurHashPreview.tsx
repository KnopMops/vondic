'use client'

import React, { useState } from 'react'
import { ArrowDown, Loader2 } from 'lucide-react'

interface BlurHashPreviewProps {
	src?: string
	alt?: string
	width?: number | string
	height?: number | string
	sizeBytes?: number
	blurColor?: string
	isAutoDownloadAllowed: boolean
	onDownloadRequest?: () => Promise<void> | void
	className?: string
	onClick?: () => void
}

export function formatBytes(bytes?: number): string {
	if (!bytes || bytes <= 0) return ''
	if (bytes < 1024) return `${bytes} Б`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
	return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}

export const BlurHashPreview: React.FC<BlurHashPreviewProps> = ({
	src,
	alt = 'Медиа',
	width = '100%',
	height = 'auto',
	sizeBytes,
	blurColor = '#1e293b',
	isAutoDownloadAllowed,
	onDownloadRequest,
	className = '',
	onClick,
}) => {
	const [isDownloaded, setIsDownloaded] = useState<boolean>(isAutoDownloadAllowed)
	const [isLoading, setIsLoading] = useState<boolean>(false)
	const [isImageLoaded, setIsImageLoaded] = useState<boolean>(false)

	const handleDownloadClick = async (e: React.MouseEvent) => {
		e.stopPropagation()
		if (isLoading || isDownloaded) return

		setIsLoading(true)
		try {
			if (onDownloadRequest) {
				await onDownloadRequest()
			}
			setIsDownloaded(true)
		} catch (err) {
			console.error('Failed to load media:', err)
		} finally {
			setIsLoading(false)
		}
	}

	return (
		<div
			className={`relative overflow-hidden rounded-xl bg-slate-800/80 select-none group cursor-pointer transition-all duration-300 ${className}`}
			style={{
				width,
				maxHeight: '420px',
				backgroundColor: blurColor,
			}}
			onClick={onClick}
		>
			{/* High-res Image if downloaded/auto-allowed */}
			{isDownloaded && src && (
				<img
					src={src}
					alt={alt}
					loading="lazy"
					onLoad={() => setIsImageLoaded(true)}
					className={`w-full h-full object-cover transition-opacity duration-300 ${
						isImageLoaded ? 'opacity-100' : 'opacity-0'
					}`}
				/>
			)}

			{/* Blurred Placeholder / Telegram-style Overlay */}
			{(!isDownloaded || !isImageLoaded) && (
				<div
					className="absolute inset-0 flex flex-col items-center justify-center backdrop-blur-md bg-black/40 transition-all p-4 text-center"
					style={{
						minHeight: '160px',
						background: `radial-gradient(circle, rgba(30,41,59,0.9) 0%, rgba(15,23,42,0.95) 100%)`,
					}}
				>
					{!isDownloaded ? (
						<button
							onClick={handleDownloadClick}
							disabled={isLoading}
							className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/80 hover:bg-indigo-600 border border-white/10 hover:border-indigo-400 text-white text-xs font-semibold shadow-xl backdrop-blur-lg transform hover:scale-105 active:scale-95 transition-all"
						>
							{isLoading ? (
								<>
									<Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
									<span>Загрузка...</span>
								</>
							) : (
								<>
									<div className="w-5 h-5 rounded-full bg-indigo-500/30 flex items-center justify-center">
										<ArrowDown className="w-3 h-3 text-indigo-300" />
									</div>
									<span>{sizeBytes ? formatBytes(sizeBytes) : 'Загрузить'}</span>
								</>
							)}
						</button>
					) : (
						<div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
							<Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
							<span>Загрузка изображения...</span>
						</div>
					)}
				</div>
			)}
		</div>
	)
}
