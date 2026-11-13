import { describe, expect, it, vi } from 'vitest'
import type { GraphNode } from '@/types/api'
import {
  LAYOUT_HEIGHT,
  LAYOUT_WIDTH,
  buildInitialPositions,
  layoutStorageKey,
  mergePositions,
  readStoredPositions,
  storePositions,
} from './graphLayout'

function node(id: string, category: number): GraphNode {
  return { id, name: id, category, symbol_size: 30 } as unknown as GraphNode
}

describe('graphLayout', () => {
  it('lays categories out in columns and spreads each column vertically', () => {
    const nodes = [node('city', 0), node('d1', 1), node('d2', 1), node('d3', 1), node('a1', 2), node('a2', 2)]
    const positions = buildInitialPositions(nodes)

    // 每个类别一列：x 互不相同且递增
    const xs = ['city', 'd1', 'a1'].map((id) => positions[id].x)
    expect(new Set(xs).size).toBe(3)
    expect(xs[0]).toBeLessThan(xs[1])
    expect(xs[1]).toBeLessThan(xs[2])

    // 同一列共享 x，纵向均分且不重叠
    expect(positions.d1.x).toBe(positions.d2.x)
    expect(positions.d1.y).toBeLessThan(positions.d2.y)
    expect(positions.d2.y).toBeLessThan(positions.d3.y)
    expect(positions.d3.y).toBeLessThanOrEqual(LAYOUT_HEIGHT)

    for (const position of Object.values(positions)) {
      expect(position.x).toBeGreaterThanOrEqual(0)
      expect(position.x).toBeLessThanOrEqual(LAYOUT_WIDTH)
    }
  })

  it('centres a single category', () => {
    const positions = buildInitialPositions([node('only', 0)])
    expect(positions.only.x).toBe(LAYOUT_WIDTH / 2)
    expect(positions.only.y).toBe(LAYOUT_HEIGHT / 2)
  })

  it('keeps dragged positions and ignores nodes from another plan', () => {
    const base = { a: { x: 1, y: 1 }, b: { x: 2, y: 2 } }
    const merged = mergePositions(base, { a: { x: 99, y: 99 }, stale: { x: 5, y: 5 } })

    expect(merged.a).toEqual({ x: 99, y: 99 })
    expect(merged.b).toEqual({ x: 2, y: 2 })
    expect(merged.stale).toBeUndefined()
  })

  it('keys storage by city, day count and node count', () => {
    const nodes = [node('a', 0)]
    const plan = { city: '北京', days: [{}, {}] } as never
    expect(layoutStorageKey(nodes, plan)).toContain('北京:2:1')
    expect(layoutStorageKey(nodes, null)).toContain(':0:1')
  })

  it('round-trips positions through storage and survives broken json', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    })

    storePositions('k', { a: { x: 10, y: 20 } })
    expect(readStoredPositions('k')).toEqual({ a: { x: 10, y: 20 } })

    store.set('broken', '{oops')
    expect(readStoredPositions('broken')).toEqual({})
    vi.unstubAllGlobals()
  })
})
