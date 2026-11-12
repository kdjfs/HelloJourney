import { useMemo, useState } from 'react'
import { Button, Card, Input, Select, Space, Tag, Typography } from 'antd'
import { ApiOutlined, CloudServerOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { listLlmModels, saveRelayProvider } from '@/services/settingsApi'
import { normalizeRelayBaseUrl } from '../model/relayUrl'
import { filterChatModels, pickPreferredModel } from '../model/modelCatalog'

interface RelayModelPanelProps {
  /** 后端是否已保存过中转站供应商 */
  configured: boolean
  /** 当前生效的供应商与模型，用于回显 */
  activeProvider: string
  activeModel: string
  /** 后端是否开启敏感配置写入；false 时提交必然 403 */
  secretUpdatesEnabled: boolean
  onSaved: () => void
}

type Feedback = { type: 'success' | 'error' | 'info'; text: string } | null

/**
 * 模型中转站配置面板。
 *
 * 一次配置「地址 + 密钥」，从 OpenAI 兼容的 /models 拉到可用模型（GLM / Kimi / 豆包 / GPT…），
 * 选一个作为规划用模型并切换为激活供应商。密钥只提交给后端保存，不写前端存储。
 */
const BASE_URL_STORAGE_KEY = 'hj.relayBaseUrl'
const DEFAULT_BASE_URL = 'https://api.siliconflow.cn/v1'

function readStoredBaseUrl(): string {
  try {
    return localStorage.getItem(BASE_URL_STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

function storeBaseUrl(value: string): void {
  try {
    if (value) localStorage.setItem(BASE_URL_STORAGE_KEY, value)
  } catch {
    // 隐私模式下忽略
  }
}

/**
 * 地址与管理员令牌的默认值。
 *
 * 优先用 `.env.local` 里的 `VITE_RELAY_BASE_URL` / `VITE_ADMIN_TOKEN`（该文件不进仓库），
 * 这样本机打开就已经填好、不用每次手敲；仓库里不会出现任何口令。
 */
function defaultBaseUrl(): string {
  return (import.meta.env.VITE_RELAY_BASE_URL as string | undefined)?.trim()
    || readStoredBaseUrl()
    || DEFAULT_BASE_URL
}

function defaultAdminToken(): string {
  return (import.meta.env.VITE_ADMIN_TOKEN as string | undefined)?.trim() || ''
}

export default function RelayModelPanel({
  configured,
  activeProvider,
  activeModel,
  secretUpdatesEnabled,
  onSaved,
}: RelayModelPanelProps) {
  const { t } = useTranslation()
  const [baseUrl, setBaseUrl] = useState(defaultBaseUrl)
  const [apiKey, setApiKey] = useState('')
  const [adminToken, setAdminToken] = useState(defaultAdminToken)
  const [model, setModel] = useState(activeModel || '')
  const [models, setModels] = useState<string[]>([])
  const [busy, setBusy] = useState<'fetch' | 'save' | ''>('')
  const [feedback, setFeedback] = useState<Feedback>(null)

  /** 只保留能对话的模型；已保存的模型即使被过滤也要显示出来，否则框里会变空 */
  const chatModels = useMemo(() => {
    const list = filterChatModels(models)
    const saved = model.trim()
    return saved && !list.includes(saved) ? [saved, ...list] : list
  }, [model, models])

  const needAdminToken = () => {
    if (!adminToken.trim()) {
      setFeedback({ type: 'info', text: t('settings.xhsAdminTokenRequired') })
      return true
    }
    return false
  }

  const handleFetch = async () => {
    const normalized = normalizeRelayBaseUrl(baseUrl)
    if (normalized !== baseUrl.trim()) setBaseUrl(normalized)
    if (!normalized) {
      setFeedback({ type: 'info', text: t('settings.relayNeedBaseUrl') })
      return
    }
    if (needAdminToken()) return
    setBusy('fetch')
    setFeedback(null)
    storeBaseUrl(normalized)
    try {
      const result = await listLlmModels(normalized, apiKey, adminToken)
      const list = result.data?.models ?? []
      setModels(list)
      if (!list.length) {
        setFeedback({ type: 'error', text: result.message || t('settings.relayFetchEmpty') })
        return
      }
      const chatOnly = filterChatModels(list)
      setFeedback({
        type: 'success',
        text: t('settings.relayFetched', { count: list.length, chat: chatOnly.length }),
      })
      // 默认选中"能一次跑通规划"的模型，而不是列表里第一个
      const preferred = pickPreferredModel(chatOnly) ?? chatOnly[0] ?? list[0]
      if (!chatOnly.includes(model)) setModel(preferred)
    } catch (error) {
      setFeedback({
        type: 'error',
        text: extractError(error, t('settings.relayFetchFailed')),
      })
    } finally {
      setBusy('')
    }
  }

  const handleSave = async () => {
    const normalized = normalizeRelayBaseUrl(baseUrl)
    if (normalized !== baseUrl.trim()) setBaseUrl(normalized)
    if (!normalized) {
      setFeedback({ type: 'info', text: t('settings.relayNeedBaseUrl') })
      return
    }
    if (!model.trim()) {
      setFeedback({ type: 'info', text: t('settings.relayNeedModel') })
      return
    }
    if (needAdminToken()) return
    setBusy('save')
    setFeedback(null)
    storeBaseUrl(normalized)
    try {
      await saveRelayProvider(
        {
          key: 'relay',
          name: t('settings.relayProviderName'),
          baseUrl: normalized,
          apiKey,
          model,
        },
        adminToken,
      )
      setFeedback({ type: 'success', text: t('settings.relaySaved') })
      setApiKey('')
      onSaved()
    } catch (error) {
      setFeedback({
        type: 'error',
        text: extractError(error, t('settings.relaySaveFailed')),
      })
    } finally {
      setBusy('')
    }
  }

  return (
    <section aria-labelledby="settings-relay-title" className="settings-relay-panel">
      <div className="settings-section-title">
        <CloudServerOutlined aria-hidden="true" />
        <div>
          <Typography.Title id="settings-relay-title" level={2}>{t('settings.relayTitle')}</Typography.Title>
          <Typography.Text type="secondary">{t('settings.relaySubtitle')}</Typography.Text>
        </div>
      </div>

      <Card className={`settings-service-card${configured ? ' is-ready' : ''}`}>
        <div className="settings-card-heading">
          <Typography.Text type="secondary">
            {configured
              ? t('settings.relayActiveNow', {
                provider: activeProvider || t('settings.relayProviderName'),
                model: activeModel || '—',
              })
              : t('settings.relayInactive')}
          </Typography.Text>
          <Tag color={configured ? 'success' : 'warning'} icon={<ApiOutlined />}>
            {configured ? t('settings.configured') : t('settings.notConfigured')}
          </Tag>
        </div>

        {!secretUpdatesEnabled && (
          <p className="relay-alert relay-alert--warn" role="note">
            {t('settings.relaySecretDisabled')}
          </p>
        )}

        <div className="relay-grid">
          <label className="relay-field">
            <span className="relay-label">{t('settings.relayBaseUrl')}</span>
            <Input
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              onBlur={() => setBaseUrl((current) => normalizeRelayBaseUrl(current))}
              placeholder={t('settings.relayBaseUrlPlaceholder')}
              spellCheck={false}
              autoComplete="off"
              aria-label={t('settings.relayBaseUrl')}
            />
            <span className="relay-hint">{t('settings.relayBaseUrlHint')}</span>
          </label>

          <label className="relay-field">
            <span className="relay-label">{t('settings.relayApiKey')}</span>
            <Input.Password
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={t('settings.relayApiKeyPlaceholder')}
              autoComplete="new-password"
              aria-label={t('settings.relayApiKey')}
            />
          </label>
        </div>

        <div className="relay-grid relay-grid--split">
          <label className="relay-field">
            <span className="relay-label">{t('settings.relayModel')}</span>
            <Select
              className="relay-model-select"
              value={model || undefined}
              onChange={(value: string) => setModel(value)}
              options={chatModels.map((item) => ({ value: item, label: item }))}
              placeholder={t('settings.relayModelPlaceholder')}
              showSearch
              optionFilterProp="label"
              notFoundContent={t('settings.relayModelEmpty')}
              popupMatchSelectWidth={false}
              styles={{ popup: { root: { maxWidth: 520 } } }}
              aria-label={t('settings.relayModel')}
            />
            <span className="relay-hint">
              {models.length === 0 ? t('settings.relayModelNeedFetch') : t('settings.relayModelHint')}
            </span>
          </label>

          <label className="relay-field">
            <span className="relay-label">{t('settings.relayAdminToken')}</span>
            <Input.Password
              value={adminToken}
              onChange={(event) => setAdminToken(event.target.value)}
              placeholder={t('settings.relayAdminToken')}
              autoComplete="off"
              aria-label={t('settings.relayAdminToken')}
            />
            <span className="relay-hint">{t('settings.relayAdminTokenHint')}</span>
          </label>
        </div>

        <Space wrap>
          <Button loading={busy === 'fetch'} disabled={busy === 'save'} onClick={() => void handleFetch()}>
            {t('settings.relayFetch')}
          </Button>
          <Button
            type="primary"
            loading={busy === 'save'}
            disabled={busy === 'fetch'}
            onClick={() => void handleSave()}
          >
            {t('settings.relaySave')}
          </Button>
          {models.length > 0 && (
            <Typography.Text type="secondary" className="relay-count">
              {t('settings.relayModelCount', { count: models.length })}
            </Typography.Text>
          )}
        </Space>

        <p className="settings-xhs-hint">{t('settings.relayApiKeyHelp')}</p>

        {feedback && (
          <p className={`relay-feedback relay-feedback--${feedback.type}`} role="status">
            {feedback.text}
          </p>
        )}
      </Card>
    </section>
  )
}

function extractError(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const response = (error as { response?: { data?: { message?: string } } }).response
    const serverMessage = response?.data?.message
    if (typeof serverMessage === 'string' && serverMessage.trim()) return serverMessage
  }
  return fallback
}
