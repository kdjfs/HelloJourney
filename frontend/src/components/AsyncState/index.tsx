import { Empty, Skeleton, Space, Typography } from 'antd'
import type { ReactNode } from 'react'

export function PageLoading({ label = '正在准备你的行程工作区' }: { label?: string }) {
  return (
    <Space orientation="vertical" size="large" style={{ width: '100%', padding: 32 }} aria-live="polite">
      <Typography.Text type="secondary">{label}</Typography.Text>
      <Skeleton active paragraph={{ rows: 8 }} />
    </Space>
  )
}

export function EmptyPanel({ description, action }: { description: string; action?: ReactNode }) {
  return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={description}>{action}</Empty>
}
