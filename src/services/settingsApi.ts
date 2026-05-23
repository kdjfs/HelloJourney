import { apiClient } from './apiClient'

export interface BackendRuntimeSettings {
  vite_amap_web_key: string
  vite_amap_web_js_key: string
  google_maps_api_key: string
  google_maps_proxy: string
  xhs_cookie: string
  openai_api_key: string
  openai_base_url: string
  openai_model: string
}

export interface SettingsApiResponse {
  success: boolean
  message?: string
  data?: Partial<BackendRuntimeSettings>
}

export async function getBackendRuntimeSettings(): Promise<Partial<BackendRuntimeSettings> | undefined> {
  const res = await apiClient.get<SettingsApiResponse>('/api/settings')
  return res.data.data
}

export async function updateBackendRuntimeSettings(
  updates: Partial<BackendRuntimeSettings>
): Promise<Partial<BackendRuntimeSettings> | undefined> {
  const res = await apiClient.put<SettingsApiResponse>('/api/settings', updates)
  return res.data.data
}