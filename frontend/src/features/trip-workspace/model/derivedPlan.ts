import type { Budget, TripPlan } from '@/types/api'

export function workspacePlanSignature(plan: TripPlan): string {
  return JSON.stringify(plan)
}

function sumFinite(values: Array<number | undefined>): number {
  return values.reduce<number>((total, value) => total + (Number.isFinite(value) ? Number(value) : 0), 0)
}

function itemizedCosts(plan: TripPlan) {
  return {
    attractions: sumFinite(plan.days.flatMap((day) => day.attractions.map((item) => item.ticket_price))),
    hotels: sumFinite(plan.days.map((day) => day.hotel?.estimated_cost)),
    meals: sumFinite(plan.days.flatMap((day) => day.meals.map((item) => item.estimated_cost))),
  }
}

function applyDelta(base: number, currentItems: number, sourceItems: number): number {
  return Math.max(0, base + currentItems - sourceItems)
}

export function deriveWorkspaceBudget(current: TripPlan, source: TripPlan): Budget | undefined {
  const base = source.budget ?? current.budget
  if (!base) return undefined
  if (workspacePlanSignature(current) === workspacePlanSignature(source)) return current.budget ?? base

  const currentItems = itemizedCosts(current)
  const sourceItems = itemizedCosts(source)
  const totalAttractions = applyDelta(base.total_attractions, currentItems.attractions, sourceItems.attractions)
  const totalHotels = applyDelta(base.total_hotels, currentItems.hotels, sourceItems.hotels)
  const totalMeals = applyDelta(base.total_meals, currentItems.meals, sourceItems.meals)
  const totalTransportation = base.total_transportation
  const totalInterCity = base.total_inter_city_transport ?? 0

  return {
    total_attractions: totalAttractions,
    total_hotels: totalHotels,
    total_meals: totalMeals,
    total_transportation: totalTransportation,
    total_inter_city_transport: base.total_inter_city_transport,
    total: totalAttractions + totalHotels + totalMeals + totalTransportation + totalInterCity,
  }
}
