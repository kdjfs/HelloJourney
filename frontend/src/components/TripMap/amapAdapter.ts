import type { Attraction, Location, TripPlan } from '@/types/api'

export type RoutePoint = [longitude: number, latitude: number]
export type RouteMode = 'driving' | 'walking' | 'straight'

export interface MapAttractionStop {
  key: string
  dayIndex: number
  attractionIndex: number
  point: RoutePoint
  attraction: Attraction
}

export interface RouteSegment {
  start: RoutePoint
  end: RoutePoint
}

export interface AMapMap {
  add(overlays: AMapOverlay | AMapOverlay[]): void
  destroy(): void
  setFitView(overlays?: AMapOverlay[], immediately?: boolean, avoid?: number[], maxZoom?: number): void
  setZoomAndCenter(zoom: number, center: RoutePoint): void
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
}

const ROUTE_STYLES: Record<RouteMode, Record<string, unknown>> = {
  driving: {
    strokeColor: '#37b4ff',
    strokeWeight: 5,
    strokeOpacity: 0.92,
    strokeStyle: 'solid',
    lineJoin: 'round',
    lineCap: 'round',
    outlineColor: 'rgba(4, 19, 32, 0.72)',
    borderWeight: 1,
  },
  walking: {
    strokeColor: '#6ad38f',
    strokeWeight: 4,
    strokeOpacity: 0.9,
    strokeStyle: 'dashed',
    strokeDasharray: [12, 8],
    lineJoin: 'round',
    lineCap: 'round',
    outlineColor: 'rgba(8, 32, 20, 0.55)',
    borderWeight: 1,
  },
  straight: {
    strokeColor: '#ffd166',
    strokeWeight: 3,
    strokeOpacity: 0.85,
    strokeStyle: 'dashed',
    strokeDasharray: [8, 8],
    lineJoin: 'round',
    lineCap: 'round',
    outlineColor: 'rgba(33, 17, 8, 0.52)',
    borderWeight: 1,
  },
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null
}

export function toRoutePoint(location?: Location | null): RoutePoint | null {
  if (!location) return null
  const longitude = Number(location.longitude)
  const latitude = Number(location.latitude)
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null
  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) return null
  if (longitude === 0 && latitude === 0) return null
  return [longitude, latitude]
}

export function collectAttractionStops(plan: TripPlan): MapAttractionStop[] {
  return plan.days.flatMap((day, dayIndex) =>
    day.attractions.flatMap((attraction, attractionIndex) => {
      const point = toRoutePoint(attraction.location)
      return point
        ? [{
            key: `${dayIndex}-${attractionIndex}`,
            dayIndex,
            attractionIndex,
            point,
            attraction,
          }]
        : []
    }),
  )
}

function samePoint(a: RoutePoint, b: RoutePoint): boolean {
  return a[0] === b[0] && a[1] === b[1]
}

export function buildRouteSegments(plan: TripPlan, stops: MapAttractionStop[]): RouteSegment[] {
  return plan.days.flatMap((day, dayIndex) => {
    const attractionPoints = stops
      .filter((stop) => stop.dayIndex === dayIndex)
      .sort((a, b) => a.attractionIndex - b.attractionIndex)
      .map((stop) => stop.point)

    if (attractionPoints.length === 0) return []
    const hotelPoint = toRoutePoint(day.hotel?.location)
    const orderedPoints = hotelPoint
      ? [hotelPoint, ...attractionPoints, hotelPoint]
      : attractionPoints

    return orderedPoints.slice(0, -1).flatMap((start, index) => {
      const end = orderedPoints[index + 1]
      return samePoint(start, end) ? [] : [{ start, end }]
    })
  })
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
