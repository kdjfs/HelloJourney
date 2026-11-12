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

/**
 * 默认推荐模型。
 *
 * 计划生成要求「一次输出整份 JSON 并通过 schema 校验」，小模型（4B/7B）几乎每次都要
 * 修三轮以上、单次上百秒，最终仍然超时。这里按"指令遵循 + JSON 稳定性 + 速度"排序，
 * 优先选中真正能一次跑通规划的模型；用户仍然可以自己改。
 */
const PREFERRED_MODEL_PATTERNS: RegExp[] = [
  /deepseek-ai\/deepseek-v3/i,
  /deepseek-ai\/deepseek-v3\.2/i,
  /Qwen\/Qwen3\.5-(235B|122B|35B)/i,
  /Qwen\/Qwen3-(235B|32B)/i,
  /Qwen\/Qwen2\.5-72B/i,
  /deepseek-ai\/deepseek-v4/i,
  /glm-4/i,
  /moonshotai\/kimi/i,
  /deepseek-ai\/deepseek-r1/i,
]

export function pickPreferredModel(modelIds: string[]): string | undefined {
  for (const pattern of PREFERRED_MODEL_PATTERNS) {
    const match = modelIds.find((id) => pattern.test(id))
    if (match) return match
  }
  return modelIds[0]
}
