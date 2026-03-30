/**
 * Tests for the /api/v1/channels API route.
 * Tests error handling, validation, and user-friendly messages.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the auth utilities
const mockWithAccessTokenRefresh = vi.fn()
vi.mock('@/lib/auth.utils', () => ({
  withAccessTokenRefresh: (req: any, callback: any) => callback('mock-token'),
}))

// Mock server URLs
vi.mock('@/lib/server-urls', () => ({
  getBackendUrl: () => 'http://localhost:5000',
}))

describe('POST /api/v1/channels API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should validate channel name is required', async () => {
    // Arrange
    const mockRequest = {
      json: async () => ({ name: '', description: 'Test' }),
    } as unknown as NextRequest

    // Import after mocks are set up
    const { POST } = await import('./route')

    // Act
    const response = await POST(mockRequest)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(400)
    expect(data.error).toContain('Название канала обязательно')
  })

  it('should validate channel name length', async () => {
    // Arrange
    const mockRequest = {
      json: async () => ({ name: 'A'.repeat(101), description: 'Test' }),
    } as unknown as NextRequest

    const { POST } = await import('./route')

    // Act
    const response = await POST(mockRequest)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(400)
    expect(data.error).toContain('100')
  })

  it('should handle backend 405 error gracefully', async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 405,
      text: async () => 'Method Not Allowed',
      json: async () => ({ error: 'Method Not Allowed' }),
    })

    const mockRequest = {
      json: async () => ({ name: 'Test Channel', description: 'Test' }),
    } as unknown as NextRequest

    const { POST } = await import('./route')

    // Act
    const response = await POST(mockRequest)
    const data = await response.json()

    // Assert
    expect(data.error).toContain('Метод не поддерживается')
  })

  it('should handle backend 400 error with user-friendly message', async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'Channel name is required',
      json: async () => ({ error: 'Channel name is required' }),
    })

    const mockRequest = {
      json: async () => ({ name: 'Test', description: 'Test' }),
    } as unknown as NextRequest

    const { POST } = await import('./route')

    // Act
    const response = await POST(mockRequest)
    const data = await response.json()

    // Assert
    expect(data.error).toContain('Название канала обязательно')
  })

  it('should handle backend 409 conflict error', async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 409,
      text: async () => 'Channel already exists',
      json: async () => ({ error: 'Channel already exists' }),
    })

    const mockRequest = {
      json: async () => ({ name: 'Existing Channel', description: 'Test' }),
    } as unknown as NextRequest

    const { POST } = await import('./route')

    // Act
    const response = await POST(mockRequest)
    const data = await response.json()

    // Assert
    expect(data.error).toContain('Канал с таким названием уже существует')
  })

  it('should handle backend 500 error gracefully', async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
      json: async () => ({ error: 'Internal Server Error' }),
    })

    const mockRequest = {
      json: async () => ({ name: 'Test Channel', description: 'Test' }),
    } as unknown as NextRequest

    const { POST } = await import('./route')

    // Act
    const response = await POST(mockRequest)
    const data = await response.json()

    // Assert
    expect(data.error).toContain('Ошибка сервера')
  })

  it('should handle successful channel creation', async () => {
    // Arrange
    const mockChannel = {
      id: 'channel-123',
      name: 'Test Channel',
      description: 'Test Description',
    }

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockChannel,
    })

    const mockRequest = {
      json: async () => ({ name: 'Test Channel', description: 'Test Description' }),
    } as unknown as NextRequest

    const { POST } = await import('./route')

    // Act
    const response = await POST(mockRequest)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(200)
    expect(data).toEqual(mockChannel)
  })

  it('should handle network errors', async () => {
    // Arrange
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'))

    const mockRequest = {
      json: async () => ({ name: 'Test Channel', description: 'Test' }),
    } as unknown as NextRequest

    const { POST } = await import('./route')

    // Act
    const response = await POST(mockRequest)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(500)
    expect(data.error).toContain('Внутренняя ошибка сервера')
  })

  it('should log errors to console for debugging', async () => {
    // Arrange
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'Validation error',
      json: async () => ({ error: 'Validation error' }),
    })

    const mockRequest = {
      json: async () => ({ name: 'Test Channel', description: 'Test' }),
    } as unknown as NextRequest

    const { POST } = await import('./route')

    // Act
    await POST(mockRequest)

    // Assert
    expect(consoleSpy).toHaveBeenCalledWith(
      '[Channel Creation Error]',
      expect.objectContaining({
        status: 400,
      })
    )

    consoleSpy.mockRestore()
  })
})
