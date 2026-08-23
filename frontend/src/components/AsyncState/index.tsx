import { Empty, Skeleton, Space, Typography } from 'antd'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'

export function PageLoading({ label }: { label?: string }) {
  const { t } = useTranslation()
  return (
    <Space orientation="vertical" size="large" style={{ width: '100%', padding: 32 }} aria-live="polite">
      <Typography.Text type="secondary">{label ?? t('asyncState.pageLoading')}</Typography.Text>
      <Skeleton active paragraph={{ rows: 8 }} />
    </Space>
  )
}

export function EmptyPanel({ description, action }: { description: string; action?: ReactNode }) {
  return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={description}>{action}</Empty>
}
