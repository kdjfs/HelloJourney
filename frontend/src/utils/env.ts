export function isMockEnabled(): boolean {
  if (typeof import.meta.env.VITE_USE_MOCK === 'string') {
    return import.meta.env.VITE_USE_MOCK === 'true'
  }
  if (import.meta.env.DEV) {
    return true
  }
  return false
}

export function getAppMode(): 'mock' | 'backend' {
  return isMockEnabled() ? 'mock' : 'backend'
}

export function getAmapWebJsKey(): string {
  return typeof import.meta.env.VITE_AMAP_WEB_JS_KEY === 'string'
    ? import.meta.env.VITE_AMAP_WEB_JS_KEY.trim()
    : ''
}

export function getAmapSecurityJsCode(): string {
  return typeof import.meta.env.VITE_AMAP_SECURITY_JS_CODE === 'string'
    ? import.meta.env.VITE_AMAP_SECURITY_JS_CODE.trim()
    : ''
}
