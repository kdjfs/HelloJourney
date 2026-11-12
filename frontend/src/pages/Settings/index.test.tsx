import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, vi } from 'vitest'
import { MAP_PROVIDER_STORAGE_KEY } from '@/features/map-provider/model/mapProvider'
import Settings from './index'

vi.mock('@/services/settingsApi', () => ({
  getBackendRuntimeSettings: vi.fn().mockResolvedValue({
    tencent_maps_configured: true,
    google_maps_configured: false,
    xhs_configured: false,
    llm_active_provider: 'deepseek',
    llm_providers: [
      { key: 'deepseek', name: 'DeepSeek', model: 'deepseek-chat', configured: true, active: true },
      { key: 'openai', name: 'OpenAI', model: 'gpt-5', configured: false, active: false },
    ],
  }),
  validateXhsCookie: vi.fn(),
  saveXhsCookie: vi.fn(),
}))

describe('Settings page', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllEnvs()
  })

  it('renders backend configuration status without leaking any secret', async () => {
    render(<MemoryRouter><Settings /></MemoryRouter>)

    expect(await screen.findByRole('heading', { name: '运行时配置状态' })).toBeInTheDocument()
    expect(screen.getByText('DeepSeek')).toBeInTheDocument()
    expect(screen.getByText('腾讯地图')).toBeInTheDocument()
    // 状态区只读：不展示任何密钥明文
    expect(screen.queryByDisplayValue(/sk-|web_session|a1=/)).not.toBeInTheDocument()
  })

  it('offers an empty xhs cookie form and never prefills secrets', async () => {
    render(<MemoryRouter><Settings /></MemoryRouter>)

    const cookieInput = await screen.findByLabelText('小红书 Cookie（含 web_session）')
    expect(cookieInput).toHaveValue('')

    const tokenInput = screen.getByLabelText('管理员令牌（后端 admin-token）')
    expect(tokenInput).toHaveValue('')

    expect(screen.getByRole('button', { name: '校验 Cookie' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '保存并生效' })).toBeInTheDocument()
  })

  it('lets the reader pick the basemap and remembers it for this browser', async () => {
    // 两把浏览器 Key 都清空，这个用例就不依赖本地 .env.local 里配了什么
    vi.stubEnv('VITE_AMAP_WEB_JS_KEY', '')
    vi.stubEnv('VITE_GOOGLE_MAPS_JS_KEY', '')
    const user = userEvent.setup()
    render(<MemoryRouter><Settings /></MemoryRouter>)

    const amap = await screen.findByRole('radio', { name: '高德地图' })
    const google = screen.getByRole('radio', { name: 'Google 地图' })
    expect(amap).toBeChecked()
    expect(google).not.toBeChecked()

    await user.click(google)

    // 明确选过就保留，即使这个构建里没有 Google 的 Key —— 地图区域会给出
    // 「缺 VITE_GOOGLE_MAPS_JS_KEY」的说明，而不是把选择悄悄改回去。
    expect(google).toBeChecked()
    expect(amap).not.toBeChecked()
    // 只存在浏览器里：这个是用户自己的偏好，不需要管理员令牌，也不发给后端
    expect(localStorage.getItem(MAP_PROVIDER_STORAGE_KEY)).toBe('google')
  })

  it('explains why Tencent is not a basemap option', async () => {
    render(<MemoryRouter><Settings /></MemoryRouter>)

    expect(await screen.findByText(/腾讯地图目前只作为服务端数据源/)).toBeInTheDocument()
  })
})
