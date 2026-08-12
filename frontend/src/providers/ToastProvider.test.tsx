import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ToastProvider, useToast } from './ToastProvider'

function ToastTriggers() {
  const { notify } = useToast()
  return <>
    <button onClick={() => notify('Saved')}>Success</button>
    <button onClick={() => notify('Unable to save', 'error')}>Error</button>
  </>
}

describe('ToastProvider', () => {
  it('uses semantic roles and replaces duplicate notifications', async () => {
    const user = userEvent.setup()
    render(<ToastProvider><ToastTriggers /></ToastProvider>)

    await user.click(screen.getByRole('button', { name: 'Error' }))
    await user.click(screen.getByRole('button', { name: 'Error' }))

    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to save')

    await user.click(screen.getByRole('button', { name: 'Success' }))
    expect(screen.getByRole('status')).toHaveTextContent('Saved')
  })
})
