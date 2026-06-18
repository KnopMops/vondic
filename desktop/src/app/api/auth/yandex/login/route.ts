import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
	return NextResponse.json({}, { headers: corsHeaders })
}

export async function POST(req: NextRequest) {
	try {
		const { searchParams } = new URL(req.url)
		const cid = searchParams.get('cid')

		
		const backendUrl = getBackendUrl()

		const response = await fetch(`${backendUrl}/api/v1/auth/yandex/login`, {
			method: 'GET',
			headers: { 'Content-Type': 'application/json' },
		})

		const responseText = await response.text()
		let data

		try {
			data = JSON.parse(responseText)
		} catch (e) {
			console.error('Failed to parse JSON from backend:', responseText)
			return NextResponse.json(
				{ error: 'Invalid response from backend' },
				{ status: 502, headers: corsHeaders },
			)
		}

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.error || 'Yandex login init failed' },
				{ status: response.status, headers: corsHeaders },
			)
		}

		if (cid && data?.auth_url) {
			try {
				const authUrl = new URL(data.auth_url as string)
				authUrl.searchParams.set('state', cid)
				data.auth_url = authUrl.toString()
			} catch (e) {
				console.error('Failed to attach cid via state to auth_url', e)
			}
		}

		return NextResponse.json(data, { headers: corsHeaders })
	} catch (error) {
		console.error('Yandex login proxy error:', error)
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500, headers: corsHeaders },
		)
	}
}
