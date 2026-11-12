import { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider, theme, type ThemeConfig } from 'antd'
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
import { GenerationProvider } from '../../features/generation/model/GenerationProvider'

const ANTD_LOCALES = { zh: zhCN, en: enUS, ja: jaJP }
const DAYJS_LOCALES: Record<AppLocale, string> = { zh: 'zh-cn', en: 'en', ja: 'ja' }
const HTML_LANGS: Record<AppLocale, string> = { zh: 'zh-CN', en: 'en', ja: 'ja' }

/**
 * 全站唯一的 antd 主题。颜色必须与 src/index.css 的设计令牌保持一致，
 * 否则 antd 组件（Select 下拉、Modal、Alert…）会重新变回另一套配色。
 */
const FONT_STACK =
  "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif"

const LIGHT_THEME: ThemeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: '#12695c',
    colorInfo: '#2a6d8f',
    colorSuccess: '#1f7a52',
    colorWarning: '#c9871d',
    colorError: '#bf4327',
    colorTextBase: '#1b2a2f',
    colorBgBase: '#f6f3ec',
    colorBgLayout: '#f6f3ec',
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorBorder: '#e6e0d4',
    colorBorderSecondary: '#f0ebe1',
    colorTextSecondary: '#4d5c62',
    colorTextTertiary: '#7b8a8f',
    colorTextQuaternary: '#a3adaf',
    borderRadius: 12,
    borderRadiusLG: 16,
    borderRadiusSM: 8,
    controlHeight: 40,
    fontFamily: FONT_STACK,
    fontSize: 15,
    boxShadow: '0 12px 32px -16px rgba(53, 42, 24, 0.22), 0 2px 8px rgba(53, 42, 24, 0.05)',
    boxShadowSecondary: '0 18px 40px -20px rgba(53, 42, 24, 0.28)',
  },
  components: {
    Card: { headerBg: 'transparent', headerFontSize: 16 },
    Button: { fontWeight: 600, primaryShadow: 'none', defaultShadow: 'none' },
    Alert: { borderRadiusLG: 14 },
    Modal: { borderRadiusLG: 20 },
    Segmented: { itemSelectedBg: '#ffffff' },
    Select: { optionSelectedBg: '#e3f0ea' },
    Tabs: { itemSelectedColor: '#12695c', inkBarColor: '#12695c' },
    FloatButton: { colorPrimary: '#12695c' },
  },
}

export default function AppProviders() {
  const { i18n } = useTranslation()
  const locale = normalizeAppLocale(i18n.resolvedLanguage || i18n.language)

  useEffect(() => {
    dayjs.locale(DAYJS_LOCALES[locale])
    document.documentElement.lang = HTML_LANGS[locale]
  }, [locale])

  return (
    <ConfigProvider locale={ANTD_LOCALES[locale]} theme={LIGHT_THEME}>
      <BrowserRouter>
        <GenerationProvider>
          <AppErrorBoundary>
            <App />
          </AppErrorBoundary>
        </GenerationProvider>
      </BrowserRouter>
    </ConfigProvider>
  )
}
