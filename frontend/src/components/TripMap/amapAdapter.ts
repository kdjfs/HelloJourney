import { samePoint, toRoutePoint } from './mapGeometry'
import type { RouteMode, RoutePoint, RouteSegment } from './mapGeometry'

/**
 * 本文件只保留 AMap 专有的部分：命名空间类型、路线服务调用、折线样式。
 * 与 SDK 无关的几何计算搬到了 ./mapGeometry，由 AMap 和 Google 两个渲染器共用。
 *
 * 下面几行是历史入口的转发：已有调用方和测试仍然可以从 './amapAdapter'
 * 取到这些类型与函数，不必改 import 路径。
 */
export { buildRouteSegments, collectAttractionStops, toRoutePoint } from './mapGeometry'
export type { MapAttractionStop, RouteMode, RoutePoint, RouteSegment } from './mapGeometry'

export interface AMapMap {
  add(overlays: AMapOverlay | AMapOverlay[]): void
  destroy(): void
  setFitView(overlays?: AMapOverlay[], immediately?: boolean, avoid?: number[], maxZoom?: number): void
  setZoomAndCenter(zoom: number, center: RoutePoint): void
  /** 容器尺寸变化（例如全屏切换）后需要通知地图重算画布大小 */
  resize?(): void
}

export interface AMapMarker {
  getPosition(): unknown
  on(eventName: string, handler: () => void): void
  off(eventName: string, handler: () => void): void
}

export interface AMapInfoWindow {
  open(map: AMapMap, position: unknown): void
  close(): void
}

export interface AMapPolyline {
  readonly __amapPolylineBrand?: 'AMapPolyline'
}
export type AMapOverlay = AMapMarker | AMapPolyline

interface RouteService {
  search(
    start: RoutePoint,
    end: RoutePoint,
    callback: (status: string, result: unknown) => void,
  ): void
}

interface RouteServiceConstructor {
  new (options?: Record<string, unknown>): RouteService
}

export interface AMapNamespace {
  Map: new (container: HTMLElement, options: Record<string, unknown>) => AMapMap
  Marker: new (options: Record<string, unknown>) => AMapMarker
  InfoWindow: new (options: Record<string, unknown>) => AMapInfoWindow
  Polyline: new (options: Record<string, unknown>) => AMapPolyline
  Driving?: RouteServiceConstructor
  Walking?: RouteServiceConstructor
  Pixel: new (x: number, y: number) => unknown
  DrivingPolicy?: { LEAST_TIME?: number }
  /** Runtime config exposed by JSAPI 2.0; carries the resolved `jscode`. */
  getConfig?: () => { jscode?: string }
}

const ROUTE_STYLES: Record<RouteMode, Record<string, unknown>> = {
  driving: {
    strokeColor: '#2f7fd0',
    strokeWeight: 5,
    strokeOpacity: 0.95,
    strokeStyle: 'solid',
    lineJoin: 'round',
    lineCap: 'round',
    outlineColor: 'rgba(255, 255, 255, 0.92)',
    borderWeight: 1.5,
  },
  walking: {
    strokeColor: '#1f8a5f',
    strokeWeight: 4,
    strokeOpacity: 0.95,
    strokeStyle: 'dashed',
    strokeDasharray: [12, 8],
    lineJoin: 'round',
    lineCap: 'round',
    outlineColor: 'rgba(255, 255, 255, 0.85)',
    borderWeight: 1.5,
  },
  straight: {
    strokeColor: '#c9752a',
    strokeWeight: 3,
    strokeOpacity: 0.92,
    strokeStyle: 'dashed',
    strokeDasharray: [8, 8],
    lineJoin: 'round',
    lineCap: 'round',
    outlineColor: 'rgba(255, 255, 255, 0.8)',
    borderWeight: 1.5,
  },
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null
}

function pointFromUnknown(raw: unknown): RoutePoint | null {
  if (Array.isArray(raw) && raw.length >= 2) {
    return toRoutePoint({ longitude: Number(raw[0]), latitude: Number(raw[1]) })
  }
  const record = asRecord(raw)
  if (!record) return null
  if (typeof record.getLng === 'function' && typeof record.getLat === 'function') {
    return toRoutePoint({
      longitude: Number(record.getLng()),
      latitude: Number(record.getLat()),
    })
  }
  return toRoutePoint({
    longitude: Number(record.lng ?? record.longitude),
    latitude: Number(record.lat ?? record.latitude),
  })
}

function parsePolyline(polyline: string): RoutePoint[] {
  return polyline
    .split(';')
    .map((pair) => pointFromUnknown(pair.split(',')))
    .filter((point): point is RoutePoint => point !== null)
}

function extractRoutePath(result: unknown): RoutePoint[] {
  const resultRecord = asRecord(result)
  const routes = resultRecord?.routes
  if (!Array.isArray(routes) || routes.length === 0) return []
  const route = asRecord(routes[0])
  if (!route) return []

  const points: RoutePoint[] = []
  if (Array.isArray(route.steps)) {
    for (const rawStep of route.steps) {
      const step = asRecord(rawStep)
      if (Array.isArray(step?.path)) {
        for (const rawPoint of step.path) {
          const point = pointFromUnknown(rawPoint)
          if (point) points.push(point)
        }
      } else if (typeof step?.polyline === 'string') {
        points.push(...parsePolyline(step.polyline))
      }
    }
  }
  if (points.length < 2 && typeof route.polyline === 'string') {
    points.push(...parsePolyline(route.polyline))
  }

  return points.filter((point, index) => index === 0 || !samePoint(point, points[index - 1]))
}

async function searchRoute(
  AMap: AMapNamespace,
  mode: Exclude<RouteMode, 'straight'>,
  segment: RouteSegment,
): Promise<RoutePoint[] | null> {
  const Service = mode === 'driving' ? AMap.Driving : AMap.Walking
  if (!Service) return null

  return new Promise((resolve) => {
    let settled = false
    const finish = (path: RoutePoint[] | null) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      resolve(path)
    }
    const timeout = window.setTimeout(() => finish(null), 6000)

    try {
      const service = mode === 'driving'
        ? new Service({ policy: AMap.DrivingPolicy?.LEAST_TIME ?? 0 })
        : new Service()
      service.search(segment.start, segment.end, (status, result) => {
        if (status !== 'complete') {
          finish(null)
          return
        }
        const path = extractRoutePath(result)
        finish(path.length > 1 ? path : null)
      })
    } catch {
      finish(null)
    }
  })
}

export async function createRoutePolyline(
  AMap: AMapNamespace,
  segment: RouteSegment,
): Promise<AMapPolyline> {
  const drivingPath = await searchRoute(AMap, 'driving', segment)
  if (drivingPath) {
    return new AMap.Polyline({ path: drivingPath, ...ROUTE_STYLES.driving, showDir: true, zIndex: 90 })
  }

  const walkingPath = await searchRoute(AMap, 'walking', segment)
  if (walkingPath) {
    return new AMap.Polyline({ path: walkingPath, ...ROUTE_STYLES.walking, showDir: true, zIndex: 90 })
  }

  return new AMap.Polyline({ path: [segment.start, segment.end], ...ROUTE_STYLES.straight, showDir: true, zIndex: 90 })
}

/**
 * `@amap/amap-jsapi-loader` only forwards key/version/plugins to the JSAPI script
 * URL, so the security code has to reach the SDK through
 * `window._AMapSecurityConfig` before the bundle executes. AMap appends the
 * resolved value to tile and service requests as `jscode`, and rejects requests
 * without it — which paints an empty canvas instead of throwing. Detecting the
 * mismatch keeps that failure explainable instead of silent.
 *
 * Returns true when the SDK exposes no runtime config, so a build that does not
 * surface `getConfig` never blocks a map that would otherwise render.
 */
export function hasUsableSecurityCode(
  AMap: AMapNamespace,
  configuredSecurityJsCode: string,
  mapStyle: string,
): boolean {
  const runtimeConfig = AMap.getConfig?.()
  if (!runtimeConfig) return true
  if (runtimeConfig.jscode?.trim()) return true
  // Without a usable code the custom style cannot be fetched either, so both a
  // configured code and a custom style require the injection to have landed.
  return !configuredSecurityJsCode && !mapStyle.startsWith('amap://styles/')
}
