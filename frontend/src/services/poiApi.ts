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

export function attractionImageCacheKey(city: string, attractionName: string): string {
  const normalize = (value: string) => value.trim().toLocaleLowerCase().replace(/[\p{P}\p{Z}\s]/gu, '')
  return `${normalize(city)}::${normalize(attractionName)}`
}

export async function resolveAttractionImage(
  attractionName: string,
  city: string,
  poiId?: string,
): Promise<AttractionImageResult> {
  const res = await apiClient.get<AttractionPhotoResponse>('/api/poi/photo', {
    params: { name: attractionName, city, poiId },
  })
  return res.data?.data ?? emptyImageResult
}
