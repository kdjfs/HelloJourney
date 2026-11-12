import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { MAP_PROVIDER_STORAGE_KEY } from '@/features/map-provider/model/mapProvider'
import type { TripPlan } from '@/types/api'
import TripMap from './index'

const loadMock = vi.hoisted(() => vi.fn())

vi.mock('@amap/amap-jsapi-loader', () => ({ load: loadMock }))

const planWithAttraction: TripPlan = {
  city: '北京',
  start_date: '2026-09-01',
  end_date: '2026-09-01',
  overall_suggestions: '',
  weather_info: [],
  days: [
    {
      date: '2026-09-01',
      day_index: 0,
      description: '',
      transportation: '步行',
      accommodation: '酒店',
      meals: [],
      attractions: [
        {
          name: '故宫',
          address: '东城区景山前街 4 号',
          description: '历史建筑',
          location: { longitude: 116.397, latitude: 39.918 },
          visit_duration: 120,
        },
      ],
    },
  ],
}

afterEach(() => {
  vi.unstubAllEnvs()
  localStorage.clear()
  loadMock.mockReset()
})

describe('TripMap fallbacks', () => {
  it('shows a deterministic setup hint when the AMap web key is missing', () => {
    vi.stubEnv('VITE_AMAP_WEB_JS_KEY', '')

    render(<TripMap plan={planWithAttraction} />)

    expect(screen.getByRole('status', { name: '地图暂不可用' })).toHaveTextContent('尚未配置高德地图 Web JS Key')
  })

  it('shows an empty-coordinate hint without loading AMap', () => {
    vi.stubEnv('VITE_AMAP_WEB_JS_KEY', 'test-web-key')
    const planWithoutCoordinates: TripPlan = {
      ...planWithAttraction,
      days: planWithAttraction.days.map((day) => ({
        ...day,
        attractions: day.attractions.map((attraction) => ({
          ...attraction,
          location: { longitude: 0, latitude: 0 },
        })),
      })),
    }

    render(<TripMap plan={planWithoutCoordinates} />)

    expect(screen.getByRole('status', { name: '地图暂无坐标' })).toHaveTextContent('行程中还没有可用的景点坐标')
  })

  it('explains a security code that never reached the SDK instead of painting a blank map', async () => {
    vi.stubEnv('VITE_AMAP_WEB_JS_KEY', 'test-web-key')
    vi.stubEnv('VITE_AMAP_SECURITY_JS_CODE', 'configured-security-code')
    loadMock.mockResolvedValue({ getConfig: () => ({ jscode: '' }) })

    render(<TripMap plan={planWithAttraction} />)

    expect(await screen.findByRole('status', { name: '高德安全密钥未生效' }))
      .toHaveTextContent('高德安全密钥未生效，地图无法渲染')
  })

  it('does not block the map when the configured code was resolved by the SDK', async () => {
    vi.stubEnv('VITE_AMAP_WEB_JS_KEY', 'test-web-key')
    vi.stubEnv('VITE_AMAP_SECURITY_JS_CODE', 'configured-security-code')
    // Only getConfig is reachable: the map is expected to proceed past the security
    // gate and fail later on the missing Map constructor, which is not this guard.
    loadMock.mockResolvedValue({ getConfig: () => ({ jscode: 'configured-security-code' }) })

    render(<TripMap plan={planWithAttraction} />)

    expect(await screen.findByRole('status', { name: '地图加载失败' })).toBeInTheDocument()
  })

  it('publishes the security code on window before the SDK bundle is requested', async () => {
    vi.stubEnv('VITE_AMAP_WEB_JS_KEY', 'test-web-key')
    vi.stubEnv('VITE_AMAP_SECURITY_JS_CODE', 'configured-security-code')
    // AMap reads window._AMapSecurityConfig while its bundle executes, so the value
    // must already be there when the loader injects the script tag.
    const seenBySdk: Array<string | undefined> = []
    loadMock.mockImplementation(() => {
      seenBySdk.push(window._AMapSecurityConfig?.securityJsCode)
      return Promise.resolve({ getConfig: () => ({ jscode: 'configured-security-code' }) })
    })

    render(<TripMap plan={planWithAttraction} />)

    await waitFor(() => expect(loadMock).toHaveBeenCalled())
    expect(seenBySdk).toEqual(['configured-security-code'])
  })

  it('sends no securityJsCode loader option, because the loader would drop it', async () => {
    vi.stubEnv('VITE_AMAP_WEB_JS_KEY', 'test-web-key')
    vi.stubEnv('VITE_AMAP_SECURITY_JS_CODE', 'configured-security-code')
    loadMock.mockResolvedValue({ getConfig: () => ({ jscode: 'configured-security-code' }) })

    render(<TripMap plan={planWithAttraction} />)

    await waitFor(() => expect(loadMock).toHaveBeenCalled())
    expect(loadMock.mock.calls[0][0]).toEqual({
      key: 'test-web-key',
      version: '2.0',
      plugins: ['AMap.Marker', 'AMap.Polyline', 'AMap.InfoWindow', 'AMap.Driving', 'AMap.Walking'],
    })
  })
})

describe('TripMap provider selection', () => {
  it('names the Google key instead of silently falling back to AMap', () => {
    // AMap 的 Key 是有的：如果这里偷偷退回 AMap，用户会以为自己点的 Google 失效了。
    vi.stubEnv('VITE_AMAP_WEB_JS_KEY', 'test-web-key')
    vi.stubEnv('VITE_GOOGLE_MAPS_JS_KEY', '')
    localStorage.setItem(MAP_PROVIDER_STORAGE_KEY, 'google')

    render(<TripMap plan={planWithAttraction} />)

    expect(screen.getByRole('status', { name: '地图暂不可用' }))
      .toHaveTextContent('尚未配置 Google Maps Web JS Key')
    expect(loadMock).not.toHaveBeenCalled()
  })
})
