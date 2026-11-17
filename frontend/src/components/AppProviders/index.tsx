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
import { useAppTheme } from '../../theme/model/theme'

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

/** 暗色主题：算法 + 与 index.css 暗色令牌一致的颜色 */
const DARK_THEME: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    ...LIGHT_THEME.token,
    colorPrimary: '#4fb3a0',
    colorInfo: '#5a9fc0',
    colorSuccess: '#56b98a',
    colorWarning: '#d9a13f',
    colorError: '#e0715c',
    colorTextBase: '#e9eff3',
    colorBgBase: '#11171a',
    colorBgLayout: '#11171a',
    colorBgContainer: '#192227',
    colorBgElevated: '#1f2a30',
    colorBorder: '#2c383f',
    colorBorderSecondary: '#232e34',
    colorTextSecondary: '#bcc7ce',
    colorTextTertiary: '#8d9aa1',
    colorTextQuaternary: '#6d7a81',
    boxShadow: '0 12px 32px -16px rgba(0, 0, 0, 0.7), 0 2px 8px rgba(0, 0, 0, 0.35)',
    boxShadowSecondary: '0 18px 40px -20px rgba(0, 0, 0, 0.8)',
  },
  components: {
    ...LIGHT_THEME.components,
    Segmented: { itemSelectedBg: '#26333a' },
    Select: { optionSelectedBg: '#1c3a35' },
    Tabs: { itemSelectedColor: '#4fb3a0', inkBarColor: '#4fb3a0' },
    FloatButton: { colorPrimary: '#4fb3a0' },
  },
}

export default function AppProviders() {
  const { i18n } = useTranslation()
  const [appTheme] = useAppTheme()
  // 子路径部署（VITE_BASE_PATH=/hellojourney/）时路由也要带上同一前缀，
  // BASE_URL 由 Vite 注入，根路径部署时为 '/'，basename 传 undefined 保持原行为。
  const routerBase = import.meta.env.BASE_URL.replace(/\/+$/, '')
  const locale = normalizeAppLocale(i18n.resolvedLanguage || i18n.language)

  useEffect(() => {
    dayjs.locale(DAYJS_LOCALES[locale])
    document.documentElement.lang = HTML_LANGS[locale]
  }, [locale])

  return (
    <ConfigProvider locale={ANTD_LOCALES[locale]} theme={appTheme === 'dark' ? DARK_THEME : LIGHT_THEME}>
      <BrowserRouter basename={routerBase || undefined}>
        <GenerationProvider>
          <AppErrorBoundary>
            <App />
          </AppErrorBoundary>
        </GenerationProvider>
      </BrowserRouter>
    </ConfigProvider>
  )
}
