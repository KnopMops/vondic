import { withAccessTokenRefresh } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'

    return await withAccessTokenRefresh(req, async token => {
      // Используем POST как в других API routes для совместимости
      const response = await fetch(`${backendUrl}/api/v1/communities/my`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ access_token: token }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Backend response error:', errorText)
        return NextResponse.json(
          { error: 'Failed to fetch my communities', details: errorText },
          { status: response.status },
        )
      }

      const data = await response.json()
      return NextResponse.json(data)
    })
  } catch (error) {
    console.error('Fetch my communities proxy error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'

    return await withAccessTokenRefresh(req, async token => {
      let body = {}
      try {
        body = await req.json()
      } catch (e) {}

      const response = await fetch(`${backendUrl}/api/v1/communities/my`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...body, access_token: token }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        return NextResponse.json(
          { error: 'Failed to fetch my communities', details: errorText },
          { status: response.status },
        )
      }

      const data = await response.json()
      return NextResponse.json(data)
    })
  } catch (error) {
    console.error('Fetch my communities proxy error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    )
  }
}
