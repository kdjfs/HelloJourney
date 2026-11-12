import { Card } from 'antd'
import { useTranslation } from 'react-i18next'
import type { Budget } from '../../types/api'

interface BudgetPanelProps {
  budget: Budget
  budgetLimit?: number
  /** 出行人数，用于人均拆分 */
  travelers?: number
  /** 行程天数，用于日均拆分 */
  dayCount?: number
}

type BudgetKey =
  | 'total_attractions'
  | 'total_hotels'
  | 'total_meals'
  | 'total_transportation'
  | 'total_inter_city_transport'

const CATEGORY_ITEMS: Array<{ key: BudgetKey; labelKey: string; color: string }> = [
  { key: 'total_attractions', labelKey: 'budgetPanel.attractions', color: '#d2673f' },
  { key: 'total_hotels', labelKey: 'budgetPanel.hotels', color: '#12695c' },
  { key: 'total_meals', labelKey: 'budgetPanel.meals', color: '#d99a2b' },
  { key: 'total_transportation', labelKey: 'budgetPanel.transportation', color: '#2a6d8f' },
  { key: 'total_inter_city_transport', labelKey: 'budgetPanel.interCity', color: '#7a6cb0' },
]

const RING_RADIUS = 68
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

function BudgetPanel({ budget, budgetLimit, travelers, dayCount }: BudgetPanelProps) {
  const { t, i18n } = useTranslation()
  const numberLocale = i18n.resolvedLanguage || i18n.language
  const format = (value: number) => value.toLocaleString(numberLocale, { maximumFractionDigits: 0 })

  const used = Number(budget?.total) || 0
  const items = CATEGORY_ITEMS
    .map((item) => ({ ...item, value: Number(budget?.[item.key]) || 0 }))
    .filter((item) => item.value > 0)

  // Fall back to the reported total so the ring always closes even when the
  // category breakdown is missing or does not add up to the total.
  const categorySum = items.reduce((acc, item) => acc + item.value, 0)
  const basis = categorySum > 0 ? categorySum : Math.max(used, 1)

  // Built without a running accumulator so each segment is a pure function of the
  // items: at most five categories, so the prefix sum stays trivially cheap.
  const segments = items.map((item, index) => {
    const length = (item.value / basis) * RING_CIRCUMFERENCE
    const offset = items
      .slice(0, index)
      .reduce((acc, previous) => acc + (previous.value / basis) * RING_CIRCUMFERENCE, 0)
    return { ...item, length, offset, percent: Math.round((item.value / basis) * 100) }
  })

  const limitValue = Number(budgetLimit)
  const hasLimit = Number.isFinite(limitValue) && limitValue > 0
  const remaining = hasLimit ? limitValue - used : null
  const limitUsedPercent = hasLimit ? Math.min(100, Math.round((used / limitValue) * 100)) : 0
  const perDay = dayCount && dayCount > 0 ? used / dayCount : null
  const perPerson = travelers && travelers > 0 ? used / travelers : null

  return (
    <Card
      className="budget-card section-shellless"
      styles={{ body: { padding: 0 } }}
    >
      <div className="budget-panel">
        <div className="budget-head">
          <div>
            <div className="budget-eyebrow">{t('budgetPanel.title')}</div>
            <h2 className="budget-headline">{t('budgetPanel.composition')}</h2>
          </div>
          <div className="budget-facts">
            {perDay !== null && (
              <span className="budget-fact">
                <em>{t('budgetPanel.perDay')}</em>
                <b>¥{format(perDay)}</b>
              </span>
            )}
            {perPerson !== null && (
              <span className="budget-fact">
                <em>{t('budgetPanel.perPerson')}</em>
                <b>¥{format(perPerson)}</b>
              </span>
            )}
            {travelers !== undefined && travelers > 0 && (
              <span className="budget-fact">
                <em>{t('budgetPanel.travelers')}</em>
                <b>{travelers}</b>
              </span>
            )}
          </div>
        </div>

        <div className="budget-body">
          <div className="budget-ring-wrap">
            <svg
              viewBox="0 0 180 180"
              className="budget-ring"
              role="img"
              aria-label={t('budgetPanel.composition')}
            >
              <circle cx="90" cy="90" r={RING_RADIUS} fill="none" stroke="rgba(27, 42, 47, 0.08)" strokeWidth="16" />
              <g transform="rotate(-90 90 90)">
                {segments.map((segment) => (
                  <circle
                    key={segment.key}
                    cx="90"
                    cy="90"
                    r={RING_RADIUS}
                    fill="none"
                    stroke={segment.color}
                    strokeWidth="16"
                    strokeDasharray={`${segment.length} ${Math.max(RING_CIRCUMFERENCE - segment.length, 0)}`}
                    strokeDashoffset={-segment.offset}
                  >
                    <title>{`${t(segment.labelKey)} ¥${format(segment.value)}`}</title>
                  </circle>
                ))}
              </g>
            </svg>
            <div className="budget-ring-center">
              <span className="budget-ring-label">{t('budgetPanel.totalLabel')}</span>
              <span className="budget-ring-total">
                <i>¥</i>{format(used)}
              </span>
            </div>
          </div>

          <ul className="budget-legend">
            {segments.map((segment) => (
              <li className="budget-legend-row" key={segment.key}>
                <span className="budget-legend-dot" style={{ background: segment.color }} />
                <span className="budget-legend-label">{t(segment.labelKey)}</span>
                <span className="budget-legend-track">
                  <span
                    className="budget-legend-fill"
                    style={{ width: `${segment.percent}%`, background: segment.color }}
                  />
                </span>
                <span className="budget-legend-percent">{segment.percent}%</span>
                <span className="budget-legend-value">¥{format(segment.value)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className={`budget-limit-bar${hasLimit ? (remaining !== null && remaining >= 0 ? ' is-ok' : ' is-over') : ' is-unset'}`}>
          {hasLimit ? (
            <>
              <span className="budget-limit-text">
                {remaining !== null && remaining >= 0 ? t('budgetPanel.remaining') : t('budgetPanel.over')}
                <b>¥{format(Math.abs(remaining ?? 0))}</b>
              </span>
              <span className="budget-limit-track" aria-hidden="true">
                <span className="budget-limit-fill" style={{ width: `${limitUsedPercent}%` }} />
              </span>
              <span className="budget-limit-cap">
                {t('budgetPanel.limit', { amount: format(limitValue) })}
                <em>{limitUsedPercent}%</em>
              </span>
            </>
          ) : (
            <span className="budget-limit-text is-unset">{t('budgetPanel.noLimit')}</span>
          )}
        </div>
      </div>
    </Card>
  )
}

export default BudgetPanel
