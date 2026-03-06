import { withAccessTokenRefresh } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

export async function POST(req: NextRequest) {
  try {
    const backendUrl = getBackendUrl()

    return await withAccessTokenRefresh(req, async token => {
      const body = await req.json()
      console.log('Join community request body:', body)
      console.log('Token available:', !!token)

      // Используем новый endpoint /api/v1/communities/join
      const response = await fetch(`${backendUrl}/api/v1/communities/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          invite_code: body.invite_code
        }),
      })

      console.log(`Backend response status: ${response.status}`)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Backend response error:', errorText)
        return NextResponse.json(
          { error: 'Failed to join community', details: errorText },
          { status: response.status },
        )
      }

      const data = await response.json()
      console.log('Backend response data:', data)
      return NextResponse.json(data)
    })
  } catch (error) {
    console.error('Join community proxy error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    )
  }
}
