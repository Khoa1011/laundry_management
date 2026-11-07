import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { BranchChangeRequest } from '../auth/branchChangeGuards'
import { UnsavedBranchDialog } from './UnsavedBranchDialog'

const mocks = vi.hoisted(() => ({ register: vi.fn(), guard: undefined as undefined | ((request: BranchChangeRequest) => void) }))
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ registerBranchChangeGuard: mocks.register }) }))

describe('UnsavedBranchDialog', () => {
  it('preserves a dirty form on cancel and proceeds only on explicit confirmation', async () => {
    const unregister = vi.fn()
    mocks.register.mockImplementation((guard) => { mocks.guard = guard; return unregister })
    const proceed = vi.fn()
    const view = render(<UnsavedBranchDialog dirty />)
    act(() => mocks.guard?.({ branchId: 2, proceed }))
    fireEvent.click(await screen.findByRole('button', { name: 'Hủy' }))
    expect(proceed).not.toHaveBeenCalled()
    act(() => mocks.guard?.({ branchId: 2, proceed }))
    fireEvent.click(await screen.findByRole('button', { name: 'Đổi chi nhánh' }))
    expect(proceed).toHaveBeenCalledTimes(1)
    view.unmount()
    expect(unregister).toHaveBeenCalled()
  })

  it('does not register a clean form and blocks switching during a pending save', async () => {
    mocks.register.mockClear().mockImplementation((guard) => { mocks.guard = guard; return () => {} })
    const proceed = vi.fn()
    const view = render(<UnsavedBranchDialog dirty={false} />)
    expect(mocks.register).not.toHaveBeenCalled()
    view.rerender(<UnsavedBranchDialog dirty busy />)
    act(() => mocks.guard?.({ branchId: 2, proceed }))
    expect(await screen.findByRole('button', { name: 'Đang lưu…' })).toBeDisabled()
    fireEvent.click(screen.getAllByRole('button', { name: 'Đóng' })[0])
    expect(proceed).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
