import { apiClient } from './apiClient'
import type { AttractionImageResult, AttractionPhotoResponse } from '../types/api'

const emptyImageResult: AttractionImageResult = {
  imageUrl: '',
  provider: 'none',
  matchedName: '',
  matchedPoiId: '',
  confidence: 0,
  verified: false,
}

/** 会话级图片缓存：同一行程反复进出结果页时不再重复请求 /api/poi/photo */
const STORAGE_KEY = 'hj.poiImageCache.v1'
const MAX_PERSISTED = 120

const memoryCache = new Map<string, AttractionImageResult>()
const inflight = new Map<string, Promise<AttractionImageResult>>()
let hydrated = false

export function attractionImageCacheKey(city: string, attractionName: string): string {
  const normalize = (value: string) => value.trim().toLocaleLowerCase().replace(/[\p{P}\p{Z}\s]/gu, '')
  return `${normalize(city)}::${normalize(attractionName)}`
}

function hydrate(): void {
  if (hydrated) return
  hydrated = true
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Record<string, AttractionImageResult>
    for (const [key, value] of Object.entries(parsed)) {
      if (value && typeof value.imageUrl === 'string') memoryCache.set(key, value)
    }
  } catch {
    // 隐私模式 / 配额不足：退化为纯内存缓存
  }
}

function persist(key: string, result: AttractionImageResult): void {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) as Record<string, AttractionImageResult> : {}
    parsed[key] = result
    const keys = Object.keys(parsed)
    if (keys.length > MAX_PERSISTED) {
      for (const stale of keys.slice(0, keys.length - MAX_PERSISTED)) delete parsed[stale]
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
  } catch {
    // 缓存写失败不影响主流程
  }
}

export async function resolveAttractionImage(
  attractionName: string,
  city: string,
  poiId?: string,
): Promise<AttractionImageResult> {
  hydrate()
  const key = attractionImageCacheKey(city, attractionName)

  const cached = memoryCache.get(key)
  if (cached) return cached

  const pending = inflight.get(key)
  if (pending) return pending

  const task = (async () => {
    try {
      const res = await apiClient.get<AttractionPhotoResponse>('/api/poi/photo', {
        params: { name: attractionName, city, poiId },
      })
      const result = res.data?.data ?? emptyImageResult
      memoryCache.set(key, result)
      // 只持久化「确实有图」的结果，未命中留给服务端 10 分钟缓存
      if (result.verified && result.imageUrl) persist(key, result)
      return result
    } finally {
      inflight.delete(key)
    }
  })()

  inflight.set(key, task)
  return task
}
