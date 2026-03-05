import {
	clearTokens,
	getAccessToken,
	getRefreshToken,
	refreshAccessToken,
	setTokens,
} from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

export async function GET(req: NextRequest) {
	try {
		console.log('[API] GET /api/auth/me called')
		const accessToken = await getAccessToken(req)
		const refreshToken = await getRefreshToken(req)

		const backendUrl = getBackendUrl()
		console.log(`[API] Fetching user from ${backendUrl}/api/v1/auth/me`)

		const callBackend = async (token: string) => {
			const response = await fetch(`${backendUrl}/api/v1/auth/me`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ access_token: token }),
			})

			console.log('[API] Backend response status:', response.status)
			return response
		}

		if (!accessToken && !refreshToken) {
			console.log('[API] No access or refresh token')
			return NextResponse.json({ user: null }, { status: 401 })
		}

		let effectiveAccessToken = accessToken
		let response: Response | null = null

		if (effectiveAccessToken) {
			response = await callBackend(effectiveAccessToken)
			if (response.status === 401 && refreshToken) {
				console.log('[API] Access token invalid, trying to refresh')
			} else if (!response.ok) {
				const errorText = await response.text()
				console.log('[API] Backend error:', errorText)
				return NextResponse.json(
					{ user: null, debug_error: errorText },
					{ status: response.status },
				)
			}
		}

		if ((!response || response.status === 401) && refreshToken) {
			const newTokens = await refreshAccessToken(refreshToken)
			if (!newTokens) {
				console.log('[API] Token refresh failed')
				const res = NextResponse.json({ user: null }, { status: 401 })
				return clearTokens(res)
			}

			effectiveAccessToken = newTokens.access_token
			const refreshedResponse = await callBackend(effectiveAccessToken)
			if (!refreshedResponse.ok) {
				const errorText = await refreshedResponse.text()
				console.log('[API] Backend error after refresh:', errorText)
				const res = NextResponse.json(
					{ user: null, debug_error: errorText },
					{ status: refreshedResponse.status },
				)
				return setTokens(res, newTokens.access_token, newTokens.refresh_token)
			}

			const data = await refreshedResponse.json()
			if (data.user) {
				data.user.access_token = effectiveAccessToken
			} else {
				data.access_token = effectiveAccessToken
			}

			const res = NextResponse.json(data, { status: refreshedResponse.status })
			setTokens(res, newTokens.access_token, newTokens.refresh_token)
			res.headers.set('x-auth-refreshed', '1')
			return res
		}

		if (!response) {
			console.log('[API] No backend response and no refresh token')
			return NextResponse.json({ user: null }, { status: 401 })
		}

		const data = await response.json()
		if (data.user) {
			data.user.access_token = effectiveAccessToken
		} else {
			data.access_token = effectiveAccessToken
		}
		return NextResponse.json(data, { status: response.status })
	} catch (error) {
		console.error('[API] Internal error:', error)
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}
