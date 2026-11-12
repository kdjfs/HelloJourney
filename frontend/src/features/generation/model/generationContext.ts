import { createContext, useContext } from 'react'
import type { TripTaskEvent } from '../../../types/api'

export type GenerationStatus = 'running' | 'completed' | 'failed' | 'cancelled'

export interface GenerationSnapshot {
  status: GenerationStatus
  /** 后端任务 id，用于刷新/跳转后继续轮询 */
  taskId: string
  planId: string
  city: string
  progress: number
  message: string
  error?: string
  startedAt: number
  finishedAt?: number
}

export interface GenerationContextValue {
  snapshot: GenerationSnapshot | null
  events: TripTaskEvent[]
  isRunning: boolean
  start: (request: import('../../../types/api').TripFormData) => void
  cancel: () => void
  dismiss: () => void
  openResult: () => void
}

export const GenerationContext = createContext<GenerationContextValue | null>(null)

export function useGeneration(): GenerationContextValue {
  const context = useContext(GenerationContext)
  if (!context) throw new Error('useGeneration must be used inside <GenerationProvider>')
  return context
}
