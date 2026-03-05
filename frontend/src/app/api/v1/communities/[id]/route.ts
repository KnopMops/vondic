import { withAccessTokenRefresh } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const backendUrl = getBackendUrl()

    console.log(`Fetching community details for: ${id}`)

    return await withAccessTokenRefresh(req, async token => {
      // Используем POST как в других API routes для совместимости
      const response = await fetch(`${backendUrl}/api/v1/communities/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ access_token: token }),
      })

      console.log(`Backend response status: ${response.status}`)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Backend response error:', errorText)
        return NextResponse.json(
          { error: 'Failed to get community details', details: errorText },
          { status: response.status },
        )
      }

      const data = await response.json()
      return NextResponse.json(data)
    })
  } catch (error) {
    console.error('Get community details proxy error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    )
  }
}
