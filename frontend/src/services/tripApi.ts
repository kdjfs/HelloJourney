import { apiClient, getRuntimeApiBaseUrl } from './apiClient'
import { isMockEnabled } from '../utils/env'
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
  },
) {
  const wsBase = getRuntimeApiBaseUrl().replace(/^http/i, 'ws').replace(/\/+$/, '')
  const finalWsUrl = wsUrl.startsWith('ws://') || wsUrl.startsWith('wss://') ? wsUrl : `${wsBase}${wsUrl}`
  const socket = new WebSocket(finalWsUrl)
  socket.onmessage = (ev) => callbacks.onEvent(JSON.parse(ev.data))
  socket.onerror = (err) => callbacks.onError?.(err)
  socket.onclose = () => callbacks.onClose?.()
  return socket
}

export interface TaskPollingOptions {
  intervalMs?: number
  maxWaitMs?: number
}

export async function waitTaskByPolling(
  taskId: string,
  onTaskEvent?: (event: TripTaskEvent) => void,
  options?: TaskPollingOptions,
): Promise<TripPlanResponse> {
  const intervalMs = options?.intervalMs ?? 1000
  const maxWaitMs = options?.maxWaitMs ?? 120_000
  const deadline = Date.now() + maxWaitMs

  while (Date.now() < deadline) {
    const status = await pollTaskStatus(taskId)
    const event: TripTaskEvent = {
      task_id: status.task_id,
      plan_id: status.plan_id,
      status: status.status,
      stage: status.stage,
      progress: status.progress ?? 0,
      message: status.message ?? '',
      error: status.error,
      result: status.result,
    }
    onTaskEvent?.(event)

    if (status.status === 'completed' && status.result) {
      return status.result
    }
    if (status.status === 'failed') {
      throw new Error(status.error || '生成失败')
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  throw new Error('任务超时，请稍后再试')
}

export interface GenerateTripPlanOptions {
  mockByPolling?: boolean
  pollingOptions?: TaskPollingOptions
}

export async function generateTripPlan(
  formData: TripFormData,
  onTaskEvent?: (event: TripTaskEvent) => void,
  options?: GenerateTripPlanOptions,
): Promise<TripPlanResponse> {
  const task = await submitTripPlan(formData)

  if (options?.mockByPolling ?? isMockEnabled()) {
    const status = await pollTaskStatus(task.task_id)
    if (status.status === 'completed' && status.result) return status.result
    throw new Error(status.error || '任务未完成')
  }

  return new Promise((resolve, reject) => {
    let settled = false
    let socket: ReturnType<typeof connectTripTaskWebSocket> | null = null

    const cleanup = () => {
      if (socket) {
        try { socket.close() } catch { /* ignore */ }
        socket = null
      }
    }

    const fallbackToPolling = async () => {
      if (settled) return
      console.log('[TripAPI] WebSocket 不可用，降级为轮询模式')
      try {
        const result = await waitTaskByPolling(task.task_id, onTaskEvent)
        settled = true
        resolve(result)
      } catch (err) {
        settled = true
        reject(err)
      }
    }

    try {
      socket = connectTripTaskWebSocket(task.ws_url, {
        onEvent: (event) => {
          if (settled) return
          onTaskEvent?.(event)
          if (event.status === 'completed') {
            settled = true
            cleanup()
            if (event.result) {
              resolve(event.result)
            } else {
              reject(new Error('没有返回结果'))
            }
          }
          if (event.status === 'failed') {
            settled = true
            cleanup()
            reject(new Error(event.error || event.message || '生成失败'))
          }
        },
        onError: () => {
          if (!settled) {
            cleanup()
            void fallbackToPolling()
          }
        },
        onClose: () => {
          if (!settled) {
            void fallbackToPolling()
          }
        },
      })
    } catch {
      if (!settled) {
        void fallbackToPolling()
      }
    }
  })
}