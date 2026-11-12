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

/**
 * Google Maps 浏览器端 Key。
 *
 * 它和服务端的 `GOOGLE_MAPS_API_KEY` 是两把**不同**的钥匙：Google 要求
 * JavaScript SDK 用「HTTP 来源（referrer）限制」的 Key，而服务端 Places /
 * Geocoding / Directions 调用用「IP 限制」的 Key。这把钥匙最终会被打进前端
 * 产物、任何人都能看到，所以务必在 Google Cloud Console 里把它限制到自己的
 * 域名，并且只勾选地图真正需要的 API。
 *
 * 同理，它只在构建时内联：改完要重启 dev server 或重新构建镜像。
 */
export function getGoogleMapsJsKey(): string {
  return typeof import.meta.env.VITE_GOOGLE_MAPS_JS_KEY === 'string'
    ? import.meta.env.VITE_GOOGLE_MAPS_JS_KEY.trim()
    : ''
}

/**
 * Google 地图的 Map ID（可选）。
 *
 * 新版高级标记 `AdvancedMarkerElement` 建图时必须带一个 Map ID；配了就能在
 * Cloud Console 里做自定义配色，不配则回落到 Google 公开的占位值
 * `DEMO_MAP_ID`（不支持云端配色，但功能和标记都正常）。
 */
export function getGoogleMapsMapId(): string {
  const configured = typeof import.meta.env.VITE_GOOGLE_MAPS_MAP_ID === 'string'
    ? import.meta.env.VITE_GOOGLE_MAPS_MAP_ID.trim()
    : ''
  return configured || 'DEMO_MAP_ID'
}

declare global {
  interface Window {
    _AMapSecurityConfig?: { securityJsCode?: string }
  }
}

/**
 * Publishes the AMap security code where the SDK expects to find it.
 *
 * AMap appends this value to every tile, style, and service request as a `jscode`
 * query parameter and rejects requests that arrive without it, which renders an
 * empty canvas instead of throwing. The SDK reads `window._AMapSecurityConfig`
 * while its bundle executes, and `@amap/amap-jsapi-loader` drops unknown options,
 * so passing `securityJsCode` to `load()` has no effect — the global has to be set
 * before `load()` injects the SDK script.
 *
 * It is set from the bundle rather than an inline <script> in index.html because
 * the deployment CSP in frontend/nginx.conf allows only `script-src 'self'`, which
 * blocks inline scripts. The value still comes from build-time VITE_ variables, so
 * no secret is ever committed to source.
 */
export function applyAmapSecurityConfig(): void {
  const securityJsCode = getAmapSecurityJsCode()
  if (!securityJsCode) return
  window._AMapSecurityConfig = { ...window._AMapSecurityConfig, securityJsCode }
}
