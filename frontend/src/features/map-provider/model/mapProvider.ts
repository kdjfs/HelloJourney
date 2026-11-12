import { useSyncExternalStore } from 'react'
import { getAmapWebJsKey, getGoogleMapsJsKey } from '@/utils/env'

/**
 * 「用哪家地图当底图」是**每个浏览器用户自己的偏好**，不是部署级配置。
 *
 * 所以它存在 localStorage 里，而不是后端：谁都能自己切，切换立即生效，
 * 不需要管理员令牌，也不会因为某个用户的选择影响别人。
 * （服务端用哪家地图取 POI/路线，是另一回事，见 MapDispatcher。）
 */
export const MAP_PROVIDERS = ['amap', 'google'] as const
export type MapProvider = typeof MAP_PROVIDERS[number]

export const MAP_PROVIDER_STORAGE_KEY = 'hj.map.provider'
export const DEFAULT_MAP_PROVIDER: MapProvider = 'amap'

export function normalizeMapProvider(value?: string | null): MapProvider {
  return MAP_PROVIDERS.includes(value as MapProvider)
    ? value as MapProvider
    : DEFAULT_MAP_PROVIDER
}

/**
 * 这个提供方在当前构建里是否可用。
 *
 * 判断依据是**浏览器端** Key 在不在（VITE_* 构建时内联）：
 * 底图是浏览器直接问地图厂商要的，和服务端有没有配服务端 Key 无关。
 */
export function isMapProviderReady(provider: MapProvider): boolean {
  switch (provider) {
    case 'google':
      return Boolean(getGoogleMapsJsKey())
    case 'amap':
    default:
      return Boolean(getAmapWebJsKey())
  }
}

/** 用户真正选过的值（没选过或存储被禁用时给默认值）。 */
export function readStoredMapProvider(): MapProvider {
  return readStoredChoice() ?? DEFAULT_MAP_PROVIDER
}

/** 用户选过的值；返回 null 表示「从没选过」，要和「选的是默认值」区分开。 */
function readStoredChoice(): MapProvider | null {
  try {
    const raw = localStorage.getItem(MAP_PROVIDER_STORAGE_KEY)
    if (raw === null) return null
    return MAP_PROVIDERS.includes(raw as MapProvider) ? raw as MapProvider : null
  } catch {
    return null
  }
}

/**
 * 实际生效的底图。
 *
 * 分两种情况，差别很重要：
 *  - 用户明确选过 → 就用他选的，哪怕这个构建里没配对应的 Key。此时地图区域会
 *    显示一张说明卡，明确告诉他是缺了哪把 Key；偷偷换成另一家会让人以为
 *    「点了没反应」，比报错更难查。
 *  - 从没选过 → 挑第一家可用的（比如构建里只有 Google Key 就直接用 Google），
 *    一家都没有就落到默认值，让兜底卡片说明情况。
 */
export function resolveMapProvider(): MapProvider {
  const chosen = readStoredChoice()
  if (chosen) return chosen
  return MAP_PROVIDERS.find((provider) => isMapProviderReady(provider)) ?? DEFAULT_MAP_PROVIDER
}

const listeners = new Set<() => void>()

function notify(): void {
  listeners.forEach((listener) => listener())
}

export function writeMapProvider(provider: MapProvider): void {
  const next = normalizeMapProvider(provider)
  try {
    localStorage.setItem(MAP_PROVIDER_STORAGE_KEY, next)
  } catch {
    // 隐私模式 / 存储配额不足：本次切换不落盘，下次打开回到默认值
  }
  notify()
}

export function subscribeMapProvider(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// 同一浏览器的另一个标签页改了选择，这里也要跟着变
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === null || event.key === MAP_PROVIDER_STORAGE_KEY) notify()
  })
}

/** 订阅当前生效的底图；设置页里切换后，结果页的地图会立刻重建。 */
export function useMapProvider(): MapProvider {
  return useSyncExternalStore(subscribeMapProvider, resolveMapProvider, () => DEFAULT_MAP_PROVIDER)
}
