import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Select, DatePicker, Button, message, Progress } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { generateTripPlan, getTripHistory } from '../../services/tripApi'
import { isMockEnabled } from '../../utils/env'
import NavBar from '../../components/NavBar'
import type { TripFormData, TripHistoryItem } from '../../types/api'
import './index.css'

/* 偏好选项 */
const INTEREST_OPTIONS = [
  { value: '历史文化', label: '历史文化' },
  { value: '自然风光', label: '自然风光' },
  { value: '美食', label: '美食' },
  { value: '购物', label: '购物' },
  { value: '艺术', label: '艺术' },
  { value: '休闲', label: '休闲' },
]

/* 加载阶段对应的中文文本 */
const stageLabels: Record<string, string> = {
  submitted: '正在初始化...',
  initializing: '正在初始化...',
  attraction_search: '正在搜索景点...',
  weather_search: '正在查询天气...',
  hotel_search: '正在推荐酒店...',
  planning: '正在生成行程计划...',
  graph_building: '正在构建知识图谱...',
  completed: '生成完成！',
  failed: '生成失败',
}

function Landing() {
  const navigate = useNavigate()
  const [form] = Form.useForm<TripFormData>()

  /* 表单状态 */
  const [loading, setLoading] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [loadingStatus, setLoadingStatus] = useState('')
  const [planCode, setPlanCode] = useState('')

  /* 偏好选择（自定义 pill 按钮需要单独管理） */
  const [preferences, setPreferences] = useState<string[]>(['历史文化', '美食'])
  const [freeTextInput, setFreeTextInput] = useState('')
  const [travelDays, setTravelDays] = useState(3)

  /* 日期选择 */
  const [startDate, setStartDate] = useState<Dayjs | null>(dayjs('2026-06-01'))
  const [endDate, setEndDate] = useState<Dayjs | null>(dayjs('2026-06-03'))

  /* 滚动 */
  const [scrollY, setScrollY] = useState(window.scrollY || 0)
  const formRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelHeight, setPanelHeight] = useState<number | 'auto'>('auto')

  /* 历史记录 */
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyPlans, setHistoryPlans] = useState<TripHistoryItem[]>([])

  /* 计算样式属性 - hero 滚动渐变 */
  const heroProgress = Math.min(scrollY / 320, 1)
  const heroContentOpacity = 1 - heroProgress * 0.95
  const heroContentTranslate = -heroProgress * 46
  const lowerShadeOpacity = Math.min(Math.max((scrollY - 20) / 360, 0), 1) * 0.7

  /* 日期变化自动计算天数 */
  const handleStartDateChange = useCallback((date: Dayjs | null) => {
    setStartDate(date)
    if (date && endDate) {
      const days = endDate.diff(date, 'day') + 1
      if (days > 0 && days <= 30) {
        setTravelDays(days)
      } else if (days > 30) {
        message.warning('出行天数不能超过30天')
        setEndDate(null)
      } else {
        message.warning('结束日期不能早于开始日期')
        setEndDate(null)
      }
    }
  }, [endDate])

  const handleEndDateChange = useCallback((date: Dayjs | null) => {
    setEndDate(date)
    if (startDate && date) {
      const days = date.diff(startDate, 'day') + 1
      if (days > 0 && days <= 30) {
        setTravelDays(days)
      } else if (days > 30) {
        message.warning('出行天数不能超过30天')
        setEndDate(null)
      } else {
        message.warning('结束日期不能早于开始日期')
        setEndDate(null)
      }
    }
  }, [startDate])

  /* 滚动监听 - 使用内联 handler，避免 setState-in-effect */

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const scrollToForm = useCallback(() => {
    if (formRef.current) {
      const y = formRef.current.getBoundingClientRect().top + window.scrollY - 65
      window.scrollTo({ top: y, behavior: 'smooth' })
    }
  }, [])

  useEffect(() => {
    const handler = () => setScrollY(window.scrollY || 0)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  /* 加载历史记录 - 在 useEffect 内直接 fetch */

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
    sessionStorage.setItem('planId', planId)
    navigate(`/result?plan_id=${planId}`)
  }

  /* 格式化历史时间 */
  const formatHistoryTime = (value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString()
  }

  /* 提交表单 */
  const handleSubmit = async () => {
    if (!startDate || !endDate) {
      message.error('请选择出行日期')
      return
    }

    const city = form.getFieldValue('city')
    if (!city) {
      message.error('请输入目的地城市')
      return
    }

    const transportation = form.getFieldValue('transportation') || '公共交通'
    const accommodation = form.getFieldValue('accommodation') || '经济型酒店'

    // 保存面板高度以保持布局稳定
    if (panelRef.current) {
      setPanelHeight(panelRef.current.offsetHeight)
    }

    setLoading(true)
    setLoadingProgress(5)
    setLoadingStatus('正在初始化...')
    setPlanCode('')

    const requestData: TripFormData = {
      city,
      start_date: startDate.format('YYYY-MM-DD'),
      end_date: endDate.format('YYYY-MM-DD'),
      travel_days: travelDays,
      transportation,
      accommodation,
      preferences,
      free_text_input: freeTextInput,
      language: 'zh',
    }

    try {
      const useMock = isMockEnabled()

      if (useMock) {
        // Mock 模式：模拟4个阶段的进度动画
        const mockStages = [
          { progress: 30, label: 'attraction_search' },
          { progress: 50, label: 'weather_search' },
          { progress: 70, label: 'hotel_search' },
          { progress: 90, label: 'planning' },
        ]

        for (const stage of mockStages) {
          setLoadingProgress(stage.progress)
          setLoadingStatus(stageLabels[stage.label])
          await new Promise((resolve) => setTimeout(resolve, 800))
        }
      }

      const response = await generateTripPlan(
        requestData,
        useMock
          ? undefined
          : (event) => {
              if (event.plan_id) setPlanCode(event.plan_id)
              if (typeof event.progress === 'number') {
                setLoadingProgress(Math.max(0, Math.min(100, event.progress)))
              }
              setLoadingStatus(event.message || stageLabels[event.stage] || '处理中...')
            },
        { mockByPolling: useMock },
      )

      setLoadingProgress(100)
      setLoadingStatus('生成完成！')

      if (response.success && response.data) {
        const planId = response.plan_id || planCode || 'mock1234'
        sessionStorage.setItem('tripPlan', JSON.stringify(response.data))
        if (response.graph_data) {
          sessionStorage.setItem('graphData', JSON.stringify(response.graph_data))
        }
        sessionStorage.setItem('planId', planId)
        message.success('旅行计划生成成功！')

        setTimeout(() => {
          navigate(`/result?plan_id=${planId}`)
        }, 600)
      } else {
        message.error(response.message || '生成失败，请重试')
      }
    } catch (error) {
      console.error('生成失败：', error)
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      message.error(`生成失败：${errorMessage}`)
    } finally {
      setTimeout(() => {
        setLoading(false)
        setLoadingProgress(0)
        setLoadingStatus('')
        setPanelHeight('auto')
      }, 1000)
    }
  }

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
      <div className="lower-shade" style={{ opacity: lowerShadeOpacity || 0.7 }} />

      <NavBar onBrandClick={scrollToTop} onCtaClick={scrollToForm} />

      <div className="wrapper">
        {/* Hero 区 */}
        <div
          className="page-header section-dark landing-header"
          style={{
            backgroundImage: "url('http://demos.creative-tim.com/paper-kit-2/assets/img/antoine-barres.jpg')",
            backgroundPosition: `center ${Math.max(-scrollY * 0.08, -120)}px`,
            backgroundSize: 'cover',
            backgroundRepeat: 'no-repeat',
          }}
        >
          <div className="filter" />
          <div
            className="content-center"
            style={{
              opacity: heroContentOpacity,
              transform: `translate3d(0, ${heroContentTranslate}px, 0)`,
            }}
          >
            <div className="container">
              <div className="title-brand">
                <h1 className="presentation-title">LINGJING</h1>
              </div>
              <h2 className="presentation-subtitle text-center">
                你的专属 AI 旅行规划师
              </h2>
            </div>
          </div>

          {/* 移动云层效果 */}
          <div
            className="moving-clouds"
            style={{
              backgroundImage: "url('https://demos.creative-tim.com/paper-kit-2/assets/img/clouds.png')",
            }}
          />
          <div className="fog-low">
            <img src="https://demos.creative-tim.com/paper-kit-2/assets/img/clouds.png" alt="fog" />
          </div>
          <div className="fog-low right">
            <img src="https://demos.creative-tim.com/paper-kit-2/assets/img/clouds.png" alt="fog" />
          </div>
          <div className="hero-bottom-shade" />
        </div>
      </div>

      {/* 表单区 */}
      <section ref={formRef} className="form-section">
        <div
          ref={panelRef}
          className="form-panel"
          style={{
            opacity: 0.2 + Math.min(Math.max((scrollY - 80) / 340, 0), 1) * 0.8,
            transform: `translate3d(0, ${(1 - Math.min(Math.max((scrollY - 80) / 340, 0), 1)) * 56}px, 0)`,
            minHeight: panelHeight === 'auto' ? 'auto' : `${panelHeight}px`,
          }}
        >
          {/* 表单内容 - 加载中隐藏 */}
          {!loading && (
            <Form form={form} layout="vertical" initialValues={{
              city: '北京',
              transportation: '公共交通',
              accommodation: '经济型酒店',
            }}>
              {/* Step 01: 目的地与日期 */}
              <div className="step">
                <div className="step-head">
                  <span>01</span>
                  <h3>目的地与日期</h3>
                </div>
                <div className="grid grid4">
                  <Form.Item
                    name="city"
                    rules={[{ required: true, message: '请输入目的地城市' }]}
                  >
                    <Input
                      placeholder="输入目的地城市"
                      size="large"
                      className="field-input"
                    />
                  </Form.Item>

                  <DatePicker
                    value={startDate}
                    onChange={handleStartDateChange}
                    placeholder="开始日期"
                    size="large"
                    className="field-input"
                    style={{ width: '100%' }}
                    disabledDate={(current) => current && current < dayjs().startOf('day')}
                  />

                  <DatePicker
                    value={endDate}
                    onChange={handleEndDateChange}
                    placeholder="结束日期"
                    size="large"
                    className="field-input"
                    style={{ width: '100%' }}
                    disabledDate={(current) => current && current < dayjs().startOf('day')}
                  />

                  <div className="days-chip">
                    <span className="days-number">{travelDays}</span>
                    <span className="days-unit">天</span>
                  </div>
                </div>
              </div>

              {/* Step 02: 偏好设置 */}
              <div className="step">
                <div className="step-head">
                  <span>02</span>
                  <h3>出行偏好</h3>
                </div>
                <div className="grid grid2">
                  <Form.Item name="transportation">
                    <Select
                      size="large"
                      className="field-select"
                      options={[
                        { value: '公共交通', label: '公共交通' },
                        { value: '自驾', label: '自驾' },
                        { value: '步行', label: '步行' },
                        { value: '混合', label: '混合' },
                      ]}
                    />
                  </Form.Item>

                  <Form.Item name="accommodation">
                    <Select
                      size="large"
                      className="field-select"
                      options={[
                        { value: '经济型酒店', label: '经济型酒店' },
                        { value: '舒适型酒店', label: '舒适型酒店' },
                        { value: '豪华酒店', label: '豪华酒店' },
                        { value: '民宿', label: '民宿' },
                      ]}
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
                        {item.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Step 03: 额外要求 */}
              <div className="step">
                <div className="step-head">
                  <span>03</span>
                  <h3>补充说明</h3>
                </div>
                <div className="field-textarea">
                  <Input.TextArea
                    value={freeTextInput}
                    onChange={(e) => setFreeTextInput(e.target.value)}
                    placeholder="例如：希望轻松一点、多安排博物馆、有老人小孩同行..."
                    rows={4}
                    size="large"
                    className="special-textarea"
                  />
                </div>
              </div>

              <div className="submit-wrapper">
                <button
                  type="button"
                  className={`btn btn-danger btn-round submit-btn${loading ? ' loading' : ''}`}
                  disabled={loading}
                  onClick={handleSubmit}
                >
                  {!loading ? (
                    '生成旅行计划'
                  ) : (
                    <span className="loading-row">
                      <i className="spinner" />
                      生成中...
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
                <h2 className="stepper-title">
                  {planCode ? `Plan #${planCode}` : '正在生成计划'}
                </h2>
                <p className="stepper-subtitle">AI 正在为您智能规划行程</p>
              </div>

              <div className="stepper-container">
                <div className={`step-node ${getNodeClass(0, 30)}`}>
                  <div className="node-icon">
                    {loadingProgress >= 0 && loadingProgress <= 30 ? (
                      <i className="spinner-small" />
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    )}
                  </div>
                  <p className="node-text">
                    {getNodeLabel(30, '已搜索景点', '搜索景点中')}
                  </p>
                </div>
                <div className={`step-divider ${getDividerClass(30)}`} />

                <div className={`step-node ${getNodeClass(30, 50)}`}>
                  <div className="node-icon">
                    {loadingProgress > 30 && loadingProgress <= 50 ? (
                      <i className="spinner-small" />
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M10.5 1.5V3.1M3.6 10H2M5.4512 4.95137L4.31982 3.82M15.5498 4.95137L16.6812 3.82M19 10H17.4M6.50007 10.0001C6.50007 7.79093 8.29093 6.00007 10.5001 6.00007C12.0061 6.00007 13.3177 6.83235 14.0001 8.06206M6 22C3.79086 22 2 20.2091 2 18C2 15.7909 3.79086 14 6 14C6.46419 14 6.90991 14.0791 7.32442 14.2245C8.04061 12.3396 9.86387 11 12 11C14.1361 11 15.9594 12.3396 16.6756 14.2245C17.0901 14.0791 17.5358 14 18 14C20.2091 14 22 15.7909 22 18C22 20.2091 20.2091 22 18 22C13.3597 22 9.87921 22 6 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <p className="node-text">
                    {getNodeLabel(50, '已查询天气', '查询天气中')}
                  </p>
                </div>
                <div className={`step-divider ${getDividerClass(50)}`} />

                <div className={`step-node ${getNodeClass(50, 70)}`}>
                  <div className="node-icon">
                    {loadingProgress > 50 && loadingProgress <= 70 ? (
                      <i className="spinner-small" />
                    ) : (
                      <svg fill="currentColor" width="25" height="25" viewBox="0 0 24 24">
                        <path d="M21,8c0-2.2-1.8-4-4-4H7C4.8,4,3,5.8,3,8v3.8c-0.6,0.5-1,1.3-1,2.2v2.7V17v2c0,0.6,0.4,1,1,1s1-0.4,1-1v-1h16v1 c0,0.6,0.4,1,1,1s1-0.4,1-1v-2v-0.3V14c0-0.9-0.4-1.7-1-2.2V8z M5,8c0-1.1,0.9-2,2-2h10c1.1,0,2,0.9,2,2v3h-1v-1c0-1.7-1.3-3-3-3 h-1c-0.8,0-1.5,0.3-2,0.8C11.5,7.3,10.8,7,10,7H9c-1.7,0-3,1.3-3,3v1H5V8z M16,10v1h-3v-1c0-0.6,0.4-1,1-1h1C15.6,9,16,9.4,16,10z M11,10v1H8v-1c0-0.6,0.4-1,1-1h1C10.6,9,11,9.4,11,10z M20,16H4v-2c0-0.6,0.4-1,1-1h3h3h2h3h3c0.6,0,1,0.4,1,1V16z" />
                      </svg>
                    )}
                  </div>
                  <p className="node-text">
                    {getNodeLabel(70, '已推荐酒店', '推荐酒店中')}
                  </p>
                </div>
                <div className={`step-divider ${getDividerClass(70)}`} />

                <div className={`step-node ${getNodeClass(70, 99)}`}>
                  <div className="node-icon">
                    {loadingProgress > 70 && loadingProgress < 100 ? (
                      <i className="spinner-small" />
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 11 12 14 22 4" />
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                      </svg>
                    )}
                  </div>
                  <p className="node-text">
                    {loadingProgress >= 100 ? '已完成' : '生成计划中'}
                  </p>
                </div>
              </div>

              <div className="stepper-footer">
                <h3>{loadingStatus}</h3>
                {loadingProgress < 100 ? (
                  <p>AI 正在协同工作，请耐心等待...</p>
                ) : (
                  <p>即将跳转到结果页...</p>
                )}
              </div>

              <Progress
                percent={loadingProgress}
                status={loadingProgress >= 100 ? 'success' : 'active'}
                showInfo={false}
                strokeColor="#d76e42"
                trailColor="rgba(236,243,250,0.08)"
                style={{ marginTop: 24, maxWidth: 480, width: '100%' }}
              />
            </div>
          )}
        </div>
      </section>

      {/* 历史计划区 */}
      <section className="history-section">
        <div className="history-panel">
          <div className="history-head">
            <div>
              <p className="history-eyebrow">历史记录</p>
              <h3 className="history-title">最近生成的旅行计划</h3>
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
              刷新
            </Button>
          </div>

          {historyLoading && (
            <div className="history-loading">加载中...</div>
          )}

          {!historyLoading && historyPlans.length === 0 && (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'rgba(236,243,250,0.54)' }}>
              暂无历史计划，生成你的第一个旅行计划吧
            </div>
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
                        {item.start_date} ~ {item.end_date}
                      </span>
                    </div>
                    <p className="history-meta">
                      <span>Plan ID: {item.plan_id}</span>
                      <span>{item.travel_days} 天</span>
                      <span>更新于 {formatHistoryTime(item.updated_at)}</span>
                    </p>
                    {item.overall_suggestions && (
                      <p className="history-summary">{item.overall_suggestions}</p>
                    )}
                  </div>
                  <span className="history-open">打开</span>
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