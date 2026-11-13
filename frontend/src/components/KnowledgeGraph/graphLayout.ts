import type { GraphEdge, GraphNode, TripPlan } from '@/types/api'

export interface NodePosition {
  x: number
  y: number
}

/** 布局画布尺寸（与 GRAPH_HEIGHT 成比例，渲染时由 ECharts 自适应缩放） */
export const LAYOUT_WIDTH = 1120
export const LAYOUT_HEIGHT = 620

/** 稳定的伪随机：同一个节点每次打开都得到同一份布局，不会"每次刷新都不一样" */
function hashNoise(id: string, salt: number): number {
  let hash = 2166136261 ^ salt
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  // 取 [0,1)
  return ((hash >>> 0) % 1000) / 1000
}

/**
 * 自带的力导向布局。
 *
 * 之前直接用力导向（layout: 'force'）时，节点坐标只存在于 ECharts 内部，
 * 拖动结束后拿不到"松手后的位置"，所以记不住。这里自己在像素空间里迭代弹簧模型：
 * 观感与力导向一致，但坐标是我们自己的，拖动后写回即可持久。
 */
export function simulateLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  iterations = 420,
): Record<string, NodePosition> {
  if (nodes.length === 0) return {}

  const ids = new Map(nodes.map((node) => [node.id, node]))
  const positions: Record<string, NodePosition> = {}
  const velocities: Record<string, NodePosition> = {}

  // 初始：按类别分列 + 稳定抖动，让边有东西可拉
  const byCategory = new Map<number, GraphNode[]>()
  for (const node of nodes) {
    const list = byCategory.get(node.category) ?? []
    list.push(node)
    byCategory.set(node.category, list)
  }
  const categoryKeys = [...byCategory.keys()].sort((a, b) => a - b)
  categoryKeys.forEach((category, columnIndex) => {
    const column = byCategory.get(category) ?? []
    const columnX = categoryKeys.length === 1
      ? LAYOUT_WIDTH / 2
      : 90 + ((LAYOUT_WIDTH - 180) * columnIndex) / (categoryKeys.length - 1)
    column.forEach((node) => {
      positions[node.id] = {
        x: columnX + (hashNoise(node.id, 1) - 0.5) * 90,
        y: LAYOUT_HEIGHT / 2 + (hashNoise(node.id, 2) - 0.5) * LAYOUT_HEIGHT * 0.8,
      }
      velocities[node.id] = { x: 0, y: 0 }
    })
  })

  // 边只保留两端都存在的，端点可能是 id 也可能是名字
  const byName = new Map(nodes.map((node) => [node.name, node]))
  const links: Array<[string, string]> = []
  for (const edge of edges) {
    const source = ids.get(edge.source)?.id ?? byName.get(edge.source)?.id
    const target = ids.get(edge.target)?.id ?? byName.get(edge.target)?.id
    if (source && target && source !== target) links.push([source, target])
  }

  const idList = nodes.map((node) => node.id)
  const repulsion = 95000
  const springLength = 215
  const springStrength = 0.02
  const centerPull = 0.012
  const minDistance = 96

  for (let step = 0; step < iterations; step += 1) {
    // 斥力：所有节点两两相斥
    for (let i = 0; i < idList.length; i += 1) {
      const a = positions[idList[i]]
      for (let j = i + 1; j < idList.length; j += 1) {
        const b = positions[idList[j]]
        let dx = a.x - b.x
        let dy = a.y - b.y
        let distanceSq = dx * dx + dy * dy
        if (distanceSq < 1) {
          dx = (hashNoise(idList[i], 3) - 0.5) * 2
          dy = (hashNoise(idList[j], 4) - 0.5) * 2
          distanceSq = dx * dx + dy * dy + 0.01
        }
        const distance = Math.sqrt(distanceSq)
        // 近距离额外加一道"硬推开"，避免圆点互相压住
        const extra = distance < minDistance ? (minDistance - distance) * 0.9 : 0
        const force = repulsion / distanceSq + extra
        const fx = (dx / distance) * force
        const fy = (dy / distance) * force
        velocities[idList[i]].x += fx
        velocities[idList[i]].y += fy
        velocities[idList[j]].x -= fx
        velocities[idList[j]].y -= fy
      }
    }

    // 弹簧：边两端互相吸引到理想长度
    for (const [source, target] of links) {
      const a = positions[source]
      const b = positions[target]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const distance = Math.hypot(dx, dy) || 0.01
      const stretch = (distance - springLength) * springStrength
      const fx = (dx / distance) * stretch
      const fy = (dy / distance) * stretch
      velocities[source].x += fx
      velocities[source].y += fy
      velocities[target].x -= fx
      velocities[target].y -= fy
    }

    // 向心力 + 位移（阻尼随迭代衰减，最后稳定下来）
    const damping = 0.82 - (step / iterations) * 0.3
    for (const id of idList) {
      const position = positions[id]
      const velocity = velocities[id]
      velocity.x += (LAYOUT_WIDTH / 2 - position.x) * centerPull
      velocity.y += (LAYOUT_HEIGHT / 2 - position.y) * centerPull
      position.x += velocity.x * damping
      position.y += velocity.y * damping
      velocity.x *= 0.5
      velocity.y *= 0.5
    }
  }

  // 收尾：把整张图等比缩放进画布。
  // 不要在迭代里硬夹边界 —— 被挤到边界上的节点会排成一条直线，标签全叠在一起。
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const id of idList) {
    const position = positions[id]
    minX = Math.min(minX, position.x)
    maxX = Math.max(maxX, position.x)
    minY = Math.min(minY, position.y)
    maxY = Math.max(maxY, position.y)
  }
  const spanX = Math.max(maxX - minX, 1)
  const spanY = Math.max(maxY - minY, 1)
  const paddingX = 110
  const paddingY = 70
  const scale = Math.min(
    (LAYOUT_WIDTH - paddingX * 2) / spanX,
    (LAYOUT_HEIGHT - paddingY * 2) / spanY,
  )
  const offsetX = (LAYOUT_WIDTH - spanX * scale) / 2
  const offsetY = (LAYOUT_HEIGHT - spanY * scale) / 2
  for (const id of idList) {
    positions[id] = {
      x: offsetX + (positions[id].x - minX) * scale,
      y: offsetY + (positions[id].y - minY) * scale,
    }
  }

  return positions
}

/**
 * 位置按"城市 + 天数 + 节点数"区分计划，换计划不会串用旧坐标。
 */
export function layoutStorageKey(nodes: GraphNode[], tripPlan?: TripPlan | null): string {
  const city = tripPlan?.city ?? ''
  const days = tripPlan?.days?.length ?? 0
  return `hj.graphLayout.v2:${city}:${days}:${nodes.length}`
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

/** 只保留当前图里真实存在的节点，避免旧计划的位置污染新图 */
export function filterPositions(
  positions: Record<string, NodePosition>,
  nodes: GraphNode[],
): Record<string, NodePosition> {
  const known = new Set(nodes.map((node) => node.id))
  const result: Record<string, NodePosition> = {}
  for (const [id, position] of Object.entries(positions)) {
    if (known.has(id) && Number.isFinite(position?.x) && Number.isFinite(position?.y)) {
      result[id] = { x: position.x, y: position.y }
    }
  }
  return result
}

/** 模拟结果 + 用户拖动结果，后者优先 */
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
