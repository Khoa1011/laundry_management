import { render, screen, waitFor, act } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PERMISSION_CODES } from '../auth/permissionCodes.generated'
import { useRealtime } from '../realtime/context'
import type { RealtimeEvent } from '../realtime/types'
import { RealtimeProvider } from './RealtimeProvider'

const mocks = vi.hoisted(() => ({ permissions: new Set<string>(), open: vi.fn() }))
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 41 }, hasPermission: (code: string) => mocks.permissions.has(code) }) }))
vi.mock('../realtime/api', () => ({ openRealtimeStream: mocks.open, isRetryableRealtimeStreamError: () => true }))

class FakeBroadcastChannel {
  static latest: FakeBroadcastChannel | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  postMessage = vi.fn()
  close = vi.fn()
  constructor(public name: string) { FakeBroadcastChannel.latest = this }
}

function Probe() {
  const { connectionState, subscribe } = useRealtime()
  const [event, setEvent] = useState<RealtimeEvent | null>(null)
  useEffect(() => subscribe('order.', setEvent), [subscribe])
  useEffect(() => subscribe('realtime.', setEvent), [subscribe])
  return <div><span>{connectionState}</span><span>{event?.type ?? 'none'}</span></div>
}

describe('RealtimeProvider', () => {
  beforeEach(() => {
    mocks.permissions.clear(); mocks.open.mockReset(); localStorage.clear(); sessionStorage.clear()
    FakeBroadcastChannel.latest = null
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)
  })

  it('opens and broadcasts the generic stream for an order-only user without notification.read-own', async () => {
    mocks.permissions.add(PERMISSION_CODES.ORDER_READ)
    let handlers: { onOpen: () => void; onEvent: (event: RealtimeEvent) => void } | undefined
    mocks.open.mockImplementation((signal: AbortSignal, value: typeof handlers) => {
      handlers = value; value?.onOpen()
      return new Promise<void>(resolve => signal.addEventListener('abort', () => resolve()))
    })
    render(<RealtimeProvider><Probe /></RealtimeProvider>)
    await waitFor(() => expect(mocks.open).toHaveBeenCalledOnce())
    expect(screen.getByText('connected')).toBeInTheDocument()
    act(() => handlers?.onEvent({ eventId: 'order-1', type: 'order.updated', entityId: 9 }))
    expect(screen.getByText('order.updated')).toBeInTheDocument()
    expect(FakeBroadcastChannel.latest?.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'event', userId: 41, event: expect.objectContaining({ type: 'order.updated' }),
    }))
  })

  it('distributes an order event received from the leader tab', async () => {
    mocks.permissions.add(PERMISSION_CODES.ORDER_READ)
    localStorage.setItem('laundry.realtime.stream-leader:41', JSON.stringify({ tabId: 'leader', userId: 41, expiresAt: Date.now() + 60_000, updatedAt: Date.now() }))
    render(<RealtimeProvider><Probe /></RealtimeProvider>)
    await waitFor(() => expect(FakeBroadcastChannel.latest).not.toBeNull())
    act(() => FakeBroadcastChannel.latest?.onmessage?.({ data: {
      type: 'event', userId: 41, event: { eventId: 'broadcast-1', type: 'order.ready', entityId: 9 },
    } } as MessageEvent))
    expect(screen.getByText('order.ready')).toBeInTheDocument()
    expect(mocks.open).not.toHaveBeenCalled()
  })
})
