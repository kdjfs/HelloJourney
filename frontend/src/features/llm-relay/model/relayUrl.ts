/**
 * 纠正常见的中转站地址填错。
 *
 * 用户最容易踩的三个坑：
 * 1. 把**控制台网页**地址填进来（`cloud.siliconflow.cn`），API 其实在 `api.siliconflow.cn`；
 * 2. 末尾多写了 `/chat/completions` 或 `/models`，拼路径时会重复；
 * 3. 只写到域名，少了 `/v1`。
 */
export function normalizeRelayBaseUrl(raw: string): string {
  let value = (raw || '').trim().replace(/\/+$/, '')
  value = value.replace(/\/chat\/completions$/i, '').replace(/\/models$/i, '')
  value = value.replace(/\/+$/, '')
  if (/\/\/cloud\.siliconflow\.cn/i.test(value)) {
    value = value.replace(/\/\/cloud\.siliconflow\.cn/i, '//api.siliconflow.cn')
  }
  if (/\/\/api\.siliconflow\.cn$/i.test(value)) {
    value += '/v1'
  }
  return value
}
