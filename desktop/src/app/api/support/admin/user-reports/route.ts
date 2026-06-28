import { withAccessTokenRefresh } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

export async function GET(req: NextRequest) {
	return withAccessTokenRefresh(req, async accessToken => {
		const backendUrl = getBackendUrl()
		const response = await fetch(`${backendUrl}/api/v1/support/admin/user-reports`, {
			method: 'GET',
			headers: {
				Authorization: `Bearer ${accessToken}`,
				'Content-Type': 'application/json',
			},
		})
		const text = await response.text()
		try {
			const data = JSON.parse(text)
			return NextResponse.json(data, { status: response.status })
		} catch {
			return NextResponse.json(
				{ error: 'Invalid backend response', raw: text },
				{ status: 500 },
			)
		}
	})
}

