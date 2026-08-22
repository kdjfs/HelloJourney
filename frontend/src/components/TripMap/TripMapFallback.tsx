import { EnvironmentOutlined, WarningOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'

export type TripMapFallbackKind = 'missing-key' | 'missing-coordinate' | 'load-error'

const FALLBACK_CONTENT: Record<TripMapFallbackKind, { labelKey: string; titleKey: string; detailKey: string }> = {
  'missing-key': {
    labelKey: 'tripMap.unavailable',
    titleKey: 'tripMap.missingKeyTitle',
    detailKey: 'tripMap.missingKeyDetail',
  },
  'missing-coordinate': {
    labelKey: 'tripMap.noCoordinates',
    titleKey: 'tripMap.noCoordinatesTitle',
    detailKey: 'tripMap.noCoordinatesDetail',
  },
  'load-error': {
    labelKey: 'tripMap.loadError',
    titleKey: 'tripMap.loadErrorTitle',
    detailKey: 'tripMap.loadErrorDetail',
  },
}

export default function TripMapFallback({ kind }: { kind: TripMapFallbackKind }) {
  const { t } = useTranslation()
  const content = FALLBACK_CONTENT[kind]
  return (
    <div className="trip-map-fallback" role="status" aria-label={t(content.labelKey)}>
      <span className="trip-map-fallback__icon" aria-hidden="true">
        {kind === 'missing-coordinate' ? <EnvironmentOutlined /> : <WarningOutlined />}
      </span>
      <strong>{t(content.titleKey)}</strong>
      <span>{t(content.detailKey)}</span>
    </div>
  )
}
