import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VietnamAddressValue } from './types'
import { VietnamAddressFields } from './VietnamAddressFields'

const labels = {
  province: 'T\u1ec9nh / th\u00e0nh ph\u1ed1',
  district: 'Qu\u1eadn / huy\u1ec7n',
  ward: 'Ph\u01b0\u1eddng / x\u00e3',
  legacyToggle: 'D\u00f9ng \u0111\u1ecba ch\u1ec9 c\u0169 tr\u01b0\u1edbc 07/2025',
  retry: 'Th\u1eed l\u1ea1i',
  catalogError: 'Kh\u00f4ng t\u1ea3i \u0111\u01b0\u1ee3c danh m\u1ee5c \u0111\u1ecba ch\u1ec9. B\u1ea1n v\u1eabn c\u00f3 th\u1ec3 nh\u1eadp tay.',
  hoChiMinh: 'Th\u00e0nh ph\u1ed1 H\u1ed3 Ch\u00ed Minh',
  linhTrung: 'Ph\u01b0\u1eddng Linh Trung',
  oldProvince: 'T\u1ec9nh c\u0169',
}

const refetch = vi.fn()
const catalogState = vi.hoisted(() => ({ isError: false }))

vi.mock('./api', () => ({
  useVietnamProvinces: () => ({
    data: [
      { code: 79, name: labels.hoChiMinh, divisionType: 'th\u00e0nh ph\u1ed1 trung \u01b0\u01a1ng' },
    ],
    isPending: false,
    isError: catalogState.isError,
    refetch,
  }),
  useVietnamDistricts: () => ({
    data: [
      { code: 769, name: 'Th\u00e0nh ph\u1ed1 Th\u1ee7 \u0110\u1ee9c', divisionType: 'th\u00e0nh ph\u1ed1' },
    ],
    isPending: false,
    isError: false,
    refetch,
  }),
  useVietnamWards: () => ({
    data: [
      { code: 26794, name: labels.linhTrung, divisionType: 'ph\u01b0\u1eddng' },
    ],
    isPending: false,
    isError: false,
    refetch,
  }),
}))

const initialValue: VietnamAddressValue = {
  administrativeVersion: 'V2',
  province: '',
  provinceCode: '',
  district: '',
  districtCode: '',
  ward: '',
  wardCode: '',
  addressLine: '',
}

function Harness() {
  const [value, setValue] = useState(initialValue)
  return (
    <>
      <VietnamAddressFields
        idPrefix="test-address"
        value={value}
        onChange={(patch) => setValue((current) => ({ ...current, ...patch }))}
        canUseCatalog
      />
      <output data-testid="value">{JSON.stringify(value)}</output>
    </>
  )
}

function ManualHarness() {
  const [value, setValue] = useState(initialValue)
  return (
    <>
      <VietnamAddressFields
        idPrefix="manual-address"
        value={value}
        onChange={(patch) => setValue((current) => ({ ...current, ...patch }))}
        canUseCatalog={false}
      />
      <output data-testid="manual-value">{JSON.stringify(value)}</output>
    </>
  )
}

describe('VietnamAddressFields', () => {
  beforeEach(() => {
    catalogState.isError = false
  })

  it('uses the current two-level catalog by default and stores codes with names', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    expect(screen.queryByRole('combobox', { name: labels.district })).not.toBeInTheDocument()

    await user.click(screen.getByRole('combobox', { name: labels.province }))
    await user.click(screen.getByRole('option', { name: labels.hoChiMinh }))
    await user.click(screen.getByRole('combobox', { name: labels.ward }))
    await user.click(screen.getByRole('option', { name: labels.linhTrung }))

    expect(screen.getByTestId('value')).toHaveTextContent('"provinceCode":"79"')
    expect(screen.getByTestId('value')).toHaveTextContent(`"province":"${labels.hoChiMinh}"`)
    expect(screen.getByTestId('value')).toHaveTextContent('"wardCode":"26794"')
  })

  it('shows the district selector only for legacy addresses and clears dependent fields', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('checkbox', { name: labels.legacyToggle }))

    expect(screen.getByRole('combobox', { name: labels.district })).toBeDisabled()
    expect(screen.getByTestId('value')).toHaveTextContent('"administrativeVersion":"V1"')
    expect(screen.getByTestId('value')).toHaveTextContent('"provinceCode":""')
  })

  it('keeps manual entry available without catalog permission', async () => {
    const user = userEvent.setup()
    render(<ManualHarness />)

    await user.type(screen.getByRole('textbox', { name: labels.province }), labels.oldProvince)
    expect(screen.getByTestId('manual-value')).toHaveTextContent('"administrativeVersion":""')
    expect(screen.getByTestId('manual-value')).toHaveTextContent(`"province":"${labels.oldProvince}"`)
  })

  it('falls back to manual entry when the catalog is unavailable', () => {
    catalogState.isError = true
    render(<Harness />)

    expect(screen.getByText(labels.catalogError)).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: labels.province })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: labels.retry })).toBeInTheDocument()
  })
})
