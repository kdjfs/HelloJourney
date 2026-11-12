import { load as loadAMap } from '@amap/amap-jsapi-loader'
import { applyAmapSecurityConfig, getAmapSecurityJsCode, getAmapWebJsKey } from '@/utils/env'
import {
  createRoutePolyline,
  hasUsableSecurityCode,
  type AMapInfoWindow,
  type AMapMap,
  type AMapMarker,
  type AMapNamespace,
  type AMapOverlay,
} from './amapAdapter'
import { buildRouteSegments } from './mapGeometry'
import type { RoutePoint } from './mapGeometry'
import { buildInfoWindowElement, buildMarkerElement } from './mapDom'
import { isMapRendererError, MapRendererError } from './mapRenderer'
import type { MapRenderer, MapRendererContext } from './mapRenderer'

const AMAP_PLUGINS = [
  'AMap.Marker',
  'AMap.Polyline',
  'AMap.InfoWindow',
  'AMap.Driving',
  'AMap.Walking',
]

/** 浅色底图，与全站纸感主题一致；自定义样式同样需要安全密钥生效 */
const MAP_STYLE = 'amap://styles/whitesmoke'

interface MarkerBinding {
  marker: AMapMarker
  infoWindow: AMapInfoWindow
  element: HTMLButtonElement
  point: RoutePoint
  handlers: Record<'mouseover' | 'mouseout' | 'click', () => void>
  keyHandler: (event: KeyboardEvent) => void
}

/**
 * AMap 底图渲染器。
 *
 * 从组件里拆出来的原因有两个：一是 TripMap 现在要按用户偏好切换两家地图，
 * 渲染细节留在组件里会让组件变成两种 SDK 的混合体；二是 SDK 的生命周期
 * （建图 → 画标记 → 画路线 → 销毁）本来就是一个独立的单元，和 React 渲染
 * 无关，单独放一个文件反而更容易读。
 */
export async function createAmapRenderer(ctx: MapRendererContext): Promise<MapRenderer> {
  const webKey = getAmapWebJsKey()
  const securityJsCode = getAmapSecurityJsCode()
  const markerBindings = new Map<string, MarkerBinding>()
  const mapOverlays: AMapOverlay[] = []
  let namespace: AMapNamespace | null = null
  let map: AMapMap | null = null

  const clearSelection = () => {
    markerBindings.forEach(({ element }) => element.classList.remove('is-active'))
  }

  const teardown = () => {
    markerBindings.forEach(({ marker, infoWindow, element, handlers, keyHandler }) => {
      marker.off('mouseover', handlers.mouseover)
      marker.off('mouseout', handlers.mouseout)
      marker.off('click', handlers.click)
      element.removeEventListener('keydown', keyHandler)
      infoWindow.close()
    })
    markerBindings.clear()
    map?.destroy()
    map = null
  }

  try {
    // Must run before load(): the SDK reads the global as its bundle executes,
    // and the loader would silently drop a securityJsCode option.
    applyAmapSecurityConfig()
    const AMap = await loadAMap({
      key: webKey,
      version: '2.0',
      plugins: AMAP_PLUGINS,
    }) as AMapNamespace
    namespace = AMap
    if (ctx.isCancelled()) throw new MapRendererError('cancelled')
    if (!hasUsableSecurityCode(AMap, securityJsCode, MAP_STYLE)) {
      throw new MapRendererError('security-code-missing')
    }

    const created = new AMap.Map(ctx.container, {
      zoom: 12,
      center: ctx.stops[0].point,
      viewMode: '3D',
      mapStyle: MAP_STYLE,
      WebGLParams: { preserveDrawingBuffer: true },
    })
    map = created

    ctx.stops.forEach((stop, index) => {
      const label = `${stop.dayIndex + 1}-${stop.attractionIndex + 1}`
      const element = buildMarkerElement(label, ctx.translate('tripMap.markerAria', { label, name: stop.attraction.name }))
      const marker = new AMap.Marker({
        position: stop.point,
        content: element,
        anchor: 'bottom-center',
        zIndex: 120 + index,
      })
      const infoWindow = new AMap.InfoWindow({
        isCustom: true,
        content: buildInfoWindowElement(
          stop.attraction.name,
          ctx.translate('tripMap.sequence', { day: stop.dayIndex + 1, index: stop.attractionIndex + 1 }),
          stop.attraction.address || ctx.translate('common.addressPending'),
          ctx.translate('tripMap.duration', {
            duration: Number.isFinite(stop.attraction.visit_duration) ? stop.attraction.visit_duration : '—',
          }),
        ),
        offset: new AMap.Pixel(0, -44),
        closeWhenClickMap: true,
      })
      const open = () => infoWindow.open(created, marker.getPosition())
      const close = () => infoWindow.close()
      const keyHandler = (event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          open()
        }
      }
      const handlers = { mouseover: open, mouseout: close, click: open }
      marker.on('mouseover', handlers.mouseover)
      marker.on('mouseout', handlers.mouseout)
      marker.on('click', handlers.click)
      element.addEventListener('keydown', keyHandler)
      markerBindings.set(stop.key, { marker, infoWindow, element, point: stop.point, handlers, keyHandler })
      mapOverlays.push(marker)
    })

    created.add(mapOverlays)
    created.setFitView(mapOverlays, false, [56, 40, 56, 40], 16)
  } catch (error) {
    teardown()
    if (isMapRendererError(error)) throw error
    throw new MapRendererError('load-error', error instanceof Error ? error.message : undefined)
  }

  const drawingOverlays = mapOverlays
  const drawRoutes = async () => {
    const active = map
    const amap = namespace
    if (!active || !amap) return
    for (const segment of buildRouteSegments(ctx.plan, ctx.stops)) {
      try {
        const polyline = await createRoutePolyline(amap, segment)
        // 卸载/切底图已经发生：不要再往已经销毁的地图里塞折线
        if (ctx.isCancelled() || map !== active) return
        active.add(polyline)
        drawingOverlays.push(polyline)
      } catch {
        // 单段路线失败只丢这一段，其余照常；地图本身仍然可用
      }
    }
    if (ctx.isCancelled() || map !== active) return
    active.setFitView(drawingOverlays, false, [56, 40, 56, 40], 16)
  }

  return {
    drawRoutes,
    selectStop(stopKey: string) {
      clearSelection()
      const binding = markerBindings.get(stopKey)
      if (!binding || !map) return
      binding.element.classList.add('is-active')
      map.setZoomAndCenter(16, binding.point)
      binding.infoWindow.open(map, binding.marker.getPosition())
    },
    clearSelection,
    resize() {
      map?.resize?.()
    },
    destroy: teardown,
  }
}
