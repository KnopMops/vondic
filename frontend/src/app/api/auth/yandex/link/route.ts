import { getAccessToken, getRefreshToken, refreshAccessToken } from '@/lib/auth.utils'
import { getBackendUrl } from '@/lib/server-urls'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
	try {
		const accessToken = await getAccessToken(req)
		const refreshToken = await getRefreshToken(req)

		console.log('[link] access:', accessToken ? 'yes' : 'no', 'refresh:', refreshToken ? 'yes' : 'no')

		if (!accessToken && !refreshToken) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const backendUrl = getBackendUrl()

		const callBackend = async (token: string) => {
			return fetch(`${backendUrl}/api/v1/auth/yandex/link`, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`,
				},
			})
		}

		let response = await callBackend(accessToken!)

		if (response.status === 401 && refreshToken) {
			const newTokens = await refreshAccessToken(refreshToken)
			if (newTokens) {
				response = await callBackend(newTokens.access_token)
			}
		}

		const data = await response.json()
		console.log('[link] backend response:', response.status, JSON.stringify(data).substring(0, 200))
		return NextResponse.json(data, { status: response.status })
	} catch (error) {
		console.error('[link] error:', error)
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
	}
}
