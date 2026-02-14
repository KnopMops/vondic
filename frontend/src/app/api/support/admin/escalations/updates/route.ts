import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/auth.utils'

export async function GET(req: NextRequest) {
  try {
    const token = await getAccessToken(req)
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const params = req.nextUrl.searchParams
    const escId = Number(params.get('escId') || '0')
    const sinceId = Number(params.get('since_id') || '0')
    if (!escId) {
      return NextResponse.json({ error: 'escId required' }, { status: 400 })
    }
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'
    const url = `${backendUrl}/api/v1/support/admin/escalations/${escId}/updates${sinceId ? `?since_id=${sinceId}` : ''}`
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
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
