import { get, put } from '@/utils/http'
import type { RuntimeSettings, RuntimeSettingsPayload, LlmProviderInfo } from '@/types/api'

interface SettingsApiResponse {
  success: boolean
  message: string
  data: RuntimeSettings
}

interface LlmProvidersResponse {
  success: boolean
  message: string
  data: {
    active_provider: string
    providers: LlmProviderInfo[]
  }
}

export function getSettings(): Promise<RuntimeSettings> {
  return get<SettingsApiResponse>('/api/settings').then((res) => res.data)
}

export function updateSettings(data: RuntimeSettingsPayload): Promise<RuntimeSettings> {
  return put<SettingsApiResponse>('/api/settings', data).then((res) => res.data)
}

export function getLlmProviders(): Promise<{ active_provider: string; providers: LlmProviderInfo[] }> {
  return get<LlmProvidersResponse>('/api/settings/llm-providers').then((res) => res.data)
}
