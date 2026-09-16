import { createContext, useContext } from 'react'
import type { RealtimeConnectionState, RealtimeEvent } from './types'

export interface RealtimeContextValue {
  connectionState: RealtimeConnectionState
  subscribe: (prefix: string, subscriber: (event: RealtimeEvent) => void) => () => void
}
export const RealtimeContext = createContext<RealtimeContextValue | null>(null)

export function useRealtime() {
  const value = useContext(RealtimeContext)
  if (!value) throw new Error('useRealtime must be used within RealtimeProvider')
  return value
}
