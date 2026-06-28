import { NextRequest, NextResponse } from 'next/server'
import { clearTokens, getAccessToken, getRefreshToken } from '@/lib/auth.utils'
import { getBackendUrl } from '@/lib/url-fallback'

export async function POST(req: NextRequest) {
	try {
		const accessToken = await getAccessToken(req)
		const refreshToken = await getRefreshToken(req)
		const backendUrl = getBackendUrl()

		await fetch(`${backendUrl}/api/v1/auth/logout`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
			},
			body: JSON.stringify({
				...(refreshToken ? { refresh_token: refreshToken } : {}),
			}),
		})
	} catch (error) {
		console.error('Backend logout error:', error)
	}

	const response = NextResponse.json({ message: 'Logged out' })
	return clearTokens(response)
}
