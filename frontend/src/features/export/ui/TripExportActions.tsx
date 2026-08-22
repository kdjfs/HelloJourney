import { DownloadOutlined, FileImageOutlined, PrinterOutlined } from '@ant-design/icons'
import { Button, Space, message } from 'antd'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TripPlan } from '@/types/api'
import { exportTripAsImage, serializeTripPlan, tripExportFilename } from '../model/tripExport'

interface Props {
  plan: TripPlan
  planId?: string
}

export default function TripExportActions({ plan, planId }: Props) {
  const { t } = useTranslation()
  const [imageExporting, setImageExporting] = useState(false)
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

  const downloadImage = async () => {
    if (imageExporting) return
    setImageExporting(true)
    message.loading({ content: t('export.imagePreparing'), key: 'trip-image-export', duration: 0 })
    try {
      const result = await exportTripAsImage(plan)
      if (result.includedMap) {
        message.success({ content: t('export.imageSuccess'), key: 'trip-image-export' })
      } else {
        message.warning({ content: t('export.imageSuccessWithoutMap'), key: 'trip-image-export', duration: 6 })
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : t('common.unknownError')
      message.error({ content: t('export.imageFailed', { error: detail }), key: 'trip-image-export', duration: 6 })
    } finally {
      setImageExporting(false)
    }
  }

  return (
    <Space wrap>
      <Button icon={<DownloadOutlined />} onClick={downloadJson}>{t('export.json')}</Button>
      <Button icon={<FileImageOutlined />} loading={imageExporting} onClick={() => void downloadImage()}>{t('export.image')}</Button>
      <Button icon={<PrinterOutlined />} onClick={() => window.print()}>{t('export.print')}</Button>
    </Space>
  )
}
