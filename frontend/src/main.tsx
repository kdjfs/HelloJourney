import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import { isMockEnabled } from './utils/env'
import './index.css'
import './styles/global.css'
import App from './App'
import AppErrorBoundary from './components/AppErrorBoundary'

dayjs.locale('zh-cn')

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
      <ConfigProvider
        locale={zhCN}
        theme={{
          algorithm: theme.darkAlgorithm,
          token: {
            colorPrimary: '#d76e42',
            colorInfo: '#d76e42',
            colorBgBase: '#0a1520',
            colorTextBase: '#ecf3fa',
            colorBorder: 'rgba(236, 243, 250, 0.18)',
            colorBorderSecondary: 'rgba(236, 243, 250, 0.12)',
            borderRadius: 10,
            fontFamily:
              "Inter, 'PingFang SC', 'Microsoft YaHei', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
          },
        }}
      >
        <BrowserRouter>
          <AppErrorBoundary>
            <App />
          </AppErrorBoundary>
        </BrowserRouter>
      </ConfigProvider>
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
