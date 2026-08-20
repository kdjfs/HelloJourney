// otherApi.ts 已拆分，此处保留重新导出以兼容旧引用
// 建议直接使用拆分后的文件：chatApi.ts / poiApi.ts / settingsApi.ts
export { askTripChat } from './chatApi'
export type { AskTripChatPayload } from './chatApi'
export { attractionImageCacheKey, resolveAttractionImage } from './poiApi'
export type { AttractionImageResult, AttractionPhotoResponse } from '../types/api'
export { getBackendRuntimeSettings } from './settingsApi'
export type { BackendRuntimeSettings, LlmProviderStatus, SettingsApiResponse } from './settingsApi'
