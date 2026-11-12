import type { Attraction, Location, TripPlan } from '@/types/api'

/**
 * 与具体地图 SDK 无关的几何层。
 *
 * AMap 用 `[lng, lat]` 数组，Google 用 `{lat, lng}` 对象，但「哪些点要画、
 * 第几天从酒店出发、最后回酒店」这套业务规则对两家完全一样。把它单独放在这里，
 * 两个渲染器就只需要关心各自的 API，不会各自实现一遍、日后改出偏差。
 */

/** 统一用 `[经度, 纬度]` 表示一个点，与 AMap 的习惯保持一致。 */
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

export function samePoint(a: RoutePoint, b: RoutePoint): boolean {
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
