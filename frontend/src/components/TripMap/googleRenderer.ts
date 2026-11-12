import { getGoogleMapsJsKey, getGoogleMapsMapId } from '@/utils/env'
import { buildRouteSegments } from './mapGeometry'
import type { RouteMode, RoutePoint } from './mapGeometry'
import { buildInfoWindowElement, buildMarkerElement } from './mapDom'
import { isMapRendererError, MapRendererError } from './mapRenderer'
import type { MapRenderer, MapRendererContext } from './mapRenderer'

/* ==========================================================================
   只声明真正用到的那几个 Google Maps 类型。
   刻意不引入 @types/google.maps：那套类型体积很大，而这里只需要十几个成员，
   手写一份反而让「我们到底用了哪些 API」一目了然，也避免了给每个调用点加断言。
   ========================================================================== */

export interface GoogleLatLngLiteral {
  lat: number
  lng: number
}

interface GoogleLatLngBounds {
  extend(point: GoogleLatLngLiteral): void
}

interface GoogleMap {
  setZoom(zoom: number): void
  setCenter(center: GoogleLatLngLiteral): void
  getZoom(): number | undefined
  fitBounds(bounds: GoogleLatLngBounds, padding?: Record<string, number>): void
}

interface GoogleMarker {
  /** 置为 null 即从地图上移除（高级标记就是这么摘的） */
  map: GoogleMap | null
}

interface GoogleInfoWindow {
  open(options: { map: GoogleMap; anchor: GoogleMarker }): void
  close(): void
}

interface GooglePolyline {
  setMap(map: GoogleMap | null): void
}

interface GoogleEventListener {
  remove(): void
}

interface GoogleDirectionsService {
  route(
    request: Record<string, unknown>,
    callback: (result: unknown, status: string) => void,
  ): void
}

export interface GoogleMapsNamespace {
  Map: new (container: HTMLElement, options: Record<string, unknown>) => GoogleMap
  InfoWindow: new (options: Record<string, unknown>) => GoogleInfoWindow
  Polyline: new (options: Record<string, unknown>) => GooglePolyline
  LatLngBounds: new () => GoogleLatLngBounds
  DirectionsService: new () => GoogleDirectionsService
  marker: { AdvancedMarkerElement: new (options: Record<string, unknown>) => GoogleMarker }
  event: { addListener(instance: unknown, eventName: string, handler: () => void): GoogleEventListener }
  TravelMode: { DRIVING: string; WALKING: string }
}

const SCRIPT_ID = 'hellojourney-google-maps-sdk'
const SCRIPT_BASE = 'https://maps.googleapis.com/maps/api/js'
const LOAD_TIMEOUT_MS = 15_000
const ROUTE_TIMEOUT_MS = 6000
const MAX_FIT_ZOOM = 16

/**
 * 拼出 SDK 的 script 地址。
 *
 * 只需要 `marker` 这一个库：高级标记 `AdvancedMarkerElement` 在它里面，
 * 而 `Map`、`InfoWindow`、`Polyline`、`DirectionsService` 都在核心包里，
 * 不用额外声明。不传 `language`，让 Google 跟随浏览器语言，避免切了界面语言
 * 之后底图标注还是旧语言（SDK 一旦加载就不会再换语言）。
 */
export function buildGoogleMapsScriptUrl(key: string): string {
  const params = new URLSearchParams({ key, v: 'weekly', libraries: 'marker' })
  return `${SCRIPT_BASE}?${params.toString()}`
}

/** 统一用 `[经度, 纬度]`，Google 要的是 `{lat, lng}`，在这里转换。 */
export function toLatLng(point: RoutePoint): GoogleLatLngLiteral {
  return { lat: point[1], lng: point[0] }
}

/**
 * 三种路线的样式，颜色/CSS 图例一一对应。
 *
 * 虚线在 Google 里不是 `strokeStyle: 'dashed'`，而是「把实线设成全透明，
 * 再用一段重复的图标画刻度」，所以这里多一个 icons 数组。
 */
export function googlePolylineOptions(mode: RouteMode): Record<string, unknown> {
  switch (mode) {
    case 'driving':
      return { strokeColor: '#2f7fd0', strokeOpacity: 0.95, strokeWeight: 5, zIndex: 90 }
    case 'walking':
      return dashedOptions('#1f8a5f', 4, '14px')
    case 'straight':
    default:
      return dashedOptions('#c9752a', 3, '10px')
  }
}

function dashedOptions(color: string, weight: number, repeat: string): Record<string, unknown> {
  return {
    strokeColor: color,
    strokeOpacity: 0,
    strokeWeight: weight,
    zIndex: 90,
    icons: [{
      icon: { path: 'M 0,-1 0,1', strokeColor: color, strokeOpacity: 1, scale: weight / 2 + 1 },
      offset: '0',
      repeat,
    }],
  }
}

function promiseGlobalNamespace(): GoogleMapsNamespace | undefined {
  return (window as unknown as { google?: { maps?: GoogleMapsNamespace } }).google?.maps
}

let loaderPromise: Promise<GoogleMapsNamespace> | null = null

/**
 * 按需注入 SDK，并且只注入一次。
 *
 * 失败后要把缓存的 Promise 清掉，否则一次网络抖动会让这个页面直到刷新前
 * 都再也加载不出地图。重复调用共享同一个 Promise，避免出现两条 script。
 */
export function loadGoogleMaps(key: string): Promise<GoogleMapsNamespace> {
  const alreadyLoaded = promiseGlobalNamespace()
  if (alreadyLoaded) return Promise.resolve(alreadyLoaded)
  if (loaderPromise) return loaderPromise

  const pending = injectGoogleMapsScript(key).then(() => {
    const namespace = promiseGlobalNamespace()
    if (!namespace) throw new Error('Google Maps SDK loaded without exposing google.maps')
    return namespace
  })

  loaderPromise = pending.catch((error: unknown) => {
    loaderPromise = null
    throw error
  })
  return loaderPromise
}

function injectGoogleMapsScript(key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    document.getElementById(SCRIPT_ID)?.remove()

    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = buildGoogleMapsScriptUrl(key)
    script.async = true
    script.defer = true

    const timer = window.setTimeout(() => {
      script.onload = null
      script.onerror = null
      script.remove()
      reject(new Error('Google Maps SDK load timed out'))
    }, LOAD_TIMEOUT_MS)

    script.onload = () => {
      window.clearTimeout(timer)
      resolve()
    }
    script.onerror = () => {
      window.clearTimeout(timer)
      script.remove()
      reject(new Error('Google Maps SDK failed to load'))
    }

    document.head.appendChild(script)
  })
}

function pointFromLatLng(raw: unknown): RoutePoint | null {
  if (typeof raw !== 'object' || raw === null) return null
  const record = raw as Record<string, unknown>
  const lat = typeof record.lat === 'function' ? Number((record.lat as () => number)()) : Number(record.lat)
  const lng = typeof record.lng === 'function' ? Number((record.lng as () => number)()) : Number(record.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return [lng, lat]
}

function extractPath(result: unknown): RoutePoint[] {
  const routes = (result as { routes?: unknown })?.routes
  if (!Array.isArray(routes) || routes.length === 0) return []
  const overview = (routes[0] as { overview_path?: unknown })?.overview_path
  if (!Array.isArray(overview)) return []
  return overview
    .map(pointFromLatLng)
    .filter((point): point is RoutePoint => point !== null)
}

async function searchDirections(
  maps: GoogleMapsNamespace,
  service: GoogleDirectionsService,
  mode: 'driving' | 'walking',
  segment: { start: RoutePoint; end: RoutePoint },
): Promise<RoutePoint[] | null> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (path: RoutePoint[] | null) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      resolve(path)
    }
    const timeout = window.setTimeout(() => finish(null), ROUTE_TIMEOUT_MS)

    try {
      service.route(
        {
          origin: toLatLng(segment.start),
          destination: toLatLng(segment.end),
          travelMode: mode === 'driving' ? maps.TravelMode.DRIVING : maps.TravelMode.WALKING,
        },
        (result, status) => {
          if (status !== 'OK') {
            finish(null)
            return
          }
          const path = extractPath(result)
          finish(path.length > 1 ? path : null)
        },
      )
    } catch {
      finish(null)
    }
  })
}

interface MarkerBinding {
  marker: GoogleMarker
  infoWindow: GoogleInfoWindow
  element: HTMLButtonElement
  point: RoutePoint
  keyHandler: (event: KeyboardEvent) => void
}

/**
 * Google Maps 底图渲染器，和 amapRenderer 实现同一个 MapRenderer 接口。
 */
export async function createGoogleRenderer(ctx: MapRendererContext): Promise<MapRenderer> {
  const key = getGoogleMapsJsKey()
  const mapId = getGoogleMapsMapId()
  const markerBindings = new Map<string, MarkerBinding>()
  const polylines: GooglePolyline[] = []
  let maps: GoogleMapsNamespace | null = null
  let map: GoogleMap | null = null

  const clearSelection = () => {
    markerBindings.forEach(({ element }) => element.classList.remove('is-active'))
  }

  const teardown = () => {
    markerBindings.forEach(({ marker, infoWindow, element, keyHandler }) => {
      infoWindow.close()
      marker.map = null
      element.removeEventListener('keydown', keyHandler)
    })
    markerBindings.clear()
    polylines.forEach((polyline) => polyline.setMap(null))
    polylines.length = 0
    map = null
  }

  try {
    const namespace = await loadGoogleMaps(key)
    if (ctx.isCancelled()) throw new MapRendererError('cancelled')
    maps = namespace

    const created = new namespace.Map(ctx.container, {
      zoom: 12,
      center: toLatLng(ctx.stops[0].point),
      // 高级标记必须有 Map ID；没配就用 Google 官方的占位值
      mapId,
      clickableIcons: false,
      gestureHandling: 'greedy',
    })
    map = created

    ctx.stops.forEach((stop) => {
      const label = `${stop.dayIndex + 1}-${stop.attractionIndex + 1}`
      const element = buildMarkerElement(label, ctx.translate('tripMap.markerAria', { label, name: stop.attraction.name }))
      const marker = new namespace.marker.AdvancedMarkerElement({
        map: created,
        position: toLatLng(stop.point),
        content: element,
        title: stop.attraction.name,
      })
      const infoWindow = new namespace.InfoWindow({
        content: buildInfoWindowElement(
          stop.attraction.name,
          ctx.translate('tripMap.sequence', { day: stop.dayIndex + 1, index: stop.attractionIndex + 1 }),
          stop.attraction.address || ctx.translate('common.addressPending'),
          ctx.translate('tripMap.duration', {
            duration: Number.isFinite(stop.attraction.visit_duration) ? stop.attraction.visit_duration : '—',
          }),
        ),
      })
      const open = () => infoWindow.open({ map: created, anchor: marker })
      const close = () => infoWindow.close()
      const keyHandler = (event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          open()
        }
      }
      // 高级标记的「图标」就是我们自己的 DOM 节点，事件直接挂在它身上
      element.addEventListener('mouseover', open)
      element.addEventListener('mouseout', close)
      element.addEventListener('click', open)
      element.addEventListener('keydown', keyHandler)
      markerBindings.set(stop.key, { marker, infoWindow, element, point: stop.point, keyHandler })
    })

  } catch (error) {
    teardown()
    if (isMapRendererError(error)) throw error
    throw new MapRendererError('load-error', error instanceof Error ? error.message : undefined)
  }

  const fitTo = (extraPoints: RoutePoint[]) => {
    if (!map || !maps || ctx.stops.length === 0) return
    const bounds = new maps.LatLngBounds()
    ctx.stops.forEach((stop) => bounds.extend(toLatLng(stop.point)))
    extraPoints.forEach((point) => bounds.extend(toLatLng(point)))
    map.fitBounds(bounds, { top: 40, right: 56, bottom: 40, left: 56 })
    // 单点时 fitBounds 会顶到最大层级，像 AMap 的 maxZoom 一样收一下
    const listener = maps.event.addListener(map, 'idle', () => {
      if (map && (map.getZoom() ?? 0) > MAX_FIT_ZOOM) map.setZoom(MAX_FIT_ZOOM)
      listener.remove()
    })
  }

  fitTo([])

  const drawRoutes = async () => {
    const active = map
    const activeMaps = maps
    if (!active || !activeMaps) return
    try {
      const service = new activeMaps.DirectionsService()
      const routePoints: RoutePoint[] = []
      for (const segment of buildRouteSegments(ctx.plan, ctx.stops)) {
        const drivingPath = await searchDirections(activeMaps, service, 'driving', segment)
        const walkingPath = drivingPath ? null : await searchDirections(activeMaps, service, 'walking', segment)
        // 卸载/切底图已经发生：不要再往已经销毁的地图里塞折线
        if (ctx.isCancelled() || map !== active) return

        const mode: RouteMode = drivingPath ? 'driving' : walkingPath ? 'walking' : 'straight'
        const path = drivingPath ?? walkingPath ?? [segment.start, segment.end]
        const polyline = new activeMaps.Polyline({
          path: path.map(toLatLng),
          ...googlePolylineOptions(mode),
        })
        polyline.setMap(active)
        polylines.push(polyline)
        routePoints.push(...path)
      }
      if (ctx.isCancelled() || map !== active) return
      fitTo(routePoints)
    } catch {
      // 路线失败只影响折线，底图和标记照常可用
    }
  }

  return {
    drawRoutes,
    selectStop(stopKey: string) {
      clearSelection()
      const binding = markerBindings.get(stopKey)
      if (!binding || !map) return
      binding.element.classList.add('is-active')
      map.setZoom(MAX_FIT_ZOOM)
      map.setCenter(toLatLng(binding.point))
      binding.infoWindow.open({ map, anchor: binding.marker })
    },
    clearSelection,
    destroy: teardown,
  }
}
