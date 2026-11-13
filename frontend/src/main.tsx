import React from 'react'
import ReactDOM from 'react-dom/client'
import { isMockEnabled } from './utils/env'
import { bootstrapTheme } from './theme/model/theme'
import './index.css'
import './styles/global.css'
import AppProviders from './components/AppProviders'

// 在 React 挂载前把主题写到 <html data-theme>，避免首屏闪白
bootstrapTheme()

async function enableMocking() {
  if (isMockEnabled()) {
    try {
      const { worker } = await import('./mocks/browser')
      await worker.start({
        onUnhandledRequest: 'bypass',
      })
      console.log('[MSW] Mock Service Worker started')
    } catch (error) {
      console.error('[MSW] Failed to start mocks:', error)
    }
  } else {
    console.log('[APP] Mocks disabled; using the configured backend')
  }
}

function renderApp() {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <AppProviders />
    </React.StrictMode>,
  )
}

enableMocking()
  .catch((error) => {
    console.error('[APP] Mock bootstrap failed:', error)
  })
  .finally(() => {
    renderApp()
  })
