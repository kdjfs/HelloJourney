import type { GraphNode, TripPlan } from '@/types/api'

export const LAYOUT_WIDTH = 1180
export const LAYOUT_HEIGHT = 660

export interface NodePosition {
  x: number
  y: number
}

/**
 * 初始布局：按类别分列、列内均分。
 *
 * 力导向布局每次重算都不一样，用户拖动后也无法保留，所以这里自己算坐标，
 * 用 `layout: 'none'` 渲染 —— 位置完全可控，拖动后写回即可持久。
 */
export function buildInitialPositions(nodes: GraphNode[]): Record<string, NodePosition> {
  const byCategory = new Map<number, GraphNode[]>()
  for (const node of nodes) {
    const list = byCategory.get(node.category) ?? []
    list.push(node)
    byCategory.set(node.category, list)
  }
  const categoryKeys = [...byCategory.keys()].sort((a, b) => a - b)
  const positions: Record<string, NodePosition> = {}
  categoryKeys.forEach((category, columnIndex) => {
    const column = byCategory.get(category) ?? []
    const x = categoryKeys.length === 1
      ? LAYOUT_WIDTH / 2
      : 90 + ((LAYOUT_WIDTH - 180) * columnIndex) / (categoryKeys.length - 1)
    column.forEach((node, rowIndex) => {
      const y = column.length === 1
        ? LAYOUT_HEIGHT / 2
        : 70 + ((LAYOUT_HEIGHT - 140) * rowIndex) / (column.length - 1)
      positions[node.id] = { x, y }
    })
  })
  return positions
}

/** 位置按"城市 + 天数 + 节点数"区分计划，换计划不会串用旧坐标 */
export function layoutStorageKey(nodes: GraphNode[], tripPlan?: TripPlan | null): string {
  const city = tripPlan?.city ?? ''
  const days = tripPlan?.days?.length ?? 0
  return `hj.graphLayout.v1:${city}:${days}:${nodes.length}`
}

export function readStoredPositions(key: string): Record<string, NodePosition> {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, NodePosition>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function storePositions(key: string, positions: Record<string, NodePosition>): void {
  try {
    localStorage.setItem(key, JSON.stringify(positions))
  } catch {
    // 隐私模式下忽略
  }
}

/** 合并默认布局与拖动结果，只接受当前图里存在的节点 */
export function mergePositions(
  base: Record<string, NodePosition>,
  dragged: Record<string, NodePosition>,
): Record<string, NodePosition> {
  const merged: Record<string, NodePosition> = { ...base }
  for (const [id, position] of Object.entries(dragged)) {
    if (merged[id]) merged[id] = position
  }
  return merged
}
