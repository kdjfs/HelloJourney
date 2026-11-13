import { useEffect, useState } from 'react'
import { Button, Modal, Space, Typography, message } from 'antd'
import { ShareAltOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import QRCode from 'qrcode'

interface MobileImportDialogProps {
  open: boolean
  onClose: () => void
  /** 要导入到手机的链接（结果页地址） */
  url: string
  onSaveImage: () => void
  savingImage: boolean
  /** 浏览器支持文件分享时，额外提供一个系统分享入口 */
  onSystemShare: () => void
  sharing: boolean
  canSystemShare: boolean
}

/**
 * 导入到手机。
 *
 * 之前叫"分享到手机"，只调 navigator.share —— 那是"把图发出去"，而且在桌面/局域网
 * http 下直接不可用。现在是以"把当前行程接到手机上看"为目标：二维码 + 复制链接，
 * 顺手保留保存长图和系统分享。
 */
export default function MobileImportDialog({
  open,
  onClose,
  url,
  onSaveImage,
  savingImage,
  onSystemShare,
  sharing,
  canSystemShare,
}: MobileImportDialogProps) {
  const { t } = useTranslation()
  const [qr, setQr] = useState('')
  const [qrFailed, setQrFailed] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    QRCode.toDataURL(url, { width: 320, margin: 1, color: { dark: '#1b2a2f', light: '#ffffff' } })
      .then((dataUrl) => {
        if (!cancelled) setQr(dataUrl)
      })
      .catch(() => {
        if (!cancelled) setQrFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [open, url])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      message.success(t('export.mobileCopied'))
    } catch {
      // 剪贴板不可用时退化为选中文本
      message.info(url)
    }
  }

  return (
    <Modal open={open} onCancel={onClose} footer={null} title={t('export.mobileTitle')} width={440} centered>
      <div className="mobile-import">
        <div className="mobile-import-qr">
          {qrFailed ? (
            <p className="mobile-import-fallback">{t('export.mobileQrFail')}</p>
          ) : (
            qr && <img src={qr} alt={t('export.mobileTitle')} />
          )}
        </div>
        <p className="mobile-import-hint">{t('export.mobileScanHint')}</p>
        <Typography.Text className="mobile-import-url" copyable={false}>{url}</Typography.Text>
        <Space wrap className="mobile-import-actions">
          <Button onClick={() => void copyLink()}>{t('export.mobileCopy')}</Button>
          <Button type="primary" loading={savingImage} onClick={onSaveImage}>
            {t('export.mobileSaveImage')}
          </Button>
          {canSystemShare && (
            <Button icon={<ShareAltOutlined />} loading={sharing} onClick={onSystemShare}>
              {t('export.mobileSystemShare')}
            </Button>
          )}
        </Space>
      </div>
    </Modal>
  )
}
