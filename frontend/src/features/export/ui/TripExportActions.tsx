import { DownloadOutlined, PrinterOutlined } from '@ant-design/icons'
import { Button, Space, message } from 'antd'
import { useTranslation } from 'react-i18next'
import type { TripPlan } from '@/types/api'
import { serializeTripPlan, tripExportFilename } from '../model/tripExport'

interface Props {
  plan: TripPlan
  planId?: string
}

export default function TripExportActions({ plan, planId }: Props) {
  const { t } = useTranslation()
  const downloadJson = () => {
    const blob = new Blob([serializeTripPlan(plan, planId)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = tripExportFilename(plan)
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    message.success(t('export.jsonSuccess'))
  }

  return (
    <Space wrap>
      <Button icon={<DownloadOutlined />} onClick={downloadJson}>{t('export.json')}</Button>
      <Button icon={<PrinterOutlined />} onClick={() => window.print()}>{t('export.print')}</Button>
    </Space>
  )
}
