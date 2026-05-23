export function isMockEnabled(): boolean {
  if (typeof import.meta.env.VITE_USE_MOCK === 'string') {
    return import.meta.env.VITE_USE_MOCK === 'true'
  }
  if (import.meta.env.DEV) {
    return true
  }
  return false
}

export function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
}

export function getAppMode(): 'mock' | 'backend' {
  return isMockEnabled() ? 'mock' : 'backend'
}