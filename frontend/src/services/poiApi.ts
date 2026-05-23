import { apiClient } from './apiClient'

export interface PoiPhotoResponse {
  success: boolean
  message: string
  data: {
    name: string
    photo_url: string
  }
}

export async function getPoiPhoto(name: string, city: string): Promise<string> {
  const res = await apiClient.get<PoiPhotoResponse>('/api/poi/photo', {
    params: { name, city },
  })
  return res.data?.data?.photo_url ?? ''
}