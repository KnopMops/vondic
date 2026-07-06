import { getAccessToken, getRefreshToken, refreshAccessToken } from '@/lib/auth.utils'
import { getBackendUrl } from '@/lib/server-urls'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
	const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || req.nextUrl.origin

	try {
		const code = req.nextUrl.searchParams.get('code')
		const state = req.nextUrl.searchParams.get('state') || ''

		console.log('[link-callback] code:', code?.substring(0, 10) + '...', 'state:', state)

		if (!code) {
			return NextResponse.redirect(new URL('/feed/settings?error=no_code', frontendUrl))
		}

		const accessToken = await getAccessToken(req)
		const refreshToken = await getRefreshToken(req)

		console.log('[link-callback] access:', accessToken ? 'yes' : 'no', 'refresh:', refreshToken ? 'yes' : 'no')

		if (!accessToken && !refreshToken) {
			console.log('[link-callback] No tokens, redirecting to login')
			return NextResponse.redirect(new URL('/login', frontendUrl))
		}

		const backendUrl = getBackendUrl()

		const callBackend = async (token: string) => {
			const url = new URL(`${backendUrl}/api/v1/auth/yandex/link-callback`)
			url.searchParams.set('code', code)
			url.searchParams.set('state', state)
			console.log('[link-callback] calling backend:', url.toString())
			return fetch(url.toString(), {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`,
				},
			})
		}

		let response = await callBackend(accessToken!)

		if (response.status === 401 && refreshToken) {
			console.log('[link-callback] 401, refreshing token...')
			const newTokens = await refreshAccessToken(refreshToken)
			if (newTokens) {
				response = await callBackend(newTokens.access_token)
			}
		}

		const data = await response.json()
		console.log('[link-callback] backend response:', response.status, JSON.stringify(data).substring(0, 200))

		if (!response.ok) {
			return NextResponse.redirect(
				new URL(`/feed/settings?error=${encodeURIComponent(data.error || 'link_failed')}`, frontendUrl),
			)
		}

		return NextResponse.redirect(new URL('/feed/settings?linked=yandex', frontendUrl))
	} catch (error) {
		console.error('[link-callback] error:', error)
		return NextResponse.redirect(new URL('/feed/settings?error=internal', frontendUrl))
	}
}
