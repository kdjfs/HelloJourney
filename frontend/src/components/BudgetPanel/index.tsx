import { Card } from 'antd'
import { useTranslation } from 'react-i18next'
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

const CATEGORY_ITEMS: Array<{ key: BudgetKey; labelKey: string; color: string }> = [
  { key: 'total_attractions', labelKey: 'budgetPanel.attractions', color: '#d76e42' },
  { key: 'total_hotels', labelKey: 'budgetPanel.hotels', color: '#51cbce' },
  { key: 'total_meals', labelKey: 'budgetPanel.meals', color: '#fbc658' },
  { key: 'total_transportation', labelKey: 'budgetPanel.transportation', color: '#6bd098' },
  { key: 'total_inter_city_transport', labelKey: 'budgetPanel.interCity', color: '#a78bfa' },
]

function BudgetPanel({ budget, budgetLimit }: BudgetPanelProps) {
  const { t, i18n } = useTranslation()
  const numberLocale = i18n.resolvedLanguage || i18n.language
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
            <div className="budget-eyebrow">{t('budgetPanel.title')}</div>
            <div className="budget-total">
              <span className="budget-currency">¥</span>
              <span className="budget-amount">{used.toLocaleString(numberLocale)}</span>
            </div>
          </div>
          {hasLimit && (
            <div className={`budget-limit ${remaining !== null && remaining >= 0 ? 'is-ok' : 'is-over'}`}>
              <span className="budget-limit-label">
                {remaining !== null && remaining >= 0 ? t('budgetPanel.remaining') : t('budgetPanel.over')}
              </span>
              <span className="budget-limit-value">¥{Math.abs(remaining ?? 0).toLocaleString(numberLocale)}</span>
              <span className="budget-limit-cap">{t('budgetPanel.limit', { amount: Number(budgetLimit).toLocaleString(numberLocale) })}</span>
            </div>
          )}
        </div>

        <div className="budget-bars">
          {items.map((item) => {
            const value = Number(budget?.[item.key]) || 0
            const percent = Math.min(100, Math.round((value / total) * 100))
            return (
              <div className="budget-row" key={item.key}>
                <span className="budget-row-label">{t(item.labelKey)}</span>
                <span className="budget-row-track">
                  <span className="budget-row-fill" style={{ width: `${percent}%`, background: item.color }} />
                </span>
                <span className="budget-row-value">¥{value.toLocaleString(numberLocale)}</span>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

export default BudgetPanel
