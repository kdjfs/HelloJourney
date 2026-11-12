import { useState, useEffect, useRef, useCallback, Fragment, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Form, Input, InputNumber, Select, DatePicker, Button, message, Progress } from 'antd'
import type { FormInstance } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { useTranslation } from 'react-i18next'
import { getTripHistory } from '../../services/tripApi'
import { useGeneration } from '../../features/generation/model/generationContext'
import NavBar from '../../components/NavBar'
import type { TripFormData, TripHistoryItem } from '../../types/api'
import { normalizeAppLocale } from '../../i18n'
import './index.css'

/* 偏好选项 */
const INTEREST_OPTIONS = [
  { value: '历史文化', labelKey: 'landing.interestHistory' },
  { value: '自然风光', labelKey: 'landing.interestNature' },
  { value: '美食', labelKey: 'landing.interestFood' },
  { value: '购物', labelKey: 'landing.interestShopping' },
  { value: '艺术', labelKey: 'landing.interestArt' },
  { value: '休闲', labelKey: 'landing.interestLeisure' },
]

/* 常用城市（点击或输入回车添加） */
const CITY_OPTIONS = [
  '北京', '上海', '广州', '深圳', '杭州', '成都', '重庆', '西安', '南京', '苏州',
  '天津', '武汉', '长沙', '厦门', '青岛', '三亚', '昆明', '大理', '桂林', '哈尔滨',
].map((city) => ({ value: city, label: city }))

const MAX_TRIP_DAYS = 30

const STAGE_LABEL_KEYS: Record<string, string> = {
  submitted: 'landing.stageSubmitted',
  initializing: 'landing.stageSubmitted',
  attraction_search: 'landing.stageAttractions',
  weather_search: 'landing.stageWeather',
  hotel_search: 'landing.stageHotels',
  planning: 'landing.stagePlanning',
  review: 'landing.stageReview',
  graph_building: 'landing.stageGraph',
  completed: 'landing.stageCompleted',
  failed: 'landing.stageFailed',
  cancelled: 'landing.stageCancelled',
}

/**
 * 途经城市路线回显。
 * 单独成组件是刻意的性能修复：Form.useWatch 会让「调用它的组件」在每次按键时重渲染，
 * 之前它就在 Landing 顶层，导致输入目的地时整个页面（Hero、表单、历史列表）全部重绘。
 */
const RoutePreview = memo(function RoutePreview({
  form,
  additionalCities,
  travelDays,
}: {
  form: FormInstance<TripFormData>
  additionalCities: string[]
  travelDays: number
}) {
  const { t } = useTranslation()
  const watchedCity = Form.useWatch('city', form)
  const routePreview = [watchedCity, ...additionalCities]
    .map((item) => (item || '').trim())
    .filter(Boolean)

  if (routePreview.length === 0) return null

  return (
    <div className="route-preview" aria-label={t('landing.routePreview')}>
      {routePreview.map((cityName, index) => (
        <Fragment key={`${cityName}-${index}`}>
          {index > 0 && <span className="route-arrow" aria-hidden="true">→</span>}
          <span className={`route-chip${index === 0 ? ' route-chip-main' : ''}`}>{cityName}</span>
        </Fragment>
      ))}
      <span className="route-total">{t('common.daysCount', { count: travelDays })}</span>
    </div>
  )
})

function Landing() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [form] = Form.useForm<TripFormData>()
  const currentLocale = normalizeAppLocale(i18n.resolvedLanguage)
  const stageLabels = Object.fromEntries(
    Object.entries(STAGE_LABEL_KEYS).map(([stage, key]) => [stage, t(key)]),
  )

  /* 生成任务由全局 Provider 持有：切页/刷新都不会丢 */
  const {
    snapshot: generation,
    events: activityEvents,
    isRunning: loading,
    start: startGeneration,
    cancel: cancelGeneration,
    dismiss: dismissGeneration,
  } = useGeneration()
  const loadingProgress = generation?.status === 'completed' ? 100 : (generation?.progress ?? 0)
  const loadingStatus = generation?.message ?? ''
  const planCode = generation?.planId ?? ''
  const generationError = generation?.status === 'failed' || generation?.status === 'cancelled'
    ? (generation.error ?? '')
    : ''

  /* 偏好选择（自定义 pill 按钮需要单独管理） */
  const [preferences, setPreferences] = useState<string[]>(['历史文化', '美食'])
  const [freeTextInput, setFreeTextInput] = useState('')
  const [additionalCities, setAdditionalCities] = useState<string[]>([])
  const [travelDays, setTravelDays] = useState(3)

  /* 日期选择：默认从明天开始、共 3 天 */
  const [startDate, setStartDate] = useState<Dayjs | null>(dayjs().add(1, 'day').startOf('day'))
  const [endDate, setEndDate] = useState<Dayjs | null>(dayjs().add(3, 'day').startOf('day'))

  /* 滚动 —— 直接用 ref 写样式，避免每帧 setState 触发整页重渲染 */
  const formRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const heroContentRef = useRef<HTMLDivElement>(null)
  const [navSolid, setNavSolid] = useState(false)
  /* 生成中锁住表单卡高度，避免切换到进度态时页面整体上跳 */
  const [panelMinHeight, setPanelMinHeight] = useState<number | null>(null)

  /* 历史记录 */
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyPlans, setHistoryPlans] = useState<TripHistoryItem[]>([])

  /* 日期变化自动计算天数，并自动修正非法区间 */
  const handleStartDateChange = useCallback((date: Dayjs | null) => {
    setStartDate(date)
    if (!date) return
    const days = endDate ? endDate.diff(date, 'day') + 1 : travelDays
    if (days > MAX_TRIP_DAYS) {
      setEndDate(date.add(MAX_TRIP_DAYS - 1, 'day'))
      setTravelDays(MAX_TRIP_DAYS)
      message.warning(t('landing.maxDaysAdjusted'))
    } else if (days < 1) {
      setEndDate(date.add(travelDays - 1, 'day'))
      setTravelDays(travelDays)
      message.info(t('landing.endAdjusted'))
    } else {
      setTravelDays(days)
    }
  }, [endDate, t, travelDays])

  const handleEndDateChange = useCallback((date: Dayjs | null) => {
    setEndDate(date)
    if (!date || !startDate) return
    const days = date.diff(startDate, 'day') + 1
    if (days > MAX_TRIP_DAYS) {
      setEndDate(startDate.add(MAX_TRIP_DAYS - 1, 'day'))
      setTravelDays(MAX_TRIP_DAYS)
      message.warning(t('landing.maxDaysAdjusted'))
    } else if (days < 1) {
      setEndDate(null)
      message.warning(t('landing.endBeforeStart'))
    } else {
      setTravelDays(days)
    }
  }, [startDate, t])

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const scrollToForm = useCallback(() => {
    if (formRef.current) {
      const y = formRef.current.getBoundingClientRect().top + window.scrollY - 76
      window.scrollTo({ top: y, behavior: 'smooth' })
    }
  }, [])

  /* 头图视差 + 导航实心化：全部走 rAF，只在跨过阈值时 setState 一次 */
  useEffect(() => {
    let frame = 0
    let solid = false
    const applyScrollStyles = () => {
      frame = 0
      const y = window.scrollY || 0
      const progress = Math.min(y / 380, 1)
      if (heroContentRef.current) {
        heroContentRef.current.style.opacity = String(1 - progress * 0.9)
        heroContentRef.current.style.transform = `translate3d(0, ${-progress * 40}px, 0)`
      }
      const nextSolid = y > 24
      if (nextSolid !== solid) {
        solid = nextSolid
        setNavSolid(nextSolid)
      }
    }
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(applyScrollStyles)
    }
    applyScrollStyles()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  useEffect(() => {
    const fetchHistory = async () => {
      setHistoryLoading(true)
      try {
        const items = await getTripHistory(8)
        setHistoryPlans(items)
      } catch {
        setHistoryPlans([])
      } finally {
        setHistoryLoading(false)
      }
    }
    void fetchHistory()
  }, [])

  /* 偏好切换 */
  const togglePreference = (value: string) => {
    setPreferences((prev) => {
      if (prev.includes(value)) return prev.filter((v) => v !== value)
      return [...prev, value]
    })
  }

  /* 打开历史计划 */
  const openHistoryPlan = (planId: string) => {
    if (!planId) return
    sessionStorage.removeItem('tripPlan')
    sessionStorage.removeItem('graphData')
    sessionStorage.removeItem('tripReview')
    sessionStorage.removeItem('tripWarnings')
    sessionStorage.removeItem('tripPlanLocale')
    sessionStorage.removeItem('tripRequest')
    sessionStorage.setItem('planId', planId)
    navigate(`/result?plan_id=${planId}`)
  }

  /* 格式化历史时间 */
  const formatHistoryTime = (value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString(currentLocale)
  }

  /* 提交表单：校验与请求组装留在页面，任务本身交给全局 Provider */
  const handleSubmit = () => {
    if (loading) return
    if (!startDate || !endDate) {
      message.error(t('landing.dateRequired'))
      return
    }

    const city = form.getFieldValue('city')
    if (!city) {
      message.error(t('landing.cityRequired'))
      return
    }

    const allCities = [city, ...additionalCities]
      .map((item) => item.trim())
      .filter((item, index, items) => item && items.indexOf(item) === index)
    if (allCities.length > travelDays) {
      message.error(t('landing.daysLessThanCities'))
      return
    }

    const baseDays = Math.floor(travelDays / allCities.length)
    const remainder = travelDays % allCities.length

    const requestData: TripFormData = {
      city,
      cities: allCities.map((cityName, index) => ({ city: cityName, days: baseDays + (index < remainder ? 1 : 0) })),
      start_date: startDate.format('YYYY-MM-DD'),
      end_date: endDate.format('YYYY-MM-DD'),
      travel_days: travelDays,
      transportation: form.getFieldValue('transportation') || '公共交通',
      accommodation: form.getFieldValue('accommodation') || '经济型酒店',
      travelers: form.getFieldValue('travelers') || 1,
      budget_limit: form.getFieldValue('budget_limit'),
      preferences,
      free_text_input: freeTextInput,
      language: currentLocale,
    }

    // 生成中锁住表单卡高度，避免切到进度态时整页上跳
    if (panelRef.current) setPanelMinHeight(panelRef.current.offsetHeight)
    startGeneration(requestData)
  }

  /* 任务结束后放开高度锁：只要不在生成中，就不再把旧高度写回样式 */
  const panelStyle = loading && panelMinHeight ? { minHeight: panelMinHeight } : undefined

  /* 加载阶段节点的状态判断 */
  const getNodeClass = (minProgress: number, maxProgress: number) => {
    if (loadingProgress > maxProgress) return 'completed'
    if (loadingProgress >= minProgress && loadingProgress <= maxProgress) return 'active'
    return ''
  }

  const getDividerClass = (threshold: number) => {
    return loadingProgress > threshold ? 'completed' : ''
  }

  const getNodeLabel = (threshold: number, completedLabel: string, activeLabel: string) => {
    return loadingProgress > threshold ? completedLabel : activeLabel
  }

  return (
    <div className="landing-page">
      <NavBar transparent={!navSolid} onBrandClick={scrollToTop} onCtaClick={scrollToForm} />

      {/* ---------------- Hero ---------------- */}
      <header className="landing-hero">
        <div className="landing-hero-bg" aria-hidden="true">
          <span className="hero-glow hero-glow--jade" />
          <span className="hero-glow hero-glow--clay" />
          <span className="hero-grid" />
          <svg className="hero-route" viewBox="0 0 1200 620" preserveAspectRatio="none">
            <path
              className="hero-route-line"
              d="M-60 470C170 350 300 520 520 372S880 196 1260 286"
            />
            <circle className="hero-route-pin" cx="520" cy="372" r="7" />
            <circle className="hero-route-pin" cx="880" cy="243" r="7" />
          </svg>
        </div>

        <div className="landing-hero-inner" ref={heroContentRef}>
          <p className="hero-eyebrow">HelloJourney</p>
          <h1 className="hero-title">{t('landing.heroSubtitle')}</h1>
          <p className="hero-sub">{t('landing.progressSubtitle')}</p>
          <div className="hero-actions">
            <button type="button" className="btn hero-cta" onClick={scrollToForm}>
              {t('landing.generate')}
            </button>
          </div>
        </div>

        <button type="button" className="hero-scroll-hint" onClick={scrollToForm} aria-hidden="true" tabIndex={-1}>
          <span />
        </button>
      </header>

      {/* ---------------- 表单 ---------------- */}
      <section ref={formRef} className="form-section" aria-label={t('landing.stepDestination')}>
        <div
          ref={panelRef}
          className="form-panel"
          style={panelStyle}
        >
          {!loading && (
            <Form form={form} layout="vertical" initialValues={{
              city: '北京',
              transportation: '公共交通',
              accommodation: '经济型酒店',
              travelers: 2,
            }}>
              {generationError && (
                <Alert
                  className="generation-alert"
                  type="error"
                  showIcon
                  title={t('landing.previousFailed')}
                  description={generationError}
                  closable
                  onClose={() => dismissGeneration()}
                />
              )}

              {/* Step 01: 目的地与日期 */}
              <div className="step">
                <div className="step-head">
                  <span className="step-index">01</span>
                  <h3>{t('landing.stepDestination')}</h3>
                </div>
                <div className="grid grid4">
                  <Form.Item
                    name="city"
                    label={t('landing.fieldCity')}
                    rules={[{ required: true, message: t('landing.cityRequired') }]}
                  >
                    <Input
                      placeholder={t('landing.cityPlaceholder')}
                      size="large"
                      className="field-input"
                    />
                  </Form.Item>

                  <Form.Item label={t('landing.startDate')}>
                    <DatePicker
                      value={startDate}
                      onChange={handleStartDateChange}
                      placeholder={t('landing.startDate')}
                      size="large"
                      allowClear={false}
                      className="field-input"
                      style={{ width: '100%' }}
                      disabledDate={(current) => current && current < dayjs().startOf('day')}
                    />
                  </Form.Item>

                  <Form.Item label={t('landing.endDate')}>
                    <DatePicker
                      value={endDate}
                      onChange={handleEndDateChange}
                      placeholder={t('landing.endDate')}
                      size="large"
                      allowClear={false}
                      className="field-input"
                      style={{ width: '100%' }}
                      disabledDate={(current) => current && (current < dayjs().startOf('day') || (startDate !== null && current < startDate.startOf('day')))}
                    />
                  </Form.Item>

                  <Form.Item label={t('landing.fieldDays')}>
                    <div className="days-chip" aria-live="polite">
                      <span className="days-number">{travelDays}</span>
                      <span className="days-unit">{t('landing.dayUnit')}</span>
                    </div>
                  </Form.Item>
                </div>

                <div className="city-route-field">
                  <label className="field-label" htmlFor="additional-cities">{t('landing.transitCities')}</label>
                  <Select
                    id="additional-cities"
                    mode="tags"
                    value={additionalCities}
                    onChange={setAdditionalCities}
                    tokenSeparators={['、', ',', '，']}
                    placeholder={t('landing.transitPlaceholder')}
                    size="large"
                    className="field-select"
                    maxCount={8}
                    options={CITY_OPTIONS}
                    aria-label={t('landing.transitAria')}
                  />
                  <RoutePreview form={form} additionalCities={additionalCities} travelDays={travelDays} />
                </div>
              </div>

              {/* Step 02: 偏好设置 */}
              <div className="step">
                <div className="step-head">
                  <span className="step-index">02</span>
                  <h3>{t('landing.stepPreferences')}</h3>
                </div>

                <div className="grid grid4">
                  <Form.Item name="transportation" label={t('landing.fieldTransport')}>
                    <Select
                      size="large"
                      className="field-select"
                      options={[
                        { value: '公共交通', label: t('landing.transportPublic') },
                        { value: '自驾', label: t('landing.transportDrive') },
                        { value: '步行', label: t('landing.transportWalk') },
                        { value: '混合', label: t('landing.transportMixed') },
                      ]}
                    />
                  </Form.Item>

                  <Form.Item name="accommodation" label={t('landing.fieldHotel')}>
                    <Select
                      size="large"
                      className="field-select"
                      options={[
                        { value: '经济型酒店', label: t('landing.hotelBudget') },
                        { value: '舒适型酒店', label: t('landing.hotelComfort') },
                        { value: '豪华酒店', label: t('landing.hotelLuxury') },
                        { value: '民宿', label: t('landing.hotelHomestay') },
                      ]}
                    />
                  </Form.Item>

                  <Form.Item name="travelers" label={t('landing.travelers')} rules={[{ required: true, message: t('landing.travelersRequired') }]}>
                    <InputNumber
                      min={1}
                      max={20}
                      precision={0}
                      size="large"
                      className="field-number"
                      suffix={<span className="field-unit">{t('landing.peopleUnit')}</span>}
                      aria-label={t('landing.travelers')}
                    />
                  </Form.Item>

                  <Form.Item name="budget_limit" label={t('landing.budget')}>
                    <InputNumber
                      min={0}
                      max={10000000}
                      precision={0}
                      step={500}
                      size="large"
                      className="field-number"
                      prefix={<span className="field-unit">¥</span>}
                      placeholder={t('landing.budgetPlaceholder')}
                      aria-label={t('landing.budgetAria')}
                    />
                  </Form.Item>
                </div>

                <div className="interest-grid">
                  <div className="interest-group">
                    {INTEREST_OPTIONS.map((item) => (
                      <label
                        key={item.value}
                        className={`interest-pill${preferences.includes(item.value) ? ' active' : ''}`}
                        onClick={(e) => {
                          e.preventDefault()
                          togglePreference(item.value)
                        }}
                      >
                        {t(item.labelKey)}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Step 03: 额外要求 */}
              <div className="step">
                <div className="step-head">
                  <span className="step-index">03</span>
                  <h3>{t('landing.stepNotes')}</h3>
                </div>
                <Input.TextArea
                  value={freeTextInput}
                  onChange={(e) => setFreeTextInput(e.target.value)}
                  placeholder={t('landing.notesPlaceholder')}
                  rows={3}
                  size="large"
                  className="special-textarea field-textarea"
                />
              </div>

              <div className="submit-wrapper">
                <button
                  type="button"
                  className={`btn submit-btn${loading ? ' loading' : ''}`}
                  disabled={loading}
                  onClick={() => void handleSubmit()}
                >
                  {!loading
                    ? t('landing.generate')
                    : (
                      <span className="loading-row">
                        <i className="spinner" />
                        {t('landing.generating')}
                      </span>
                    )}
                </button>
              </div>
            </Form>
          )}

          {/* 加载状态 - 节点式进度动画 */}
          {loading && (
            <div className="stepper-wrapper">
              <div className="stepper-header">
                <p className="hj-eyebrow">{planCode ? `Plan #${planCode}` : t('landing.progressPlan')}</p>
                <h2 className="stepper-title">{loadingStatus || t('landing.progressPlan')}</h2>
                <p className="stepper-subtitle">
                  {loadingProgress < 100 ? t('landing.waiting') : t('landing.redirecting')}
                </p>
              </div>

              <Progress
                percent={loadingProgress}
                status={loadingProgress >= 100 ? 'success' : 'active'}
                showInfo={false}
                strokeColor="#12695c"
                trailColor="var(--hj-surface-3)"
                style={{ width: '100%', maxWidth: 560, margin: '0 auto 34px' }}
              />

              <div className="stepper-container">
                <div className={`step-node ${getNodeClass(0, 30)}`}>
                  <div className="node-icon">
                    {loadingProgress >= 0 && loadingProgress <= 30
                      ? <i className="spinner-small" />
                      : <span aria-hidden="true">1</span>}
                  </div>
                  <p className="node-text">
                    {getNodeLabel(30, t('landing.attractionsDone'), t('landing.attractionsActive'))}
                  </p>
                </div>
                <div className={`step-divider ${getDividerClass(30)}`} />

                <div className={`step-node ${getNodeClass(30, 50)}`}>
                  <div className="node-icon">
                    {loadingProgress > 30 && loadingProgress <= 50
                      ? <i className="spinner-small" />
                      : <span aria-hidden="true">2</span>}
                  </div>
                  <p className="node-text">
                    {getNodeLabel(50, t('landing.weatherDone'), t('landing.weatherActive'))}
                  </p>
                </div>
                <div className={`step-divider ${getDividerClass(50)}`} />

                <div className={`step-node ${getNodeClass(50, 70)}`}>
                  <div className="node-icon">
                    {loadingProgress > 50 && loadingProgress <= 70
                      ? <i className="spinner-small" />
                      : <span aria-hidden="true">3</span>}
                  </div>
                  <p className="node-text">
                    {getNodeLabel(70, t('landing.hotelsDone'), t('landing.hotelsActive'))}
                  </p>
                </div>
                <div className={`step-divider ${getDividerClass(70)}`} />

                <div className={`step-node ${getNodeClass(70, 99)}`}>
                  <div className="node-icon">
                    {loadingProgress > 70 && loadingProgress < 100
                      ? <i className="spinner-small" />
                      : <span aria-hidden="true">4</span>}
                  </div>
                  <p className="node-text">
                    {loadingProgress >= 100 ? t('landing.complete') : t('landing.planningActive')}
                  </p>
                </div>
              </div>

              {activityEvents.length > 0 && (
                <ol className="agent-activity" aria-label={t('landing.agentActivity')} aria-live="polite">
                  {activityEvents.slice(-4).map((event, index) => {
                    const stageLabel = stageLabels[event.stage] || event.stage
                    return (
                      <li key={`${event.stage}-${event.progress}-${index}`}>
                        <span>{event.progress}%</span>
                        <strong>{stageLabel}</strong>
                        {event.message && event.message !== stageLabel && <small>{event.message}</small>}
                      </li>
                    )
                  })}
                </ol>
              )}

              {loadingProgress < 100 && (
                <Button className="cancel-generation" onClick={() => cancelGeneration()}>
                  {t('landing.cancel')}
                </Button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ---------------- 历史计划 ---------------- */}
      <section className="history-section">
        <div className="history-panel">
          <div className="history-head">
            <div>
              <p className="hj-eyebrow">{t('landing.historyEyebrow')}</p>
              <h2 className="history-title">{t('landing.historyTitle')}</h2>
            </div>
            <Button
              type="link"
              className="history-refresh"
              onClick={async () => {
                setHistoryLoading(true)
                try {
                  const items = await getTripHistory(8)
                  setHistoryPlans(items)
                } catch {
                  setHistoryPlans([])
                } finally {
                  setHistoryLoading(false)
                }
              }}
            >
              {t('landing.refresh')}
            </Button>
          </div>

          {historyLoading && (
            <div className="history-loading">{t('landing.historyLoading')}</div>
          )}

          {!historyLoading && historyPlans.length === 0 && (
            <div className="history-empty">{t('landing.historyEmpty')}</div>
          )}

          {!historyLoading && historyPlans.length > 0 && (
            <div className="history-list">
              {historyPlans.map((item) => (
                <button
                  key={item.plan_id}
                  type="button"
                  className="history-item"
                  onClick={() => openHistoryPlan(item.plan_id)}
                >
                  <div className="history-item-main">
                    <div className="history-route">
                      <span className="history-city">{item.city}</span>
                      <span className="history-date">
                        {item.start_date} — {item.end_date}
                      </span>
                    </div>
                    <p className="history-meta">
                      <span>{t('common.daysCount', { count: item.travel_days })}</span>
                      <span>{t('landing.updatedAt', { time: formatHistoryTime(item.updated_at) })}</span>
                    </p>
                    {item.overall_suggestions && (
                      <p className="history-summary">{item.overall_suggestions}</p>
                    )}
                  </div>
                  <span className="history-open" aria-hidden="true">→</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default Landing
