import { post } from '@/utils/http'
import type { TripChatRequest, TripChatResponse } from '@/types/api'

export function askTripChat(data: TripChatRequest): Promise<TripChatResponse> {
  return post<TripChatResponse>('/api/chat/ask', data)
}
