import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import './index.css'
import { AppRouter } from './app/AppRouter'
import { IS_PRACTICE_MODE } from './lib/practiceMode'

const queryClient = new QueryClient()

const Router = IS_PRACTICE_MODE ? HashRouter : BrowserRouter

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Router>
        <AppRouter />
      </Router>
    </QueryClientProvider>
  </StrictMode>,
)
