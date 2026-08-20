import { get } from '@/utils/http'

export interface PoiPhotoResult {
  imageUrl: string
  provider: string
  matchedName: string
  matchedPoiId: string
  confidence: number
  verified: boolean
}

export interface PoiPhotoResponse {
  success: boolean
  message: string
  data: PoiPhotoResult
}

export function getPoiPhoto(name: string, city: string, poiId?: string): Promise<PoiPhotoResult> {
  const params: Record<string, string> = { name, city }
  if (poiId) params.poiId = poiId
  return get<PoiPhotoResponse>('/api/poi/photo', params).then((res) => res.data)
}
