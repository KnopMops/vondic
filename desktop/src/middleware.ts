import { getAccessToken, getRefreshToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_ROUTES = ['/login']
const ROOT_ROUTE = '/'
const MESSENGER_ROUTE = '/feed/messages'

export default async function middleware(req: NextRequest) {
	const { pathname } = req.nextUrl


	if (
		pathname.startsWith('/api') ||
		pathname.startsWith('/static') ||
		pathname.startsWith('/uploads')
	) {
		const requestHeaders = new Headers(req.headers)
		const secret = process.env.VONDIC_PROXY_SECRET || 'vondic-dev-proxy-secret'
		requestHeaders.set('x-vondic-proxy-secret', secret)
		return NextResponse.next({
			request: {
				headers: requestHeaders,
			},
		})
	}

	if (
		pathname.startsWith('/_next') ||
		pathname.includes('.')
	) {
		return NextResponse.next()
	}

	const accessToken = await getAccessToken(req)
	const refreshToken = await getRefreshToken(req)

	const isPublicRoute = PUBLIC_ROUTES.includes(pathname)
	const isRootRoute = pathname === ROOT_ROUTE


	if (!accessToken && !refreshToken) {

		if (isPublicRoute || isRootRoute) {
			return NextResponse.next()
		}

		const url = req.nextUrl.clone()
		url.pathname = '/login'
		url.searchParams.set('from', pathname)
		return NextResponse.redirect(url)
	}


	let response = NextResponse.next()


	if (isPublicRoute && pathname !== '/verify') {
		const url = req.nextUrl.clone()
		url.pathname = MESSENGER_ROUTE
		return NextResponse.redirect(url)
	}

	return response
}

export const config = {
	matcher: [

		'/((?!api|_next/static|_next/image|favicon.ico).*)',
	],
}
