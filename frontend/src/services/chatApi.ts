import { apiClient } from './apiClient'
import type { TripChatResponse, ChatMessage } from '../types/api'

export interface AskTripChatPayload {
  message: string
  trip_plan: Record<string, unknown>
  history: ChatMessage[]
  /** 可选：临时指定模型（中转站里的任意对话模型），留空用当前激活供应商 */
  model?: string
}

export async function askTripChat(payload: AskTripChatPayload) {
  const res = await apiClient.post<TripChatResponse>('/api/chat/ask', payload)
  return res.data
}

export interface AvailableModels {
  models: string[]
  count: number
}

/** 当前供应商可用的模型 id（公开接口，不含密钥） */
export async function listAvailableModels(): Promise<string[]> {
  const res = await apiClient.get<{ success: boolean; data?: AvailableModels }>('/api/settings/llm/models')
  return res.data?.data?.models ?? []
}