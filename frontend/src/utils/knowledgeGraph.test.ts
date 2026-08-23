import { describe, it, expect } from 'vitest'
import { buildFallbackGraphData } from './knowledgeGraph'
import type { TripPlan } from '../types/api'

const samplePlan: TripPlan = {
  city: '广州',
  start_date: '2026-09-05',
  end_date: '2026-09-06',
  days: [
    {
      date: '2026-09-05',
      day_index: 0,
      city: '广州',
      description: '第一天',
      transportation: '地铁',
      accommodation: '经济型酒店',
      hotel: { name: '如家酒店', address: '广州', price_range: '200-300', rating: '4.5', distance: '1km', type: '经济型' },
      attractions: [
        { name: '广州塔', address: '海珠区', location: { longitude: 0, latitude: 0 }, visit_duration: 120, description: '塔', ticket_price: 150 },
        { name: '陈家祠', address: '荔湾区', location: { longitude: 0, latitude: 0 }, visit_duration: 60, description: '祠' },
      ],
      meals: [
        { type: 'breakfast', name: '早茶', estimated_cost: 30 },
        { type: 'dinner', name: '粤菜', estimated_cost: 100 },
      ],
    },
  ],
  weather_info: [{ date: '2026-09-05', day_weather: '晴', night_weather: '多云', day_temp: 32, night_temp: 26, wind_direction: '东南', wind_power: '2级' }],
  overall_suggestions: '建议带伞',
  budget: { total: 1000, total_attractions: 300, total_hotels: 400, total_meals: 200, total_transportation: 100 },
}

describe('buildFallbackGraphData', () => {
  it('builds nodes and edges from a trip plan', () => {
    const graph = buildFallbackGraphData(samplePlan)

    expect(graph.categories).toHaveLength(8)
    expect(graph.nodes.some((n) => n.name === '广州' && n.category === 0)).toBe(true)
    expect(graph.nodes.some((n) => n.name === '广州塔' && n.category === 2)).toBe(true)
    expect(graph.nodes.some((n) => n.name === '如家酒店' && n.category === 3)).toBe(true)
    expect(graph.nodes.some((n) => n.name === '早茶' && n.category === 4)).toBe(true)
    expect(graph.nodes.some((n) => n.name === '总预算 ¥1,000' && n.category === 6)).toBe(true)
    expect(graph.edges.some((e) => e.label === '游览' && e.target.includes('广州塔'))).toBe(true)
    expect(graph.edges.some((e) => e.label === '下一站')).toBe(true)
    expect(graph.edges.some((e) => e.label === '入住')).toBe(true)
    expect(graph.edges.some((e) => e.label === '天气')).toBe(true)
  })

  it('handles a minimal plan without crashing', () => {
    const graph = buildFallbackGraphData({
      city: '北京',
      start_date: '2026-09-01',
      end_date: '2026-09-01',
      days: [],
      weather_info: [],
      overall_suggestions: '',
    })

    expect(graph.nodes.length).toBeGreaterThan(0)
    expect(Array.isArray(graph.edges)).toBe(true)
  })
})
