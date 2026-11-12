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

export interface XhsCookieValidation {
  success: boolean
  message?: string
  data?: { valid?: boolean; message?: string }
}

const adminHeaders = (adminToken: string) => ({ 'X-HelloJourney-Admin-Token': adminToken.trim() })

/** 校验一段小红书 Cookie 是否可用（不落库，后端会真实抓一次页面） */
export async function validateXhsCookie(cookie: string, adminToken: string): Promise<XhsCookieValidation> {
  const res = await apiClient.post<XhsCookieValidation>(
    '/api/settings/xhs-cookie/validate',
    { cookie },
    { headers: adminHeaders(adminToken) },
  )
  return res.data
}

/** 保存小红书 Cookie 到后端运行时配置（写文件并立即生效） */
export async function saveXhsCookie(cookie: string, adminToken: string): Promise<SettingsApiResponse> {
  const res = await apiClient.put<SettingsApiResponse>(
    '/api/settings',
    { xhs_cookie: cookie },
    { headers: adminHeaders(adminToken) },
  )
  return res.data
}

export interface LlmModelListResult {
  success: boolean
  message?: string
  data?: {
    base_url?: string
    models: string[]
    count: number
  }
}

/**
 * 拉取 OpenAI 兼容中转站的模型列表。
 * 请求由后端代发：浏览器不持有长期密钥，也不会被中转站的 CORS 拦下。
 */
export async function listLlmModels(
  baseUrl: string,
  apiKey: string,
  adminToken: string,
): Promise<LlmModelListResult> {
  const res = await apiClient.post<LlmModelListResult>(
    '/api/settings/llm/models',
    { base_url: baseUrl.trim(), api_key: apiKey.trim() },
    { headers: adminHeaders(adminToken) },
  )
  return res.data
}

export interface RelayProviderInput {
  key: string
  name: string
  baseUrl: string
  /** 留空表示沿用后端已保存的密钥 */
  apiKey: string
  model: string
}

/** 保存中转站供应商并切换为当前激活项 */
export async function saveRelayProvider(
  input: RelayProviderInput,
  adminToken: string,
): Promise<SettingsApiResponse> {
  const provider: Record<string, string> = {
    key: input.key,
    name: input.name,
    base_url: input.baseUrl.trim(),
    model: input.model,
  }
  if (input.apiKey.trim()) provider.api_key = input.apiKey.trim()

  const res = await apiClient.put<SettingsApiResponse>(
    '/api/settings',
    { llm_active_provider: input.key, llm_providers: [provider] },
    { headers: adminHeaders(adminToken) },
  )
  return res.data
}
