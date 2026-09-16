export const NAVIGATION_SETTLE_MS = 180

let settleTimer: number | null = null
let pendingNavigation: (() => void) | null = null

function finishSettleWindow() {
  if (pendingNavigation) {
    const navigate = pendingNavigation
    pendingNavigation = null
    navigate()
    settleTimer = window.setTimeout(finishSettleWindow, NAVIGATION_SETTLE_MS)
    return
  }

  settleTimer = null
}

/**
 * Runs the first navigation immediately, then coalesces a rapid click burst to
 * its latest destination. This keeps the router from accumulating transitions
 * when a user repeatedly clicks navigation controls.
 */
export function scheduleNavigation(navigate: () => void) {
  if (settleTimer === null) {
    navigate()
    settleTimer = window.setTimeout(finishSettleWindow, NAVIGATION_SETTLE_MS)
    return
  }

  pendingNavigation = navigate
}

export function resetNavigationScheduler() {
  if (settleTimer !== null) window.clearTimeout(settleTimer)
  settleTimer = null
  pendingNavigation = null
}
