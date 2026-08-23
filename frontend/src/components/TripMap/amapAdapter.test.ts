import { describe, expect, it } from 'vitest'
import type { TripPlan } from '@/types/api'
import {
  buildRouteSegments,
  collectAttractionStops,
  createRoutePolyline,
  type AMapNamespace,
  type RoutePoint,
} from './amapAdapter'

const plan: TripPlan = {
  city: '北京',
  start_date: '2026-09-01',
  end_date: '2026-09-01',
  overall_suggestions: '',
  weather_info: [],
  days: [{
    date: '2026-09-01',
    day_index: 0,
    description: '',
    transportation: '地铁',
    accommodation: '酒店',
    meals: [],
    hotel: {
      name: '前门酒店', address: '前门', location: { longitude: 116.397, latitude: 39.9 },
      price_range: '¥500', rating: '4.5', distance: '1km', type: '酒店',
    },
    attractions: [
      { name: '故宫', address: '东城区', description: '', location: { longitude: 116.4, latitude: 39.91 }, visit_duration: 120 },
      { name: '景山', address: '西城区', description: '', location: { longitude: 116.39, latitude: 39.92 }, visit_duration: 60 },
    ],
  }],
}

function createFakeAMap(
  driving: { status: string; result: unknown },
  walking: { status: string; result: unknown },
) {
  const polylineOptions: Array<Record<string, unknown>> = []
  class FakeDriving {
    search(_start: RoutePoint, _end: RoutePoint, callback: (status: string, result: unknown) => void) {
      callback(driving.status, driving.result)
    }
  }
  class FakeWalking {
    search(_start: RoutePoint, _end: RoutePoint, callback: (status: string, result: unknown) => void) {
      callback(walking.status, walking.result)
    }
  }
  class FakePolyline {
    constructor(options: Record<string, unknown>) {
      polylineOptions.push(options)
    }
  }
  return {
    AMap: { Driving: FakeDriving, Walking: FakeWalking, Polyline: FakePolyline } as unknown as AMapNamespace,
    polylineOptions,
  }
}

describe('TripMap AMap adapter', () => {
  it('builds each day route as hotel to attractions to hotel', () => {
    const segments = buildRouteSegments(plan, collectAttractionStops(plan))

    expect(segments).toEqual([
      { start: [116.397, 39.9], end: [116.4, 39.91] },
      { start: [116.4, 39.91], end: [116.39, 39.92] },
      { start: [116.39, 39.92], end: [116.397, 39.9] },
    ])
  })

  it('falls back from driving to a walking road path', async () => {
    const { AMap, polylineOptions } = createFakeAMap(
      { status: 'error', result: null },
      { status: 'complete', result: { routes: [{ steps: [{ path: [[116.4, 39.9], [116.41, 39.91]] }] }] } },
    )

    await createRoutePolyline(AMap, { start: [116.4, 39.9], end: [116.41, 39.91] })

    expect(polylineOptions[0]).toMatchObject({
      path: [[116.4, 39.9], [116.41, 39.91]],
      strokeColor: '#6ad38f',
    })
  })

  it('draws a straight fallback when both route services fail', async () => {
    const { AMap, polylineOptions } = createFakeAMap(
      { status: 'error', result: null },
      { status: 'no_data', result: null },
    )

    await createRoutePolyline(AMap, { start: [116.4, 39.9], end: [116.41, 39.91] })

    expect(polylineOptions[0]).toMatchObject({
      path: [[116.4, 39.9], [116.41, 39.91]],
      strokeColor: '#ffd166',
    })
  })
})
