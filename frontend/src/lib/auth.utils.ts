import { decodeJwt } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from './url-fallback'

const ACCESS_TOKEN_KEY = 'access_token'
const REFRESH_TOKEN_KEY = 'refresh_token'


export async function getAccessToken(
	req?: NextRequest,
): Promise<string | undefined> {
	if (req) {
		return req.cookies.get(ACCESS_TOKEN_KEY)?.value
	}
	const cookieStore = await cookies()
	return cookieStore.get(ACCESS_TOKEN_KEY)?.value
}


export async function getRefreshToken(
	req?: NextRequest,
): Promise<string | undefined> {
	if (req) {
		return req.cookies.get(REFRESH_TOKEN_KEY)?.value
	}
	const cookieStore = await cookies()
	return cookieStore.get(REFRESH_TOKEN_KEY)?.value
}


export function setTokens(
	res: NextResponse,
	accessToken: string,
	refreshToken: string,
): NextResponse {
	const domain = process.env.NEXT_PUBLIC_FRONTEND_URL
		? new URL(process.env.NEXT_PUBLIC_FRONTEND_URL).hostname
		: undefined

	res.cookies.set({
		name: ACCESS_TOKEN_KEY,
		value: accessToken,
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		path: '/',
		sameSite: 'lax',
		maxAge: 24 * 60 * 60, 
		...(domain && { domain }),
	})

	res.cookies.set({
		name: REFRESH_TOKEN_KEY,
		value: refreshToken,
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		path: '/',
		sameSite: 'lax',
		maxAge: 30 * 24 * 60 * 60, 
		...(domain && { domain }),
	})

	return res
}


export function clearTokens(res: NextResponse): NextResponse {
	res.cookies.delete(ACCESS_TOKEN_KEY)
	res.cookies.delete(REFRESH_TOKEN_KEY)
	return res
}


export function isTokenExpired(token: string): boolean {
	try {
		const decoded = decodeJwt(token)
		if (!decoded.exp) return false 
		
		return decoded.exp * 1000 < Date.now()
	} catch {
		
		
		return false
	}
}


export async function refreshAccessToken(
	refreshToken: string,
): Promise<{ access_token: string; refresh_token: string } | null> {
	try {
		const response = await fetch(`${getBackendUrl()}/api/v1/auth/refresh`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${refreshToken}`,
			},
		})

		if (!response.ok) {
			return null
		}

		const data = await response.json()
		return {
			access_token: data.access_token,
			refresh_token: data.refresh_token,
		}
	} catch (error) {
		console.error('Token refresh failed:', error)
		return null
	}
}

/**
 * Универсальная обёртка для API-роутов, которая:
 * - достаёт access/refresh токены из cookies;
 * - выполняет handler с access_token;
 * - при 401 пробует обновить токены через refresh_token и повторяет handler;
 * - при успешном рефреше обновляет cookies и проставляет заголовок x-auth-refreshed: 1.
 */
export async function withAccessTokenRefresh(
	req: NextRequest,
	handler: (accessToken: string) => Promise<NextResponse>,
): Promise<NextResponse> {
	let accessToken = await getAccessToken(req)
	const refreshToken = await getRefreshToken(req)

	if (!accessToken && !refreshToken) {
		const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		return clearTokens(res)
	}

	// Если access истёк, пробуем рефреш до выполнения handler
	if (accessToken && isTokenExpired(accessToken) && refreshToken) {
		const newTokens = await refreshAccessToken(refreshToken)
		if (newTokens) {
			const res = await handler(newTokens.access_token)
			setTokens(res, newTokens.access_token, newTokens.refresh_token)
			res.headers.set('x-auth-refreshed', '1')
			return res
		}
	}

	if (accessToken) {
		const res = await handler(accessToken)
		if (res.status !== 401) {
			return res
		}
	}

	if (!refreshToken) {
		const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		return clearTokens(res)
	}

	const newTokens = await refreshAccessToken(refreshToken)
	if (!newTokens) {
		const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		return clearTokens(res)
	}

	const res = await handler(newTokens.access_token)
	setTokens(res, newTokens.access_token, newTokens.refresh_token)
	res.headers.set('x-auth-refreshed', '1')
	return res
}
