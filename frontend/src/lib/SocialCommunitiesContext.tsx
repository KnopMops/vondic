'use client'

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from 'react'
import { useAuth } from '@/lib/AuthContext'
import type { SocialCommunity } from '@/lib/hooks/useSocialCommunities'

async function apiPost<T>(url: string, body: Record<string, unknown> = {}): Promise<T> {
	const res = await fetch(url, {
		method: 'POST',
		credentials: 'include',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	})
	if (!res.ok) {
		const err = await res.json().catch(() => ({}))
		throw new Error(
			(typeof err.error === 'string' && err.error) || 'Ошибка запроса',
		)
	}
	return res.json() as Promise<T>
}

type ContextValue = {
	communities: SocialCommunity[]
	isLoading: boolean
	error: string | null
	fetchMyCommunities: () => Promise<void>
	createCommunity: (name: string, description?: string) => Promise<SocialCommunity>
	joinCommunity: (inviteCode: string) => Promise<SocialCommunity>
	updateCommunity: (
		communityId: string,
		data: {
			name?: string
			description?: string
			avatar_url?: string | null
			cover_url?: string | null
			is_public?: boolean
		},
	) => Promise<SocialCommunity>
}

const SocialCommunitiesContext = createContext<ContextValue | null>(null)

export function SocialCommunitiesProvider({ children }: { children: ReactNode }) {
	const { user, authReady } = useAuth()
	const [communities, setCommunities] = useState<SocialCommunity[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const fetchMyCommunities = useCallback(async () => {
		if (!user) return

		setIsLoading(true)
		setError(null)
		try {
			const data = await apiPost<SocialCommunity[]>(
				'/api/v1/social-communities/my',
				{},
			)
			setCommunities(Array.isArray(data) ? data : [])
		} catch (e: unknown) {
			setError(e instanceof Error ? e.message : 'Error')
		} finally {
			setIsLoading(false)
		}
	}, [user])

	useEffect(() => {
		if (authReady && user) {
			fetchMyCommunities()
		}
		if (authReady && !user) {
			setCommunities([])
		}
	}, [authReady, user, fetchMyCommunities])

	const createCommunity = useCallback(
		async (name: string, description?: string) => {
			const data = await apiPost<SocialCommunity>(
				'/api/v1/social-communities',
				{ name, description },
			)
			await fetchMyCommunities()
			return data
		},
		[fetchMyCommunities],
	)

	const joinCommunity = useCallback(async (inviteCode: string) => {
		const data = await apiPost<SocialCommunity>(
			'/api/v1/social-communities/join',
			{ invite_code: inviteCode },
		)
		setCommunities(prev => {
			if (prev.some(c => c.id === data.id)) return prev
			return [data, ...prev]
		})
		return data
	}, [])

	const updateCommunity = useCallback(
		async (
			communityId: string,
			payload: {
				name?: string
				description?: string
				avatar_url?: string | null
				cover_url?: string | null
				is_public?: boolean
			},
		) => {
			const res = await fetch(`/api/v1/social-communities/${communityId}`, {
				method: 'PUT',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			})
			if (!res.ok) {
				const err = await res.json().catch(() => ({}))
				throw new Error(err.error || 'Не удалось обновить сообщество')
			}
			const updated = (await res.json()) as SocialCommunity
			setCommunities(prev =>
				prev.map(c => (c.id === communityId ? updated : c)),
			)
			return updated
		},
		[],
	)

	const value = useMemo(
		() => ({
			communities,
			isLoading,
			error,
			fetchMyCommunities,
			createCommunity,
			joinCommunity,
			updateCommunity,
		}),
		[
			communities,
			isLoading,
			error,
			fetchMyCommunities,
			createCommunity,
			joinCommunity,
			updateCommunity,
		],
	)

	return (
		<SocialCommunitiesContext.Provider value={value}>
			{children}
		</SocialCommunitiesContext.Provider>
	)
}

export function useSocialCommunities() {
	const ctx = useContext(SocialCommunitiesContext)
	if (!ctx) {
		throw new Error(
			'useSocialCommunities must be used within SocialCommunitiesProvider',
		)
	}
	return ctx
}
