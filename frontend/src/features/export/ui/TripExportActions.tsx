import { DownloadOutlined, PrinterOutlined } from '@ant-design/icons'
import { Button, Space, message } from 'antd'
import type { TripPlan } from '@/types/api'
import { serializeTripPlan, tripExportFilename } from '../model/tripExport'

interface Props {
  plan: TripPlan
  planId?: string
}

export default function TripExportActions({ plan, planId }: Props) {
  const downloadJson = () => {
    const blob = new Blob([serializeTripPlan(plan, planId)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = tripExportFilename(plan)
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    message.success('行程 JSON 已导出')
  }

  return (
    <Space wrap>
      <Button icon={<DownloadOutlined />} onClick={downloadJson}>导出 JSON</Button>
      <Button icon={<PrinterOutlined />} onClick={() => window.print()}>打印 / PDF</Button>
    </Space>
  )
}
