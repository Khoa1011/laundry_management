import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { AuthProvider } from './auth/AuthProvider'
import './i18n'
import { ThemeProvider } from './providers/ThemeProvider'
import { ToastProvider } from './providers/ToastProvider'
import { MotionProvider } from './providers/MotionProvider'
import { RealtimeProvider } from './providers/RealtimeProvider'
import './styles.css'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false }, mutations: { retry: false } } })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <MotionProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ToastProvider>
              <RealtimeProvider>
                <App />
              </RealtimeProvider>
            </ToastProvider>
          </AuthProvider>
        </QueryClientProvider>
      </MotionProvider>
    </ThemeProvider>
  </StrictMode>,
)
