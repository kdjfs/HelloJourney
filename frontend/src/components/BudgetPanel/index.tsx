import { Card } from 'antd'
import type { Budget } from '../../types/api'

interface BudgetPanelProps {
  budget: Budget
  budgetLimit?: number
}

type BudgetKey =
  | 'total_attractions'
  | 'total_hotels'
  | 'total_meals'
  | 'total_transportation'
  | 'total_inter_city_transport'

const CATEGORY_ITEMS: Array<{ key: BudgetKey; label: string; color: string }> = [
  { key: 'total_attractions', label: '景点门票', color: '#d76e42' },
  { key: 'total_hotels', label: '酒店住宿', color: '#51cbce' },
  { key: 'total_meals', label: '餐饮美食', color: '#fbc658' },
  { key: 'total_transportation', label: '市内交通', color: '#6bd098' },
  { key: 'total_inter_city_transport', label: '跨城交通', color: '#a78bfa' },
]

function BudgetPanel({ budget, budgetLimit }: BudgetPanelProps) {
  const used = Number(budget?.total) || 0
  const total = Math.max(used, 1)
  const items = CATEGORY_ITEMS.filter((item) => Number(budget?.[item.key]) > 0)
  const hasLimit = Number.isFinite(Number(budgetLimit)) && Number(budgetLimit) > 0
  const remaining = hasLimit ? Number(budgetLimit) - used : null

  return (
    <Card
      className="budget-card section-shellless"
      style={{ borderRadius: 12, marginBottom: 24 }}
      styles={{ body: { padding: 0 } }}
    >
      <div className="budget-panel">
        <div className="budget-header">
          <div>
            <div className="budget-eyebrow">预算总览</div>
            <div className="budget-total">
              <span className="budget-currency">¥</span>
              <span className="budget-amount">{used.toLocaleString()}</span>
            </div>
          </div>
          {hasLimit && (
            <div className={`budget-limit ${remaining !== null && remaining >= 0 ? 'is-ok' : 'is-over'}`}>
              <span className="budget-limit-label">
                {remaining !== null && remaining >= 0 ? '预算内剩余' : '已超出预算'}
              </span>
              <span className="budget-limit-value">¥{Math.abs(remaining ?? 0).toLocaleString()}</span>
              <span className="budget-limit-cap">上限 ¥{Number(budgetLimit).toLocaleString()}</span>
            </div>
          )}
        </div>

        <div className="budget-bars">
          {items.map((item) => {
            const value = Number(budget?.[item.key]) || 0
            const percent = Math.min(100, Math.round((value / total) * 100))
            return (
              <div className="budget-row" key={item.key}>
                <span className="budget-row-label">{item.label}</span>
                <span className="budget-row-track">
                  <span className="budget-row-fill" style={{ width: `${percent}%`, background: item.color }} />
                </span>
                <span className="budget-row-value">¥{value.toLocaleString()}</span>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

export default BudgetPanel
