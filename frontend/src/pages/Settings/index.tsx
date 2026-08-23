import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ApiOutlined,
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloudServerOutlined,
  SafetyCertificateOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { Alert, Button, Card, Empty, Spin, Tag, Typography } from 'antd'
import { useTranslation } from 'react-i18next'
import NavBar from '@/components/NavBar'
import { getBackendRuntimeSettings } from '@/services/settingsApi'
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

export default function Settings() {
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
  const services: ServiceCardProps[] = [
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

            <section aria-labelledby="settings-services-title">
              <div className="settings-section-title">
                <ApiOutlined aria-hidden="true" />
                <Typography.Title id="settings-services-title" level={2}>{t('settings.servicesTitle')}</Typography.Title>
              </div>
              <div className="settings-grid">
                {services.map((service) => <ServiceCard key={service.name} {...service} />)}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  )
}
