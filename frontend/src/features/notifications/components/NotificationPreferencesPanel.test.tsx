import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '../../../i18n'
import { NotificationPreferencesPanel } from './NotificationPreferencesPanel'

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  preview: vi.fn(),
  previewCustom: vi.fn(),
  prepareCustom: vi.fn(),
  clearCustom: vi.fn(),
  notify: vi.fn(),
  loadCustom: vi.fn(),
  saveCustom: vi.fn(),
  setCustomActive: vi.fn(),
  deleteCustom: vi.fn(),
  preferences: {
    soundEnabled: true,
    soundKey: 'SOFT_CHIME' as const,
    soundVolume: 65,
    toastEnabled: true,
    bellAnimationEnabled: true,
    version: 2,
  },
}))

vi.mock('../hooks/useNotifications', () => ({
  useNotificationPreferences: () => ({
    data: mocks.preferences,
    isLoading: false,
  }),
  useUpdateNotificationPreferences: () => ({
    mutateAsync: mocks.update,
    isPending: false,
  }),
}))
vi.mock('../sound/notificationSound', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sound/notificationSound')>()),
  notificationSoundEngine: {
    previewPreset: mocks.preview,
    previewCustom: mocks.previewCustom,
    prepareCustomSound: mocks.prepareCustom,
    clearCustomSound: mocks.clearCustom,
  },
}))
vi.mock('../sound/customNotificationSound', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sound/customNotificationSound')>()),
  loadCustomNotificationSound: mocks.loadCustom,
  saveCustomNotificationSound: mocks.saveCustom,
  setCustomNotificationSoundActive: mocks.setCustomActive,
  deleteCustomNotificationSound: mocks.deleteCustom,
}))
vi.mock('../../../auth/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 7 } }),
}))
vi.mock('../../../providers/ToastProvider', () => ({
  useToast: () => ({ notify: mocks.notify }),
}))

describe('NotificationPreferencesPanel', () => {
  beforeEach(() => {
    mocks.update.mockReset().mockResolvedValue(undefined)
    mocks.preview.mockReset().mockResolvedValue('played')
    mocks.previewCustom.mockReset().mockResolvedValue('played')
    mocks.prepareCustom.mockReset()
    mocks.clearCustom.mockReset()
    mocks.notify.mockReset()
    mocks.loadCustom.mockReset().mockResolvedValue(undefined)
    mocks.saveCustom.mockReset()
    mocks.setCustomActive.mockReset().mockResolvedValue(undefined)
    mocks.deleteCustom.mockReset().mockResolvedValue(undefined)
  })

  it('previews explicitly and saves the selected sound, volume, toast, and animation settings', async () => {
    const user = userEvent.setup()
    render(<NotificationPreferencesPanel />)

    const digitalPing = document.querySelector<HTMLInputElement>('input[value="DIGITAL_PING"]')
    expect(digitalPing).not.toBeNull()
    await user.click(digitalPing as HTMLInputElement)
    fireEvent.change(screen.getByRole('slider'), { target: { value: '35' } })
    await user.click(screen.getAllByRole('button')[2])
    expect(mocks.preview).toHaveBeenCalledWith('DIGITAL_PING', 35)

    const switches = screen.getAllByRole('switch')
    await user.click(switches[1])
    await user.click(switches[2])
    const buttons = screen.getAllByRole('button')
    await user.click(buttons[buttons.length - 1])

    expect(mocks.update).toHaveBeenCalledWith({
      soundEnabled: true,
      soundKey: 'DIGITAL_PING',
      soundVolume: 35,
      toastEnabled: false,
      bellAnimationEnabled: false,
    })
  })

  it('shows the audio-unlock fallback when the browser blocks preview', async () => {
    mocks.preview.mockResolvedValue('blocked')
    render(<NotificationPreferencesPanel />)

    await userEvent.click(screen.getAllByRole('button')[0])

    expect(mocks.notify).toHaveBeenCalled()
  })

  it('toggles the switch with the keyboard', async () => {
    const user = userEvent.setup()
    render(<NotificationPreferencesPanel />)
    const soundSwitch = screen.getAllByRole('switch')[0]

    soundSwitch.focus()
    await user.keyboard('[Space]')

    expect(soundSwitch).not.toBeChecked()
    expect(screen.getByRole('slider')).toBeDisabled()
  })

  it('imports a local sound and activates it when settings are saved', async () => {
    const user = userEvent.setup()
    const file = new File(['custom audio'], 'thong-bao.mp3', { type: 'audio/mpeg' })
    const record = {
      scope: 'user:7',
      blob: file,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      updatedAt: 123,
      active: false,
    }
    mocks.saveCustom.mockResolvedValue(record)
    mocks.setCustomActive.mockResolvedValue({ ...record, active: true })
    render(<NotificationPreferencesPanel />)

    const input = document.querySelector<HTMLInputElement>('input[type="file"]')
    expect(input).not.toBeNull()
    await user.upload(input as HTMLInputElement, file)
    await waitFor(() => expect(screen.getByText('thong-bao.mp3')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Nghe thử Âm thanh của bạn' }))

    await user.click(screen.getByRole('button', { name: 'Lưu' }))

    expect(mocks.saveCustom).toHaveBeenCalledWith('user:7', file)
    expect(mocks.previewCustom).toHaveBeenCalledWith('user:7', 65, record)
    expect(mocks.setCustomActive).toHaveBeenCalledWith('user:7', true)
    expect(mocks.update).toHaveBeenCalled()
  })
})
