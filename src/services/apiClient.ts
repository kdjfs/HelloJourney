import axios from 'axios'

const ENV_API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
const RUNTIME_API_BASE_STORAGE_KEY = 'tripstar.runtime.api_base_url'

const normalizeBaseUrl = (value?: string | null) => String(value ?? '').trim().replace(/\/+$/, '')

export const getRuntimeApiBaseUrl = () => {
  const saved = normalizeBaseUrl(localStorage.getItem(RUNTIME_API_BASE_STORAGE_KEY))
  const env = normalizeBaseUrl(ENV_API_BASE_URL)
  return saved || env || window.location.origin || 'http://localhost:8000'
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
