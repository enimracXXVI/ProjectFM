import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { ConfirmProvider } from './components/ConfirmDialog.tsx'
import { AuthProvider } from './lib/auth.tsx'
import { CareerProvider } from './lib/career.tsx'
import { ConfigProvider } from './lib/config.tsx'
import './index.css'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <AuthProvider>
          <ConfigProvider>
            <CareerProvider>
              <ConfirmProvider>
                <App />
              </ConfirmProvider>
            </CareerProvider>
          </ConfigProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
