import type { TripPlan } from '@/types/api'

export function serializeTripPlan(plan: TripPlan, planId?: string): string {
  return JSON.stringify({
    schema_version: 'hello-journey.trip-plan.v3',
    exported_at: new Date().toISOString(),
    plan_id: planId,
    plan,
  }, null, 2)
}

export function tripExportFilename(plan: TripPlan): string {
  const safeCity = (plan.city || 'trip').replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^-|-$/g, '')
  return `HelloJourney-${safeCity || 'trip'}-${plan.start_date}.json`
}
