import { CheckCircleOutlined, CloudOutlined, ExclamationCircleOutlined, RobotOutlined } from '@ant-design/icons'
import { Tag, Tooltip } from 'antd'
import type { ReactNode } from 'react'
import type { VerificationMetadata, VerificationStatus } from '@/types/api'

const badge: Record<VerificationStatus, { color: string; label: string; icon: ReactNode }> = {
  verified: { color: 'green', label: '已核验', icon: <CheckCircleOutlined /> },
  real_route: { color: 'cyan', label: '真实路线', icon: <CheckCircleOutlined /> },
  live_weather: { color: 'blue', label: '实时天气', icon: <CloudOutlined /> },
  ai_suggested: { color: 'purple', label: 'AI 建议', icon: <RobotOutlined /> },
  needs_verification: { color: 'orange', label: '待核验', icon: <ExclamationCircleOutlined /> },
}

export default function VerificationBadge({ metadata }: { metadata: VerificationMetadata }) {
  const status = metadata.verification_status ?? 'needs_verification'
  const config = badge[status]
  const details = [metadata.provider, metadata.source, metadata.verified_at].filter(Boolean).join(' · ')
  return (
    <Tooltip title={details || '该内容尚未绑定外部数据来源'}>
      <Tag color={config.color} icon={config.icon}>{config.label}</Tag>
    </Tooltip>
  )
}
