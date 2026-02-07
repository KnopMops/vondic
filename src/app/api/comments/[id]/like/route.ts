import { getAccessToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = await params
  
  // Get token from cookies
  const accessToken = await getAccessToken(request)
  if (!accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { action } = body // 'like' or 'unlike'
    
    const endpoint = action === 'unlike' ? '/api/v1/comments/unlike' : '/api/v1/comments/like'
    
    const res = await fetch(`${BACKEND_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ 
        access_token: accessToken,
        comment_id: id 
      })
    })

    if (res.ok) {
      return NextResponse.json({ success: true })
    } else {
      const errorText = await res.text()
      return NextResponse.json({ error: errorText }, { status: res.status })
    }
  } catch (error) {
    console.error('Error toggling comment like:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
