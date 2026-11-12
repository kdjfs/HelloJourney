import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyAmapSecurityConfig } from './env'

afterEach(() => {
  vi.unstubAllEnvs()
  delete window._AMapSecurityConfig
})

describe('applyAmapSecurityConfig', () => {
  it('publishes the configured security code for AMap to pick up', () => {
    vi.stubEnv('VITE_AMAP_SECURITY_JS_CODE', '  configured-code  ')

    applyAmapSecurityConfig()

    expect(window._AMapSecurityConfig).toEqual({ securityJsCode: 'configured-code' })
  })

  it('leaves the global untouched when no security code is configured', () => {
    vi.stubEnv('VITE_AMAP_SECURITY_JS_CODE', '')

    applyAmapSecurityConfig()

    expect(window._AMapSecurityConfig).toBeUndefined()
  })

  it('is idempotent so a re-render cannot drop the value', () => {
    vi.stubEnv('VITE_AMAP_SECURITY_JS_CODE', 'configured-code')

    applyAmapSecurityConfig()
    applyAmapSecurityConfig()

    expect(window._AMapSecurityConfig).toEqual({ securityJsCode: 'configured-code' })
  })
})
