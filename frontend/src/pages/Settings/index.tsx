import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ApiOutlined,
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloudServerOutlined,
  CompassOutlined,
  SafetyCertificateOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { Alert, Button, Card, Empty, Input, Space, Spin, Tag, Typography, message } from 'antd'
import { useTranslation } from 'react-i18next'
import NavBar from '@/components/NavBar'
import RelayModelPanel from '@/features/llm-relay/ui/RelayModelPanel'
import {
  isMapProviderReady,
  MAP_PROVIDERS,
  useMapProvider,
  writeMapProvider,
} from '@/features/map-provider/model/mapProvider'
import type { MapProvider } from '@/features/map-provider/model/mapProvider'
import { getBackendRuntimeSettings, saveXhsCookie, validateXhsCookie } from '@/services/settingsApi'
import { getAmapWebJsKey } from '@/utils/env'
import type { BackendRuntimeSettings, LlmProviderStatus } from '@/types/api'
import './index.css'

interface ServiceCardProps {
  name: string
  description: string
  guide: string
  configured: boolean
}

function StatusTag({ configured }: { configured: boolean }) {
  const { t } = useTranslation()
  return configured
    ? <Tag color="success" icon={<CheckCircleOutlined />}>{t('settings.configured')}</Tag>
    : <Tag color="warning" icon={<WarningOutlined />}>{t('settings.notConfigured')}</Tag>
}

function ServiceCard({ name, description, guide, configured }: ServiceCardProps) {
  const { t } = useTranslation()
  return (
    <Card className={`settings-service-card${configured ? ' is-ready' : ''}`}>
      <div className="settings-card-heading">
        <div>
          <Typography.Title level={4}>{name}</Typography.Title>
          <Typography.Text type="secondary">{description}</Typography.Text>
        </div>
        <StatusTag configured={configured} />
      </div>
      <p className="settings-status-help">
        {configured ? t('settings.configuredHelp') : t('settings.unconfiguredHelp')}
      </p>
      {!configured && <div className="settings-guide">{guide}</div>}
    </Card>
  )
}

function ProviderCard({ provider }: { provider: LlmProviderStatus }) {
  const { t } = useTranslation()
  return (
    <Card className={`settings-provider-card${provider.active ? ' is-active' : ''}`}>
      <div className="settings-card-heading">
        <div>
          <Typography.Title level={4}>{provider.name || provider.key}</Typography.Title>
          <Typography.Text type="secondary">
            {t('settings.model', { model: provider.model || '—' })}
          </Typography.Text>
        </div>
        <div className="settings-provider-tags">
          {provider.active && <Tag color="processing">{t('settings.active')}</Tag>}
          <StatusTag configured={provider.configured} />
        </div>
      </div>
      {!provider.configured && <div className="settings-guide">{t('settings.providerGuide')}</div>}
    </Card>
  )
}

function extractErrorText(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const response = (error as { response?: { data?: { message?: string } } }).response
    const serverMessage = response?.data?.message
    if (typeof serverMessage === 'string' && serverMessage.trim()) return serverMessage
  }
  return fallback
}

function mapProviderName(provider: MapProvider, t: (key: string) => string): string {
  return provider === 'google' ? t('settings.mapProviderGoogle') : t('settings.mapProviderAmap')
}

/**
 * 底图选择器。
 *
 * 这里的选择存 localStorage、只影响当前浏览器，所以不需要管理员令牌，
 * 也不必请求后端——和下面那些「服务端 Key 是否配好」的状态卡片是两件事：
 * 一个是「我用哪张底图看」，一个是「服务端拿谁的数据」。
 */
function MapBasemapPanel() {
  const { t } = useTranslation()
  const provider = useMapProvider()

  return (
    <section aria-labelledby="settings-basemap-title">
      <div className="settings-section-title">
        <CompassOutlined aria-hidden="true" />
        <div>
          <Typography.Title id="settings-basemap-title" level={2}>
            {t('settings.mapProviderTitle')}
          </Typography.Title>
          <Typography.Text type="secondary">{t('settings.mapProviderSubtitle')}</Typography.Text>
        </div>
      </div>

      <Card className="settings-basemap-card">
        <div className="settings-basemap-options" role="radiogroup">
          {MAP_PROVIDERS.map((candidate) => {
            const ready = isMapProviderReady(candidate)
            const name = mapProviderName(candidate, t)
            return (
              <label
                key={candidate}
                className={`settings-basemap-option${provider === candidate ? ' is-selected' : ''}${ready ? '' : ' is-unready'}`}
              >
                <input
                  type="radio"
                  name="map-basemap"
                  value={candidate}
                  aria-label={name}
                  checked={provider === candidate}
                  onChange={() => writeMapProvider(candidate)}
                />
                <span className="settings-basemap-option__head">
                  <span className="settings-basemap-option__name">{name}</span>
                  <StatusTag configured={ready} />
                </span>
                <span className="settings-basemap-option__hint">
                  {ready
                    ? t(candidate === 'google' ? 'settings.mapProviderGoogleReady' : 'settings.mapProviderAmapReady')
                    : t(candidate === 'google' ? 'settings.mapProviderGoogleMissing' : 'settings.mapProviderAmapMissing')}
                </span>
              </label>
            )
          })}
        </div>

        <p className="settings-basemap-note">{t('settings.mapProviderTencentNote')}</p>
        <p className="settings-basemap-note">{t('settings.mapProviderDataNote')}</p>
      </Card>
    </section>
  )
}

function XhsCookiePanel({ configured, onSaved }: { configured: boolean; onSaved: () => void }) {
  const { t } = useTranslation()
  const [cookie, setCookie] = useState('')
  const [adminToken, setAdminToken] = useState('')
  const [busy, setBusy] = useState<'validate' | 'save' | ''>('')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)

  const ready = () => {
    if (!cookie.trim()) {
      setFeedback({ type: 'info', text: t('settings.xhsCookieRequired') })
      return false
    }
    if (!adminToken.trim()) {
      setFeedback({ type: 'info', text: t('settings.xhsAdminTokenRequired') })
      return false
    }
    return true
  }

  const handleValidate = async () => {
    if (!ready()) return
    setBusy('validate')
    setFeedback(null)
    try {
      const res = await validateXhsCookie(cookie.trim(), adminToken)
      const valid = res.data?.valid ?? res.success
      setFeedback({ type: valid ? 'success' : 'error', text: res.data?.message || res.message || '' })
    } catch (error) {
      setFeedback({ type: 'error', text: extractErrorText(error, t('settings.xhsRequestFailed')) })
    } finally {
      setBusy('')
    }
  }

  const handleSave = async () => {
    if (!ready()) return
    setBusy('save')
    setFeedback(null)
    try {
      const res = await saveXhsCookie(cookie.trim(), adminToken)
      setFeedback({ type: 'success', text: res.message || t('settings.xhsSaved') })
      setCookie('')
      message.success(res.message || t('settings.xhsSaved'))
      onSaved()
    } catch (error) {
      setFeedback({ type: 'error', text: extractErrorText(error, t('settings.xhsSaveFailed')) })
    } finally {
      setBusy('')
    }
  }

  return (
    <section aria-labelledby="settings-xhs-title" className="settings-xhs-panel">
      <div className="settings-section-title">
        <SafetyCertificateOutlined aria-hidden="true" />
        <div>
          <Typography.Title id="settings-xhs-title" level={2}>{t('settings.xhsPanelTitle')}</Typography.Title>
          <Typography.Text type="secondary">{t('settings.xhsPanelSubtitle')}</Typography.Text>
        </div>
      </div>

      <Card className={`settings-service-card${configured ? ' is-ready' : ''}`}>
        <div className="settings-card-heading">
          <Typography.Text type="secondary">{t('settings.xhsCookieHelp')}</Typography.Text>
          <StatusTag configured={configured} />
        </div>

        <Input.TextArea
          className="settings-xhs-cookie"
          value={cookie}
          onChange={(event) => setCookie(event.target.value)}
          placeholder="abRequestId=...; a1=...; web_session=..."
          autoSize={{ minRows: 3, maxRows: 6 }}
          spellCheck={false}
          aria-label={t('settings.xhsCookieHelp')}
        />

        <div className="settings-xhs-row">
          <Input.Password
            className="settings-xhs-token"
            value={adminToken}
            onChange={(event) => setAdminToken(event.target.value)}
            placeholder={t('settings.xhsAdminToken')}
            aria-label={t('settings.xhsAdminToken')}
          />

          <Space wrap>
            <Button type="primary" loading={busy === 'validate'} disabled={busy === 'save'} onClick={() => void handleValidate()}>
              {t('settings.xhsValidate')}
            </Button>
            <Button loading={busy === 'save'} disabled={busy === 'validate'} onClick={() => void handleSave()}>
              {t('settings.xhsSave')}
            </Button>
          </Space>
        </div>

        <p className="settings-xhs-hint">{t('settings.xhsAdminTokenHelp')}</p>

        {feedback && (
          <Alert
            className="settings-xhs-feedback"
            type={feedback.type === 'info' ? 'warning' : feedback.type}
            showIcon
            title={feedback.text}
          />
        )}
      </Card>
    </section>
  )
}

function Settings() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [settings, setSettings] = useState<Partial<BackendRuntimeSettings>>()
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    getBackendRuntimeSettings()
      .then((data) => {
        if (cancelled) return
        if (!data) throw new Error('Settings payload is empty')
        setSettings(data)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reloadToken])

  const goHome = () => navigate('/')
  const retry = () => {
    setLoading(true)
    setFailed(false)
    setReloadToken((value) => value + 1)
  }
  const providers = settings?.llm_providers ?? []
  /** 中转站供应商由本页创建，key 固定为 relay */
  const relayProvider = providers.find((provider) => provider.key === 'relay')
  const activeProviderModel = providers.find(
    (provider) => provider.key === settings?.llm_active_provider,
  )?.model ?? ''
  /**
   * 高德：后端返回 amap_maps_configured 表示服务端 Key 已配置；
   * 老版本后端不返回该字段，此时回落到浏览器端 Web JS Key 是否存在，
   * 避免卡片永远显示「未配置」。
   */
  const amapConfigured = settings?.amap_maps_configured ?? Boolean(getAmapWebJsKey())
  const services: ServiceCardProps[] = [
    {
      name: t('settings.amapMaps'),
      description: t('settings.amapMapsDetail'),
      guide: t('settings.amapMapsGuide'),
      configured: amapConfigured,
    },
    {
      name: t('settings.tencentMaps'),
      description: t('settings.tencentMapsDetail'),
      guide: t('settings.tencentMapsGuide'),
      configured: settings?.tencent_maps_configured === true,
    },
    {
      name: t('settings.googleMaps'),
      description: t('settings.googleMapsDetail'),
      guide: t('settings.googleMapsGuide'),
      configured: settings?.google_maps_configured === true,
    },
    {
      name: t('settings.xhs'),
      description: t('settings.xhsDetail'),
      guide: t('settings.xhsGuide'),
      configured: settings?.xhs_configured === true,
    },
  ]

  return (
    <div className="settings-page">
      <NavBar onBrandClick={goHome} onCtaClick={goHome} />
      <main className="settings-main">
        <Button className="settings-back" type="text" icon={<ArrowLeftOutlined />} onClick={goHome}>
          {t('settings.backHome')}
        </Button>

        <header className="settings-hero">
          <span className="settings-eyebrow">{t('settings.eyebrow')}</span>
          <Typography.Title>{t('settings.title')}</Typography.Title>
          <Typography.Paragraph>{t('settings.subtitle')}</Typography.Paragraph>
        </header>

        <Alert
          className="settings-security"
          type="info"
          showIcon
          icon={<SafetyCertificateOutlined />}
          title={t('settings.securityTitle')}
          description={t('settings.securityDetail')}
        />

        {loading && (
          <div className="settings-state" role="status">
            <Spin size="large" />
            <span>{t('settings.loading')}</span>
          </div>
        )}

        {!loading && failed && (
          <div className="settings-state">
            <Alert
              type="error"
              showIcon
              title={t('settings.loadFailed')}
              description={t('settings.loadFailedDetail')}
              action={<Button onClick={retry}>{t('settings.retry')}</Button>}
            />
          </div>
        )}

        {!loading && !failed && (
          <div className="settings-content">
            <section aria-labelledby="settings-llm-title">
              <div className="settings-section-title">
                <CloudServerOutlined aria-hidden="true" />
                <div>
                  <Typography.Title id="settings-llm-title" level={2}>{t('settings.llmTitle')}</Typography.Title>
                  <Typography.Text type="secondary">
                    {t('settings.activeProvider')}: <strong>{settings?.llm_active_provider || t('common.none')}</strong>
                  </Typography.Text>
                </div>
              </div>
              {providers.length > 0
                ? <div className="settings-grid">{providers.map((provider) => <ProviderCard key={provider.key} provider={provider} />)}</div>
                : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('settings.noProviders')} />}
            </section>

            <RelayModelPanel
              configured={relayProvider?.configured === true}
              activeProvider={settings?.llm_active_provider || ''}
              activeModel={activeProviderModel}
              secretUpdatesEnabled={settings?.secret_updates_enabled !== false}
              onSaved={() => setReloadToken((value) => value + 1)}
            />

            <MapBasemapPanel />

            <section aria-labelledby="settings-services-title">
              <div className="settings-section-title">
                <ApiOutlined aria-hidden="true" />
                <Typography.Title id="settings-services-title" level={2}>{t('settings.servicesTitle')}</Typography.Title>
              </div>
              <div className="settings-grid">
                {services.map((service) => <ServiceCard key={service.name} {...service} />)}
              </div>
            </section>

            <XhsCookiePanel
              configured={settings?.xhs_configured === true}
              onSaved={() => setReloadToken((value) => value + 1)}
            />
          </div>
        )}
      </main>
    </div>
  )
}

export default Settings
