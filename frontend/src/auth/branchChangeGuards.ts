export type BranchChangeRequest = { branchId: number; proceed: () => void }
export type BranchChangeGuard = (request: BranchChangeRequest) => void

/** Coordinates explicit user branch changes without bypassing dirty forms or replaying stale confirmations. */
export class BranchChangeGuards {
  private readonly guards = new Map<symbol, BranchChangeGuard>()
  private generation = 0

  register(guard: BranchChangeGuard) {
    const key = Symbol('branch-change-guard')
    this.cancelPending()
    this.guards.set(key, guard)
    return () => { this.guards.delete(key); this.cancelPending() }
  }

  cancelPending() { this.generation += 1 }

  request(branchId: number, commit: () => void) {
    const generation = ++this.generation
    const guards = [...this.guards.values()]
    let committed = false
    const next = (index: number) => {
      if (generation !== this.generation || committed) return
      if (index === guards.length) { committed = true; commit(); return }
      let continued = false
      guards[index]({ branchId, proceed: () => {
        if (continued) return
        continued = true
        next(index + 1)
      } })
    }
    next(0)
  }
}
