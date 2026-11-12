import '@testing-library/jest-dom/vitest'
import { beforeEach, vi } from 'vitest'
import '../i18n'

// Vite 会把 frontend/.env.local 里的 VITE_* 读进 import.meta.env，而那个文件是
// 每个开发者自己的（被 gitignore）。如果测试依赖它，同一份代码在「配了 Google Key」
// 的机器上就会红、在没配的机器上就绿 —— 那是环境在决定测试结果，不是在测代码。
// 这里统一清零，谁需要哪个 Key 就在自己的用例里 vi.stubEnv 显式给。
beforeEach(() => {
  vi.stubEnv('VITE_AMAP_WEB_JS_KEY', '')
  vi.stubEnv('VITE_AMAP_SECURITY_JS_CODE', '')
  vi.stubEnv('VITE_GOOGLE_MAPS_JS_KEY', '')
  vi.stubEnv('VITE_GOOGLE_MAPS_MAP_ID', '')
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
})

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

window.ResizeObserver = ResizeObserverMock
