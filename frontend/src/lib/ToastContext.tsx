'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { FiX as X } from 'react-icons/fi'
import React, { createContext, useCallback, useContext, useState } from 'react'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
	id: string
	message: string
	type: ToastType
}

interface ToastContextType {
	showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
	const [toasts, setToasts] = useState<Toast[]>([])

	const showToast = useCallback((message: string, type: ToastType = 'info') => {
		const id = Math.random().toString(36).substring(2, 9)
		setToasts(prev => [...prev, { id, message, type }])

		
		setTimeout(() => {
			setToasts(prev => prev.filter(t => t.id !== id))
		}, 3000)
	}, [])

	const removeToast = (id: string) => {
		setToasts(prev => prev.filter(t => t.id !== id))
	}

	return (
		<ToastContext.Provider value={{ showToast }}>
			{children}
			<div className='fixed bottom-4 right-4 z-50 flex flex-col gap-2'>
				<AnimatePresence>
					{toasts.map(toast => (
						<motion.div
							key={toast.id}
							initial={{ opacity: 0, y: 20, scale: 0.9 }}
							animate={{ opacity: 1, y: 0, scale: 1 }}
							exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
							layout
							className={`
                min-w-[300px] p-4 rounded-xl shadow-lg backdrop-blur-md border flex items-center justify-between gap-3
                ${
									toast.type === 'success'
										? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200'
										: toast.type === 'error'
										? 'bg-red-500/10 border-red-500/20 text-red-200'
										: 'bg-blue-500/10 border-blue-500/20 text-blue-200'
								}
              `}
						>
							<span className='text-sm font-medium'>{toast.message}</span>
							<button
								onClick={() => removeToast(toast.id)}
								className={`p-1 rounded-full hover:bg-white/10 transition-colors ${
									toast.type === 'success'
										? 'text-emerald-200'
										: toast.type === 'error'
										? 'text-red-200'
										: 'text-blue-200'
								}`}
							>
								<X className='w-4 h-4' />
							</button>
						</motion.div>
					))}
				</AnimatePresence>
			</div>
		</ToastContext.Provider>
	)
}

export function useToast() {
	const context = useContext(ToastContext)
	if (context === undefined) {
		throw new Error('useToast must be used within a ToastProvider')
	}
	return context
}
