import { beforeEach, describe, expect, it, vi } from 'vitest'
import { orderApi } from './api'

const request = vi.hoisted(() => vi.fn())
vi.mock('../../api/client', () => ({ apiRequest: request }))

describe('order intake API', () => {
  beforeEach(() => request.mockReset())

  it('uses order-scoped intake routes for customer, service, item type and quote data', async () => {
    request.mockResolvedValue([])
    await orderApi.customers(7, '1234')
    await orderApi.services(7)
    await orderApi.eligibility(7, 11)
    await orderApi.preview(7, { serviceId: 11, itemTypeId: 22, sharingMode: 'ANY', quantity: 2 })

    expect(request).toHaveBeenNthCalledWith(1, '/api/orders/intake/customers?branchId=7&query=1234')
    expect(request).toHaveBeenNthCalledWith(2, '/api/orders/intake/services?branchId=7')
    expect(request).toHaveBeenNthCalledWith(3, '/api/orders/intake/services/11/items?branchId=7')
    expect(request).toHaveBeenNthCalledWith(4, '/api/orders/intake/quote', expect.objectContaining({
      method: 'POST', body: expect.objectContaining({ branchId: 7, serviceId: 11, itemTypeId: 22 }),
    }))
    expect(request.mock.calls.flat().join(' ')).not.toContain('/api/pricing/preview')
  })

  it('omits patch fields that the caller does not intend to change', async () => {
    request.mockResolvedValue({})
    await orderApi.update(5, 7, { version: 3, note: 'Mới', itemNoteUpdates: [{ itemId: 11, note: null }] })
    expect(request).toHaveBeenCalledWith('/api/orders/5', {
      method: 'PATCH', branchId: 7, body: { version: 3, note: 'Mới', itemNoteUpdates: [{ itemId: 11, note: null }] },
    })
  })
})
