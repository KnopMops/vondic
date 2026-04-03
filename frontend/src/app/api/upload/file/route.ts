import { getAccessToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

export async function POST(req: NextRequest) {
	try {
		let token = await getAccessToken(req)

		
		if (!token) {
			const authHeader = req.headers.get('authorization')
			if (authHeader && authHeader.startsWith('Bearer ')) {
				token = authHeader.substring(7)
				console.log('[Upload] Got token from Authorization header')
			}
		}

		if (!token) {
			console.error('[Upload] No access token found in cookies or headers')
			console.log('[Upload] Request cookies:', Array.from(req.cookies.getAll()))
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const body = await req.json().catch((e) => {
			console.error('[Upload] Failed to parse JSON body:', e)
			return {}
		})
		const file = body?.file
		const filename = body?.filename

		console.log('[Upload] Received file upload request:', {
			hasFile: !!file,
			filename,
			fileLength: file?.length,
			tokenLength: token.length,
		})

		if (!file || !filename) {
			console.error('[Upload] Missing file or filename in request body')
			return NextResponse.json(
				{ error: 'Missing file or filename' },
				{ status: 400 },
			)
		}

		const backendUrl = getBackendUrl()
		console.log('[Upload] Using backend URL:', backendUrl)

		const response = await fetch(`${backendUrl}/api/v1/upload/file`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				access_token: token,
				file,
				filename,
			}),
		})

		if (!response.ok) {
			const errorText = await response.text()
			console.error('[Upload] Backend upload failed:', errorText, 'Status:', response.status)
			return NextResponse.json(
				{ error: 'Failed to upload file', details: errorText },
				{ status: response.status },
			)
		}

		const data = await response.json()
		console.log('[Upload] Upload successful:', data)
		return NextResponse.json(data)
	} catch (error) {
		console.error('[Upload] Upload file proxy error:', error)
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}
