import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_MAP_PROVIDER,
  isMapProviderReady,
  MAP_PROVIDER_STORAGE_KEY,
  normalizeMapProvider,
  readStoredMapProvider,
  resolveMapProvider,
  subscribeMapProvider,
  writeMapProvider,
} from './mapProvider'

afterEach(() => {
  localStorage.clear()
  vi.unstubAllEnvs()
})

describe('map provider preference', () => {
  it('falls back to the default for an unknown stored value', () => {
    localStorage.setItem(MAP_PROVIDER_STORAGE_KEY, 'baidu')

    expect(readStoredMapProvider()).toBe(DEFAULT_MAP_PROVIDER)
    expect(normalizeMapProvider('baidu')).toBe(DEFAULT_MAP_PROVIDER)
    expect(normalizeMapProvider(null)).toBe(DEFAULT_MAP_PROVIDER)
  })

  it('persists a choice for this browser and reads it back', () => {
    writeMapProvider('google')

    expect(localStorage.getItem(MAP_PROVIDER_STORAGE_KEY)).toBe('google')
    expect(readStoredMapProvider()).toBe('google')
  })

  it('notifies subscribers so an open result page rebuilds its map', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeMapProvider(listener)

    writeMapProvider('google')
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    writeMapProvider('amap')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('reports readiness from the browser key of each SDK, not the server key', () => {
    vi.stubEnv('VITE_AMAP_WEB_JS_KEY', '')
    vi.stubEnv('VITE_GOOGLE_MAPS_JS_KEY', '')
    expect(isMapProviderReady('amap')).toBe(false)
    expect(isMapProviderReady('google')).toBe(false)

    vi.stubEnv('VITE_AMAP_WEB_JS_KEY', 'amap-web-key')
    expect(isMapProviderReady('amap')).toBe(true)
    expect(isMapProviderReady('google')).toBe(false)

    vi.stubEnv('VITE_GOOGLE_MAPS_JS_KEY', 'google-js-key')
    expect(isMapProviderReady('google')).toBe(true)
  })

  it('keeps the stored choice when that provider is usable', () => {
    vi.stubEnv('VITE_AMAP_WEB_JS_KEY', 'amap-web-key')
    vi.stubEnv('VITE_GOOGLE_MAPS_JS_KEY', 'google-js-key')
    writeMapProvider('google')

    expect(resolveMapProvider()).toBe('google')
  })

  it('honours an explicit choice even when this build has no key for it', () => {
    vi.stubEnv('VITE_AMAP_WEB_JS_KEY', 'amap-web-key')
    vi.stubEnv('VITE_GOOGLE_MAPS_JS_KEY', '')
    writeMapProvider('google')

    // 偷偷换成 AMap 会让用户以为「点了没反应」；保留选择，兜底卡片才能准确
    // 说清缺的是 VITE_GOOGLE_MAPS_JS_KEY。
    expect(resolveMapProvider()).toBe('google')
  })

  it('picks the only configured basemap when nothing was chosen yet', () => {
    vi.stubEnv('VITE_AMAP_WEB_JS_KEY', '')
    vi.stubEnv('VITE_GOOGLE_MAPS_JS_KEY', 'google-js-key')

    expect(resolveMapProvider()).toBe('google')
  })

  it('falls back to the default when nothing was chosen and nothing is configured', () => {
    vi.stubEnv('VITE_AMAP_WEB_JS_KEY', '')
    vi.stubEnv('VITE_GOOGLE_MAPS_JS_KEY', '')

    expect(resolveMapProvider()).toBe(DEFAULT_MAP_PROVIDER)
  })
})
