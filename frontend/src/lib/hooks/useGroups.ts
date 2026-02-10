import { useAppSelector } from '@/lib/hooks'
import { Group } from '@/lib/types'
import { useCallback, useState } from 'react'

export const useGroups = () => {
	const { user } = useAppSelector(state => state.auth)
	const token = user?.access_token
	const [groups, setGroups] = useState<Group[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const fetchMyGroups = useCallback(async () => {
		if (!token) return

		setIsLoading(true)
		setError(null)
		try {
			const res = await fetch('/api/v1/groups/my', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ access_token: token }),
			})
			if (!res.ok) throw new Error('Failed to fetch groups')
			const data = await res.json()
			setGroups(Array.isArray(data) ? data : [])
		} catch (err: any) {
			setError(err.message)
		} finally {
			setIsLoading(false)
		}
	}, [token])

	const createGroup = useCallback(
		async (name: string, description?: string) => {
			if (!token) return

			setIsLoading(true)
			setError(null)
			try {
				const res = await fetch('/api/v1/groups', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ name, description, access_token: token }),
				})
				if (!res.ok) throw new Error('Failed to create group')
				const newGroup = await res.json()
				setGroups(prev => [...prev, newGroup])
				return newGroup
			} catch (err: any) {
				setError(err.message)
				throw err
			} finally {
				setIsLoading(false)
			}
		},
		[token],
	)

	const addParticipant = useCallback(
		async (groupId: string, userId: string) => {
			if (!token) return

			setIsLoading(true)
			setError(null)
			try {
				const res = await fetch(`/api/v1/groups/${groupId}/participants`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ user_id: userId, access_token: token }),
				})

				if (!res.ok) {
					if (res.status === 403)
						throw new Error('Only the group owner can add participants')
					if (res.status === 400)
						throw new Error('User already in group or invalid request')
					throw new Error('Failed to add participant')
				}

				// Optional: Reload groups or update the specific group in state
				// For now, just return success
				return true
			} catch (err: any) {
				setError(err.message)
				throw err
			} finally {
				setIsLoading(false)
			}
		},
		[token],
	)

	const getGroupParticipants = useCallback(
		async (groupId: string) => {
			if (!token) return []

			setIsLoading(true)
			setError(null)
			try {
				const res = await fetch(`/api/v1/groups/${groupId}/participants`, {
					method: 'GET',
				})
				if (!res.ok) throw new Error('Failed to fetch participants')
				const data = await res.json()
				return Array.isArray(data) ? data : []
			} catch (err: any) {
				setError(err.message)
				return []
			} finally {
				setIsLoading(false)
			}
		},
		[token],
	)

	const getGroupDetails = useCallback(
		async (groupId: string) => {
			if (!token) return null

			setIsLoading(true)
			setError(null)
			try {
				const res = await fetch('/api/v1/groups/info', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ group_id: groupId, access_token: token }),
				})
				if (!res.ok) throw new Error('Failed to fetch group details')
				const data = await res.json()
				return data as Group
			} catch (err: any) {
				setError(err.message)
				throw err
			} finally {
				setIsLoading(false)
			}
		},
		[token],
	)

	const joinGroup = useCallback(
		async (inviteCode: string) => {
			if (!token) return

			setIsLoading(true)
			setError(null)
			try {
				const res = await fetch('/api/v1/groups/join', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						invite_code: inviteCode,
						access_token: token,
					}),
				})
				if (!res.ok) throw new Error('Failed to join group')
				const data = await res.json()
				setGroups(prev => [...prev, data])
				return data
			} catch (err: any) {
				setError(err.message)
				throw err
			} finally {
				setIsLoading(false)
			}
		},
		[token],
	)

	return {
		groups,
		isLoading,
		error,
		fetchMyGroups,
		createGroup,
		addParticipant,
		getGroupParticipants,
		getGroupDetails,
		joinGroup,
	}
}
