import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
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
}))

describe('Settings page', () => {
  it('renders backend configuration status without secret inputs', async () => {
    render(<MemoryRouter><Settings /></MemoryRouter>)

    expect(await screen.findByRole('heading', { name: '运行时配置状态' })).toBeInTheDocument()
    expect(screen.getByText('DeepSeek')).toBeInTheDocument()
    expect(screen.getByText('腾讯地图')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByText('仅展示配置状态，不会向浏览器返回或收集密钥。')).toBeInTheDocument()
  })
})
