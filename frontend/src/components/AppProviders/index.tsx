import { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import enUS from 'antd/locale/en_US'
import jaJP from 'antd/locale/ja_JP'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import 'dayjs/locale/en'
import 'dayjs/locale/ja'
import { useTranslation } from 'react-i18next'
import { normalizeAppLocale, type AppLocale } from '../../i18n'
import App from '../../App'
import AppErrorBoundary from '../AppErrorBoundary'

const ANTD_LOCALES = { zh: zhCN, en: enUS, ja: jaJP }
const DAYJS_LOCALES: Record<AppLocale, string> = { zh: 'zh-cn', en: 'en', ja: 'ja' }
const HTML_LANGS: Record<AppLocale, string> = { zh: 'zh-CN', en: 'en', ja: 'ja' }

export default function AppProviders() {
  const { i18n } = useTranslation()
  const locale = normalizeAppLocale(i18n.resolvedLanguage || i18n.language)

  useEffect(() => {
    dayjs.locale(DAYJS_LOCALES[locale])
    document.documentElement.lang = HTML_LANGS[locale]
  }, [locale])

  return (
    <ConfigProvider
      locale={ANTD_LOCALES[locale]}
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
  )
}
