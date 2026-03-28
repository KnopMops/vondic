'use client'

import { useRouter } from 'next/navigation'
import React, { createContext, useContext, useEffect } from 'react'
import {
	fetchUser,
	logout as logoutAction,
	setUser,
} from './features/authSlice'
import { useAppDispatch, useAppSelector } from './hooks'
import { User } from './types'

interface AuthContextType {
	user: User | null
	login: (email: string, password: string) => Promise<void>
	loginWithTelegram: (key: string) => Promise<void>
	loginWithYandex: () => Promise<void>
	register: (email: string, username: string, password: string) => Promise<void>
	logout: () => void
	isLoading: boolean
	isInitialized: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const dispatch = useAppDispatch()
	const { user, isLoading, isInitialized } = useAppSelector(state => state.auth)
	const router = useRouter()

	const backendUrl =
		process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'

	useEffect(() => {
		const initAuth = async () => {
			if (isInitialized) return

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
					dispatch(setUser(userData))
					localStorage.setItem('user', JSON.stringify(userData))
					// Удаляем cookie
					document.cookie =
						'temp_user_data=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;'
					return
				} catch (e) {
					console.error('Не удалось разобрать temp_user_data', e)
				}
			}

			// 2. Сначала пробуем восстановить из localStorage для быстрого отображения
			// (Можно добавить setUser здесь, но fetchUser перепишет его если что)
			const storedUser = localStorage.getItem('user')
			if (storedUser && !user) {
				dispatch(setUser(JSON.parse(storedUser)))
			}

			// 3. Загружаем пользователя с сервера через Redux Thunk
			dispatch(fetchUser())
		}

		initAuth()
	}, [dispatch, isInitialized, user])

	useEffect(() => {
		const root = document.documentElement
		const savedTheme = localStorage.getItem('app_theme')
		if (savedTheme === 'dark' || savedTheme === 'light') {
			root.setAttribute('data-theme', savedTheme)
			root.style.colorScheme = savedTheme
			return
		}
		root.removeAttribute('data-theme')
		root.style.colorScheme = ''
	}, [])

	const login = async (email: string, password: string) => {
		try {
			// Запрос к нашему API Proxy (который установит cookies)
			const response = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password }),
			})

			const data = await response.json()

			if (!response.ok) {
				throw new Error(data.error || 'Вход не выполнен')
			}

			const userData = data.user
			if (data.access_token) {
				userData.access_token = data.access_token
			}
			dispatch(setUser(userData))
			localStorage.setItem('user', JSON.stringify(userData))

			// Токены теперь в httpOnly cookies, не сохраняем их в localStorage

			router.push('/feed')
		} catch (error) {
			alert(error instanceof Error ? error.message : 'Произошла ошибка')
		}
	}

	const loginWithTelegram = async (key: string) => {
		try {
			const response = await fetch('/api/auth/telegram', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ key }),
			})

			const data = await response.json()

			if (!response.ok) {
				throw new Error(data.error || 'Вход через Telegram не выполнен')
			}

			const userData = data.user
			if (data.access_token) {
				userData.access_token = data.access_token
			}
			dispatch(setUser(userData))
			localStorage.setItem('user', JSON.stringify(userData))

			router.push('/feed')
		} catch (error) {
			alert(error instanceof Error ? error.message : 'Произошла ошибка')
		}
	}

	const loginWithYandex = async () => {
		try {
			const response = await fetch('/api/auth/yandex/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
			})

			const data = await response.json()

			if (!response.ok) {
				throw new Error(data.error || 'Вход через Яндекс не выполнен')
			}

			if (data.auth_url) {
				window.location.href = data.auth_url
			} else {
				throw new Error('Не получен auth_url')
			}
		} catch (error) {
			alert(error instanceof Error ? error.message : 'Произошла ошибка')
		}
	}

	const register = async (
		email: string,
		username: string,
		password: string,
	) => {
		try {
			// Запрос к нашему API Proxy
			const response = await fetch('/api/auth/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, username, password }),
			})

			const data = await response.json()

			if (!response.ok) {
				throw new Error(data.error || 'Регистрация не выполнена')
			}

			// Если бэкенд возвращает пользователя и токены сразу
			if (data.user) {
				const userData = data.user
				if (data.access_token) {
					userData.access_token = data.access_token
				}
				dispatch(setUser(userData))
				localStorage.setItem('user', JSON.stringify(userData))
			}

			// Перенаправляем на верификацию
			router.push('/verify')
		} catch (error) {
			alert(error instanceof Error ? error.message : 'Произошла ошибка')
		}
	}

	const logout = async () => {
		try {
			// Set status to offline before logout
			if (user?.access_token) {
				try {
					await fetch('/api/v1/users/status', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${user.access_token}`,
						},
						body: JSON.stringify({ status: 'offline' }),
					})
				} catch (e) {
					console.error('Не удалось установить статус offline:', e)
				}
			}
			
			await fetch('/api/auth/logout', { method: 'POST' })
		} catch (e) {
			console.error(e)
		}
		dispatch(logoutAction())
		localStorage.removeItem('user')
		// Удаляем токены из localStorage на всякий случай, если они там были
		localStorage.removeItem('access_token')
		localStorage.removeItem('refresh_token')
		router.push('/')
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
