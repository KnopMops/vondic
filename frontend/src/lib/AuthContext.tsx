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
import { getSavedAccounts, saveAccount } from './savedAccounts'

interface AuthContextType {
	user: User | null
	login: (
		email: string,
		password: string,
		opts?: { smartCaptchaToken?: string },
	) => Promise<void>
	loginWithYandex: () => Promise<void>
	register: (
		email: string,
		username: string,
		password: string,
		captchaToken?: string,
	) => Promise<void>
	logout: (redirectUrl?: string) => void
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
					saveAccount({
						id: userData.id,
						email: userData.email,
						username: userData.username,
						avatar_url: userData.avatar_url ?? null,
						auth_provider: 'yandex',
						last_login_at: Date.now(),
						added_at: Date.now(),
					})
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

	const login = async (
		email: string,
		password: string,
		opts?: { smartCaptchaToken?: string },
	) => {
		try {
			const body: Record<string, string> = { email, password }
			const cap = opts?.smartCaptchaToken
			if (cap) body.smart_captcha_token = cap
			// Запрос к нашему API Proxy (который установит cookies)
			const response = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
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
			saveAccount({
				id: userData.id,
				email: userData.email,
				username: userData.username,
				avatar_url: userData.avatar_url ?? null,
				auth_provider: 'email',
				last_login_at: Date.now(),
				added_at: Date.now(),
				refresh_token: data.refresh_token || undefined,
			})

			// Токены теперь в httpOnly cookies, не сохраняем их в localStorage

			if (typeof window !== 'undefined') {
				window.location.assign('/feed')
			} else {
				router.push('/feed')
			}
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
		captchaToken?: string,
	) => {
		try {
			// Запрос к нашему API Proxy
			const response = await fetch('/api/auth/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email,
					username,
					password,
					smart_captcha_token: captchaToken,
				}),
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
				saveAccount({
					id: userData.id,
					email: userData.email,
					username: userData.username,
					avatar_url: userData.avatar_url ?? null,
					auth_provider: 'email',
					last_login_at: Date.now(),
					added_at: Date.now(),
				})
			}

			// Перенаправляем на верификацию
			router.push('/verify')
		} catch (error) {
			alert(error instanceof Error ? error.message : 'Произошла ошибка')
		}
	}

	const logout = async (redirectUrl?: string) => {
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
				// SocketContext отключает сокет с небольшой задержкой после emit('logout')
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
		// Удаляем токены из localStorage на всякий случай, если они там были
		localStorage.removeItem('access_token')
		localStorage.removeItem('refresh_token')
		if (typeof window !== 'undefined') {
			window.location.assign(redirectUrl || '/')
		} else {
			router.push(redirectUrl || '/')
		}
	}

	return (
		<AuthContext.Provider
			value={{
				user,
				login,
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
