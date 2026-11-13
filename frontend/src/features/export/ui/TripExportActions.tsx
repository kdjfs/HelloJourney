import { DownloadOutlined, FileImageOutlined, MobileOutlined, PrinterOutlined } from '@ant-design/icons'
import { Button, Modal, Space, message } from 'antd'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TripPlan } from '@/types/api'
import {
  exportTripAsImage,
  printTripPlan,
  serializeTripPlan,
  shareTripImage,
  tripExportFilename,
  type TripImageArtifact,
} from '../model/tripExport'
import MobileImportDialog from './MobileImportDialog'
import './index.css'

interface Props {
  plan: TripPlan
  planId?: string
}

export default function TripExportActions({ plan, planId }: Props) {
  const { t } = useTranslation()
  const [imageExporting, setImageExporting] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [preview, setPreview] = useState<TripImageArtifact | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  /** 手机要打开的地址：带 plan_id，手机端能自己拉回这份行程 */
  const mobileUrl = (() => {
    if (typeof window === 'undefined') return ''
    const url = new URL(window.location.href)
    if (planId) url.searchParams.set('plan_id', planId)
    return url.toString()
  })()
  const canSystemShare = typeof navigator !== 'undefined'
    && typeof navigator.canShare === 'function'
    && typeof navigator.share === 'function'

  const closePreview = useCallback(() => {
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current.url)
      return null
    })
  }, [])

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

  const shareImage = async () => {
    if (sharing) return
    setSharing(true)
    message.loading({ content: t('export.sharePreparing'), key: 'trip-share', duration: 0 })
    try {
      const result = await shareTripImage(plan)
      if (result.outcome === 'shared') {
        message.success({ content: t('export.shareSuccess'), key: 'trip-share' })
      } else if (result.outcome === 'cancelled') {
        message.info({ content: t('export.shareCancelled'), key: 'trip-share' })
      } else {
        // 浏览器不支持文件分享：直接给大图，让用户长按保存
        message.destroy('trip-share')
        setPreview(result.artifact)
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : t('common.unknownError')
      message.error({ content: t('export.imageFailed', { error: detail }), key: 'trip-share', duration: 6 })
    } finally {
      setSharing(false)
    }
  }

  const printPlan = async () => {
    if (printing) return
    setPrinting(true)
    try {
      await printTripPlan(plan)
    } catch (error) {
      const detail = error instanceof Error ? error.message : t('common.unknownError')
      message.error({ content: t('export.printFailed', { error: detail }), duration: 6 })
    } finally {
      setPrinting(false)
    }
  }

  return (
    <>
      <Space className="trip-export-actions" wrap={false}>
        <Button icon={<DownloadOutlined />} onClick={downloadJson}>{t('export.json')}</Button>
        <Button icon={<FileImageOutlined />} loading={imageExporting} onClick={() => void downloadImage()}>
          {t('export.image')}
        </Button>
        <Button icon={<MobileOutlined />} onClick={() => setMobileOpen(true)}>
          {t('export.importPhone')}
        </Button>
        <Button icon={<PrinterOutlined />} loading={printing} onClick={() => void printPlan()}>
          {t('export.print')}
        </Button>
      </Space>

      <MobileImportDialog
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        url={mobileUrl}
        onSaveImage={() => void downloadImage()}
        savingImage={imageExporting}
        onSystemShare={() => void shareImage()}
        sharing={sharing}
        canSystemShare={canSystemShare}
      />

      <Modal
        open={Boolean(preview)}
        onCancel={closePreview}
        footer={null}
        title={t('export.sharePreviewTitle')}
        width={480}
        centered
        destroyOnHidden
      >
        {preview && (
          <div className="export-share-preview">
            <img src={preview.url} alt={preview.filename} />
            <p className="export-share-hint">{t('export.sharePreviewHint')}</p>
            <Space wrap>
              <Button type="primary" href={preview.url} download={preview.filename}>
                {t('export.shareSave')}
              </Button>
              <Button onClick={closePreview}>{t('export.close')}</Button>
            </Space>
          </div>
        )}
      </Modal>
    </>
  )
}
