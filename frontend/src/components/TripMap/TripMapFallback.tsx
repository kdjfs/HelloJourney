import { EnvironmentOutlined, WarningOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import type { MapProvider } from '@/features/map-provider/model/mapProvider'

export type TripMapFallbackKind = 'missing-key' | 'missing-coordinate' | 'load-error' | 'security-code-missing'

interface FallbackContent {
  labelKey: string
  titleKey: string
  detailKey: string
}

/**
 * 兜底文案跟「缺的是哪家的钥匙」走。
 *
 * 选了 Google 底图却没配 VITE_GOOGLE_MAPS_JS_KEY 时，如果还弹高德的提示，
 * 用户会去翻错的地方。所以这里按 provider 分开给键，文案本身在 i18n 里。
 */
function contentFor(kind: TripMapFallbackKind, provider: MapProvider): FallbackContent {
  const google = provider === 'google'
  switch (kind) {
    case 'missing-coordinate':
      return {
        labelKey: 'tripMap.noCoordinates',
        titleKey: 'tripMap.noCoordinatesTitle',
        detailKey: 'tripMap.noCoordinatesDetail',
      }
    case 'load-error':
      return google
        ? {
            labelKey: 'tripMap.loadError',
            titleKey: 'tripMap.googleLoadErrorTitle',
            detailKey: 'tripMap.googleLoadErrorDetail',
          }
        : {
            labelKey: 'tripMap.loadError',
            titleKey: 'tripMap.loadErrorTitle',
            detailKey: 'tripMap.loadErrorDetail',
          }
    case 'security-code-missing':
      return {
        labelKey: 'tripMap.securityCodeMissing',
        titleKey: 'tripMap.securityCodeMissingTitle',
        detailKey: 'tripMap.securityCodeMissingDetail',
      }
    case 'missing-key':
    default:
      return google
        ? {
            labelKey: 'tripMap.unavailable',
            titleKey: 'tripMap.googleMissingKeyTitle',
            detailKey: 'tripMap.googleMissingKeyDetail',
          }
        : {
            labelKey: 'tripMap.unavailable',
            titleKey: 'tripMap.missingKeyTitle',
            detailKey: 'tripMap.missingKeyDetail',
          }
  }
}

export default function TripMapFallback(
  { kind, provider = 'amap' }: { kind: TripMapFallbackKind; provider?: MapProvider },
) {
  const { t } = useTranslation()
  const content = contentFor(kind, provider)
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
