import { apiClient } from './apiClient'

export interface BackendRuntimeSettings {
  tencent_maps_configured: boolean
  google_maps_configured: boolean
  xhs_configured: boolean
  llm_active_provider: string
  llm_providers: LlmProviderStatus[]
}

export interface LlmProviderStatus {
  key: string
  name: string
  model: string
  configured: boolean
  active: boolean
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
