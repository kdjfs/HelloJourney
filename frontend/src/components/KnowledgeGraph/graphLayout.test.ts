import { describe, expect, it, vi } from 'vitest'
import type { GraphNode } from '@/types/api'
import {
  filterPositions,
  layoutStorageKey,
  readStoredPositions,
  storePositions,
} from './graphLayout'

function node(id: string, category = 0): GraphNode {
  return { id, name: id, category, symbol_size: 30 } as unknown as GraphNode
}

describe('graphLayout', () => {
  it('keys storage by city, day count and node count', () => {
    const nodes = [node('a')]
    const plan = { city: '北京', days: [{}, {}] } as never
    expect(layoutStorageKey(nodes, plan)).toContain('北京:2:1')
    expect(layoutStorageKey(nodes, null)).toContain(':0:1')
  })

  it('keeps dragged positions for current nodes only', () => {
    const nodes = [node('a'), node('b')]
    const filtered = filterPositions({ a: { x: 10, y: 20 }, stale: { x: 1, y: 1 } }, nodes)

    expect(filtered).toEqual({ a: { x: 10, y: 20 } })
    expect(filtered.stale).toBeUndefined()
  })

  it('drops non-finite coordinates', () => {
    const nodes = [node('a'), node('b')]
    const filtered = filterPositions(
      { a: { x: Number.NaN, y: 1 }, b: { x: 3, y: 4 } },
      nodes,
    )
    expect(filtered).toEqual({ b: { x: 3, y: 4 } })
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
