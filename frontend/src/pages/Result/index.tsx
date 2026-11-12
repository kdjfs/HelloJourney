import { lazy, Suspense, useCallback, useEffect, useState, useRef, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Card,
  Button,
  Empty,
  Spin,
  Popover,
  Image,
  Tag,
} from 'antd'
import {
  ArrowLeftOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  WarningFilled,
} from '@ant-design/icons'
import EditableTripDays from '../../features/trip-workspace/ui/EditableTripDays'
import { deriveWorkspaceBudget, workspacePlanSignature } from '../../features/trip-workspace/model/derivedPlan'
import TripExportActions from '../../features/export/ui/TripExportActions'
import BudgetPanel from '../../components/BudgetPanel'
import OverviewAttractionCard, { type OverviewAttractionItem } from '../../components/OverviewAttractionCard'
import { attractionImageCacheKey, resolveAttractionImage } from '../../services/poiApi'
import { pollTaskStatus } from '../../services/tripApi'
import { buildFallbackGraphData } from '../../utils/knowledgeGraph'
import type { TripPlan, KnowledgeGraphData, WeatherInfo, TripReviewResult } from '../../types/api'
import { normalizeAppLocale } from '../../i18n'
import './index.css'

const KnowledgeGraph = lazy(() => import('../../components/KnowledgeGraph'))
const AIChat = lazy(() => import('../../components/AIChat'))
const TripMap = lazy(() => import('../../components/TripMap'))

type WeatherIconKind = 'sunny' | 'sun-shower' | 'thunder-storm' | 'cloudy' | 'flurries' | 'rainy'

function getWeatherIconKind(weatherText: string): WeatherIconKind {
  const text = (weatherText || '').trim()
  const hasRain = /(雨|rain|shower|drizzle|sprinkle|阵雨|小雨|中雨|大雨|暴雨)/i.test(text)
  const hasSun = /(晴|sun|clear)/i.test(text)
  if (/(雷|thunder|storm|lightning|雷暴|雷阵雨)/i.test(text)) return 'thunder-storm'
  if (/(雪|snow|sleet|hail|冰雹|冻雨|雨夹雪)/i.test(text)) return 'flurries'
  if (hasRain && hasSun) return 'sun-shower'
  if (hasRain) return 'rainy'
  if (/(云|阴|cloud|overcast|雾|霾|fog|mist|haze|wind|breeze|gale)/i.test(text)) return 'cloudy'
  return 'sunny'
}

function getWeatherGradient(text: string): string {
  const t = (text || '').toLowerCase()
  if (/(雷|thunder)/.test(t)) return 'linear-gradient(150deg, #64748f 0%, #3b4563 100%)'
  if (/(雪|snow|sleet|hail)/.test(t)) return 'linear-gradient(150deg, #a8c6dc 0%, #7f9cb8 100%)'
  if (/(雨|rain|shower|drizzle)/.test(t)) return 'linear-gradient(150deg, #6a92b5 0%, #3f6484 100%)'
  if (/(雾|霾|fog|mist|haze)/.test(t)) return 'linear-gradient(150deg, #b0ada1 0%, #87847a 100%)'
  if (/(阴|cloud|overcast)/.test(t)) return 'linear-gradient(150deg, #9aa7ad 0%, #6a7a82 100%)'
  return 'linear-gradient(150deg, #eaa45f 0%, #d2683f 100%)'
}

function parseWeatherDate(rawDate: string): Date | null {
  if (!rawDate) return null
  const normalized = rawDate
    .replace(/年/g, '-').replace(/月/g, '-').replace(/日/g, '')
    .replace(/[./]/g, '-').trim()
  const d = new Date(normalized)
  if (!Number.isNaN(d.getTime())) return d
  const m = rawDate.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function formatWeatherDate(rawDate: string, locale: string): string {
  const d = parseWeatherDate(rawDate)
  if (!d) return rawDate || '--'
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric' }).format(d)
}

function formatWeatherWeekday(rawDate: string, locale: string, short = false): string {
  const d = parseWeatherDate(rawDate)
  if (!d) return rawDate || '--'
  return new Intl.DateTimeFormat(locale, { weekday: short ? 'short' : 'long' }).format(d)
}

function formatWeatherTemp(temp: number | string | null | undefined): string {
  if (!Number.isFinite(Number(temp))) return '--'
  return `${Math.round(Number(temp))}°C`
}

function WeatherIcon({ kind }: { kind: WeatherIconKind }) {
  return (
    <div className={`weather-hero-icon weather-icon ${kind}`}>
      {kind === 'sun-shower' && (
        <>
          <div className="cloud" />
          <div className="sun"><div className="rays" /></div>
          <div className="rain" />
        </>
      )}
      {kind === 'thunder-storm' && (
        <>
          <div className="cloud" />
          <div className="lightning">
            <div className="bolt" />
            <div className="bolt" />
          </div>
        </>
      )}
      {kind === 'cloudy' && (
        <>
          <div className="cloud" />
          <div className="cloud" />
        </>
      )}
      {kind === 'flurries' && (
        <>
          <div className="cloud" />
          <div className="snow">
            <div className="flake" />
            <div className="flake" />
          </div>
        </>
      )}
      {kind === 'rainy' && (
        <>
          <div className="cloud" />
          <div className="rain" />
        </>
      )}
      {kind === 'sunny' && (
        <div className="sun"><div className="rays" /></div>
      )}
    </div>
  )
}

function SmallWeatherIcon({ kind }: { kind: WeatherIconKind }) {
  return (
    <div className={`day-icon weather-icon weather-icon--small ${kind}`}>
      {kind === 'sun-shower' && (
        <>
          <div className="cloud" />
          <div className="sun"><div className="rays" /></div>
          <div className="rain" />
        </>
      )}
      {kind === 'thunder-storm' && (
        <>
          <div className="cloud" />
          <div className="lightning">
            <div className="bolt" />
            <div className="bolt" />
          </div>
        </>
      )}
      {kind === 'cloudy' && (
        <>
          <div className="cloud" />
          <div className="cloud" />
        </>
      )}
      {kind === 'flurries' && (
        <>
          <div className="cloud" />
          <div className="snow">
            <div className="flake" />
            <div className="flake" />
          </div>
        </>
      )}
      {kind === 'rainy' && (
        <>
          <div className="cloud" />
          <div className="rain" />
        </>
      )}
      {kind === 'sunny' && (
        <div className="sun"><div className="rays" /></div>
      )}
    </div>
  )
}

function getPrecipitation(text: string): string {
  const t = text.toLowerCase()
  if (/(雷|thunder|暴雨|storm)/.test(t)) return '85%'
  if (/(雨|rain|shower|drizzle)/.test(t)) return '65%'
  if (/(雪|snow|sleet|hail)/.test(t)) return '55%'
  if (/(阴|cloud|overcast)/.test(t)) return '30%'
  return '10%'
}

function getHumidity(text: string): string {
  const t = (text || '').toLowerCase()
  if (/(雨|rain|shower|drizzle|雷|thunder|暴雨|storm)/.test(t)) return '85%'
  if (/(阴|cloud|overcast|雪|snow)/.test(t)) return '65%'
  return '45%'
}

function getWind(weather: WeatherInfo, fallback: string): string {
  const dir = weather.wind_direction || ''
  const power = weather.wind_power || ''
  if (dir || power) return `${dir} ${power}`.trim()
  return fallback
}

function readStoredTripPlan(): TripPlan | null {
  const raw = sessionStorage.getItem('tripPlan')
  if (!raw) return null
  try { return JSON.parse(raw) as TripPlan } catch { return null }
}

/** The plan payload carries no traveler count or limit, so the request is kept too. */
function readStoredTripRequest(): { travelers?: number; budget_limit?: number } {
  const raw = sessionStorage.getItem('tripRequest')
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as { travelers?: number; budget_limit?: number }
    return {
      travelers: Number.isFinite(Number(parsed.travelers)) ? Number(parsed.travelers) : undefined,
      budget_limit: Number.isFinite(Number(parsed.budget_limit)) ? Number(parsed.budget_limit) : undefined,
    }
  } catch { return {} }
}

/** 同一句提示会重复几十次（例如「景点仍需地图服务确认」），先在数据层收敛。 */
function summarizeNotices(messages: string[]): Array<{ message: string; count: number }> {
  const counter = new Map<string, number>()
  for (const raw of messages) {
    const message = (raw || '').trim()
    if (!message) continue
    counter.set(message, (counter.get(message) ?? 0) + 1)
  }
  return [...counter.entries()]
    .map(([message, count]) => ({ message, count }))
    .sort((a, b) => b.count - a.count)
}

/** 限并发地跑异步任务，避免 20 张景点图串行请求把首屏拖成几十秒。 */
async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  if (items.length === 0) return
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      await worker(items[index])
    }
  })
  await Promise.all(runners)
}

/** 图标以「白天天气」为准；只有白天字段为空时才回落到夜间，避免「晴 / 多云」被判成阴天。 */
function weatherIconSource(weather: WeatherInfo): string {
  const day = (weather.day_weather || '').trim()
  if (day) return day
  return (weather.night_weather || '').trim()
}

function Result() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const urlPlanId = searchParams.get('plan_id')
  const currentLocale = normalizeAppLocale(i18n.resolvedLanguage)
  const generatedPlanLocale = sessionStorage.getItem('tripPlanLocale')

  const [tripPlan, setTripPlan] = useState<TripPlan | null>(readStoredTripPlan)
  const [sourcePlan, setSourcePlan] = useState<TripPlan | null>(readStoredTripPlan)

  const [graphData, setGraphData] = useState<KnowledgeGraphData | null>(() => {
    const raw = sessionStorage.getItem('graphData')
    if (!raw || raw === 'null') return null
    try { return JSON.parse(raw) } catch { return null }
  })

  const [tripReview, setTripReview] = useState<TripReviewResult | null>(() => {
    const raw = sessionStorage.getItem('tripReview')
    if (!raw) return null
    try { return JSON.parse(raw) } catch { return null }
  })

  const [degradedWarnings, setDegradedWarnings] = useState<string[]>(() => {
    const raw = sessionStorage.getItem('tripWarnings')
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
    } catch { return [] }
  })

  const [planId] = useState(urlPlanId || sessionStorage.getItem('planId') || '')
  const [tripRequest] = useState(readStoredTripRequest)
  const [loading, setLoading] = useState(false)
  const [recoveryError, setRecoveryError] = useState('')
  const [activeSection, setActiveSection] = useState('overview')
  const [activeWeatherIndex, setActiveWeatherIndex] = useState(0)
  const [selectedOverviewName, setSelectedOverviewName] = useState('')
  const [selectedMapAttraction, setSelectedMapAttraction] = useState<{
    dayIndex: number
    attractionIndex: number
  } | null>(null)
  const [attractionPhotos, setAttractionPhotos] = useState<Record<string, { url: string; provider: string }>>({})
  const [noticeDismissed, setNoticeDismissed] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!tripPlan) return
    let cancelled = false

    const loadPhotos = async () => {
      const targets: Array<{ key: string; name: string; city: string; poiId?: string }> = []
      const seen = new Set<string>()
      for (const day of tripPlan.days) {
        const city = day.city || tripPlan.city
        for (const attr of day.attractions) {
          const key = attractionImageCacheKey(city, attr.name)
          if (seen.has(key)) continue
          seen.add(key)
          targets.push({ key, name: attr.name, city, poiId: attr.poi_id })
        }
      }

      const photos: Record<string, { url: string; provider: string }> = {}
      await runWithConcurrency(targets, 6, async (target) => {
        try {
          const result = await resolveAttractionImage(target.name, target.city, target.poiId)
          if (result.verified && result.imageUrl) {
            photos[target.key] = { url: result.imageUrl, provider: result.provider }
          }
        } catch {
          // The card keeps a deterministic named placeholder when the provider is unavailable.
        }
        // 每张图落地就增量渲染，用户不必等全部请求结束才看到第一张。
        if (!cancelled) setAttractionPhotos((prev) => ({ ...prev, ...photos }))
      })
    }

    void loadPhotos()
    return () => {
      cancelled = true
    }
  }, [tripPlan])

  useEffect(() => {
    if (tripPlan || !urlPlanId || loading) return

    const recoverPlan = async () => {
      setLoading(true)
      try {
        const status = await pollTaskStatus(urlPlanId)
        if (status.status === 'completed' && status.result) {
          const data: TripPlan = status.result.data || status.result
          const gData: KnowledgeGraphData | null = status.result.graph_data || null
          const review: TripReviewResult | null = status.result.review || null
          const warnings = Array.isArray(status.result.warnings) ? status.result.warnings : []
          setSourcePlan(structuredClone(data))
          setTripPlan(data)
          setGraphData(gData)
          setTripReview(review)
          setDegradedWarnings(warnings)
          if (warnings.length > 0) sessionStorage.setItem('tripWarnings', JSON.stringify(warnings))
          sessionStorage.setItem('tripPlan', JSON.stringify(data))
          if (gData) sessionStorage.setItem('graphData', JSON.stringify(gData))
          if (review) sessionStorage.setItem('tripReview', JSON.stringify(review))
          sessionStorage.setItem('planId', urlPlanId)
        } else if (status.status === 'failed') {
          setRecoveryError(status.error || t('result.planFailed'))
        } else {
          setRecoveryError(t('result.historyUnavailable'))
        }
      } catch {
        setRecoveryError(t('result.historyUnavailable'))
      } finally {
        setLoading(false)
      }
    }

    void recoverPlan()
  }, [loading, t, tripPlan, urlPlanId])

  const overviewAttractions: OverviewAttractionItem[] = useMemo(() => (tripPlan
    ? tripPlan.days.flatMap((day, dayIdx) =>
        day.attractions.map((attr, attractionIdx) => ({
          name: attr.name,
          city: day.city || tripPlan.city,
          address: attr.address,
          visit_duration: attr.visit_duration,
          description: attr.description,
          dayArrayIndex: dayIdx,
          attractionArrayIndex: attractionIdx,
          rating: attr.rating,
          ticket_price: attr.ticket_price,
          reservation_required: attr.reservation_required,
          reservation_tips: attr.reservation_tips,
        })),
      )
    : []), [tripPlan])

  const workspaceEdited = Boolean(
    tripPlan
    && sourcePlan
    && workspacePlanSignature(tripPlan) !== workspacePlanSignature(sourcePlan),
  )
  const effectiveBudget = useMemo(
    () => tripPlan && sourcePlan ? deriveWorkspaceBudget(tripPlan, sourcePlan) : tripPlan?.budget,
    [sourcePlan, tripPlan],
  )
  const effectiveTripPlan = useMemo<TripPlan | null>(
    () => tripPlan ? { ...tripPlan, budget: effectiveBudget } : null,
    [effectiveBudget, tripPlan],
  )

  /* 编辑后后端图谱已失效，切换为基于最新工作区数据生成的图谱。撤销到原始版本时自动恢复后端图谱。 */
  const effectiveGraphData = useMemo<KnowledgeGraphData | null>(
    () => (!workspaceEdited ? graphData : null) ?? (effectiveTripPlan ? buildFallbackGraphData(effectiveTripPlan) : null),
    [effectiveTripPlan, graphData, workspaceEdited],
  )
  const graphDerived = (workspaceEdited || graphData == null) && effectiveGraphData != null

  const weatherList = tripPlan?.weather_info ?? []
  const selectedWeather: WeatherInfo | null =
    weatherList.length > 0
      ? weatherList[Math.min(Math.max(activeWeatherIndex, 0), weatherList.length - 1)]
      : null
  const selectedIconKind: WeatherIconKind = selectedWeather
    ? getWeatherIconKind(weatherIconSource(selectedWeather))
    : 'sunny'

  /* ---------- 校验结果：从大色块横幅收敛成顶栏一个可展开的小胶囊 ---------- */
  const notices = useMemo(
    () => summarizeNotices([
      ...(tripReview?.warnings ?? []).map((issue) => issue.message),
      ...degradedWarnings,
    ]),
    [degradedWarnings, tripReview],
  )
  const noticeCount = notices.length
  const checkTone = !tripReview
    ? 'neutral'
    : !tripReview.pass
      ? 'error'
      : noticeCount > 0 ? 'warn' : 'ok'

  const sectionItems = useMemo(() => [
    { key: 'overview', label: t('result.tabOverview') },
    ...(effectiveBudget ? [{ key: 'budget', label: t('result.tabBudget') }] : []),
    { key: 'weather', label: t('result.tabWeather') },
    { key: 'days', label: t('result.tabDays') },
    { key: 'knowledge-graph', label: t('result.tabGraph') },
    { key: 'assistant', label: t('result.tabAssistant') },
  ], [effectiveBudget, t])

  const switchSection = useCallback((key: string) => {
    setActiveSection(key)
    const top = contentRef.current
    if (top) {
      const y = top.getBoundingClientRect().top + window.scrollY - 132
      window.scrollTo({ top: Math.max(y, 0), behavior: 'smooth' })
    }
  }, [])

  if (loading) {
    return (
      <div className="result-state">
        <div className="result-state-box">
          <Spin size="large" />
          <p>{t('result.loadingPlan')}</p>
        </div>
      </div>
    )
  }

  if (!tripPlan) {
    return (
      <div className="result-state">
        <Empty description={recoveryError || t('result.noPlan')}>
          <Button type="primary" onClick={() => navigate('/')} icon={<ArrowLeftOutlined />}>
            {t('result.backGenerate')}
          </Button>
        </Empty>
      </div>
    )
  }

  const noticeBody = (
    <div className="check-popover">
      <p className="check-popover-head">
        {tripReview?.pass ? t('result.reviewPass') : t('result.reviewBlocked')}
      </p>
      {noticeCount === 0 ? (
        <p className="check-popover-empty">{t('result.reviewSuccess')}</p>
      ) : (
        <ul className="check-popover-list">
          {notices.map((notice) => (
            <li key={notice.message}>
              <span>{notice.message}</span>
              {notice.count > 1 && <Tag>{`×${notice.count}`}</Tag>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )

  return (
    <div className="result-shell">
      {/* ---------------- 顶栏 ---------------- */}
      <header className="result-topbar">
        <div className="result-topbar-inner">
          <button type="button" className="result-back" onClick={() => navigate('/')}>
            <ArrowLeftOutlined aria-hidden="true" />
            <span className="result-back-text">{t('result.backHome')}</span>
          </button>

          <div className="result-heading">
            <h1>{tripPlan.city}</h1>
            <p className="result-heading-meta" title={planId ? `#${planId}` : undefined}>
              <span className="hj-num">{tripPlan.start_date} — {tripPlan.end_date}</span>
              <span className="result-dot" aria-hidden="true">·</span>
              <span>{t('common.daysCount', { count: tripPlan.days.length })}</span>
            </p>
          </div>

          <div className="result-topbar-actions">
            {tripReview && (
              <Popover
                trigger="click"
                placement="bottomRight"
                content={noticeBody}
                title={null}
                arrow={false}
              >
                <button type="button" className={`check-chip check-chip--${checkTone}`}>
                  {checkTone === 'error'
                    ? <CloseCircleFilled aria-hidden="true" />
                    : checkTone === 'warn'
                      ? <WarningFilled aria-hidden="true" />
                      : <CheckCircleFilled aria-hidden="true" />}
                  <span>{tripReview.pass ? t('result.reviewPass') : t('result.reviewBlocked')}</span>
                  {noticeCount > 0 && <em className="hj-num">{noticeCount}</em>}
                </button>
              </Popover>
            )}
            <TripExportActions plan={effectiveTripPlan ?? tripPlan} planId={planId} />
          </div>
        </div>

        <nav className="result-tabs" aria-label={t('result.tabOverview')}>
          {sectionItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`result-tab${activeSection === item.key ? ' is-active' : ''}`}
              aria-current={activeSection === item.key ? 'page' : undefined}
              onClick={() => switchSection(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="result-main" ref={contentRef}>
        {generatedPlanLocale
          && normalizeAppLocale(generatedPlanLocale) !== currentLocale
          && !noticeDismissed
          && (
            <div className="result-inline-note">
              <span>{t('result.regenerateHint')}</span>
              <button type="button" onClick={() => setNoticeDismissed(true)} aria-label={t('common.none')}>✕</button>
            </div>
          )}

        <Image.PreviewGroup>
          {/* ---------------- 概览 ---------------- */}
          <div
            className={`overview-export-host${activeSection === 'overview' ? '' : ' is-background'}`}
            aria-hidden={activeSection === 'overview' ? undefined : true}
          >
            <section className="result-section overview-section">
              <div className="overview-head">
                <div>
                  <p className="hj-eyebrow">{t('result.tabOverview')}</p>
                  {tripPlan.overall_suggestions && (
                    <p className="overview-lead">{tripPlan.overall_suggestions}</p>
                  )}
                </div>
                <div className="overview-stats">
                  <div className="overview-stat">
                    <em>{t('landing.fieldDays')}</em>
                    <b className="hj-num">{tripPlan.days.length}</b>
                  </div>
                  <div className="overview-stat">
                    <em>{t('knowledgeGraph.categoryAttraction')}</em>
                    <b className="hj-num">{overviewAttractions.length}</b>
                  </div>
                  {effectiveBudget && (
                    <div className="overview-stat">
                      <em>{t('budgetPanel.totalLabel')}</em>
                      <b className="hj-num">¥{Math.round(Number(effectiveBudget.total) || 0).toLocaleString(currentLocale)}</b>
                    </div>
                  )}
                </div>
              </div>

              <div className="overview-map-card">
                <Suspense
                  fallback={(
                    <div className="trip-map-lazy" role="status">
                      <Spin />
                      <span>{t('result.mapLoading')}</span>
                    </div>
                  )}
                >
                  <TripMap plan={effectiveTripPlan ?? tripPlan} selectedAttraction={selectedMapAttraction} />
                </Suspense>
              </div>

              {overviewAttractions.length > 0 ? (
                <div className="overview-gallery">
                  {overviewAttractions.map((item) => {
                    const photo = attractionPhotos[attractionImageCacheKey(item.city, item.name)]
                    return (
                      <OverviewAttractionCard
                        key={`${item.dayArrayIndex}-${item.name}`}
                        item={item}
                        imageUrl={photo?.url}
                        imageSource={photo?.provider}
                        active={selectedOverviewName === `${item.dayArrayIndex}-${item.name}`}
                        onSelect={() => {
                          setSelectedOverviewName(`${item.dayArrayIndex}-${item.name}`)
                          setSelectedMapAttraction({
                            dayIndex: item.dayArrayIndex,
                            attractionIndex: item.attractionArrayIndex,
                          })
                        }}
                      />
                    )
                  })}
                </div>
              ) : (
                <div className="result-empty-block">
                  <Empty description={t('result.noAttractions')} />
                </div>
              )}
            </section>
          </div>

          {/* ---------------- 预算 ---------------- */}
          {activeSection === 'budget' && effectiveBudget && (
            <section className="result-section">
              <BudgetPanel
                budget={effectiveBudget}
                budgetLimit={tripRequest.budget_limit}
                travelers={tripRequest.travelers}
                dayCount={(effectiveTripPlan ?? tripPlan)?.days.length}
              />
            </section>
          )}

          {/* ---------------- 天气 ---------------- */}
          {activeSection === 'weather' && selectedWeather && (
            <section className="result-section">
              <Card id="weather" className="section-shellless weather-section-card" styles={{ body: { padding: 0 } }}>
                <div className="weather-dashboard">
                  <section className="weather-side" style={{ background: getWeatherGradient(selectedWeather.day_weather) }}>
                    <div className="date-container">
                      <h2 className="date-dayname">{formatWeatherWeekday(selectedWeather.date, currentLocale)}</h2>
                      <span className="date-day">{formatWeatherDate(selectedWeather.date, currentLocale)}</span>
                      <span className="location">
                        <span className="location-icon">
                          <svg width="15" height="15" viewBox="-3 0 20 20" fill="currentColor" aria-hidden="true">
                            <path d="M9,0C4.6,0,1,3.6,1,8c0,5.1,8,12.5,8,12.5S17,13.1,17,8C17,3.6,13.4,0,9,0z M9,11c-1.7,0-3-1.3-3-3s1.3-3,3-3s3,1.3,3,3S10.7,11,9,11z" />
                          </svg>
                        </span>
                        {tripPlan.city}
                      </span>
                    </div>
                    <div className="weather-container">
                      <WeatherIcon kind={selectedIconKind} />
                      <h1 className="weather-temp">{formatWeatherTemp(selectedWeather.day_temp)}</h1>
                      <h3 className="weather-desc">{selectedWeather.day_weather}</h3>
                    </div>
                  </section>

                  <section className="weather-info-side">
                    <div className="week-container week-container--top">
                      <ul className="week-list">
                        {weatherList.map((item, idx) => {
                          const kind = getWeatherIconKind(weatherIconSource(item))
                          return (
                            <li
                              key={`${item.date}-${idx}`}
                              className={idx === activeWeatherIndex ? 'active' : ''}
                              onMouseEnter={() => setActiveWeatherIndex(idx)}
                              onClick={() => setActiveWeatherIndex(idx)}
                            >
                              <SmallWeatherIcon kind={kind} />
                              <span className="day-name">{formatWeatherWeekday(item.date, currentLocale, true)}</span>
                              <span className="day-temp hj-num">{formatWeatherTemp(item.day_temp)}</span>
                            </li>
                          )
                        })}
                      </ul>
                    </div>

                    <div className="today-info-container">
                      <div className="today-info">
                        <div className="today-info-item">
                          <span className="wea-title">{t('result.daytime')}</span>
                          <span className="value">{selectedWeather.day_weather} · {formatWeatherTemp(selectedWeather.day_temp)}</span>
                        </div>
                        <div className="today-info-item">
                          <span className="wea-title">{t('result.nighttime')}</span>
                          <span className="value">{selectedWeather.night_weather} · {formatWeatherTemp(selectedWeather.night_temp)}</span>
                        </div>
                        <div className="today-info-item">
                          <span className="wea-title">{t('result.precipitation')}</span>
                          <span className="value">{getPrecipitation(selectedWeather.day_weather)}</span>
                        </div>
                        <div className="today-info-item">
                          <span className="wea-title">{t('result.humidity')}</span>
                          <span className="value">{getHumidity(selectedWeather.day_weather)}</span>
                        </div>
                        <div className="today-info-item">
                          <span className="wea-title">{t('result.wind')}</span>
                          <span className="value">{getWind(selectedWeather, t('result.breeze'))}</span>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              </Card>
            </section>
          )}

          {/* ---------------- 每日行程 ---------------- */}
          {activeSection === 'days' && (
            <section className="result-section">
              <EditableTripDays initialPlan={tripPlan} planId={planId} onPlanChange={setTripPlan} />
            </section>
          )}

          {/* ---------------- 知识图谱 ---------------- */}
          {activeSection === 'knowledge-graph' && (
            <section className="result-section">
              <Card id="knowledge-graph" className="section-shellless kg-card" styles={{ body: { padding: 0 } }}>
                <div className="kg-card-body">
                  <Suspense fallback={<div className="kg-loading-fallback"><Spin /><span>{t('result.graphLoading')}</span></div>}>
                    <KnowledgeGraph graphData={effectiveGraphData} derived={graphDerived} tripPlan={effectiveTripPlan} />
                  </Suspense>
                </div>
              </Card>
            </section>
          )}
        </Image.PreviewGroup>

        <Suspense fallback={activeSection === 'assistant' ? <div className="kg-loading-fallback"><Spin /></div> : null}>
          <AIChat mode={activeSection === 'assistant' ? 'embedded' : 'floating'} tripPlan={effectiveTripPlan} />
        </Suspense>
      </main>
    </div>
  )
}

export default Result
