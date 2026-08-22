import { describe, expect, it } from 'vitest'
import type { TripPlan } from '@/types/api'
import { deriveWorkspaceBudget, workspacePlanSignature } from './derivedPlan'

const source: TripPlan = {
  city: '北京',
  start_date: '2026-09-01',
  end_date: '2026-09-01',
  overall_suggestions: '',
  weather_info: [],
  budget: {
    total_attractions: 150,
    total_hotels: 500,
    total_meals: 200,
    total_transportation: 100,
    total_inter_city_transport: 50,
    total: 1_000,
  },
  days: [{
    date: '2026-09-01', day_index: 0, description: '', transportation: '地铁', accommodation: '酒店',
    hotel: { name: '酒店', address: '前门', price_range: '¥500', rating: '4.5', distance: '1km', type: '酒店', estimated_cost: 500 },
    attractions: [
      { name: '故宫', address: '东城区', location: { longitude: 116.4, latitude: 39.9 }, visit_duration: 120, description: '', ticket_price: 60 },
      { name: '景山', address: '西城区', location: { longitude: 116.3, latitude: 39.9 }, visit_duration: 60, description: '', ticket_price: 10 },
    ],
    meals: [{ type: 'lunch', name: '午餐', estimated_cost: 80 }],
  }],
}

describe('workspace derived data', () => {
  it('detects semantic itinerary edits and restores the original signature on undo', () => {
    const edited = structuredClone(source)
    edited.days[0].attractions.pop()

    expect(workspacePlanSignature(edited)).not.toBe(workspacePlanSignature(source))
    expect(workspacePlanSignature(structuredClone(source))).toBe(workspacePlanSignature(source))
  })

  it('updates itemized budget categories while preserving backend-only estimates', () => {
    const edited = structuredClone(source)
    edited.days[0].attractions.pop()
    edited.days[0].hotel!.estimated_cost = 650

    expect(deriveWorkspaceBudget(edited, source)).toEqual({
      total_attractions: 140,
      total_hotels: 650,
      total_meals: 200,
      total_transportation: 100,
      total_inter_city_transport: 50,
      total: 1_140,
    })
  })
})
