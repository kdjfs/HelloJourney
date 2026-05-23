import { get, post } from '@/utils/http'
import type { TripRequest, TripTaskEvent, TripHistoryItem } from '@/types/api'

export interface SubmitTripPlanResult {
  task_id: string
  plan_id: string
  status: string
  ws_url: string
  message: string
}

export function submitTripPlan(data: TripRequest): Promise<SubmitTripPlanResult> {
  return post<SubmitTripPlanResult>('/api/trip/plan', data)
}

export function pollTaskStatus(taskId: string): Promise<TripTaskEvent> {
  return get<TripTaskEvent>(`/api/trip/status/${taskId}`)
}

export function getTripHistory(limit = 10): Promise<{ items: TripHistoryItem[] }> {
  return get<{ items: TripHistoryItem[] }>('/api/trip/history', { limit })
}
