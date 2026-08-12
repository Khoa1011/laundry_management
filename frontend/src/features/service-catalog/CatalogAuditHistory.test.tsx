import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CatalogAuditHistory } from './CatalogAuditHistory'

describe('CatalogAuditHistory', () => {
  it('shows an English action with explicit before and after values', () => {
    render(<CatalogAuditHistory
      entries={[{
        id: 1,
        entityType: 'PRICE_LIST',
        entityId: 8,
        action: 'PRICE_RULE_UPDATED',
        oldValue: { serviceName: 'Giặt sấy', unitPrice: 90000, sharingMode: 'ANY' },
        newValue: { serviceName: 'Giặt sấy', unitPrice: 98563242, sharingMode: 'PRIVATE_LOAD' },
        actor: { id: 2, name: 'Store Manager' },
        createdAt: '2026-07-26T10:00:00Z',
      }]}
      formatDate={() => '26 Jul 2026, 17:00'}
    />)

    expect(screen.getByText('Updated pricing rule')).toBeInTheDocument()
    expect(screen.getByText(/Changed by Store Manager/)).toBeInTheDocument()
    expect(screen.getByText('Unit price')).toBeInTheDocument()
    expect(screen.getByText('90,000 VND')).toBeInTheDocument()
    expect(screen.getByText('98,563,242 VND')).toBeInTheDocument()
    expect(screen.getByText('Processing mode')).toBeInTheDocument()
    expect(screen.getByText('Any processing mode')).toBeInTheDocument()
    expect(screen.getByText('Private load')).toBeInTheDocument()
    expect(screen.getAllByText('Before').length).toBeGreaterThan(0)
    expect(screen.getAllByText('After').length).toBeGreaterThan(0)
  })
})
