'use client'

import { DragEvent, useCallback, useState } from 'react'

export function useFileDrop(onFiles: (files: File[]) => void) {
	const [dragOver, setDragOver] = useState(false)

	const onDragOver = useCallback((e: DragEvent) => {
		e.preventDefault()
		e.stopPropagation()
		setDragOver(true)
	}, [])

	const onDragLeave = useCallback((e: DragEvent) => {
		e.preventDefault()
		e.stopPropagation()
		setDragOver(false)
	}, [])

	const onDrop = useCallback(
		(e: DragEvent) => {
			e.preventDefault()
			e.stopPropagation()
			setDragOver(false)
			const list = Array.from(e.dataTransfer?.files || [])
			if (list.length > 0) onFiles(list)
		},
		[onFiles],
	)

	return {
		dragOver,
		dropHandlers: { onDragOver, onDragLeave, onDrop },
	}
}
