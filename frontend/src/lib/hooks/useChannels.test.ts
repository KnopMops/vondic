
import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useChannels } from '../hooks/useChannels'


const mockStoreState = {
  auth: {
    user: {
      id: 'test-user-123',
      username: 'testuser',
      access_token: 'test-token-123',
    },
  },
}

vi.mock('@/lib/hooks', () => ({
  useAppSelector: vi.fn((selector: any) => selector(mockStoreState)),
}))


const mockFetch = vi.fn()
global.fetch = mockFetch

describe('useChannels', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
  })

  describe('createChannel', () => {
    it('should successfully create a channel', async () => {
      
      const mockChannel = {
        id: 'channel-123',
        name: 'Test Channel',
        description: 'Test Description',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockChannel,
      })

      const { result } = renderHook(() => useChannels())

      
      let createdChannel
      await act(async () => {
        createdChannel = await result.current.createChannel(
          'Test Channel',
          'Test Description'
        )
      })

      
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Channel',
          description: 'Test Description',
          access_token: 'test-token-123',
        }),
      })
      expect(createdChannel).toEqual(mockChannel)
      expect(result.current.error).toBeNull()
    })

    it('should handle 400 error with invalid input', async () => {
      
      const errorResponse = {
        error: 'Название канала обязательно',
        code: 'INVALID_NAME',
      }

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => errorResponse,
      })

      const { result } = renderHook(() => useChannels())

      
      await expect(
        act(async () => {
          await result.current.createChannel('', 'Description')
        })
      ).rejects.toThrow()

      expect(result.current.error).toEqual({
        message: errorResponse.error,
        code: errorResponse.code,
        status: 400,
      })
    })

    it('should handle 401 unauthorized error', async () => {
      
      const errorResponse = {
        error: 'Требуется авторизация',
        code: 'UNAUTHORIZED',
      }

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => errorResponse,
      })

      const { result } = renderHook(() => useChannels())

      
      await expect(
        act(async () => {
          await result.current.createChannel('Test', 'Desc')
        })
      ).rejects.toThrow()

      expect(result.current.error?.status).toBe(401)
    })

    it('should handle 405 method not allowed error', async () => {
      
      const errorResponse = {
        error: 'Метод не поддерживается',
        code: 'METHOD_NOT_ALLOWED',
      }

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 405,
        json: async () => errorResponse,
      })

      const { result } = renderHook(() => useChannels())

      
      await expect(
        act(async () => {
          await result.current.createChannel('Test', 'Desc')
        })
      ).rejects.toThrow()

      expect(result.current.error?.status).toBe(405)
    })

    it('should handle 409 conflict (channel already exists)', async () => {
      
      const errorResponse = {
        error: 'Канал с таким названием уже существует',
        code: 'CHANNEL_EXISTS',
      }

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => errorResponse,
      })

      const { result } = renderHook(() => useChannels())

      
      await expect(
        act(async () => {
          await result.current.createChannel('Existing Channel', 'Desc')
        })
      ).rejects.toThrow()

      expect(result.current.error?.code).toBe('CHANNEL_EXISTS')
    })

    it('should handle network error', async () => {
      
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useChannels())

      
      await expect(
        act(async () => {
          await result.current.createChannel('Test', 'Desc')
        })
      ).rejects.toThrow()

      expect(result.current.error?.code).toBe('NETWORK_ERROR')
    })

    it('should handle missing token', async () => {
      
      vi.mocked(require('@/lib/hooks').useAppSelector).mockImplementation(
        (selector: any) =>
          selector({ auth: { user: { ...mockStoreState.auth.user, access_token: null } } })
      )

      const { result } = renderHook(() => useChannels())

      
      await expect(
        act(async () => {
          await result.current.createChannel('Test', 'Desc')
        })
      ).rejects.toEqual({
        message: 'Требуется авторизация. Пожалуйста, войдите в аккаунт',
        code: 'UNAUTHORIZED',
      })
    })

    it('should update channels list after successful creation', async () => {
      
      const mockChannel = {
        id: 'channel-456',
        name: 'New Channel',
        description: 'New Description',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockChannel,
      })

      const { result } = renderHook(() => useChannels())

      
      await act(async () => {
        await result.current.createChannel('New Channel', 'New Description')
      })

      
      expect(result.current.channels).toContainEqual(mockChannel)
    })

    it('should set loading state during channel creation', async () => {
      
      let isLoadingDuringCall = false

      mockFetch.mockImplementationOnce(async () => {
        isLoadingDuringCall = true
        return {
          ok: true,
          json: async () => ({ id: 'channel-789', name: 'Test' }),
        }
      })

      const { result } = renderHook(() => useChannels())

      
      const createPromise = act(async () => {
        await result.current.createChannel('Test', 'Desc')
      })

      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })

      await createPromise

      
      expect(result.current.isLoading).toBe(false)
    })

    it('should handle description as optional field', async () => {
      
      const mockChannel = {
        id: 'channel-no-desc',
        name: 'Channel Without Description',
        description: null,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockChannel,
      })

      const { result } = renderHook(() => useChannels())

      
      await act(async () => {
        await result.current.createChannel('Channel Without Description', '')
      })

      
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/channels',
        expect.objectContaining({
          body: expect.stringContaining('"name":"Channel Without Description"'),
        })
      )
    })
  })

  describe('fetchMyChannels', () => {
    it('should fetch user channels successfully', async () => {
      
      const mockChannels = [
        { id: 'ch1', name: 'Channel 1' },
        { id: 'ch2', name: 'Channel 2' },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockChannels,
      })

      const { result } = renderHook(() => useChannels())

      
      await act(async () => {
        await result.current.fetchMyChannels()
      })

      
      expect(result.current.channels).toEqual(mockChannels)
    })

    it('should handle fetch error', async () => {
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      const { result } = renderHook(() => useChannels())

      
      await act(async () => {
        await result.current.fetchMyChannels()
      })

      
      expect(result.current.error).toBeTruthy()
    })
  })

  describe('joinChannel', () => {
    it('should join channel successfully', async () => {
      
      const mockChannel = { id: 'ch-join', name: 'Joined Channel' }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockChannel,
      })

      const { result } = renderHook(() => useChannels())

      
      await act(async () => {
        await result.current.joinChannel('INVITE123')
      })

      
      expect(result.current.channels).toContainEqual(mockChannel)
    })

    it('should handle invalid invite code', async () => {
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid invite code' }),
      })

      const { result } = renderHook(() => useChannels())

      
      await expect(
        act(async () => {
          await result.current.joinChannel('INVALID')
        })
      ).rejects.toThrow()
    })
  })
})
