'use client'

import { useRouter } from 'next/navigation'
import React, { createContext, useContext, useEffect, useState } from 'react'

interface User {
	id: string
	email: string
	username: string
	role: string
	avatar_url: string | null
}

interface AuthContextType {
	user: User | null
	login: (email: string, password: string) => Promise<void>
	loginWithTelegram: (key: string) => Promise<void>
	loginWithYandex: () => Promise<void>
	register: (email: string, username: string, password: string) => Promise<void>
	logout: () => void
	isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [user, setUser] = useState<User | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const router = useRouter()

	const backendUrl =
		process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'

	useEffect(() => {
		const initAuth = async () => {
			// 1. Пробуем восстановить из временной cookie (от social auth)
			const getCookie = (name: string) => {
				const value = `; ${document.cookie}`
				const parts = value.split(`; ${name}=`)
				if (parts.length === 2) return parts.pop()?.split(';').shift()
			}

			const tempUserData = getCookie('temp_user_data')
			if (tempUserData) {
				try {
					const userData = JSON.parse(decodeURIComponent(tempUserData))
					setUser(userData)
					localStorage.setItem('user', JSON.stringify(userData))
					// Удаляем cookie
					document.cookie =
						'temp_user_data=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;'
					setIsLoading(false)
					return // Если восстановили из cookie, запрос к me можно пропустить (или сделать фоном)
				} catch (e) {
					console.error('Failed to parse temp_user_data', e)
				}
			}

			// 2. Сначала пробуем восстановить из localStorage для быстрого отображения
			const storedUser = localStorage.getItem('user')
			if (storedUser) {
				setUser(JSON.parse(storedUser))
			}

			// 3. Затем пробуем получить актуального пользователя с сервера (по cookies)
			try {
				console.log('AuthContext: Fetching /api/auth/me...')
				const response = await fetch('/api/auth/me')
				console.log('AuthContext: /api/auth/me status:', response.status)

				if (response.ok) {
					const data = await response.json()
					console.log('AuthContext: /api/auth/me data:', data)
					if (data.user) {
						setUser(data.user)
						localStorage.setItem('user', JSON.stringify(data.user))
					} else {
						// Если сервер говорит, что мы не авторизованы, но в localStorage что-то есть - чистим
						// (хотя это спорный момент, может быть оффлайн, но для безопасности лучше почистить)
						// В данном случае, если API вернул 200 но без юзера, или 401 (который мы тут не поймали в response.ok если статус не 2xx)
					}
				} else {
					// Если 401 - значит токен протух или его нет
					if (response.status === 401) {
						console.log('AuthContext: 401 Unauthorized, clearing user')
						localStorage.removeItem('user')
						setUser(null)
					}
				}
			} catch (error) {
				console.error('Failed to fetch user:', error)
			} finally {
				setIsLoading(false)
			}
		}

		initAuth()
	}, [])

	const login = async (email: string, password: string) => {
		setIsLoading(true)
		try {
			// Запрос к нашему API Proxy (который установит cookies)
			const response = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password }),
			})

			const data = await response.json()

			if (!response.ok) {
				throw new Error(data.error || 'Login failed')
			}

			const userData = data.user
			setUser(userData)
			localStorage.setItem('user', JSON.stringify(userData))
			// Токены теперь в httpOnly cookies, не сохраняем их в localStorage

			router.push('/')
		} catch (error) {
			alert(error instanceof Error ? error.message : 'An error occurred')
		} finally {
			setIsLoading(false)
		}
	}

	const loginWithTelegram = async (key: string) => {
		setIsLoading(true)
		try {
			const response = await fetch('/api/auth/telegram', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ key }),
			})

			const data = await response.json()

			if (!response.ok) {
				throw new Error(data.error || 'Telegram login failed')
			}

			const userData = data.user
			setUser(userData)
			localStorage.setItem('user', JSON.stringify(userData))

			router.push('/')
		} catch (error) {
			alert(error instanceof Error ? error.message : 'An error occurred')
		} finally {
			setIsLoading(false)
		}
	}

	const loginWithYandex = async () => {
		setIsLoading(true)
		try {
			const response = await fetch('/api/auth/yandex/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
			})

			const data = await response.json()

			if (!response.ok) {
				throw new Error(data.error || 'Yandex login init failed')
			}

			if (data.auth_url) {
				window.location.href = data.auth_url
			} else {
				throw new Error('No auth_url returned')
			}
		} catch (error) {
			alert(error instanceof Error ? error.message : 'An error occurred')
			setIsLoading(false)
		}
	}

	const register = async (
		email: string,
		username: string,
		password: string,
	) => {
		setIsLoading(true)
		try {
			// Запрос к нашему API Proxy
			const response = await fetch('/api/auth/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, username, password }),
			})

			const data = await response.json()

			if (!response.ok) {
				throw new Error(data.error || 'Registration failed')
			}

			// Если бэкенд возвращает пользователя и токены сразу
			if (data.user) {
				setUser(data.user)
				localStorage.setItem('user', JSON.stringify(data.user))
			}

			// Перенаправляем на верификацию
			router.push('/verify')
		} catch (error) {
			alert(error instanceof Error ? error.message : 'An error occurred')
		} finally {
			setIsLoading(false)
		}
	}

	const logout = async () => {
		try {
			await fetch('/api/auth/logout', { method: 'POST' })
		} catch (e) {
			console.error(e)
		}
		setUser(null)
		localStorage.removeItem('user')
		// Удаляем токены из localStorage на всякий случай, если они там были
		localStorage.removeItem('access_token')
		localStorage.removeItem('refresh_token')
		router.push('/login')
	}

	return (
		<AuthContext.Provider
			value={{
				user,
				login,
				loginWithTelegram,
				loginWithYandex,
				register,
				logout,
				isLoading,
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
