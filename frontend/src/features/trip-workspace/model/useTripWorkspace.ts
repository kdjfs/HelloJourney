import { useEffect, useMemo, useReducer } from 'react'
import type { TripPlan } from '@/types/api'
import { createWorkspaceState, workspaceReducer } from './workspaceReducer'

interface PersistedDraft {
  version: 1
  savedAt: string
  plan: TripPlan
}

function storageKey(planId: string | undefined, plan: TripPlan) {
  return `hellojourney:trip-draft:${planId ?? `${plan.city}:${plan.start_date}`}`
}

function readDraft(key: string, fallback: TripPlan): TripPlan {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const draft = JSON.parse(raw) as Partial<PersistedDraft>
    return draft.version === 1 && draft.plan?.days ? draft.plan : fallback
  } catch {
    return fallback
  }
}

export function useTripWorkspace(initialPlan: TripPlan, planId?: string) {
  const key = useMemo(() => storageKey(planId, initialPlan), [initialPlan, planId])
  const [state, dispatch] = useReducer(
    workspaceReducer,
    undefined,
    () => createWorkspaceState(readDraft(key, initialPlan)),
  )

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const savedAt = new Date().toISOString()
      const draft: PersistedDraft = { version: 1, savedAt, plan: state.present }
      try {
        localStorage.setItem(key, JSON.stringify(draft))
        dispatch({ type: 'saved', at: savedAt })
      } catch {
        // Storage may be unavailable in private browsing. Editing remains usable in memory.
      }
    }, 350)
    return () => window.clearTimeout(timeout)
  }, [key, state.present])

  return { state, dispatch, canUndo: state.past.length > 0, canRedo: state.future.length > 0 }
}
