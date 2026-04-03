import { withAccessTokenRefresh } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

export async function POST(req: NextRequest) {
	const body = await req.json().catch(() => ({}))
	const msg: string | undefined = body?.message
	if (!msg || typeof msg !== 'string') {
		return NextResponse.json({ error: 'Bad Request' }, { status: 400 })
	}

	
	try {
		const supportUrl =
			process.env.NEXT_PUBLIC_SUPPORT_API_URL || 'http://127.0.0.1:8000'
		const ragResp = await fetch(`${supportUrl}/ask`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ question: msg }),
		})
		const ragText = await ragResp.text()
		let ragData: any = {}
		try {
			ragData = JSON.parse(ragText)
		} catch {
			ragData = { answer: ragText }
		}
		const answer =
			typeof ragData === 'string'
				? ragData
				: ragData?.answer || ragData?.response || ragData?.text || ''
		if (answer && answer.trim()) {
			return NextResponse.json(
				{ ok: true, answer, escalation_id: body?.esc_id ?? undefined },
				{ status: 200 },
			)
		}
	} catch {}

	// 2) Если RAG не дал ответа — эскалируем на бэкенд (с авто-рефрешем токена)
	return withAccessTokenRefresh(req, async accessToken => {
		try {
			const backendUrl = getBackendUrl()
			const response = await fetch(`${backendUrl}/api/v1/support/chat/send`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${accessToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(body),
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
		} catch (error) {
			return NextResponse.json(
				{ error: 'Internal Server Error' },
				{ status: 500 },
			)
		}
	})
}
