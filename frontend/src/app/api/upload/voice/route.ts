import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/auth.utils'

export async function POST(request: NextRequest) {
	try {
		const accessToken = await getAccessToken()

		if (!accessToken) {
			return NextResponse.json(
				{ error: 'Unauthorized' },
				{ status: 401 }
			)
		}

		const body = await request.json()

		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'}/api/v1/upload/voice`,
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${accessToken}`,
				},
				body: JSON.stringify(body),
			}
		)

		const data = await response.json()

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.message || data.error || 'Upload failed' },
				{ status: response.status }
			)
		}

		return NextResponse.json(data)
	} catch (error) {
		console.error('Voice upload error:', error)
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 }
		)
	}
}
