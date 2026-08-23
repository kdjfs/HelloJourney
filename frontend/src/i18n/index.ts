import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import zh from './locales/zh.json'
import en from './locales/en.json'
import ja from './locales/ja.json'

export const LOCALE_STORAGE_KEY = 'hj.locale'
export const SUPPORTED_LOCALES = ['zh', 'en', 'ja'] as const
export type AppLocale = typeof SUPPORTED_LOCALES[number]

export function normalizeAppLocale(value?: string | null): AppLocale {
  const language = (value || '').toLowerCase().split('-')[0]
  return SUPPORTED_LOCALES.includes(language as AppLocale) ? language as AppLocale : 'zh'
}

export function readStoredLocale(): AppLocale {
  try {
    return normalizeAppLocale(localStorage.getItem(LOCALE_STORAGE_KEY))
  } catch {
    return 'zh'
  }
}

void i18n
  .use(initReactI18next)
  .init({
    resources: {
      zh: { translation: zh },
      en: { translation: en },
      ja: { translation: ja },
    },
    lng: readStoredLocale(),
    fallbackLng: 'zh',
    supportedLngs: [...SUPPORTED_LOCALES],
    load: 'languageOnly',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  })

i18n.on('languageChanged', (language) => {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, normalizeAppLocale(language))
  } catch {
    // Locale switching remains available when storage is blocked.
  }
})

export default i18n
