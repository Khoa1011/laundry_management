import { useCallback, useEffect, useState } from 'react'

type ConnectionState = 'checking' | 'ready' | 'error'

const stateCopy: Record<
  ConnectionState,
  { label: string; description: string }
> = {
  checking: {
    label: 'Đang kiểm tra',
    description: 'Đang xác nhận kết nối tới dịch vụ backend.',
  },
  ready: {
    label: 'Đã kết nối',
    description: 'Giao diện và dịch vụ backend đang hoạt động bình thường.',
  },
  error: {
    label: 'Chưa kết nối',
    description: 'Không thể liên hệ dịch vụ backend. Vui lòng thử lại.',
  },
}

function App() {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>('checking')

  const checkBackend = useCallback(async () => {
    setConnectionState('checking')

    try {
      const response = await fetch('/api/health', {
        headers: { Accept: 'application/json' },
      })

      if (!response.ok) {
        throw new Error(`Health request failed with ${response.status}`)
      }

      const result = (await response.json()) as { status?: string }
      setConnectionState(result.status === 'UP' ? 'ready' : 'error')
    } catch {
      setConnectionState('error')
    }
  }, [])

  useEffect(() => {
    void checkBackend()
  }, [checkBackend])

  const copy = stateCopy[connectionState]

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true">
          GS
        </div>
        <div>
          <p className="brand-name">Giặt Sấy</p>
          <p className="brand-context">Hệ thống quản lý cửa hàng</p>
        </div>
      </header>

      <section className="content" aria-labelledby="page-title">
        <div className="intro">
          <p className="status-kicker">Khởi động hoàn tất</p>
          <h1 id="page-title">Ứng dụng đã sẵn sàng</h1>
          <p>
            Docker đã phục vụ giao diện web. Trạng thái bên dưới xác nhận kết
            nối cùng nguồn tới backend.
          </p>
        </div>

        <div className="status-panel" aria-live="polite">
          <div className="status-heading">
            <div
              className={`status-icon status-icon--${connectionState}`}
              aria-hidden="true"
            >
              {connectionState === 'ready'
                ? '✓'
                : connectionState === 'error'
                  ? '!'
                  : '…'}
            </div>
            <div>
              <h2>Kết nối hệ thống</h2>
              <p>{copy.description}</p>
            </div>
          </div>

          <dl className="service-list">
            <div>
              <dt>Giao diện web</dt>
              <dd>
                <span className="state-dot state-dot--ready" />
                Đang hoạt động
              </dd>
            </div>
            <div>
              <dt>Dịch vụ backend</dt>
              <dd>
                <span className={`state-dot state-dot--${connectionState}`} />
                {copy.label}
              </dd>
            </div>
          </dl>

          {connectionState === 'error' && (
            <button type="button" onClick={() => void checkBackend()}>
              Thử kết nối lại
            </button>
          )}
        </div>

        <p className="next-step">
          Các chức năng nghiệp vụ sẽ xuất hiện tại đây sau khi quy tắc vận hành
          được xác nhận.
        </p>
      </section>
    </main>
  )
}

export default App

