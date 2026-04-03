import { useAppSelector } from '@/lib/hooks'
import { Channel } from '@/lib/types'
import { useCallback, useState } from 'react'

interface ChannelError {
  message: string
  code?: string
  status?: number
}

export const useChannels = () => {
	const { user } = useAppSelector(state => state.auth)
	const token = user?.access_token
	const [channels, setChannels] = useState<Channel[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<ChannelError | null>(null)

	const fetchMyChannels = useCallback(async () => {
		if (!token) return

		setIsLoading(true)
		setError(null)
		try {
			const res = await fetch('/api/v1/channels/my', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ access_token: token }),
			})
			if (!res.ok) throw new Error('Failed to fetch channels')
			const data = await res.json()
			setChannels(Array.isArray(data) ? data : [])
		} catch (err: any) {
			setError({ message: err.message || 'Failed to fetch channels' })
		} finally {
			setIsLoading(false)
		}
	}, [token])

	const createChannel = useCallback(
		async (name: string, description: string) => {
			if (!token) {
				const err: ChannelError = {
					message: 'Требуется авторизация. Пожалуйста, войдите в аккаунт',
					code: 'UNAUTHORIZED',
				}
				setError(err)
				throw err
			}

			setIsLoading(true)
			setError(null)
			try {
				const res = await fetch('/api/v1/channels', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ name, description, access_token: token }),
				})

				const responseData = await res.json()

				if (!res.ok) {
					const channelError: ChannelError = {
						message: responseData.error || 'Failed to create channel',
						code: responseData.code,
						status: res.status,
					}
					setError(channelError)
					throw channelError
				}

				const newChannel = responseData
				setChannels(prev => [...prev, newChannel])
				return newChannel
			} catch (err: any) {
				
				if (!err.message) {
					const networkError: ChannelError = {
						message: 'Ошибка сети. Проверьте подключение к интернету',
						code: 'NETWORK_ERROR',
					}
					setError(networkError)
					throw networkError
				}
				setError(err)
				throw err
			} finally {
				setIsLoading(false)
			}
		},
		[token],
	)

	const joinChannel = useCallback(
		async (inviteCode: string) => {
			if (!token) return

			setIsLoading(true)
			setError(null)
			try {
				const res = await fetch('/api/v1/channels/join', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						invite_code: inviteCode,
						access_token: token,
					}),
				})
				if (!res.ok) throw new Error('Failed to join channel')
				const channel = await res.json()
				setChannels(prev => {
					if (prev.find(c => c.id === channel.id)) return prev
					return [...prev, channel]
				})
				return channel
			} catch (err: any) {
				setError(err.message)
				throw err
			} finally {
				setIsLoading(false)
			}
		},
		[token],
	)

	const getChannelInfo = useCallback(
		async (id: string) => {
			if (!token) return null

			try {
				const res = await fetch(`/api/v1/channels/${id}`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ access_token: token }),
				})
				if (!res.ok) throw new Error('Failed to get channel info')
				return await res.json()
			} catch (err: any) {
				console.error(err)
				return null
			}
		},
		[token],
	)

	return {
		channels,
		isLoading,
		error,
		fetchMyChannels,
		createChannel,
		joinChannel,
		getChannelInfo,
	}
}
