import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { PERMISSION_CODES } from '../auth/permissionCodes.generated'
import { isRetryableRealtimeStreamError, openRealtimeStream } from '../realtime/api'
import { RealtimeContext } from '../realtime/context'
import { claimRealtimeStreamLeadership, hasCurrentRealtimeStreamLeader, realtimeStreamLeaderKey, releaseRealtimeStreamLeadership, renewRealtimeStreamLeadership } from '../realtime/streamLeader'
import type { RealtimeConnectionState, RealtimeEvent } from '../realtime/types'

const MAX_EVENT_IDS = 300
const CHANNEL_NAME = 'laundry-realtime'
const LEADER_RENEW_MS = 4_000
const FOLLOWER_CHECK_MS = 3_000
type Subscriber = (event: RealtimeEvent) => void
type BroadcastMessage = { type: 'event'; event: RealtimeEvent; userId: number }
  | { type: 'leader-state'; state: RealtimeConnectionState; userId: number; tabId: string }
  | { type: 'stream-blocked'; userId: number }

function rememberBounded(set: Set<string>, order: string[], value: string) {
  if (set.has(value)) return false
  set.add(value); order.push(value)
  while (order.length > MAX_EVENT_IDS) { const removed = order.shift(); if (removed) set.delete(removed) }
  return true
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user, hasPermission } = useAuth()
  const userId = user?.id ?? null
  const canStream = Boolean(user) && (
    hasPermission(PERMISSION_CODES.NOTIFICATION_READ_OWN) || hasPermission(PERMISSION_CODES.ORDER_READ)
  )
  const [connectionState, setConnectionState] = useState<RealtimeConnectionState>('idle')
  const subscribers = useRef(new Map<string, Set<Subscriber>>())
  const handled = useRef(new Set<string>())
  const handledOrder = useRef<string[]>([])
  const channelRef = useRef<BroadcastChannel | null>(null)
  const blocked = useRef(false)

  const subscribe = useCallback((prefix: string, subscriber: Subscriber) => {
    const values = subscribers.current.get(prefix) ?? new Set<Subscriber>()
    values.add(subscriber); subscribers.current.set(prefix, values)
    return () => { values.delete(subscriber); if (!values.size) subscribers.current.delete(prefix) }
  }, [])
  const dispatch = useCallback((event: RealtimeEvent, source: 'stream' | 'broadcast' | 'local') => {
    if (!event.eventId || !rememberBounded(handled.current, handledOrder.current, event.eventId)) return
    if (source === 'stream' && userId) {
      channelRef.current?.postMessage({ type: 'event', event, userId } satisfies BroadcastMessage)
    }
    const type = event.type ?? event.eventType ?? ''
    subscribers.current.forEach((listeners, prefix) => {
      if (type.startsWith(prefix)) listeners.forEach(listener => listener(event))
    })
  }, [userId])

  useEffect(() => {
    if (!canStream || !userId || typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel(CHANNEL_NAME); channelRef.current = channel
    channel.onmessage = (message: MessageEvent<BroadcastMessage>) => {
      if (message.data.userId !== userId) return
      if (message.data.type === 'event') dispatch(message.data.event, 'broadcast')
      if (message.data.type === 'leader-state') {
        const state = message.data.state
        setConnectionState(current => current === 'offline' ? current : state)
      }
      if (message.data.type === 'stream-blocked') { blocked.current = true; setConnectionState('idle') }
    }
    return () => { channel.close(); channelRef.current = null }
  }, [canStream, dispatch, userId])

  useEffect(() => {
    if (!canStream || !userId) { setConnectionState('idle'); return }
    blocked.current = false
    let stopped = false; let isLeader = false; let connectedOnce = false; let retryDelay = 1_000
    let retryTimer: number | null = null; let renewTimer: number | null = null; let followerTimer: number | null = null
    let controller: AbortController | null = null; let leaderState: RealtimeConnectionState = 'connecting'
    const tabId = getTabId(); const leaderKey = realtimeStreamLeaderKey(userId)
    const coordinated = typeof BroadcastChannel !== 'undefined' && typeof localStorage !== 'undefined'
    const publish = (state: RealtimeConnectionState) => { leaderState = state; if (coordinated) channelRef.current?.postMessage({ type: 'leader-state', state, userId, tabId } satisfies BroadcastMessage) }
    const clearTimers = () => { if (retryTimer !== null) clearTimeout(retryTimer); if (renewTimer !== null) clearInterval(renewTimer); if (followerTimer !== null) clearInterval(followerTimer); retryTimer = renewTimer = followerTimer = null }
    const stopLeadership = () => { isLeader = false; if (renewTimer !== null) clearInterval(renewTimer); renewTimer = null; if (coordinated) releaseRealtimeStreamLeadership(localStorage, leaderKey, tabId, userId) }
    const schedule = () => { if (stopped || blocked.current || retryTimer !== null || !navigator.onLine) { if (!navigator.onLine) setConnectionState('offline'); return } if (coordinated && !isLeader) return; setConnectionState('reconnecting'); publish('reconnecting'); retryTimer = window.setTimeout(() => { retryTimer = null; void connect() }, retryDelay); retryDelay = Math.min(30_000, retryDelay * 2) }
    const follow = () => { if (!coordinated || followerTimer !== null) return; followerTimer = window.setInterval(() => { if (!stopped && !blocked.current && !hasCurrentRealtimeStreamLeader(localStorage, leaderKey, userId)) void claim() }, FOLLOWER_CHECK_MS) }
    const renew = () => { if (!coordinated) return; renewTimer = window.setInterval(() => { if (stopped || blocked.current) return; if (!renewRealtimeStreamLeadership(localStorage, leaderKey, tabId, userId)) { controller?.abort(); stopLeadership(); setConnectionState('reconnecting'); follow() } else publish(leaderState) }, LEADER_RENEW_MS) }
    const claim = async () => { if (stopped || blocked.current) return; if (!navigator.onLine) { setConnectionState('offline'); return } if (coordinated && !claimRealtimeStreamLeadership(localStorage, leaderKey, tabId, userId)) { isLeader = false; setConnectionState('connecting'); follow(); return } isLeader = true; if (followerTimer !== null) clearInterval(followerTimer); followerTimer = null; renew(); await connect() }
    const connect = async () => { if (stopped || blocked.current || (coordinated && !isLeader)) return; controller?.abort(); controller = new AbortController(); setConnectionState(current => current === 'idle' ? 'connecting' : 'reconnecting'); publish('reconnecting'); try { await openRealtimeStream(controller.signal, { onOpen: () => { retryDelay = 1_000; setConnectionState('connected'); publish('connected'); if (connectedOnce) dispatch({ eventId: `reconnect:${userId}:${Date.now()}`, type: 'realtime.reconnected', occurredAt: new Date().toISOString() }, 'local'); connectedOnce = true }, onEvent: event => dispatch(event, 'stream') }); if (!controller.signal.aborted) schedule() } catch (error) { if (controller.signal.aborted) return; if (!isRetryableRealtimeStreamError(error)) { blocked.current = true; setConnectionState('idle'); channelRef.current?.postMessage({ type: 'stream-blocked', userId } satisfies BroadcastMessage); stopLeadership(); return } schedule() } }
    const offline = () => { if (retryTimer !== null) clearTimeout(retryTimer); retryTimer = null; controller?.abort(); setConnectionState('offline'); publish('offline') }
    const online = () => { if (retryTimer !== null) clearTimeout(retryTimer); retryTimer = null; void claim() }
    window.addEventListener('offline', offline); window.addEventListener('online', online); void claim()
    return () => { stopped = true; clearTimers(); controller?.abort(); stopLeadership(); window.removeEventListener('offline', offline); window.removeEventListener('online', online) }
  }, [canStream, dispatch, userId])

  const value = useMemo(() => ({ connectionState, subscribe }), [connectionState, subscribe])
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
}

function getTabId() { const key = 'laundry.realtime.tab-id'; let id = sessionStorage.getItem(key); if (!id) { id = crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`; sessionStorage.setItem(key, id) } return id }
