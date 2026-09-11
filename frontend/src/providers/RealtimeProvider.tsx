import type { ReactNode } from 'react'
import { NotificationProvider } from '../features/notifications/providers/NotificationProvider'

/** Owns the single authenticated application SSE stream and notification projection. */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  return <NotificationProvider>{children}</NotificationProvider>
}
