import { getAccessToken, getRefreshToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_ROUTES = ['/login', '/register', '/verify']
const ROOT_ROUTE = '/'
const FEED_ROUTE = '/feed'

export default async function middleware(req: NextRequest) {
	const { pathname } = req.nextUrl

	if (
		pathname.startsWith('/_next') ||
		pathname.startsWith('/api') ||
		pathname.startsWith('/oauth') ||
		pathname.startsWith('/static') ||
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

	if (isPublicRoute && pathname !== '/verify') {
		const url = req.nextUrl.clone()
		url.pathname = FEED_ROUTE
		return NextResponse.redirect(url)
	}

	return NextResponse.next()
}

export const config = {
	// Exclude /api Server Routes, OAuth browser flow, and Next assets.
	matcher: ['/((?!api|oauth|_next/static|_next/image|favicon.ico).*)'],
}
