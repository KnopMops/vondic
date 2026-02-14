import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/auth.utils'

export async function POST(req: NextRequest) {
  try {
    const token = await getAccessToken(req)
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await req.json().catch(() => ({}))
    const escId = String(body?.escId || '').trim()
    const answer = String(body?.answer || '').trim()
    if (!escId || !answer) {
      return NextResponse.json({ error: 'escId and answer required' }, { status: 400 })
    }
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'
    let response = await fetch(`${backendUrl}/api/v1/support/admin/escalations/${escId}/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ answer }),
    })
    if (!response.ok) {
      const legacyUrl = process.env.NEXT_PUBLIC_SUPPORT_API_URL || 'http://127.0.0.1:8000'
      response = await fetch(`${legacyUrl}/admin/escalations/${escId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer }),
      })
    }
    const text = await response.text()
    try {
      const data = JSON.parse(text)
      return NextResponse.json(data, { status: response.status })
    } catch {
      return NextResponse.json({ error: 'Invalid backend response', raw: text }, { status: 500 })
    }
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
