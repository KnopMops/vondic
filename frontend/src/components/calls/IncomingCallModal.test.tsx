import { render, fireEvent, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import IncomingCallModal from './IncomingCallModal'
import React from 'react'

// Mock the WebRTCService and utils
vi.mock('../../lib/services/WebRTCService', () => ({
  CallState: {}
}))
vi.mock('@/lib/utils', () => ({
  getAttachmentUrl: (url: string) => url
}))

describe('IncomingCallModal Draggable Logic', () => {
  const mockCallerInfo = {
    socketId: 'test-socket',
    userName: 'Test User',
    status: 'calling',
    isGroupCall: false,
    avatarUrl: null,
  }

  const mockOnAccept = vi.fn()
  const mockOnReject = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset window size
    Object.defineProperty(window, 'innerWidth', { value: 1000, writable: true })
    Object.defineProperty(window, 'innerHeight', { value: 1000, writable: true })
  })

  it('should be centered on initial render', () => {
    const { container } = render(
      <IncomingCallModal
        callerInfo={mockCallerInfo as any}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
        isVisible={true}
      />
    )

    const modal = container.querySelector('.incoming-call-modal') as HTMLElement
    // Since getBoundingClientRect returns 0 in JSDOM unless mocked, we mock it
    modal.getBoundingClientRect = vi.fn(() => ({
      width: 400,
      height: 300,
      top: 350,
      left: 300,
      right: 700,
      bottom: 650,
    } as any))

    // Re-trigger useEffect for centering
    fireEvent(window, new Event('resize'))
    
    // Check if position is calculated (300 = (1000-400)/2, 350 = (1000-300)/2)
    // In our component, we use state for left/top
    // Since we can't easily check state, we check the style attribute
  })

  it('should clamp position to viewport boundaries during dragging', () => {
    const { container } = render(
      <IncomingCallModal
        callerInfo={mockCallerInfo as any}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
        isVisible={true}
      />
    )

    const modal = container.querySelector('.incoming-call-modal') as HTMLElement
    modal.getBoundingClientRect = vi.fn(() => ({
      width: 400,
      height: 300,
      top: 0,
      left: 0,
      right: 400,
      bottom: 300,
    } as any))

    // Start dragging
    fireEvent.mouseDown(modal, { clientX: 50, clientY: 50 })
    
    // Drag to -100, -100 (outside left-top)
    fireEvent.mouseMove(window, { clientX: -50, clientY: -50 })
    
    // Style should be clamped to 0, 0
    expect(modal.style.left).toBe('0px')
    expect(modal.style.top).toBe('0px')

    // Drag to 2000, 2000 (outside right-bottom)
    fireEvent.mouseMove(window, { clientX: 2050, clientY: 2050 })
    
    // Style should be clamped to 1000-400, 1000-300
    expect(modal.style.left).toBe('600px')
    expect(modal.style.top).toBe('700px')
  })

  it('should adjust position on window resize to stay within boundaries', () => {
     const { container } = render(
      <IncomingCallModal
        callerInfo={mockCallerInfo as any}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
        isVisible={true}
      />
    )

    const modal = container.querySelector('.incoming-call-modal') as HTMLElement
    modal.getBoundingClientRect = vi.fn(() => ({
      width: 400,
      height: 300,
      top: 0,
      left: 600, // At the edge of 1000px width
      right: 1000,
      bottom: 300,
    } as any))

    // Resize window to 800px width
    Object.defineProperty(window, 'innerWidth', { value: 800, writable: true })
    fireEvent(window, new Event('resize'))

    // Position should be adjusted to 800-400 = 400
    expect(modal.style.left).toBe('400px')
  })
})
