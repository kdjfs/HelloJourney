import { apiClient, getRuntimeApiBaseUrl } from './apiClient'
import { isMockEnabled } from '../utils/env'
import type { TripFormData, TripHistoryItem, TripPlanResponse, TripTaskEvent } from '../types/api'
import type { TripChangeSet } from '@/features/trip-workspace/model/workspaceReducer'

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
  let finalWsUrl: string
  if (wsUrl.startsWith('ws://') || wsUrl.startsWith('wss://')) {
    try {
      const url = new URL(wsUrl)
      finalWsUrl = `${wsBase}${url.pathname}${url.search}`
    } catch {
      finalWsUrl = wsUrl
    }
  } else {
    finalWsUrl = `${wsBase}${wsUrl}`
  }
  const socket = new WebSocket(finalWsUrl)
  socket.onmessage = (ev) => {
    try {
      callbacks.onEvent(JSON.parse(ev.data))
    } catch {
      callbacks.onError?.(new Event('invalid-message'))
    }
  }
  socket.onerror = (err) => callbacks.onError?.(err)
  socket.onclose = () => callbacks.onClose?.()
  return socket
}

export interface TaskPollingOptions {
  intervalMs?: number
  maxWaitMs?: number
  signal?: AbortSignal
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
    if (options?.signal?.aborted) throw new DOMException('任务已取消', 'AbortError')
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
    if (status.status === 'cancelled') {
      throw new DOMException('任务已取消', 'AbortError')
    }

    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(resolve, intervalMs)
      options?.signal?.addEventListener('abort', () => {
        window.clearTimeout(timer)
        reject(new DOMException('任务已取消', 'AbortError'))
      }, { once: true })
    })
  }

  throw new Error('任务超时，请稍后再试')
}

export interface GenerateTripPlanOptions {
  mockByPolling?: boolean
  pollingOptions?: TaskPollingOptions
  signal?: AbortSignal
  onTaskSubmitted?: (task: SubmitTripPlanResponse) => void
  maxSocketReconnects?: number
}

export async function generateTripPlan(
  formData: TripFormData,
  onTaskEvent?: (event: TripTaskEvent) => void,
  options?: GenerateTripPlanOptions,
): Promise<TripPlanResponse> {
  const task = await submitTripPlan(formData)
  options?.onTaskSubmitted?.(task)

  if (options?.signal?.aborted) {
    await cancelTripTask(task.task_id).catch(() => undefined)
    throw new DOMException('任务已取消', 'AbortError')
  }

  if (options?.mockByPolling ?? isMockEnabled()) {
    const status = await pollTaskStatus(task.task_id)
    if (status.status === 'completed' && status.result) return status.result
    throw new Error(status.error || '任务未完成')
  }

  return new Promise((resolve, reject) => {
    let settled = false
    let socket: ReturnType<typeof connectTripTaskWebSocket> | null = null
    let reconnectAttempts = 0
    let recovering = false
    let fallbackStarted = false
    let reconnectTimer: number | undefined

    const cleanup = () => {
      if (socket) {
        try { socket.close() } catch { /* ignore */ }
        socket = null
      }
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer)
      options?.signal?.removeEventListener('abort', abortTask)
    }

    const fallbackToPolling = async () => {
      if (settled || fallbackStarted) return
      fallbackStarted = true
      console.log('[TripAPI] WebSocket 不可用，降级为轮询模式')
      try {
        const result = await waitTaskByPolling(task.task_id, onTaskEvent, { ...options?.pollingOptions, signal: options?.signal })
        settled = true
        cleanup()
        resolve(result)
      } catch (err) {
        settled = true
        cleanup()
        reject(err)
      }
    }

    const scheduleRecovery = () => {
      if (settled || recovering || fallbackStarted) return
      recovering = true
      if (socket) {
        try { socket.close() } catch { /* ignore */ }
        socket = null
      }
      const maxReconnects = options?.maxSocketReconnects ?? 2
      if (reconnectAttempts >= maxReconnects) {
        recovering = false
        void fallbackToPolling()
        return
      }
      const delay = 500 * (2 ** reconnectAttempts)
      reconnectAttempts += 1
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = undefined
        recovering = false
        openSocket()
      }, delay)
    }

    const openSocket = () => {
      if (settled || fallbackStarted) return
      try {
        socket = connectTripTaskWebSocket(task.ws_url, {
        onEvent: (event) => {
          if (settled) return
          reconnectAttempts = 0
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
          if (event.status === 'cancelled') {
            settled = true
            cleanup()
            reject(new DOMException('任务已取消', 'AbortError'))
          }
        },
        onError: scheduleRecovery,
        onClose: () => {
          if (!settled && !recovering) scheduleRecovery()
        },
        })
      } catch {
        scheduleRecovery()
      }
    }

    function abortTask() {
      if (settled) return
      settled = true
      cleanup()
      void cancelTripTask(task.task_id)
      reject(new DOMException('任务已取消', 'AbortError'))
    }

    options?.signal?.addEventListener('abort', abortTask, { once: true })
    openSocket()
  })
}

export async function cancelTripTask(taskId: string) {
  const res = await apiClient.delete<{ task_id: string; status: string; message: string }>(`/api/trip/tasks/${taskId}`)
  return res.data
}

export async function proposePartialReplan(
  planId: string,
  request: { instruction: string; scope: 'day' | 'attraction' | 'hotel' | 'route' | 'budget' | 'all'; day_index?: number; current_plan: import('../types/api').TripPlan },
): Promise<TripChangeSet> {
  const res = await apiClient.post<TripChangeSet>(`/api/trip/plans/${encodeURIComponent(planId)}/replan`, request)
  return res.data
}
