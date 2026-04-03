import { useAuth } from '@/lib/AuthContext'
import { useEffect, useState } from 'react'

const getAccessToken = (user?: any, retries = 3): string | null => {
	for (let i = 0; i < retries; i++) {
		
		let token = user?.access_token
		
		
		if (!token) {
			token = localStorage.getItem('access_token')
		}
		
		
		if (!token) {
			const cookies = document.cookie.split(';')
			const accessTokenCookie = cookies.find(cookie => 
				cookie.trim().startsWith('access_token=')
			)
			if (accessTokenCookie) {
				token = accessTokenCookie.split('=')[1]
			}
		}
		
		if (token) return token
		
		
		if (i < retries - 1) {
			
			const start = Date.now()
			while (Date.now() - start < 50) {
				
			}
		}
	}
	
	return null
}

interface Community {
	id: string
	name: string
	description?: string
	owner_id: string
	participants_count?: number
	channels_count?: number
	invite_code?: string
	created_at?: string
	updated_at?: string
}

export const useCommunities = () => {
	const [communities, setCommunities] = useState<Community[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const { user } = useAuth()

	const fetchMyCommunities = async () => {
		if (!user) return
		
		setIsLoading(true)
		setError(null)
		
		try {
			const token = getAccessToken(user, 5)
			
			if (!token) {
				console.warn('No access token found, skipping communities fetch')
				return
			}
			
			const res = await fetch('/api/v1/communities/my', {
				headers: {
					'Authorization': `Bearer ${token}`
				}
			})
			
			if (!res.ok) {
				const errorData = await res.json().catch(() => ({}))
				throw new Error(errorData.error || 'Failed to fetch communities')
			}
			
			const data = await res.json()
			setCommunities(Array.isArray(data) ? data : [])
		} catch (e: any) {
			console.error(e)
			setError(e.message)
		} finally {
			setIsLoading(false)
		}
	}

	const createCommunity = async (name: string, description?: string) => {
		if (!user) throw new Error('User not authenticated')
		
		const token = getAccessToken(user, 5)
		if (!token) {
			throw new Error('Токен доступа не найден. Пожалуйста, обновите страницу и попробуйте снова.')
		}
		
		const res = await fetch('/api/v1/communities', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ 
				name, 
				description,
				access_token: token,
			}),
		})
		
		if (!res.ok) {
			const errorData = await res.json().catch(() => ({}))
			throw new Error(errorData.error || 'Не удалось создать сообщество')
		}
		
		const data = await res.json()
		await fetchMyCommunities()
		return data
	}

	const joinCommunity = async (inviteCode: string) => {
		if (!user) throw new Error('User not authenticated')
		
		const token = getAccessToken(user, 5)
		if (!token) {
			throw new Error('Токен доступа не найден. Пожалуйста, обновите страницу и попробуйте снова.')
		}
		
		const res = await fetch('/api/v1/communities/join', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				invite_code: inviteCode,
				access_token: token,
			}),
		})
		
		if (!res.ok) {
			const errorData = await res.json().catch(() => ({}))
			throw new Error(errorData.error || 'Не удалось вступить в сообщество')
		}
		
		const data = await res.json()
		await fetchMyCommunities()
		return data
	}

	const getCommunityDetails = async (communityId: string) => {
		if (!user) throw new Error('User not authenticated')
		
		const token = getAccessToken(user, 5)
		if (!token) {
			throw new Error('Токен доступа не найден. Пожалуйста, обновите страницу и попробуйте снова.')
		}
		
		const res = await fetch(`/api/v1/communities/${communityId}`, {
			headers: {
				'Authorization': `Bearer ${token}`
			}
		})
		
		if (!res.ok) {
			const errorData = await res.json().catch(() => ({}))
			throw new Error(errorData.error || 'Не удалось получить информацию о сообществе')
		}
		
		return await res.json()
	}

	const getCommunityInviteCode = async (communityId: string) => {
		if (!user) throw new Error('User not authenticated')
		
		const token = getAccessToken(user, 5) // Увеличим количество попыток
		if (!token) {
			throw new Error('Токен доступа не найден. Пожалуйста, обновите страницу и попробуйте снова.')
		}
		
		try {
			const res = await fetch(`/api/v1/communities/${communityId}/invite`, {
				headers: {
					'Authorization': `Bearer ${token}`
				}
			})
			
			if (!res.ok) {
				const errorData = await res.json().catch(() => ({}))
				throw new Error(errorData.error || 'Не удалось получить код приглашения')
			}
			
			const data = await res.json()
			return data.invite_code
		} catch (error: any) {
			if (error.message.includes('Токен доступа не найден')) {
				throw error
			}
			throw new Error('Не удалось получить код приглашения. Попробуйте позже.')
		}
	}

	useEffect(() => {
		// Ждем пока пользователь загрузится
		if (user) {
			// Небольшая задержка чтобы убедиться что токены загружены
			const timer = setTimeout(() => {
				fetchMyCommunities()
			}, 100)
			
			return () => clearTimeout(timer)
		}
	}, [user])

	return {
		communities,
		isLoading,
		error,
		fetchMyCommunities,
		createCommunity,
		joinCommunity,
		getCommunityDetails,
		getCommunityInviteCode,
	}
}
