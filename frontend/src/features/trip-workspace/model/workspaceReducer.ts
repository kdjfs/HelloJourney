import type { Attraction, DayPlan, Hotel, TripPlan } from '@/types/api'

export type TripChangeOperation =
  | { type: 'attraction.add'; dayIndex: number; attraction: Attraction; at?: number }
  | { type: 'attraction.remove'; dayIndex: number; attractionIndex: number }
  | { type: 'attraction.update'; dayIndex: number; attractionIndex: number; patch: Partial<Attraction> }
  | { type: 'attraction.move'; fromDayIndex: number; attractionIndex: number; toDayIndex: number; at?: number }
  | { type: 'hotel.update'; dayIndex: number; patch: Partial<Hotel> }
  | { type: 'day.update'; dayIndex: number; patch: Partial<Omit<DayPlan, 'attractions' | 'meals'>> }

export interface TripChangeSet {
  id: string
  title: string
  summary: string
  operations: TripChangeOperation[]
}

export interface WorkspaceState {
  past: TripPlan[]
  present: TripPlan
  future: TripPlan[]
  pendingChangeSet?: TripChangeSet
  lastSavedAt?: string
}

export type WorkspaceAction =
  | { type: 'replace'; plan: TripPlan }
  | { type: 'attraction.add'; dayIndex: number; attraction: Attraction; at?: number }
  | { type: 'attraction.remove'; dayIndex: number; attractionIndex: number }
  | { type: 'attraction.update'; dayIndex: number; attractionIndex: number; patch: Partial<Attraction> }
  | { type: 'attraction.move'; fromDayIndex: number; attractionIndex: number; toDayIndex: number; at?: number }
  | { type: 'hotel.update'; dayIndex: number; patch: Partial<Hotel> }
  | { type: 'day.update'; dayIndex: number; patch: Partial<Omit<DayPlan, 'attractions' | 'meals'>> }
  | { type: 'changeset.preview'; changeSet: TripChangeSet }
  | { type: 'changeset.apply' }
  | { type: 'changeset.reject' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'saved'; at: string }

const MAX_HISTORY = 50

const copy = <T,>(value: T): T => structuredClone(value)

export function createWorkspaceState(plan: TripPlan): WorkspaceState {
  return { past: [], present: copy(plan), future: [] }
}

function validDay(plan: TripPlan, index: number) {
  return Number.isInteger(index) && index >= 0 && index < plan.days.length
}

function applyOperation(plan: TripPlan, operation: TripChangeOperation): boolean {
  if (operation.type === 'attraction.add') {
    if (!validDay(plan, operation.dayIndex)) return false
    const attractions = plan.days[operation.dayIndex].attractions
    const at = operation.at === undefined ? attractions.length : Math.max(0, Math.min(operation.at, attractions.length))
    attractions.splice(at, 0, copy(operation.attraction))
    return true
  }

  if (operation.type === 'attraction.remove') {
    if (!validDay(plan, operation.dayIndex)) return false
    const attractions = plan.days[operation.dayIndex].attractions
    if (operation.attractionIndex < 0 || operation.attractionIndex >= attractions.length) return false
    attractions.splice(operation.attractionIndex, 1)
    return true
  }

  if (operation.type === 'attraction.update') {
    if (!validDay(plan, operation.dayIndex)) return false
    const attraction = plan.days[operation.dayIndex].attractions[operation.attractionIndex]
    if (!attraction) return false
    Object.assign(attraction, copy(operation.patch))
    return true
  }

  if (operation.type === 'attraction.move') {
    if (!validDay(plan, operation.fromDayIndex) || !validDay(plan, operation.toDayIndex)) return false
    const source = plan.days[operation.fromDayIndex].attractions
    if (operation.attractionIndex < 0 || operation.attractionIndex >= source.length) return false
    const [attraction] = source.splice(operation.attractionIndex, 1)
    const target = plan.days[operation.toDayIndex].attractions
    const defaultIndex = operation.fromDayIndex === operation.toDayIndex ? operation.attractionIndex : target.length
    const at = operation.at === undefined ? defaultIndex : Math.max(0, Math.min(operation.at, target.length))
    target.splice(at, 0, attraction)
    return true
  }

  if (operation.type === 'hotel.update') {
    if (!validDay(plan, operation.dayIndex)) return false
    const day = plan.days[operation.dayIndex]
    if (!day.hotel) return false
    Object.assign(day.hotel, copy(operation.patch))
    return true
  }

  if (!validDay(plan, operation.dayIndex)) return false
  Object.assign(plan.days[operation.dayIndex], copy(operation.patch))
  return true
}

function commit(state: WorkspaceState, operations: TripChangeOperation[]): WorkspaceState {
  const next = copy(state.present)
  const changed = operations.reduce((didChange, operation) => applyOperation(next, operation) || didChange, false)
  if (!changed) return state
  return {
    ...state,
    past: [...state.past, state.present].slice(-MAX_HISTORY),
    present: next,
    future: [],
    pendingChangeSet: undefined,
  }
}

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case 'replace':
      return createWorkspaceState(action.plan)
    case 'undo': {
      const previous = state.past.at(-1)
      if (!previous) return state
      return {
        ...state,
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
        pendingChangeSet: undefined,
      }
    }
    case 'redo': {
      const next = state.future[0]
      if (!next) return state
      return {
        ...state,
        past: [...state.past, state.present].slice(-MAX_HISTORY),
        present: next,
        future: state.future.slice(1),
        pendingChangeSet: undefined,
      }
    }
    case 'changeset.preview':
      return { ...state, pendingChangeSet: copy(action.changeSet) }
    case 'changeset.reject':
      return { ...state, pendingChangeSet: undefined }
    case 'changeset.apply':
      return state.pendingChangeSet ? commit(state, state.pendingChangeSet.operations) : state
    case 'saved':
      return { ...state, lastSavedAt: action.at }
    default:
      return commit(state, [action])
  }
}
