'use client'

import React, { useState, useRef, useEffect } from 'react'
import { LuRotateCw, LuCrop, LuCheck, LuX, LuSparkles } from 'react-icons/lu'

interface ImageEditorModalProps {
	file: File | null
	isOpen: boolean
	onClose: () => void
	onSave: (editedFile: File) => void
}

export default function ImageEditorModal({
	file,
	isOpen,
	onClose,
	onSave,
}: ImageEditorModalProps) {
	const [rotation, setRotation] = useState<number>(0)
	const [cropRatio, setCropRatio] = useState<'free' | '1:1' | '4:3' | '16:9'>('free')
	const [quality, setQuality] = useState<number>(0.85)
	const [imgSrc, setImgSrc] = useState<string>('')
	const canvasRef = useRef<HTMLCanvasElement | null>(null)
	const imageRef = useRef<HTMLImageElement | null>(null)

	useEffect(() => {
		if (file) {
			const url = URL.createObjectURL(file)
			setImgSrc(url)
			setRotation(0)
			setCropRatio('free')
			return () => URL.revokeObjectURL(url)
		}
	}, [file])

	if (!isOpen || !file) return null

	const handleRotate = () => {
		setRotation(prev => (prev + 90) % 360)
	}

	const handleSave = () => {
		if (!imageRef.current) return
		const img = imageRef.current
		const canvas = document.createElement('canvas')
		const ctx = canvas.getContext('2d')
		if (!ctx) return

		let srcWidth = img.naturalWidth
		let srcHeight = img.naturalHeight

		// Determine crop dimensions
		let cropX = 0
		let cropY = 0
		let targetWidth = srcWidth
		let targetHeight = srcHeight

		if (cropRatio === '1:1') {
			const size = Math.min(srcWidth, srcHeight)
			cropX = (srcWidth - size) / 2
			cropY = (srcHeight - size) / 2
			targetWidth = size
			targetHeight = size
		} else if (cropRatio === '4:3') {
			if (srcWidth / srcHeight > 4 / 3) {
				targetWidth = Math.round(srcHeight * (4 / 3))
				cropX = (srcWidth - targetWidth) / 2
			} else {
				targetHeight = Math.round(srcWidth * (3 / 4))
				cropY = (srcHeight - targetHeight) / 2
			}
		} else if (cropRatio === '16:9') {
			if (srcWidth / srcHeight > 16 / 9) {
				targetWidth = Math.round(srcHeight * (16 / 9))
				cropX = (srcWidth - targetWidth) / 2
			} else {
				targetHeight = Math.round(srcWidth * (9 / 16))
				cropY = (srcHeight - targetHeight) / 2
			}
		}

		const isSideways = rotation === 90 || rotation === 270
		canvas.width = isSideways ? targetHeight : targetWidth
		canvas.height = isSideways ? targetWidth : targetHeight

		ctx.save()
		ctx.translate(canvas.width / 2, canvas.height / 2)
		ctx.rotate((rotation * Math.PI) / 180)

		const drawW = isSideways ? canvas.height : canvas.width
		const drawH = isSideways ? canvas.width : canvas.height

		ctx.drawImage(
			img,
			cropX,
			cropY,
			targetWidth,
			targetHeight,
			-drawW / 2,
			-drawH / 2,
			drawW,
			drawH,
		)
		ctx.restore()

		canvas.toBlob(
			blob => {
				if (!blob) return
				const editedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
					type: 'image/jpeg',
					lastModified: Date.now(),
				})
				onSave(editedFile)
				onClose()
			},
			'image/jpeg',
			quality,
		)
	}

	return (
		<div
			className='fixed inset-0 z-[100010] flex items-center justify-center bg-black/85 backdrop-blur-md p-4'
			onClick={onClose}
		>
			<div
				className='w-full max-w-xl rounded-2xl border border-white/10 bg-[#161b22] shadow-2xl flex flex-col overflow-hidden text-white animate-in fade-in zoom-in-95 duration-200'
				onClick={e => e.stopPropagation()}
			>
				{/* Header */}
				<div className='flex items-center justify-between px-5 py-3 border-b border-white/10 bg-[#0e1117]'>
					<div className='flex items-center gap-2'>
						<LuCrop className='w-5 h-5 text-indigo-400' />
						<h3 className='font-semibold text-sm sm:text-base'>Редактор медиа перед отправкой</h3>
					</div>
					<button
						type='button'
						onClick={onClose}
						className='p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition'
					>
						<LuX className='w-5 h-5' />
					</button>
				</div>

				{/* Preview Area */}
				<div className='relative flex items-center justify-center bg-black/50 p-4 min-h-[300px] max-h-[50vh] overflow-hidden'>
					<img
						ref={imageRef}
						src={imgSrc}
						alt='Preview'
						style={{
							transform: `rotate(${rotation}deg)`,
							transition: 'transform 0.2s ease-in-out',
							maxHeight: '45vh',
							maxWidth: '100%',
							objectFit: 'contain',
						}}
						className={`rounded-lg shadow-lg ${
							cropRatio === '1:1'
								? 'aspect-square object-cover'
								: cropRatio === '4:3'
									? 'aspect-[4/3] object-cover'
									: cropRatio === '16:9'
										? 'aspect-[16/9] object-cover'
										: ''
						}`}
					/>
				</div>

				{/* Controls */}
				<div className='p-4 space-y-4 bg-[#0e1117]/80 border-t border-white/10'>
					{/* Crop & Rotate Buttons */}
					<div className='flex flex-wrap items-center justify-between gap-2'>
						<div className='flex items-center gap-1.5 bg-[#161b22] p-1 rounded-xl border border-white/5'>
							{(['free', '1:1', '4:3', '16:9'] as const).map(ratio => (
								<button
									key={ratio}
									type='button'
									onClick={() => setCropRatio(ratio)}
									className={`px-2.5 py-1 text-xs rounded-lg font-medium transition ${
										cropRatio === ratio
											? 'bg-indigo-600 text-white shadow'
											: 'text-gray-400 hover:text-white hover:bg-white/5'
									}`}
								>
									{ratio === 'free' ? 'Оригинал' : ratio}
								</button>
							))}
						</div>

						<button
							type='button'
							onClick={handleRotate}
							className='flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#161b22] border border-white/5 text-xs text-gray-200 hover:text-white hover:bg-white/10 transition font-medium'
						>
							<LuRotateCw className='w-4 h-4 text-indigo-400' />
							<span>+90°</span>
						</button>
					</div>

					{/* Quality slider */}
					<div className='flex items-center gap-3'>
						<span className='text-xs text-gray-400 font-medium whitespace-nowrap'>
							Сжатие: {Math.round(quality * 100)}%
						</span>
						<input
							type='range'
							min={0.3}
							max={1.0}
							step={0.05}
							value={quality}
							onChange={e => setQuality(parseFloat(e.target.value))}
							className='flex-1 h-1.5 accent-indigo-500 cursor-pointer'
						/>
					</div>

					{/* Actions */}
					<div className='flex items-center justify-end gap-2 pt-2 border-t border-white/5'>
						<button
							type='button'
							onClick={onClose}
							className='px-4 py-2 rounded-xl text-xs text-gray-300 hover:text-white hover:bg-white/5 transition'
						>
							Отмена
						</button>
						<button
							type='button'
							onClick={handleSave}
							className='flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition'
						>
							<LuCheck className='w-4 h-4' />
							<span>Применить</span>
						</button>
					</div>
				</div>
			</div>
		</div>
	)
}
