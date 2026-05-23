import { apiClient } from './apiClient'
import type { TripChatResponse, ChatMessage } from '../types/api'

export interface AskTripChatPayload {
  message: string
  trip_plan: Record<string, unknown>
  history: ChatMessage[]
}

export async function askTripChat(payload: AskTripChatPayload) {
  const res = await apiClient.post<TripChatResponse>('/api/chat/ask', payload)
  return res.data
}