import { useEffect, useMemo, useRef, useState } from 'react'
import { LoadingOutlined } from '@ant-design/icons'
import { load as loadAMap } from '@amap/amap-jsapi-loader'
import { useTranslation } from 'react-i18next'
import type { TripPlan } from '@/types/api'
import { getAmapWebJsKey, getAmapSecurityJsCode } from '@/utils/env'
import {
  buildRouteSegments,
  collectAttractionStops,
  createRoutePolyline,
  type AMapInfoWindow,
  type AMapMap,
  type AMapMarker,
  type AMapNamespace,
  type AMapOverlay,
} from './amapAdapter'
import TripMapFallback from './TripMapFallback'
import { buildInfoWindowElement, buildMarkerElement } from './mapDom'
import './index.css'

export interface TripMapSelection {
  dayIndex: number
  attractionIndex: number
}

interface TripMapProps {
  plan: TripPlan
  selectedAttraction?: TripMapSelection | null
}

interface MarkerBinding {
  marker: AMapMarker
  infoWindow: AMapInfoWindow
  element: HTMLButtonElement
  point: [number, number]
  handlers: Record<'mouseover' | 'mouseout' | 'click', () => void>
  keyHandler: (event: KeyboardEvent) => void
}

type MapPhase = 'loading' | 'ready' | 'load-error'

const AMAP_PLUGINS = [
  'AMap.Marker',
  'AMap.Polyline',
  'AMap.InfoWindow',
  'AMap.Driving',
  'AMap.Walking',
]

export default function TripMap({ plan, selectedAttraction }: TripMapProps) {
  const { t, i18n } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<AMapMap | null>(null)
  const markerBindingsRef = useRef(new Map<string, MarkerBinding>())
  const [phase, setPhase] = useState<MapPhase>('loading')
  const webKey = getAmapWebJsKey()
  const securityJsCode = getAmapSecurityJsCode()
  const stops = useMemo(() => collectAttractionStops(plan), [plan])

  useEffect(() => {
    if (!webKey || stops.length === 0 || !containerRef.current) return
    let cancelled = false
    const markerBindings = markerBindingsRef.current
    const mapOverlays: AMapOverlay[] = []
    setPhase('loading')

    const initialize = async () => {
      try {
        const AMap = await loadAMap({
          key: webKey,
          version: '2.0',
          plugins: AMAP_PLUGINS,
          ...(securityJsCode ? { securityJsCode } : {}),
        } as Parameters<typeof loadAMap>[0] & { securityJsCode?: string }) as AMapNamespace
        if (cancelled || !containerRef.current) return

        const map = new AMap.Map(containerRef.current, {
          zoom: 12,
          center: stops[0].point,
          viewMode: '3D',
          mapStyle: 'amap://styles/darkblue',
          WebGLParams: { preserveDrawingBuffer: true },
        })
        mapRef.current = map

        stops.forEach((stop, index) => {
          const label = `${stop.dayIndex + 1}-${stop.attractionIndex + 1}`
          const element = buildMarkerElement(label, t('tripMap.markerAria', { label, name: stop.attraction.name }))
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
              t('tripMap.sequence', { day: stop.dayIndex + 1, index: stop.attractionIndex + 1 }),
              stop.attraction.address || t('common.addressPending'),
              t('tripMap.duration', {
                duration: Number.isFinite(stop.attraction.visit_duration) ? stop.attraction.visit_duration : '—',
              }),
            ),
            offset: new AMap.Pixel(0, -44),
            closeWhenClickMap: true,
          })
          const open = () => infoWindow.open(map, marker.getPosition())
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

        map.add(mapOverlays)
        map.setFitView(mapOverlays, false, [56, 40, 56, 40], 16)
        setPhase('ready')

        for (const segment of buildRouteSegments(plan, stops)) {
          const polyline = await createRoutePolyline(AMap, segment)
          if (cancelled) return
          map.add(polyline)
          mapOverlays.push(polyline)
        }
        if (!cancelled) map.setFitView(mapOverlays, false, [56, 40, 56, 40], 16)
      } catch {
        if (!cancelled) setPhase('load-error')
      }
    }

    void initialize()
    return () => {
      cancelled = true
      markerBindings.forEach(({ marker, infoWindow, element, handlers, keyHandler }) => {
        marker.off('mouseover', handlers.mouseover)
        marker.off('mouseout', handlers.mouseout)
        marker.off('click', handlers.click)
        element.removeEventListener('keydown', keyHandler)
        infoWindow.close()
      })
      markerBindings.clear()
      mapRef.current?.destroy()
      mapRef.current = null
    }
  }, [i18n.resolvedLanguage, plan, stops, t, webKey, securityJsCode])

  useEffect(() => {
    markerBindingsRef.current.forEach(({ element }) => element.classList.remove('is-active'))
    if (!selectedAttraction || phase !== 'ready') return
    const binding = markerBindingsRef.current.get(`${selectedAttraction.dayIndex}-${selectedAttraction.attractionIndex}`)
    if (!binding || !mapRef.current) return
    binding.element.classList.add('is-active')
    mapRef.current.setZoomAndCenter(16, binding.point)
    binding.infoWindow.open(mapRef.current, binding.marker.getPosition())
  }, [phase, selectedAttraction])

  if (!webKey) return <TripMapFallback kind="missing-key" />
  if (stops.length === 0) return <TripMapFallback kind="missing-coordinate" />
  if (phase === 'load-error') return <TripMapFallback kind="load-error" />

  return (
    <section className="trip-map-shell" aria-label={t('tripMap.overview')}>
      <div className="trip-map-heading">
        <div>
          <span className="trip-map-eyebrow">{t('tripMap.overview')}</span>
          <h2>{t('tripMap.title')}</h2>
        </div>
        <div className="trip-map-legend" aria-label={t('tripMap.legend')}>
          <span><i className="is-driving" />{t('tripMap.driving')}</span>
          <span><i className="is-walking" />{t('tripMap.walking')}</span>
          <span><i className="is-fallback" />{t('tripMap.straight')}</span>
        </div>
      </div>
      <div ref={containerRef} id="trip-map-canvas" className="trip-map-canvas" data-trip-map-capture="true" />
      {phase === 'loading' && (
        <div className="trip-map-loading" role="status">
          <LoadingOutlined spin />
          <span>{t('tripMap.loading')}</span>
        </div>
      )}
    </section>
  )
}
