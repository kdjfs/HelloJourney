import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import type { TripPlan } from '@/types/api'
import EditableTripDays from './EditableTripDays'

const plan: TripPlan = {
  city: '北京', start_date: '2026-09-01', end_date: '2026-09-01', overall_suggestions: '', weather_info: [],
  days: [{
    date: '2026-09-01', day_index: 0, city: '北京', description: '', transportation: '地铁', accommodation: '酒店', meals: [],
    attractions: [{ name: '故宫', address: '东城区', description: '历史建筑', location: { longitude: 116.4, latitude: 39.9 }, visit_duration: 120, verification_status: 'verified' }],
  }],
}

describe('EditableTripDays', () => {
  it('adds an attraction and can undo the change', async () => {
    const onPlanChange = vi.fn()
    render(<EditableTripDays initialPlan={plan} planId="test-plan" onPlanChange={onPlanChange} />)

    expect(screen.getByText('故宫')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '添加景点' }))
    expect(screen.getByText('新景点')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '撤销' }))
    expect(screen.queryByText('新景点')).not.toBeInTheDocument()
  })
})
