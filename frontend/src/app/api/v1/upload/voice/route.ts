import { getAccessToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

export async function POST(req: NextRequest) {
	try {
		const token = await getAccessToken(req)

		if (!token) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const formData = await req.formData()
		const file = formData.get('file') as File

		if (!file) {
			return NextResponse.json({ error: 'No file provided' }, { status: 400 })
		}

		
		const bytes = await file.arrayBuffer()
		const base64 = Buffer.from(bytes).toString('base64')

		const backendUrl = getBackendUrl()

		const response = await fetch(`${backendUrl}/api/v1/upload/voice`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				access_token: token,
				file: base64,
				filename: file.name,
			}),
		})

		if (!response.ok) {
			const errorText = await response.text()
			console.error('Backend voice upload error:', {
				status: response.status,
				statusText: response.statusText,
				error: errorText,
				filename: file.name,
				contentType: file.type,
				fileSize: file.size,
			})
			return NextResponse.json(
				{ error: 'Failed to upload voice message', details: errorText },
				{ status: response.status },
			)
		}

		const data = await response.json()
		return NextResponse.json(data)
	} catch (error) {
		console.error('Upload voice proxy error:', error)
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}
