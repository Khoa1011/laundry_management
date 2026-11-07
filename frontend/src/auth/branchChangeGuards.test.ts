import { describe, expect, it, vi } from 'vitest'
import { BranchChangeGuards, type BranchChangeRequest } from './branchChangeGuards'

describe('Branch change guards', () => {
  it('commits clean changes immediately and requires every active guard to continue', () => {
    const guards = new BranchChangeGuards()
    const commit = vi.fn()
    guards.request(2, commit)
    expect(commit).toHaveBeenCalledTimes(1)
    const requests: BranchChangeRequest[] = []
    guards.register((r) => requests.push(r))
    guards.register((r) => requests.push(r))
    guards.request(3, commit)
    expect(requests).toHaveLength(1)
    requests[0].proceed()
    expect(requests).toHaveLength(2)
    expect(commit).toHaveBeenCalledTimes(1)
    requests[1].proceed()
    requests[1].proceed()
    expect(commit).toHaveBeenCalledTimes(2)
  })

  it('ignores superseded, unmounted and authorization-invalidated confirmations', () => {
    const guards = new BranchChangeGuards()
    const requests: BranchChangeRequest[] = []
    const unregister = guards.register((r) => requests.push(r))
    const first = vi.fn(), second = vi.fn(), third = vi.fn()
    guards.request(2, first)
    guards.request(3, second)
    requests[0].proceed()
    expect(first).not.toHaveBeenCalled()
    unregister()
    requests[1].proceed()
    expect(second).not.toHaveBeenCalled()
    guards.register((r) => requests.push(r))
    guards.request(4, third)
    guards.cancelPending()
    requests[2].proceed()
    expect(third).not.toHaveBeenCalled()
  })
})
