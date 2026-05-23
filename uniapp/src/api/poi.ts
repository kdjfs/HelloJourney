import { get } from '@/utils/http'

export interface PoiPhotoResult {
  name: string
  photo_url: string
}

export interface PoiPhotoResponse {
  success: boolean
  message: string
  data: PoiPhotoResult
}

export function getPoiPhoto(name: string, city?: string): Promise<PoiPhotoResult> {
  const params: Record<string, string> = { name }
  if (city) params.city = city
  return get<PoiPhotoResponse>('/api/poi/photo', params).then((res) => res.data)
}
