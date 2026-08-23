import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from './apiClient'
import { attractionImageCacheKey, resolveAttractionImage } from './poiApi'

vi.mock('./apiClient', () => ({
  apiClient: { get: vi.fn() },
}))

describe('resolveAttractionImage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends city, attraction name, and POI identity to the resolver', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        success: true,
        message: '获取图片成功',
        data: {
          imageUrl: 'https://aos-cdn-image.amap.com/guangzhou-tower.jpg',
          provider: 'amap',
          matchedName: '广州塔',
          matchedPoiId: 'B00140TY2A',
          confidence: 1,
          verified: true,
        },
      },
    })

    const result = await resolveAttractionImage('广州塔', '广州', 'B00140TY2A')

    expect(apiClient.get).toHaveBeenCalledWith('/api/poi/photo', {
      params: { name: '广州塔', city: '广州', poiId: 'B00140TY2A' },
    })
    expect(result.verified).toBe(true)
    expect(result.matchedName).toBe('广州塔')
  })

  it('uses city and attraction name as a stable local lookup key', () => {
    expect(attractionImageCacheKey(' 广州 ', '广州 塔')).toBe('广州::广州塔')
  })
})
