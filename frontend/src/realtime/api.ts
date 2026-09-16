import { readSession, refreshSession } from '../api/client'
import type { RealtimeEvent } from './types'

interface StreamHandlers { onOpen: () => void; onEvent: (event: RealtimeEvent) => void }

export class RealtimeStreamError extends Error {
  status: number | null
  retryable: boolean
  constructor(message: string, options: { status?: number | null; retryable: boolean }) {
    super(message); this.name = 'RealtimeStreamError'; this.status = options.status ?? null
    this.retryable = options.retryable
  }
}

export function isRetryableRealtimeStreamError(error: unknown) {
  return error instanceof RealtimeStreamError ? error.retryable : true
}

export async function openRealtimeStream(signal: AbortSignal, handlers: StreamHandlers) {
  let session = readSession()
  if (!session) throw new RealtimeStreamError('AUTH_REQUIRED', { status: 401, retryable: false })
  let response = await request(session.accessToken, signal)
  if (response.status === 401 && !signal.aborted) {
    session = await refreshSession()
    if (!session) throw new RealtimeStreamError('AUTH_REQUIRED', { status: 401, retryable: false })
    response = await request(session.accessToken, signal)
  }
  if (!response.ok) throw new RealtimeStreamError(`SSE_${response.status}`, {
    status: response.status, retryable: response.status === 408 || response.status === 429 || response.status >= 500,
  })
  if (!response.body) throw new RealtimeStreamError('SSE_NO_BODY', { retryable: true })
  handlers.onOpen()
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ''
  while (!signal.aborted) {
    const { value, done } = await reader.read(); if (done) break
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')
    let boundary = buffer.indexOf('\n\n')
    while (boundary >= 0) {
      const parsed = parseSseBlock(buffer.slice(0, boundary)); buffer = buffer.slice(boundary + 2)
      if (parsed) handlers.onEvent(parsed)
      boundary = buffer.indexOf('\n\n')
    }
  }
}

function request(accessToken: string, signal: AbortSignal) {
  return fetch('/api/realtime/stream', { method: 'GET', signal, credentials: 'same-origin', headers: {
    Accept: 'text/event-stream', Authorization: `Bearer ${accessToken}`,
  } })
}

function parseSseBlock(block: string): RealtimeEvent | null {
  let id = ''; const data: string[] = []
  for (const line of block.split('\n')) {
    if (line.startsWith('id:')) id = line.slice(3).trim()
    if (line.startsWith('data:')) data.push(line.slice(5).trimStart())
  }
  if (!data.length) return null
  try { const parsed = JSON.parse(data.join('\n')) as RealtimeEvent; return parsed.eventId ? parsed : { ...parsed, eventId: id } }
  catch { return null }
}
