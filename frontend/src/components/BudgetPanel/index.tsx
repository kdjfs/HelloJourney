import { Card } from 'antd'
import type { Budget } from '../../types/api'

interface BudgetPanelProps {
  budget: Budget
}

function BudgetPanel({ budget }: BudgetPanelProps) {
  return (
    <Card
      className="budget-card section-shellless"
      style={{ borderRadius: 12, marginBottom: 24 }}
      styles={{ body: { padding: 0 } }}
    >
      <div className="budget-summary-panel" style={{ padding: 24 }}>
        <div className="budget-summary-title" style={{
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          color: 'rgba(0,0,0,0.45)',
          marginBottom: 8,
        }}>
          预算总览
        </div>
        <div className="budget-summary-total-wrap" style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 20 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#f5593d' }}>¥</span>
          <span style={{ fontSize: 36, fontWeight: 700, color: '#f5593d', lineHeight: 1 }}>
            {budget.total.toLocaleString()}
          </span>
        </div>

        <div className="budget-summary-sub-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 16,
        }}>
          <div className="budget-summary-sub-item">
            <div style={{ fontSize: 18, fontWeight: 700, color: '#262626' }}>
              ¥{budget.total_attractions.toLocaleString()}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', marginTop: 2 }}>景点门票</div>
          </div>
          <div className="budget-summary-sub-item">
            <div style={{ fontSize: 18, fontWeight: 700, color: '#262626' }}>
              ¥{budget.total_hotels.toLocaleString()}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', marginTop: 2 }}>酒店住宿</div>
          </div>
          <div className="budget-summary-sub-item">
            <div style={{ fontSize: 18, fontWeight: 700, color: '#262626' }}>
              ¥{budget.total_meals.toLocaleString()}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', marginTop: 2 }}>餐饮美食</div>
          </div>
          <div className="budget-summary-sub-item">
            <div style={{ fontSize: 18, fontWeight: 700, color: '#262626' }}>
              ¥{budget.total_transportation.toLocaleString()}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', marginTop: 2 }}>交通出行</div>
          </div>
        </div>
      </div>
    </Card>
  )
}

export default BudgetPanel