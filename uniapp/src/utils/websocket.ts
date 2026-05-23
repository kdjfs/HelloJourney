import { getBaseUrl } from '@/utils/http'
import type { TripTaskEvent, TripPlanResponse } from '@/types/api'

export function connectTripTaskWebSocket(
  taskId: string,
  onMessage: (event: TripTaskEvent) => void,
  onComplete: (result: TripPlanResponse) => void,
  onError: (error: string) => void
): UniApp.SocketTask {
  const baseUrl = getBaseUrl()
  const wsBaseUrl = baseUrl.replace(/^http/i, 'ws').replace(/\/+$/, '')
  const wsUrl = `${wsBaseUrl}/api/trip/ws/${taskId}`

  const socketTask = uni.connectSocket({ url: wsUrl })

  socketTask.onMessage((res) => {
    try {
      const event: TripTaskEvent = JSON.parse(res.data as string)
      onMessage(event)

      if (event.status === 'completed') {
        if (event.result) {
          onComplete(event.result)
        } else {
          onError('任务完成但未返回结果')
        }
      } else if (event.status === 'failed') {
        onError(event.error || event.message || '任务失败')
      }
    } catch (e) {
      onError('解析 WebSocket 消息失败')
    }
  })

  socketTask.onError(() => {
    onError('WebSocket 连接错误')
  })

  return socketTask
}
