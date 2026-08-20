import { lazy, Suspense, useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Card,
  Button,
  Empty,
  Spin,
  FloatButton,
  Alert,
} from 'antd'
import {
  ArrowLeftOutlined,
} from '@ant-design/icons'
import EditableTripDays from '../../features/trip-workspace/ui/EditableTripDays'
import TripExportActions from '../../features/export/ui/TripExportActions'
import BudgetPanel from '../../components/BudgetPanel'
import OverviewAttractionCard, { type OverviewAttractionItem } from '../../components/OverviewAttractionCard'
import { attractionImageCacheKey, resolveAttractionImage } from '../../services/poiApi'
import { pollTaskStatus } from '../../services/tripApi'
import type { TripPlan, KnowledgeGraphData, WeatherInfo, TripReviewResult } from '../../types/api'
import './index.css'

const KnowledgeGraph = lazy(() => import('../../components/KnowledgeGraph'))
const AIChat = lazy(() => import('../../components/AIChat'))

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
  if (/(雷|thunder)/.test(t)) return 'linear-gradient(140deg, #3a4a86 0%, #5b3b8a 100%)'
  if (/(雪|snow|sleet|hail)/.test(t)) return 'linear-gradient(140deg, #8bc6ec 0%, #d9afd9 100%)'
  if (/(雨|rain|shower|drizzle)/.test(t)) return 'linear-gradient(140deg, #4b6cb7 0%, #182848 100%)'
  if (/(雾|霾|fog|mist|haze)/.test(t)) return 'linear-gradient(140deg, #7b8799 0%, #4a5568 100%)'
  if (/(阴|cloud|overcast)/.test(t)) return 'linear-gradient(140deg, #6d7f92 0%, #3f4c6b 100%)'
  return 'linear-gradient(140deg, #72edf2 0%, #5151e5 100%)'
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

function formatWeatherDate(rawDate: string): string {
  const d = parseWeatherDate(rawDate)
  if (!d) return rawDate || '--'
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

function formatWeatherWeekday(rawDate: string, short = false): string {
  const d = parseWeatherDate(rawDate)
  if (!d) return rawDate || '--'
  const days = short
    ? ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    : ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  return days[d.getDay()]
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

function getWind(weather: WeatherInfo): string {
  const dir = weather.wind_direction || ''
  const power = weather.wind_power || ''
  if (dir || power) return `${dir} ${power}`.trim()
  return '微风'
}

function Result() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const urlPlanId = searchParams.get('plan_id')

  const [tripPlan, setTripPlan] = useState<TripPlan | null>(() => {
    const raw = sessionStorage.getItem('tripPlan')
    if (!raw) return null
    try { return JSON.parse(raw) } catch { return null }
  })

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

  const [planId] = useState(urlPlanId || sessionStorage.getItem('planId') || '')
  const [loading, setLoading] = useState(false)
  const [recoveryError, setRecoveryError] = useState('')
  const [activeSection, setActiveSection] = useState('overview')
  const [activeWeatherIndex, setActiveWeatherIndex] = useState(0)
  const [activeOverviewCard, setActiveOverviewCard] = useState(1)
  const [attractionPhotos, setAttractionPhotos] = useState<Record<string, string>>({})
  const overviewRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!tripPlan) return
    let cancelled = false

    const loadPhotos = async () => {
      const photos: Record<string, string> = {}
      const resolvedKeys = new Set<string>()
      for (const day of tripPlan.days) {
        const city = day.city || tripPlan.city
        for (const attr of day.attractions) {
          const key = attractionImageCacheKey(city, attr.name)
          if (resolvedKeys.has(key)) continue
          resolvedKeys.add(key)
          try {
            const result = await resolveAttractionImage(attr.name, city, attr.poi_id)
            if (result.verified && result.imageUrl) photos[key] = result.imageUrl
          } catch {
            // The card keeps a deterministic named placeholder when the provider is unavailable.
          }
        }
      }
      if (!cancelled) setAttractionPhotos(photos)
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
          setTripPlan(data)
          setGraphData(gData)
          setTripReview(review)
          sessionStorage.setItem('tripPlan', JSON.stringify(data))
          if (gData) sessionStorage.setItem('graphData', JSON.stringify(gData))
          if (review) sessionStorage.setItem('tripReview', JSON.stringify(review))
          sessionStorage.setItem('planId', urlPlanId)
        } else if (status.status === 'failed') {
          setRecoveryError(status.error || '计划生成失败')
        } else {
          setRecoveryError('历史计划详情不可恢复，请重新生成')
        }
      } catch {
        setRecoveryError('历史计划详情不可恢复，请重新生成')
      } finally {
        setLoading(false)
      }
    }

    void recoverPlan()
  }, [tripPlan, urlPlanId, loading])

  const overviewAttractions: OverviewAttractionItem[] = tripPlan
    ? tripPlan.days.flatMap((day, dayIdx) =>
        day.attractions.map((attr) => ({
          name: attr.name,
          city: day.city || tripPlan.city,
          address: attr.address,
          visit_duration: attr.visit_duration,
          description: attr.description,
          dayArrayIndex: dayIdx,
          rating: attr.rating,
          ticket_price: attr.ticket_price,
        })),
      )
    : []

  const weatherList = tripPlan?.weather_info ?? []
  const selectedWeather: WeatherInfo | null =
    weatherList.length > 0
      ? weatherList[Math.min(Math.max(activeWeatherIndex, 0), weatherList.length - 1)]
      : null
  const selectedIconKind: WeatherIconKind = selectedWeather
    ? getWeatherIconKind(`${selectedWeather.day_weather || ''} ${selectedWeather.night_weather || ''}`)
    : 'sunny'

  const scrollToSection = (key: string) => {
    setActiveSection(key)
  }

  const goToDayFromOverview = (dayIndex: number) => {
    setActiveSection('days')
    setTimeout(() => {
      document.getElementById(`day-${dayIndex}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  if (loading) {
    return (
      <div className="result-loading">
        <Spin size="large" tip="正在加载旅行计划..." />
      </div>
    )
  }

  if (!tripPlan) {
    return (
      <div className="result-empty">
        <Empty description={recoveryError || '没有找到旅行计划数据'}>
          <Button type="primary" onClick={() => navigate('/')} icon={<ArrowLeftOutlined />}>
            返回首页生成计划
          </Button>
        </Empty>
      </div>
    )
  }

  return (
    <div className="result-container">
      <div className="lower-shade" />

      <main className="result-main">
        <div className="result-actions">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/')}
            style={{ color: '#ecf3fa' }}
          >
            返回首页
          </Button>
          <TripExportActions plan={tripPlan} planId={planId} />
        </div>

        <div className="content-wrapper">
          {/* Top Nav */}
          <div className="top-switch-nav">
            <div className="top-switch-menu-wrap">
              <div className="top-switch-menu" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {[
                  { key: 'overview', label: '概览' },
                  ...(tripPlan.budget ? [{ key: 'budget', label: '预算' }] : []),
                  { key: 'weather', label: '天气' },
                  { key: 'days', label: '每日行程' },
                  { key: 'knowledge-graph', label: '知识图谱' },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`nav-pill${activeSection === item.key ? ' active' : ''}`}
                    onClick={() => scrollToSection(item.key)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {tripReview && (
            <Alert
              className="review-summary"
              type={tripReview.pass ? (tripReview.warnings.length ? 'warning' : 'success') : 'error'}
              showIcon
              title={tripReview.pass ? '行程已通过可执行性校验' : '行程仍有阻断问题'}
              description={tripReview.warnings.length
                ? `${tripReview.warnings.length} 项提示：${tripReview.warnings.slice(0, 2).map((issue) => issue.message).join('；')}`
                : '日期、时间、餐饮和预算结构均已通过 Review Agent 校验。'}
            />
          )}

          {/* Overview */}
          {activeSection === 'overview' && (
            <Card id="overview" className="section-shellless overview-card" styles={{ body: { padding: 0 } }}>
              {overviewAttractions.length > 0 ? (
                <div ref={overviewRef} className="overview-swiper">
                  <div className="overview-swiper-track">
                    {overviewAttractions.map((item, index) => (
                      <OverviewAttractionCard
                        key={`${item.dayArrayIndex}-${item.name}`}
                        item={item}
                        imageUrl={attractionPhotos[attractionImageCacheKey(item.city, item.name)]}
                        active={activeOverviewCard === index}
                        onHover={() => setActiveOverviewCard(index)}
                        onSelectDay={goToDayFromOverview}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ padding: 40, textAlign: 'center' }}>
                  <Empty description="暂无景点数据" />
                </div>
              )}

              <div className="overview-meta">
                <span style={{ color: '#ffd5c6', fontWeight: 700 }}>
                  {tripPlan.start_date} ~ {tripPlan.end_date}
                </span>
                {planId && <span>Plan ID: {planId}</span>}
                {tripPlan.overall_suggestions && (
                  <span>{tripPlan.overall_suggestions}</span>
                )}
              </div>
            </Card>
          )}

          {/* Budget */}
          {activeSection === 'budget' && tripPlan.budget && (
            <BudgetPanel budget={tripPlan.budget} />
          )}

          {/* Weather */}
          {activeSection === 'weather' && selectedWeather && (
            <Card id="weather" className="section-shellless weather-section-card" styles={{ body: { padding: 0 } }}>
              <div className="weather-dashboard">
                <section className="weather-side" style={{ background: getWeatherGradient(selectedWeather.day_weather) }}>
                  <div className="weather-gradient" />
                  <div className="date-container">
                    <h2 className="date-dayname">{formatWeatherWeekday(selectedWeather.date)}</h2>
                    <span className="date-day">{formatWeatherDate(selectedWeather.date)}</span>
                    <span className="location">
                      <span className="location-icon">
                        <svg width="16" height="16" viewBox="-3 0 20 20" fill="currentColor">
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
                        const kind = getWeatherIconKind(`${item.day_weather || ''} ${item.night_weather || ''}`)
                        return (
                          <li
                            key={`${item.date}-${idx}`}
                            className={idx === activeWeatherIndex ? 'active' : ''}
                            onMouseEnter={() => setActiveWeatherIndex(idx)}
                            onClick={() => setActiveWeatherIndex(idx)}
                          >
                            <SmallWeatherIcon kind={kind} />
                            <span className="day-name">{formatWeatherWeekday(item.date, true)}</span>
                            <span className="day-temp">{formatWeatherTemp(item.day_temp)}</span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>

                  <div className="today-info-container">
                    <div className="today-info">
                      <div className="today-info-item">
                        <span className="wea-title">白天</span>
                        <span className="value">{selectedWeather.day_weather} · {formatWeatherTemp(selectedWeather.day_temp)}</span>
                      </div>
                      <div className="today-info-item">
                        <span className="wea-title">夜间</span>
                        <span className="value">{selectedWeather.night_weather} · {formatWeatherTemp(selectedWeather.night_temp)}</span>
                      </div>
                      <div className="today-info-item">
                        <span className="wea-title">降水量</span>
                        <span className="value">{getPrecipitation(selectedWeather.day_weather)}</span>
                      </div>
                      <div className="today-info-item">
                        <span className="wea-title">湿度</span>
                        <span className="value">{getHumidity(selectedWeather.day_weather)}</span>
                      </div>
                      <div className="today-info-item">
                        <span className="wea-title">风力</span>
                        <span className="value">{getWind(selectedWeather)}</span>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </Card>
          )}

          {/* Daily Trips */}
          {activeSection === 'days' && (
            <div>
              <EditableTripDays initialPlan={tripPlan} planId={planId} onPlanChange={setTripPlan} />
            </div>
          )}

          {/* Knowledge Graph */}
          {activeSection === 'knowledge-graph' && (
            <Card id="knowledge-graph" className="section-shellless kg-card" styles={{ body: { padding: 24 } }}>
              <Suspense fallback={<Spin tip="正在加载知识图谱" />}><KnowledgeGraph graphData={graphData} /></Suspense>
            </Card>
          )}
        </div>
      </main>

      <FloatButton.BackTop visibilityHeight={300} tooltip="回到顶部" />

      <Suspense fallback={null}><AIChat tripPlan={tripPlan} /></Suspense>
    </div>
  )
}

export default Result
