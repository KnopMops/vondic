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
		process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:5050'

	useEffect(() => {
		const storedUser = localStorage.getItem('user')
		if (storedUser) {
			setUser(JSON.parse(storedUser))
		}
		setIsLoading(false)
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
		<AuthContext.Provider value={{ user, login, register, logout, isLoading }}>
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
