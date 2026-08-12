import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EvidenceCaptureField, type EvidenceCaptureLabels } from './EvidenceCaptureField'

const labels: EvidenceCaptureLabels = {
  label: 'Ảnh kiểm chứng', takePhoto: 'Chụp ảnh', chooseFile: 'Chọn ảnh hoặc PDF', replaceFile: 'Chọn lại',
  removeFile: 'Bỏ tệp đã chọn', preview: 'Xem trước', emptyHint: 'JPEG, PNG hoặc PDF', invalidType: 'Tệp không hợp lệ',
  imageTooLarge: 'Ảnh quá lớn', pdfTooLarge: 'PDF quá lớn',
}

describe('EvidenceCaptureField', () => {
  it('provides a rear-camera input and a separate device file input', () => {
    const { container } = render(<EvidenceCaptureField value={null} onChange={vi.fn()} labels={labels} allowPdf />)
    expect(container.querySelector('input[capture="environment"]')).toHaveAttribute('accept', 'image/*')
    expect(container.querySelector('input:not([capture])')).toHaveAttribute('accept', expect.stringContaining('application/pdf'))
    expect(screen.getByRole('button', { name: 'Chụp ảnh' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Chọn ảnh hoặc PDF' })).toBeInTheDocument()
  })

  it('previews a selected image without uploading it', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:evidence')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const onChange = vi.fn()
    const { container, rerender } = render(<EvidenceCaptureField value={null} onChange={onChange} labels={labels} allowPdf />)
    const input = container.querySelector('input:not([capture])') as HTMLInputElement
    const file = new File(['image'], 'proof.png', { type: 'image/png' })
    await userEvent.upload(input, file)
    expect(onChange).toHaveBeenCalledWith(file)

    rerender(<EvidenceCaptureField value={file} onChange={onChange} labels={labels} allowPdf />)
    expect(screen.getByRole('button', { name: 'Xem trước: proof.png' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Xem trước: proof.png' }))
    expect(screen.getByRole('dialog', { name: 'proof.png' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'proof.png' })).toHaveAttribute('src', 'blob:evidence')
  })
})
