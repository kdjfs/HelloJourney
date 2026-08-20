import { describe, expect, it } from 'vitest'
import type { TripPlan } from '@/types/api'
import { serializeTripPlan, tripExportFilename } from './tripExport'

describe('trip export', () => {
  it('exports a versioned, portable JSON document', () => {
    const plan: TripPlan = {
      city: '北京',
      start_date: '2026-08-21',
      end_date: '2026-08-21',
      days: [],
      weather_info: [],
      overall_suggestions: '',
    }
    const exported = JSON.parse(serializeTripPlan(plan, 'plan-1'))

    expect(exported.schema_version).toBe('hello-journey.trip-plan.v3')
    expect(exported.plan_id).toBe('plan-1')
    expect(exported.plan.city).toBe(plan.city)
    expect(tripExportFilename(plan)).toContain('HelloJourney-')
  })
})
