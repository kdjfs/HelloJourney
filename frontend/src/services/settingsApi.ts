import { apiClient } from './apiClient'
import type { BackendRuntimeSettings } from '../types/api'
export type { BackendRuntimeSettings, LlmProviderStatus } from '../types/api'

export interface SettingsApiResponse {
  success: boolean
  message?: string
  data?: Partial<BackendRuntimeSettings>
}

export async function getBackendRuntimeSettings(): Promise<Partial<BackendRuntimeSettings> | undefined> {
  const res = await apiClient.get<SettingsApiResponse>('/api/settings')
  return res.data.data
}
