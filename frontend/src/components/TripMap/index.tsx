import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FullscreenExitOutlined, FullscreenOutlined, LoadingOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import type { TripPlan } from '@/types/api'
import { isMapProviderReady, useMapProvider } from '@/features/map-provider/model/mapProvider'
import type { MapProvider } from '@/features/map-provider/model/mapProvider'
import { createAmapRenderer } from './amapRenderer'
import { createGoogleRenderer } from './googleRenderer'
import { collectAttractionStops } from './mapGeometry'
import { isMapRendererError } from './mapRenderer'
import type { MapRenderer, MapRendererContext } from './mapRenderer'
import type { MapAttractionStop } from './mapGeometry'
import TripMapFallback from './TripMapFallback'
import './index.css'

export interface TripMapSelection {
  dayIndex: number
  attractionIndex: number
}

interface TripMapProps {
  plan: TripPlan
  selectedAttraction?: TripMapSelection | null
  /** 点击左上角景点清单时通知调用方，由调用方统一管理选中态 */
  onSelectStop?: (selection: TripMapSelection) => void
}

type MapPhase = 'loading' | 'ready' | 'load-error' | 'security-code-missing'

/**
 * 按用户选定的底图挑渲染器。
 *
 * 两家 SDK 的差异全部关在各自的 renderer 里，这里只做一次二选一，
 * 页面其余部分（标题、图例、全屏、兜底）对两套实现是同一份代码。
 */
function createRenderer(provider: MapProvider, context: MapRendererContext): Promise<MapRenderer> {
  return provider === 'google'
    ? createGoogleRenderer(context)
    : createAmapRenderer(context)
}

/**
 * 地图只关心「点位与路线的几何形状」，不关心 plan 对象的引用。
 * 由此派生出稳定签名：工作区里任何一次编辑（撤销、保存、切换标签页）
 * 都会产生新的 plan 引用，若直接依赖 plan，地图实例会被反复销毁重建，
 * 这正是行程页卡顿的主要来源之一。
 */
function buildPlanSignature(plan: TripPlan): string {
  const parts: string[] = []
  plan.days.forEach((day, dayIndex) => {
    const hotel = day.hotel?.location
    parts.push(`h${dayIndex}:${hotel?.longitude ?? ''},${hotel?.latitude ?? ''}`)
    day.attractions.forEach((attraction, attractionIndex) => {
      const location = attraction.location
      parts.push(
        `a${dayIndex}-${attractionIndex}:${location?.longitude ?? ''},${location?.latitude ?? ''}:${attraction.name}`,
      )
    })
  })
  return parts.join('|')
}

function TripMap({ plan, selectedAttraction, onSelectStop }: TripMapProps) {
  const { t, i18n } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<MapRenderer | null>(null)
  const [phase, setPhase] = useState<MapPhase>('loading')
  const [expanded, setExpanded] = useState(false)
  const provider = useMapProvider()
  const providerReady = isMapProviderReady(provider)
  const stops = useMemo(() => collectAttractionStops(plan), [plan])
  const planSignature = useMemo(() => buildPlanSignature(plan), [plan])

  // 回调/文案/数据都从 ref 读取，effect 的依赖里只留真正需要重建地图的量。
  // ref 必须在 effect 里写入（渲染期写 ref 会被 react-hooks 规则拦截）；
  // 这两个同步 effect 声明在地图 effect 之前，保证同一轮更新里先同步再重建。
  const planRef = useRef(plan)
  const translateRef = useRef(t)

  useEffect(() => {
    planRef.current = plan
  }, [plan])

  useEffect(() => {
    translateRef.current = t
  }, [t])

  /** 聚焦某个景点：有父级回调就交给父级统一管理选中态，否则直接驱动渲染器 */
  const focusSpot = useCallback((stop: MapAttractionStop) => {
    const selection = { dayIndex: stop.dayIndex, attractionIndex: stop.attractionIndex }
    if (onSelectStop) {
      onSelectStop(selection)
      return
    }
    rendererRef.current?.selectStop(`${stop.dayIndex}-${stop.attractionIndex}`)
  }, [onSelectStop])

  /* 全屏：锁滚动 + Esc 退出 */
  useEffect(() => {
    if (!expanded) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [expanded])

  /* 容器尺寸变化后通知地图重算画布，否则全屏时地图会被裁切 */
  useEffect(() => {
    const host = containerRef.current
    if (!host || typeof ResizeObserver === 'undefined') return
    let frame = 0
    const observer = new ResizeObserver(() => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        rendererRef.current?.resize?.()
      })
    })
    observer.observe(host)
    return () => {
      observer.disconnect()
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!providerReady || !container) return
    const currentPlan = planRef.current
    const currentStops = collectAttractionStops(currentPlan)
    if (currentStops.length === 0) return
    let cancelled = false
    setPhase('loading')

    const initialize = async () => {
      try {
        const renderer = await createRenderer(provider, {
          container,
          plan: currentPlan,
          stops: currentStops,
          translate: (key, options) => String(translateRef.current(key, options)),
          isCancelled: () => cancelled,
        })
        if (cancelled) {
          renderer.destroy()
          return
        }
        rendererRef.current = renderer
        setPhase('ready')
        // 路线在后台补，进度不阻塞底图交互
        void renderer.drawRoutes()
      } catch (error) {
        if (cancelled) return
        if (isMapRendererError(error) && error.reason === 'cancelled') return
        if (isMapRendererError(error) && error.reason === 'security-code-missing') {
          setPhase('security-code-missing')
          return
        }
        setPhase('load-error')
      }
    }

    void initialize()
    return () => {
      cancelled = true
      rendererRef.current?.destroy()
      rendererRef.current = null
    }
  }, [provider, providerReady, i18n.resolvedLanguage, planSignature])

  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer) return
    if (!selectedAttraction || phase !== 'ready') {
      renderer.clearSelection()
      return
    }
    const key = `${selectedAttraction.dayIndex}-${selectedAttraction.attractionIndex}`
    renderer.selectStop(key)
  }, [phase, provider, selectedAttraction])

  if (!providerReady) return <TripMapFallback kind="missing-key" provider={provider} />
  if (stops.length === 0) return <TripMapFallback kind="missing-coordinate" />
  if (phase === 'security-code-missing') return <TripMapFallback kind="security-code-missing" />
  if (phase === 'load-error') return <TripMapFallback kind="load-error" provider={provider} />

  return (
    <section
      className={`trip-map-shell${expanded ? ' is-expanded' : ''}`}
      aria-label={t('tripMap.overview')}
    >
      <div className="trip-map-heading">
        <div>
          <span className="trip-map-eyebrow">{t('tripMap.overview')}</span>
          <h2>{t('tripMap.title')}</h2>
        </div>
        <div className="trip-map-tools">
          <div className="trip-map-legend" aria-label={t('tripMap.legend')}>
            <span><i className="is-driving" />{t('tripMap.driving')}</span>
            <span><i className="is-walking" />{t('tripMap.walking')}</span>
            <span><i className="is-fallback" />{t('tripMap.straight')}</span>
          </div>
          <button
            type="button"
            className="trip-map-expand"
            aria-label={expanded ? t('tripMap.collapse') : t('tripMap.expand')}
            title={expanded ? t('tripMap.collapse') : t('tripMap.expand')}
            aria-pressed={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
          </button>
        </div>
      </div>
      <div ref={containerRef} id="trip-map-canvas" className="trip-map-canvas" data-trip-map-capture="true" />

      {/* 左上角景点清单：点一下地图就聚焦到该点并弹出信息窗（全屏时同样可用） */}
      {stops.length > 0 && (
        <nav className="trip-map-spots" aria-label={t('tripMap.spotsTitle')}>
          <p className="trip-map-spots-title">{t('tripMap.spotsTitle')}</p>
          <ul>
            {stops.map((stop) => {
              const active = selectedAttraction
                && selectedAttraction.dayIndex === stop.dayIndex
                && selectedAttraction.attractionIndex === stop.attractionIndex
              return (
                <li key={stop.key}>
                  <button
                    type="button"
                    className={`trip-map-spot${active ? ' is-active' : ''}`}
                    onClick={() => focusSpot(stop)}
                  >
                    <span className="trip-map-spot-index" aria-hidden="true">
                      {stop.dayIndex + 1}-{stop.attractionIndex + 1}
                    </span>
                    <span className="trip-map-spot-name">{stop.attraction.name}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
      )}

      {phase === 'loading' && (
        <div className="trip-map-loading" role="status">
          <LoadingOutlined spin />
          <span>{t('tripMap.loading')}</span>
        </div>
      )}
    </section>
  )
}

/**
 * 地图是这一页最贵的子树（WebGL canvas + 大量 overlay）。
 * 图片陆续返回、卡片选中态变化都不应该让它重新参与渲染。
 */
export default memo(TripMap)
