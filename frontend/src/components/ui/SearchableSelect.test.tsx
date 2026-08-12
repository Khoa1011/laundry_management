import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SearchableSelect } from './SearchableSelect'

const labels = {
  haNoi: 'Th\u00e0nh ph\u1ed1 H\u00e0 N\u1ed9i',
  daNang: 'Th\u00e0nh ph\u1ed1 \u0110\u00e0 N\u1eb5ng',
  hoChiMinh: 'Th\u00e0nh ph\u1ed1 H\u1ed3 Ch\u00ed Minh',
  province: 'T\u1ec9nh / th\u00e0nh ph\u1ed1',
  selectProvince: 'Ch\u1ecdn t\u1ec9nh / th\u00e0nh ph\u1ed1',
  searchProvince: 'T\u00ecm t\u1ec9nh / th\u00e0nh ph\u1ed1',
  noResults: 'Kh\u00f4ng t\u00ecm th\u1ea5y k\u1ebft qu\u1ea3',
}

const options = [
  { value: '1', label: labels.haNoi },
  { value: '48', label: labels.daNang },
  { value: '79', label: labels.hoChiMinh },
]

describe('SearchableSelect', () => {
  it('filters Vietnamese labels without requiring diacritics', async () => {
    const user = userEvent.setup()
    render(
      <SearchableSelect
        value=""
        options={options}
        placeholder={labels.selectProvince}
        selectAriaLabel={labels.province}
        searchPlaceholder={labels.searchProvince}
        noResultsText={labels.noResults}
        onChange={vi.fn()}
      />,
    )

    await user.type(screen.getByRole('combobox', { name: labels.province }), 'da nang')

    expect(screen.getByRole('option', { name: labels.daNang })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: labels.haNoi })).not.toBeInTheDocument()
  })

  it('selects a filtered option and clears the search query', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SearchableSelect
        value=""
        options={options}
        placeholder={labels.selectProvince}
        selectAriaLabel={labels.province}
        searchPlaceholder={labels.searchProvince}
        noResultsText={labels.noResults}
        onChange={onChange}
      />,
    )

    const search = screen.getByRole('combobox', { name: labels.province })
    await user.type(search, 'ho chi minh')
    await user.click(screen.getByRole('option', { name: labels.hoChiMinh }))

    expect(onChange).toHaveBeenCalledWith('79')
    expect(search).toHaveValue('')
  })

  it('clears a stale query when the select becomes unavailable', async () => {
    const user = userEvent.setup()
    const props = {
      value: '',
      options,
      placeholder: 'Select province',
      selectAriaLabel: 'Province',
      searchPlaceholder: 'Search province',
      noResultsText: 'No matching results',
      onChange: vi.fn(),
    }
    const { rerender } = render(<SearchableSelect {...props} />)

    const search = screen.getByRole('combobox', { name: 'Province' })
    await user.type(search, 'da nang')
    rerender(<SearchableSelect {...props} disabled />)

    expect(search).toHaveValue('')
    expect(search).toBeDisabled()
  })
})
