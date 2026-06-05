'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useRouter } from 'next/navigation'
import { setUser, logout as logoutAction, fetchUser } from './features/authSlice'
import type { RootState } from './store'
import { getSavedAccounts, saveAccount } from './savedAccounts'

interface AuthContextType {
	user: any
	loginWithVondic: (options?: { forceLogin?: boolean; loginHint?: string }) => Promise<void>
	logout: () => Promise<void>
	isLoading: boolean
	isInitialized: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const dispatch = useDispatch()
	const router = useRouter()
	const user = useSelector((state: RootState) => state.auth.user)
	const [isLoading, setIsLoading] = useState(true)
	const [isInitialized, setIsInitialized] = useState(false)

	useEffect(() => {
		// Initialize theme
		const root = document.documentElement
		const savedTheme = localStorage.getItem('app_theme')
		if (savedTheme === 'dark' || savedTheme === 'light') {
			root.setAttribute('data-theme', savedTheme)
			root.style.colorScheme = savedTheme
		} else {
			root.removeAttribute('data-theme')
			root.style.colorScheme = ''
		}

		const initAuth = async () => {
			// Try to restore user from localStorage
			const stored = localStorage.getItem('user')
			if (stored) {
				try {
					const parsed = JSON.parse(stored)
					if (parsed && (parsed.id || parsed.email)) {
						dispatch(setUser(parsed))
						// Restore tokens to localStorage for code that reads them directly
						if (parsed.access_token) {
							localStorage.setItem('access_token', parsed.access_token)
							document.cookie = `access_token=${parsed.access_token}; path=/; max-age=86400`
						}
						if (parsed.refresh_token) {
							localStorage.setItem('refresh_token', parsed.refresh_token)
							document.cookie = `refresh_token=${parsed.refresh_token}; path=/; max-age=2592000`
						}
					}
				} catch {
					localStorage.removeItem('user')
				}
			} else {
				await dispatch(fetchUser())
			}
			setIsLoading(false)
			setIsInitialized(true)
		}

		initAuth()
	}, [dispatch])

	const loginWithVondic = async (options?: { forceLogin?: boolean; loginHint?: string }) => {
		if (
			typeof window === 'undefined' ||
			!(window as any).electronAPI?.startVondicAuth
		) {
			throw new Error('Desktop API not available')
		}
		const result = await (window as any).electronAPI.startVondicAuth(options)
		if (!result.success) {
			throw new Error(result.error || 'Вход не выполнен')
		}
		const userData = result.user
		// Persist user in localStorage so the desktop renderer can restore it
		localStorage.setItem('user', JSON.stringify(userData))
		// Also store tokens separately for code that reads localStorage directly
		if (userData.access_token) {
			localStorage.setItem('access_token', userData.access_token)
			document.cookie = `access_token=${userData.access_token}; path=/; max-age=86400`
		}
		if (userData.refresh_token) {
			localStorage.setItem('refresh_token', userData.refresh_token)
			document.cookie = `refresh_token=${userData.refresh_token}; path=/; max-age=2592000`
		}
		dispatch(setUser(userData))
		saveAccount({
			id: userData.id,
			email: userData.email,
			username: userData.username,
			avatar_url: userData.avatar_url ?? null,
			auth_provider: 'vondic',
			last_login_at: Date.now(),
			added_at: Date.now(),
		})
		router.push('/feed/messages')
	}

	const logout = async () => {
		try {
			try {
				await fetch('/api/v1/users/status', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ status: 'offline' }),
					credentials: 'include',
				})
			} catch (e) {
				console.error('Не удалось установить статус offline:', e)
			}

			if (typeof window !== 'undefined') {
				window.dispatchEvent(new CustomEvent('vondic-before-logout'))
				await new Promise<void>(resolve => setTimeout(resolve, 280))
			}

			await fetch('/api/auth/logout', { method: 'POST' })
		} catch (e) {
			console.error(e)
		}

		if (user) {
			const existing = getSavedAccounts().find(a => a.id === user.id)
			saveAccount({
				id: user.id,
				email: user.email,
				username: user.username,
				avatar_url: user.avatar_url ?? null,
				auth_provider: existing?.auth_provider,
				last_login_at: existing?.last_login_at ?? Date.now(),
				added_at: Date.now(),
			})
		}

		dispatch(logoutAction())
		localStorage.removeItem('user')
		localStorage.removeItem('access_token')
		localStorage.removeItem('refresh_token')
		// Clear auth cookies
		document.cookie = 'access_token=; path=/; max-age=0'
		document.cookie = 'refresh_token=; path=/; max-age=0'
		router.push('/')
	}

	return (
		<AuthContext.Provider
			value={{
				user,
				loginWithVondic,
				logout,
				isLoading,
				isInitialized,
			}}
		>
			{children}
		</AuthContext.Provider>
	)
}

export function useAuth() {
	const context = useContext(AuthContext)
	if (context === undefined) {
		throw new Error('useAuth must be used within an AuthProvider')
	}
	return context
}
