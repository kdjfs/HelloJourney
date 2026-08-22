import React from 'react'
import ReactDOM from 'react-dom/client'
import { isMockEnabled } from './utils/env'
import './index.css'
import './styles/global.css'
import AppProviders from './components/AppProviders'

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
