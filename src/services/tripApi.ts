import { apiClient, getRuntimeApiBaseUrl } from './apiClient'
import type { TripFormData, TripHistoryItem, TripPlanResponse, TripTaskEvent } from '../types/api'

export interface SubmitTripPlanResponse {
  task_id: string
  plan_id: string
  status: 'processing'
  ws_url: string
  message: string
}

export async function submitTripPlan(formData: TripFormData) {
  const res = await apiClient.post<SubmitTripPlanResponse>('/api/trip/plan', formData)
  return res.data
}

export async function pollTaskStatus(taskId: string) {
  const res = await apiClient.get(`/api/trip/status/${taskId}`)
  return res.data
}

export async function getTripHistory(limit = 8): Promise<TripHistoryItem[]> {
  const res = await apiClient.get<{ items: TripHistoryItem[] }>('/api/trip/history', { params: { limit } })
  return res.data.items ?? []
}

export function connectTripTaskWebSocket(
  wsUrl: string,
  callbacks: {
    onEvent: (event: TripTaskEvent) => void
    onError?: (error: Event) => void
    onClose?: () => void
  }
) {
  const wsBase = getRuntimeApiBaseUrl().replace(/^http/i, 'ws').replace(/\/+$/, '')
  const finalWsUrl = wsUrl.startsWith('ws://') || wsUrl.startsWith('wss://') ? wsUrl : `${wsBase}${wsUrl}`
  const socket = new WebSocket(finalWsUrl)
  socket.onmessage = (ev) => callbacks.onEvent(JSON.parse(ev.data))
  socket.onerror = (err) => callbacks.onError?.(err)
  socket.onclose = () => callbacks.onClose?.()
  return socket
}

export async function generateTripPlan(
  formData: TripFormData,
  onTaskEvent?: (event: TripTaskEvent) => void,
  options?: { mockByPolling?: boolean }
): Promise<TripPlanResponse> {
  const task = await submitTripPlan(formData)

  // Mock 开发模式：不用 WebSocket，直接轮询一次 status。
  if (options?.mockByPolling) {
    const status = await pollTaskStatus(task.task_id)
    if (status.status === 'completed' && status.result) return status.result
    throw new Error(status.error || 'Mock 任务未完成')
  }

  return new Promise((resolve, reject) => {
    let settled = false
    const socket = connectTripTaskWebSocket(task.ws_url, {
      onEvent: (event) => {
        onTaskEvent?.(event)
        if (event.status === 'completed') {
          settled = true
          socket.close()
          if (event.result) {
            resolve(event.result)
          } else {
            reject(new Error('没有返回结果'))
          }
        }
        if (event.status === 'failed') {
          settled = true
          socket.close()
          reject(new Error(event.error || event.message || '生成失败'))
        }
      },
      onError: () => {
        if (!settled) reject(new Error('WebSocket 连接失败'))
      },
      onClose: () => {
        if (!settled) reject(new Error('WebSocket 已关闭'))
      },
    })
  })
}
