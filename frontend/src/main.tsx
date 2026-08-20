import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { isMockEnabled } from './utils/env'
import './index.css'
import './styles/global.css'
import App from './App'
import AppErrorBoundary from './components/AppErrorBoundary'

async function enableMocking() {
  if (isMockEnabled()) {
    try {
      const { worker } = await import('./mocks/browser')
      await worker.start({
        onUnhandledRequest: 'bypass',
      })
      console.log('[MSW] Mock Service Worker 已启动，拦截 API 请求')
    } catch (error) {
      console.error('[MSW] Mock 启动失败：', error)
    }
  } else {
    console.log('[APP] Mock 未启用，将请求真实后端')
  }
}

function renderApp() {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter>
        <AppErrorBoundary>
          <App />
        </AppErrorBoundary>
      </BrowserRouter>
    </React.StrictMode>,
  )
}

enableMocking()
  .catch((error) => {
    console.error('[APP] Mock 启动阶段异常：', error)
  })
  .finally(() => {
    renderApp()
  })
