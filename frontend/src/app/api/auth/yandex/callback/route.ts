import { POST_LOGIN_REDIRECT_COOKIE } from '@/lib/authRedirect'
import { setTokens } from '@/lib/auth.utils'
import { setDesktopSession } from '@/lib/desktopSessions'
import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl, getWebrtcUrl } from '@/lib/server-urls'

export async function GET(req: NextRequest) {
	const frontendUrl =
		process.env.NEXT_PUBLIC_FRONTEND_URL || req.nextUrl.origin
	try {
		const { searchParams } = new URL(req.url)
		const code = searchParams.get('code')
		const cid = searchParams.get('cid') || searchParams.get('state')
		const userAgent = req.headers.get('user-agent') || ''
		const forwardedFor = req.headers.get('x-forwarded-for') || ''
		const realIp = req.headers.get('x-real-ip') || ''

		if (!code) {
			return NextResponse.json({ error: 'No code provided' }, { status: 400 })
		}

		const backendUrl = getBackendUrl()

		
		const backendCallbackUrl = new URL(
			`${backendUrl}/api/v1/auth/yandex/callback`,
		)
		backendCallbackUrl.searchParams.set('code', code)
		if (cid) backendCallbackUrl.searchParams.set('cid', cid)

		// Делаем запрос к бэкенду
		const response = await fetch(backendCallbackUrl.toString(), {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				'User-Agent': userAgent,
				'X-Forwarded-For': forwardedFor,
				'X-Real-IP': realIp,
			},
		})

		const data = await response.json()

		if (!response.ok) {
			if (cid && (cid.startsWith('mobile_redirect:') || cid.startsWith('vondic://'))) {
				const redirectBase = cid.startsWith('mobile_redirect:')
					? cid.substring('mobile_redirect:'.length)
					: cid
				const separator = redirectBase.includes('?') ? '&' : '?'
				const params = new URLSearchParams()
				params.set('error', data.error || 'Yandex login failed')
				return NextResponse.redirect(`${redirectBase}${separator}${params.toString()}`)
			}
			const loginUrl = new URL('/login', frontendUrl)
			loginUrl.searchParams.set('error', data.error || 'Yandex login failed')
			return NextResponse.redirect(loginUrl)
		}

		if (cid) {
			try {
				setDesktopSession(cid, {
					access_token: data.access_token,
					refresh_token: data.refresh_token,
					user: data.user,
				})
			} catch (e) {
				console.error('Failed to register desktop session', e)
			}
		}

		// Mobile deep link redirect: redirect directly to custom URL scheme
		if (cid && (cid.startsWith('mobile_redirect:') || cid.startsWith('vondic://'))) {
			const redirectBase = cid.startsWith('mobile_redirect:')
				? cid.substring('mobile_redirect:'.length)
				: cid
			const separator = redirectBase.includes('?') ? '&' : '?'
			const params = new URLSearchParams()
			if (data.access_token) params.set('access_token', data.access_token)
			if (data.refresh_token) params.set('refresh_token', data.refresh_token)
			return NextResponse.redirect(`${redirectBase}${separator}${params.toString()}`)
		}

		const rawRedirect = req.cookies.get(POST_LOGIN_REDIRECT_COOKIE)?.value
		let dest = '/feed'
		if (rawRedirect) {
			try {
				const decoded = decodeURIComponent(rawRedirect)
				if (decoded.startsWith('/')) dest = decoded
			} catch {
				/* ignore */
			}
		}

		const nextResponse = NextResponse.redirect(new URL(dest, frontendUrl))
		nextResponse.cookies.delete(POST_LOGIN_REDIRECT_COOKIE)

		// Устанавливаем токены
		const responseWithTokens = setTokens(
			nextResponse,
			data.access_token,
			data.refresh_token,
		)

		// Устанавливаем временную cookie с данными пользователя (не httpOnly, чтобы JS мог прочитать)
		// Кодируем в base64 или URI encoded JSON
		if (data.user) {
			responseWithTokens.cookies.set({
				name: 'temp_user_data',
				value: JSON.stringify(data.user),
				httpOnly: false, // Разрешаем доступ из JS
				secure: process.env.NODE_ENV === 'production',
				path: '/',
				maxAge: 60, // Живет всего минуту, пока клиент не прочитает
				sameSite: 'lax',
			})
		}

		return responseWithTokens
	} catch (error) {
		console.error('Yandex callback proxy error:', error)
		try {
			const { searchParams } = new URL(req.url)
			const cid = searchParams.get('cid') || searchParams.get('state')
			if (cid && (cid.startsWith('mobile_redirect:') || cid.startsWith('vondic://'))) {
				const redirectBase = cid.startsWith('mobile_redirect:')
					? cid.substring('mobile_redirect:'.length)
					: cid
				const separator = redirectBase.includes('?') ? '&' : '?'
				const params = new URLSearchParams()
				params.set('error', 'Internal Server Error')
				return NextResponse.redirect(`${redirectBase}${separator}${params.toString()}`)
			}
		} catch (_) {}

		const loginUrl = new URL('/login', frontendUrl)
		loginUrl.searchParams.set('error', 'Internal Server Error')
		return NextResponse.redirect(loginUrl)
	}
}
