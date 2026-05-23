import axios from 'axios'

const ENV_API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
const RUNTIME_API_BASE_STORAGE_KEY = 'lingjing.runtime.api_base_url'
const OLD_RUNTIME_API_BASE_STORAGE_KEY = 'tripstar.runtime.api_base_url'

const normalizeBaseUrl = (value?: string | null) => String(value ?? '').trim().replace(/\/+$/, '')

const migrateOldKey = () => {
  try {
    const old = localStorage.getItem(OLD_RUNTIME_API_BASE_STORAGE_KEY)
    if (old) {
      localStorage.setItem(RUNTIME_API_BASE_STORAGE_KEY, old)
      localStorage.removeItem(OLD_RUNTIME_API_BASE_STORAGE_KEY)
      return old
    }
  } catch { /* 静默处理 localStorage 不可用 */ }
  return null
}

export const getRuntimeApiBaseUrl = () => {
  const saved = normalizeBaseUrl(localStorage.getItem(RUNTIME_API_BASE_STORAGE_KEY))
  const migrated = normalizeBaseUrl(migrateOldKey())
  const env = normalizeBaseUrl(ENV_API_BASE_URL)
  return saved || migrated || env || window.location.origin || 'http://localhost:8000'
}

export const setRuntimeApiBaseUrl = (value: string) => {
  const normalized = normalizeBaseUrl(value)
  localStorage.setItem(RUNTIME_API_BASE_STORAGE_KEY, normalized)
  return normalized
}

export const apiClient = axios.create({
  timeout: 0,
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use((config) => {
  config.baseURL = getRuntimeApiBaseUrl()
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
      console.error(
        `[API] 网络请求失败 (${error.config?.url || 'unknown'})。`,
        '请检查 VITE_USE_MOCK 是否开启，或真实后端 http://localhost:8000 是否已启动。',
        error,
      )
    }
    return Promise.reject(error)
  },
)
