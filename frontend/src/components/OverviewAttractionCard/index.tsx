import AttractionImage from '../AttractionImage'
import { useTranslation } from 'react-i18next'
import { Tooltip } from 'antd'
import './index.css'

interface OverviewAttractionItem {
  name: string
  city: string
  address: string
  visit_duration: number
  description: string
  dayArrayIndex: number
  attractionArrayIndex: number
  rating?: number
  ticket_price?: number
  category?: string
  reservation_required?: boolean
  reservation_tips?: string
}

interface OverviewAttractionCardProps {
  item: OverviewAttractionItem
  imageUrl?: string
  /** 图片来源（amap / xhs / …），用于在小红书图片上打出「实拍」标识 */
  imageSource?: string
  active: boolean
  onHover?: () => void
  onSelect?: () => void
}

/**
 * 概览页的景点卡。
 * 所有卡片共用同一条尺寸规则（媒体区固定 4:3 + 正文固定行高），
 * 这样无论图片原始比例如何，网格里都不会再出现「高矮参差」。
 */
function OverviewAttractionCard({
  item,
  imageUrl,
  imageSource,
  active,
  onHover,
  onSelect,
}: OverviewAttractionCardProps) {
  const { t } = useTranslation()
  const hasDuration = Number.isFinite(item.visit_duration) && item.visit_duration > 0
  const hasPrice = typeof item.ticket_price === 'number' && Number.isFinite(item.ticket_price)
  const hasRating = typeof item.rating === 'number' && Number.isFinite(item.rating) && item.rating > 0
  const fromXhs = Boolean(imageUrl) && (imageSource ?? '').toLowerCase().includes('xhs')

  return (
    <article
      className={`overview-card${active ? ' is-active' : ''}`}
      onMouseEnter={onHover}
      onClick={onSelect}
      onKeyDown={(event) => {
        if ((event.key === 'Enter' || event.key === ' ') && onSelect) {
          event.preventDefault()
          onSelect()
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={t('overviewCard.locate', { name: item.name })}
      aria-pressed={active}
    >
      <div className="overview-card-media">
        <AttractionImage
          attractionName={item.name}
          city={item.city}
          imageUrl={imageUrl}
        />
        <span className="overview-card-day">
          {t('common.dayIndex', { day: item.dayArrayIndex + 1 })}
        </span>
        {fromXhs && (
          <span className="overview-card-source" title={t('overviewCard.xhsPhotoHint')}>
            {t('overviewCard.xhsPhoto')}
          </span>
        )}
        {item.reservation_required && (
          <Tooltip
            title={item.reservation_tips || t('overviewCard.reservationFallback')}
            trigger={['hover', 'focus']}
            mouseEnterDelay={0}
          >
            <span
              className="overview-reservation-badge"
              role="note"
              tabIndex={0}
              onKeyDown={(event) => event.stopPropagation()}
            >
              🔔 {t('overviewCard.reservation')}
            </span>
          </Tooltip>
        )}
      </div>

      <div className="overview-card-body">
        <h3 className="overview-card-title">{item.name}</h3>
        <p className="overview-card-desc">
          {item.description || item.address || t('overviewCard.noDescription')}
        </p>
        <div className="overview-card-meta">
          {hasDuration && <span>{t('common.minutes', { count: item.visit_duration })}</span>}
          {hasPrice && <span>¥{item.ticket_price}</span>}
          {hasRating && <span>★ {item.rating}</span>}
        </div>
      </div>
    </article>
  )
}

export type { OverviewAttractionItem }
export default OverviewAttractionCard
