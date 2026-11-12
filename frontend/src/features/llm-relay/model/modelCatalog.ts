/**
 * 中转站的模型列表里混着好几类东西：对话模型、向量(embedding)、重排(rerank)、
 * 语音(tts/asr)、绘画(diffusion)。后几类拿来做行程规划一定会报错，
 * 所以这里按家族名过滤，只把"能对话"的留给用户选。
 */
const NON_CHAT_PATTERNS: RegExp[] = [
  /(^|[/_-])(bge|gte|m3e|text-embedding|embedding|embed)([/_-]|$)/i,
  /rerank/i,
  /whisper|sensevoice|cosyvoice|tts|asr|speech/i,
  /stable-diffusion|sdxl|sd3|flux|kolors|seedream|seededit|wanx|dall-e|midjourney/i,
  /bge-large|bge-base|bge-small/i,
]

export function isChatCapableModel(modelId: string): boolean {
  const id = (modelId || '').trim()
  if (!id) return false
  return !NON_CHAT_PATTERNS.some((pattern) => pattern.test(id))
}

export function filterChatModels(modelIds: string[]): string[] {
  return modelIds.filter(isChatCapableModel)
}
