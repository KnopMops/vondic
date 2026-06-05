import { withAccessTokenRefresh } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'


const ERROR_MESSAGES: Record<number, string> = {
  400: 'Неверные данные. Проверьте название и описание канала',
  401: 'Требуется авторизация. Пожалуйста, войдите в аккаунт',
  403: 'Доступ запрещён. У вас нет прав для создания канала',
  405: 'Метод не поддерживается. Попробуйте обновить страницу',
  409: 'Канал с таким названием уже существует',
  500: 'Ошибка сервера. Попробуйте позже',
  503: 'Сервис временно недоступен',
}

const getErrorMessage = (status: number, details: string): string => {
  if (details.includes('Channel name is required')) {
    return 'Название канала обязательно для заполнения'
  }
  if (details.includes('already exists') || details.includes('unique')) {
    return 'Канал с таким названием уже существует'
  }
  if (details.includes('Unauthorized') || details.includes('token')) {
    return 'Сессия истекла. Пожалуйста, войдите снова'
  }
  if (details.includes('database') || details.includes('SQL')) {
    return 'Ошибка базы данных. Попробуйте позже'
  }
  return ERROR_MESSAGES[status] || `Ошибка при создании канала: ${details || 'Неизвестная ошибка'}`
}

// Handle POST request to create channel
export async function POST(request: NextRequest) {
  try {
    const backendUrl = getBackendUrl()

    return await withAccessTokenRefresh(request, async (token) => {
      const body = await request.json()

      // Validate input on frontend side
      if (!body.name || typeof body.name !== 'string') {
        return NextResponse.json(
          { error: 'Название канала обязательно', code: 'INVALID_NAME' },
          { status: 400 }
        )
      }

      if (body.name.length < 1 || body.name.length > 100) {
        return NextResponse.json(
          { error: 'Название канала должно быть от 1 до 100 символов', code: 'INVALID_NAME_LENGTH' },
          { status: 400 }
        )
      }

      const response = await fetch(`${backendUrl}/api/v1/channels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...body, access_token: token }),
      })

      if (!response.ok) {
        let errorDetails = ''
        try {
          const errorData = await response.json()
          errorDetails = errorData.error || JSON.stringify(errorData)
        } catch {
          errorDetails = await response.text() || response.statusText
        }

        const userMessage = getErrorMessage(response.status, errorDetails)

        console.error('[Channel Creation Error]', {
          status: response.status,
          details: errorDetails,
          userMessage,
        })

        return NextResponse.json(
          { error: userMessage, code: 'CHANNEL_CREATE_FAILED', originalError: errorDetails },
          { status: response.status }
        )
      }

      const data = await response.json()
      return NextResponse.json(data)
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Create channel proxy error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера. Попробуйте позже', code: 'INTERNAL_ERROR', details: errorMessage },
      { status: 500 }
    )
  }
}
