const DEFAULT_BASE_URL = 'http://127.0.0.1:8000'

function getBaseUrl(): string {
  const stored = uni.getStorageSync('API_BASE_URL')
  if (stored && typeof stored === 'string' && stored.trim()) {
    return stored.trim().replace(/\/+$/, '')
  }
  return DEFAULT_BASE_URL
}

interface RequestOptions {
  url: string
  data?: any
  header?: Record<string, string>
}

function request<T>(method: 'GET' | 'POST' | 'PUT', options: RequestOptions): Promise<T> {
  const baseUrl = getBaseUrl()
  const fullUrl = `${baseUrl}${options.url}`

  return new Promise<T>((resolve, reject) => {
    uni.request({
      url: fullUrl,
      method,
      data: options.data,
      header: {
        'Content-Type': 'application/json',
        ...options.header,
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data as T)
        } else {
          const errMsg = `请求失败: ${res.statusCode}`
          uni.showToast({ title: errMsg, icon: 'none', duration: 2000 })
          reject(new Error(errMsg))
        }
      },
      fail: (err) => {
        const errMsg = err.errMsg || '网络请求失败'
        uni.showToast({ title: errMsg, icon: 'none', duration: 2000 })
        reject(new Error(errMsg))
      },
    })
  })
}

export function get<T>(url: string, data?: any, header?: Record<string, string>): Promise<T> {
  return request<T>('GET', { url, data, header })
}

export function post<T>(url: string, data?: any, header?: Record<string, string>): Promise<T> {
  return request<T>('POST', { url, data, header })
}

export function put<T>(url: string, data?: any, header?: Record<string, string>): Promise<T> {
  return request<T>('PUT', { url, data, header })
}

export { getBaseUrl }
