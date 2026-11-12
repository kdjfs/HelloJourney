import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { cancelTripTask, generateTripPlan, waitTaskByPolling } from '../../../services/tripApi'
import { isMockEnabled } from '../../../utils/env'
import i18n, { normalizeAppLocale } from '../../../i18n'
import type { TripFormData, TripPlanResponse, TripTaskEvent } from '../../../types/api'
import {
  GenerationContext,
  type GenerationContextValue,
  type GenerationSnapshot,
} from './generationContext'

const STORAGE_KEY = 'tripGeneration'
/**
 * 前端等待任务的上限，必须与后端 trip.planning.execution-timeout-seconds（默认 600s）对齐。
 * 之前这里用 waitTaskByPolling 的默认 120s，慢模型（中转站单次调用 100s+）还没跑完
 * 前端就先报「任务超时」，用户看到失败但后端其实还在算。
 */
const POLL_MAX_WAIT_MS = 600_000
const POLL_INTERVAL_MS = 1_500
const STAGE_LABEL_KEYS: Record<string, string> = {
  submitted: 'landing.stageSubmitted',
  initializing: 'landing.stageSubmitted',
  attraction_search: 'landing.stageAttractions',
  weather_search: 'landing.stageWeather',
  hotel_search: 'landing.stageHotels',
  planning: 'landing.stagePlanning',
  review: 'landing.stageReview',
  graph_building: 'landing.stageGraph',
  completed: 'landing.stageCompleted',
  failed: 'landing.stageFailed',
  cancelled: 'landing.stageCancelled',
}

function readSnapshot(): GenerationSnapshot | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as GenerationSnapshot
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function writeSnapshot(snapshot: GenerationSnapshot | null): void {
  try {
    if (snapshot) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // 隐私模式下 sessionStorage 可能不可写，生成流程本身不应因此中断
  }
}

/** 把生成结果落到 sessionStorage，供结果页与导出直接读取 */
function persistPlanResult(response: TripPlanResponse, request: TripFormData | null): string {
  const planId = response.plan_id || 'mock1234'
  if (response.success && response.data) {
    sessionStorage.setItem('tripPlan', JSON.stringify(response.data))
    if (response.graph_data) sessionStorage.setItem('graphData', JSON.stringify(response.graph_data))
    if (response.review) sessionStorage.setItem('tripReview', JSON.stringify(response.review))
    if (response.warnings && response.warnings.length > 0) {
      sessionStorage.setItem('tripWarnings', JSON.stringify(response.warnings))
    } else {
      sessionStorage.removeItem('tripWarnings')
    }
    sessionStorage.setItem('planId', planId)
    if (request) {
      sessionStorage.setItem('tripPlanLocale', request.language || normalizeAppLocale(i18n.language))
      sessionStorage.setItem('tripRequest', JSON.stringify({
        travelers: request.travelers,
        budget_limit: request.budget_limit,
      }))
    }
  }
  return planId
}

/**
 * 生成任务的全局持有者。
 *
 * 之前生成流程完全长在 Landing 组件里：一旦离开首页，组件卸载，进度、
 * 取消句柄、活动流全部丢失，用户回到首页只能看到一个空表单。把任务提升到
 * 路由外层后，任务在后台继续跑，任何页面都能看到进度，刷新后还能凭 taskId
 * 继续轮询同一个后端任务。
 */
export function GenerationProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [snapshot, setSnapshot] = useState<GenerationSnapshot | null>(readSnapshot)
  const [events, setEvents] = useState<TripTaskEvent[]>([])
  const controllerRef = useRef<AbortController | null>(null)
  const resumeGuardRef = useRef(false)
  const pathnameRef = useRef(location.pathname)
  const requestRef = useRef<TripFormData | null>(null)

  useEffect(() => {
    pathnameRef.current = location.pathname
  }, [location.pathname])

  /* 快照变化即落盘：任务状态要能扛住路由切换与刷新 */
  useEffect(() => {
    writeSnapshot(snapshot)
  }, [snapshot])

  const patch = useCallback((next: Partial<GenerationSnapshot>) => {
    setSnapshot((current) => ({
      status: 'running',
      taskId: '',
      planId: '',
      city: '',
      progress: 0,
      message: '',
      startedAt: Date.now(),
      ...current,
      ...next,
    }))
  }, [])

  const stageLabel = useCallback(
    (stage: string | undefined, fallbackKey: string) => t(STAGE_LABEL_KEYS[stage ?? ''] ?? fallbackKey),
    [t],
  )

  const finishSuccess = useCallback((response: TripPlanResponse, request: TripFormData | null) => {
    const planId = persistPlanResult(response, request)
    patch({
      status: 'completed',
      planId,
      progress: 100,
      message: t('landing.stageCompleted'),
      finishedAt: Date.now(),
    })
    // 只有停在首页时才自动跳转；在别的页面生成完成时不抢走用户的当前操作
    if (pathnameRef.current === '/') {
      navigate(`/result?plan_id=${planId}`)
    }
  }, [navigate, patch, t])

  const runGeneration = useCallback(async (request: TripFormData) => {
    const controller = new AbortController()
    controllerRef.current = controller
    requestRef.current = request
    setEvents([])
    patch({
      status: 'running',
      city: request.city,
      progress: 5,
      message: t('landing.stageSubmitted'),
      taskId: '',
      planId: '',
      error: undefined,
      startedAt: Date.now(),
      finishedAt: undefined,
    })

    const useMock = isMockEnabled()

    try {
      if (useMock) {
        const mockStages = [
          { progress: 30, stage: 'attraction_search' },
          { progress: 50, stage: 'weather_search' },
          { progress: 70, stage: 'hotel_search' },
          { progress: 90, stage: 'planning' },
        ]
        for (const stage of mockStages) {
          if (controller.signal.aborted) throw new DOMException(t('landing.taskCancelled'), 'AbortError')
          const message = stageLabel(stage.stage, 'common.processing')
          patch({ progress: stage.progress, message })
          setEvents((current) => [...current, {
            task_id: 'mock1234',
            plan_id: 'mock1234',
            status: 'processing',
            stage: stage.stage as TripTaskEvent['stage'],
            progress: stage.progress,
            message,
          }])
          await new Promise((resolve) => setTimeout(resolve, 800))
        }
      }

      const response = await generateTripPlan(
        request,
        (event) => {
          setEvents((current) => [...current.slice(-5), event])
          patch({
            taskId: event.task_id || '',
            planId: event.plan_id || '',
            progress: typeof event.progress === 'number' ? Math.max(0, Math.min(100, event.progress)) : undefined,
            message: event.message || stageLabel(event.stage, 'common.processing'),
          })
        },
        {
          mockByPolling: useMock,
          signal: controller.signal,
          pollingOptions: { maxWaitMs: POLL_MAX_WAIT_MS, intervalMs: POLL_INTERVAL_MS },
          onTaskSubmitted: (task) => {
            patch({ taskId: task.task_id, planId: task.plan_id, progress: 5, message: task.message })
          },
        },
      )

      if (response.success && response.data) {
        finishSuccess(response, request)
      } else {
        patch({ status: 'failed', error: response.message || t('landing.generationFailed'), finishedAt: Date.now() })
      }
    } catch (error) {
      const cancelled = error instanceof DOMException && error.name === 'AbortError'
      const message = error instanceof Error ? error.message : t('common.unknownError')
      patch({
        status: cancelled ? 'cancelled' : 'failed',
        error: cancelled ? t('landing.generationCancelledDetail') : message,
        finishedAt: Date.now(),
      })
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null
    }
  }, [finishSuccess, patch, stageLabel, t])

  const start = useCallback((request: TripFormData) => {
    if (controllerRef.current) return
    // 生成通常要几十秒，趁这段时间把结果页的 chunk 预取回来，跳转时直接命中缓存
    void import('../../../pages/Result')
    void runGeneration(request)
  }, [runGeneration])

  const cancel = useCallback(() => {
    const controller = controllerRef.current
    const taskId = snapshot?.taskId
    controller?.abort()
    controllerRef.current = null
    if (taskId) void cancelTripTask(taskId).catch(() => undefined)
    patch({
      status: 'cancelled',
      message: t('landing.stageCancelled'),
      error: t('landing.generationCancelledDetail'),
      finishedAt: Date.now(),
    })
  }, [patch, snapshot?.taskId, t])

  const dismiss = useCallback(() => {
    writeSnapshot(null)
    setSnapshot(null)
    setEvents([])
  }, [])

  const openResult = useCallback(() => {
    const planId = snapshot?.planId || sessionStorage.getItem('planId')
    if (planId) navigate(`/result?plan_id=${planId}`)
  }, [navigate, snapshot?.planId])

  /* 刷新或被路由卸载后重新挂载：凭 taskId 继续等同一个后端任务 */
  useEffect(() => {
    if (resumeGuardRef.current) return
    resumeGuardRef.current = true
    const stored = readSnapshot()
    if (!stored || stored.status !== 'running' || !stored.taskId) return

    const controller = new AbortController()
    controllerRef.current = controller
    void (async () => {
      try {
        const response = await waitTaskByPolling(
          stored.taskId,
          (event) => {
            setEvents((current) => [...current.slice(-5), event])
            patch({
              progress: typeof event.progress === 'number' ? Math.max(0, Math.min(100, event.progress)) : undefined,
              message: event.message || stageLabel(event.stage, 'common.processing'),
            })
          },
          { signal: controller.signal, maxWaitMs: POLL_MAX_WAIT_MS, intervalMs: POLL_INTERVAL_MS },
        )
        finishSuccess(response as TripPlanResponse, requestRef.current)
      } catch (error) {
        const cancelled = error instanceof DOMException && error.name === 'AbortError'
        patch({
          status: cancelled ? 'cancelled' : 'failed',
          error: error instanceof Error ? error.message : t('common.unknownError'),
          finishedAt: Date.now(),
        })
      } finally {
        if (controllerRef.current === controller) controllerRef.current = null
      }
    })()
  }, [finishSuccess, patch, stageLabel, t])

  const value = useMemo<GenerationContextValue>(() => ({
    snapshot,
    events,
    isRunning: snapshot?.status === 'running',
    start,
    cancel,
    dismiss,
    openResult,
  }), [cancel, dismiss, events, openResult, snapshot, start])

  return <GenerationContext.Provider value={value}>{children}</GenerationContext.Provider>
}

export default GenerationProvider
