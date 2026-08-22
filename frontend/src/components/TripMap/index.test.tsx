import { render, screen } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import type { TripPlan } from '@/types/api'
import TripMap from './index'

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
})
