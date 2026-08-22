import { fireEvent, render, screen } from '@testing-library/react'
import OverviewAttractionCard from './index'

describe('OverviewAttractionCard', () => {
  it('shows reservation emphasis and exposes reservation tips in a tooltip', async () => {
    render(
      <OverviewAttractionCard
        active={false}
        item={{
          name: '故宫',
          city: '北京',
          address: '东城区',
          visit_duration: 120,
          description: '历史建筑',
          dayArrayIndex: 0,
          attractionArrayIndex: 0,
          reservation_required: true,
          reservation_tips: '至少提前一天实名预约',
        }}
      />,
    )

    const badge = screen.getByText('🔔 需预约')
    fireEvent.mouseEnter(badge)
    expect(await screen.findByText('至少提前一天实名预约')).toBeInTheDocument()
  })
})
