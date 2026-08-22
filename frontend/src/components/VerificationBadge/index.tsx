import { CheckCircleOutlined, CloudOutlined, ExclamationCircleOutlined, RobotOutlined } from '@ant-design/icons'
import { Tag, Tooltip } from 'antd'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { VerificationMetadata, VerificationStatus } from '@/types/api'

const badge: Record<VerificationStatus, { color: string; labelKey: string; icon: ReactNode }> = {
  verified: { color: 'green', labelKey: 'verification.verified', icon: <CheckCircleOutlined /> },
  real_route: { color: 'cyan', labelKey: 'verification.realRoute', icon: <CheckCircleOutlined /> },
  live_weather: { color: 'blue', labelKey: 'verification.liveWeather', icon: <CloudOutlined /> },
  ai_suggested: { color: 'purple', labelKey: 'verification.aiSuggested', icon: <RobotOutlined /> },
  needs_verification: { color: 'orange', labelKey: 'verification.needsVerification', icon: <ExclamationCircleOutlined /> },
}

export default function VerificationBadge({ metadata }: { metadata: VerificationMetadata }) {
  const { t } = useTranslation()
  const status = metadata.verification_status ?? 'needs_verification'
  const config = badge[status]
  const details = [metadata.provider, metadata.source, metadata.verified_at].filter(Boolean).join(' · ')
  return (
    <Tooltip title={details || t('verification.noSource')}>
      <Tag color={config.color} icon={config.icon}>{t(config.labelKey)}</Tag>
    </Tooltip>
  )
}
