import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  NotificationStreamError,
  isRetryableNotificationStreamError,
  openNotificationStream,
} from './notificationsApi'

const sessionMocks = vi.hoisted(() => ({
  readSession: vi.fn(),
  refreshSession: vi.fn(),
}))

vi.mock('../../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/client')>()),
  readSession: sessionMocks.readSession,
  refreshSession: sessionMocks.refreshSession,
}))

function streamResponse(chunks: string[], status = 200) {
  const encoder = new TextEncoder()
  return new Response(new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)))
      controller.close()
    },
  }), {
    status,
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

describe('openNotificationStream', () => {
  beforeEach(() => {
    sessionMocks.readSession.mockReturnValue({ accessToken: 'access-one' })
    sessionMocks.refreshSession.mockReset()
    vi.unstubAllGlobals()
  })

  it('uses a bearer header and parses split SSE blocks without putting the token in the URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(streamResponse([
      'id:evt-1\nevent:notification.created\ndata:{"eventType":"notification.created",',
      '"notificationId":7,"serverTime":"2026-07-23T10:00:00Z"}\n\n',
    ]))
    vi.stubGlobal('fetch', fetchMock)
    const onOpen = vi.fn()
    const onEvent = vi.fn()

    await openNotificationStream(new AbortController().signal, { onOpen, onEvent })

    expect(fetchMock).toHaveBeenCalledWith('/api/notifications/stream', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer access-one' }),
    }))
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('access-one')
    expect(onOpen).toHaveBeenCalledOnce()
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventId: 'evt-1',
      eventType: 'notification.created',
      notificationId: 7,
    }))
  })

  it('refreshes once after 401 and reconnects with the new bearer token', async () => {
    sessionMocks.refreshSession.mockResolvedValue({ accessToken: 'access-two' })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(streamResponse([
        'data:{"eventId":"connected-1","eventType":"connected","serverTime":"2026-07-23T10:00:00Z"}\n\n',
      ]))
    vi.stubGlobal('fetch', fetchMock)
    const onEvent = vi.fn()

    await openNotificationStream(new AbortController().signal, {
      onOpen: vi.fn(),
      onEvent,
    })

    expect(sessionMocks.refreshSession).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/notifications/stream', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer access-two' }),
    }))
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'connected' }))
  })

  it('marks forbidden stream responses as non-retryable', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 403 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(openNotificationStream(new AbortController().signal, {
      onOpen: vi.fn(),
      onEvent: vi.fn(),
    })).rejects.toMatchObject({
      name: 'NotificationStreamError',
      status: 403,
      retryable: false,
    })
  })

  it('marks throttled and server errors as retryable', () => {
    expect(isRetryableNotificationStreamError(
      new NotificationStreamError('SSE_429', { status: 429, retryable: true }),
    )).toBe(true)
    expect(isRetryableNotificationStreamError(
      new NotificationStreamError('SSE_500', { status: 500, retryable: true }),
    )).toBe(true)
  })
})
