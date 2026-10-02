import { NextRequest, NextResponse } from 'next/server'

export async function GET(
	req: NextRequest,
	context: { params: Promise<{ path: string[] }> }
) {
	try {
		const { path } = await context.params
		const subpath = Array.isArray(path) ? path.join('/') : path
		const s3Url = `https://s3.vondic.ru/uploads/${subpath}`

		// Redirect to permanent S3 storage
		return NextResponse.redirect(s3Url, { status: 307 })
	} catch (error) {
		console.error('[Uploads Proxy] Error handling upload request:', error)
		return NextResponse.json({ error: 'File not found' }, { status: 404 })
	}
}
