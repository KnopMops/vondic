import { NextRequest, NextResponse } from 'next/server'
import { withAccessTokenRefresh } from '@/lib/auth.utils'

export async function GET(req: NextRequest) {
  return withAccessTokenRefresh(req, async accessToken => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'
      const response = await fetch(`${backendUrl}/api/v1/support/chat/updates`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
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
  })
}
