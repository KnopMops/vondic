import { render, fireEvent, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import IncomingCallModal from './IncomingCallModal'
import React from 'react'

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
    
    modal.getBoundingClientRect = vi.fn(() => ({
      width: 400,
      height: 300,
      top: 350,
      left: 300,
      right: 700,
      bottom: 650,
    } as any))

    
    fireEvent(window, new Event('resize'))
    
    
    
    
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

    
    fireEvent.mouseDown(modal, { clientX: 50, clientY: 50 })
    
    
    fireEvent.mouseMove(window, { clientX: -50, clientY: -50 })
    
    
    expect(modal.style.left).toBe('0px')
    expect(modal.style.top).toBe('0px')

    
    fireEvent.mouseMove(window, { clientX: 2050, clientY: 2050 })
    
    
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
      left: 600, 
      right: 1000,
      bottom: 300,
    } as any))

    
    Object.defineProperty(window, 'innerWidth', { value: 800, writable: true })
    fireEvent(window, new Event('resize'))

    
    expect(modal.style.left).toBe('400px')
  })
})
