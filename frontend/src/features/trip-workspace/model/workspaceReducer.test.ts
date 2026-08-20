import type { Attraction, TripPlan } from '@/types/api'
import { createWorkspaceState, workspaceReducer } from './workspaceReducer'

const attraction = (name: string): Attraction => ({
  name,
  address: `${name}地址`,
  location: { longitude: 116.4, latitude: 39.9 },
  visit_duration: 90,
  description: `${name}介绍`,
  verification_status: 'ai_suggested',
})

const plan: TripPlan = {
  city: '北京',
  cities: ['北京', '天津'],
  start_date: '2026-09-01',
  end_date: '2026-09-02',
  overall_suggestions: '轻装出行',
  weather_info: [],
  days: [
    { date: '2026-09-01', day_index: 0, description: '北京', transportation: '地铁', accommodation: '酒店', attractions: [attraction('故宫'), attraction('景山')], meals: [] },
    { date: '2026-09-02', day_index: 1, description: '天津', transportation: '步行', accommodation: '酒店', attractions: [attraction('五大道')], meals: [] },
  ],
}

describe('workspaceReducer', () => {
  it('edits an attraction without mutating the source plan and supports undo/redo', () => {
    const initial = createWorkspaceState(plan)
    const edited = workspaceReducer(initial, {
      type: 'attraction.update', dayIndex: 0, attractionIndex: 0, patch: { name: '故宫博物院' },
    })

    expect(plan.days[0].attractions[0].name).toBe('故宫')
    expect(edited.present.days[0].attractions[0].name).toBe('故宫博物院')
    const undone = workspaceReducer(edited, { type: 'undo' })
    expect(undone.present.days[0].attractions[0].name).toBe('故宫')
    expect(workspaceReducer(undone, { type: 'redo' }).present.days[0].attractions[0].name).toBe('故宫博物院')
  })

  it('moves an attraction across days', () => {
    const moved = workspaceReducer(createWorkspaceState(plan), {
      type: 'attraction.move', fromDayIndex: 0, attractionIndex: 1, toDayIndex: 1, at: 0,
    })
    expect(moved.present.days[0].attractions.map(({ name }) => name)).toEqual(['故宫'])
    expect(moved.present.days[1].attractions.map(({ name }) => name)).toEqual(['景山', '五大道'])
  })

  it('previews, rejects, and applies an AI change set atomically', () => {
    const initial = createWorkspaceState(plan)
    const previewed = workspaceReducer(initial, {
      type: 'changeset.preview',
      changeSet: {
        id: 'change-1', title: '减少步行', summary: '替换下午景点',
        operations: [
          { type: 'attraction.remove', dayIndex: 0, attractionIndex: 1 },
          { type: 'attraction.add', dayIndex: 0, attraction: attraction('北海公园') },
        ],
      },
    })
    expect(workspaceReducer(previewed, { type: 'changeset.reject' }).present).toEqual(initial.present)

    const applied = workspaceReducer(previewed, { type: 'changeset.apply' })
    expect(applied.present.days[0].attractions.map(({ name }) => name)).toEqual(['故宫', '北海公园'])
    expect(applied.past).toHaveLength(1)
  })

  it('ignores invalid coordinates in an operation instead of crashing', () => {
    const initial = createWorkspaceState(plan)
    const next = workspaceReducer(initial, { type: 'attraction.remove', dayIndex: 99, attractionIndex: 0 })
    expect(next).toBe(initial)
  })
})
