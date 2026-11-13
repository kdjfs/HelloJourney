import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { Typography, Empty, Alert, Tag, Input, Button } from 'antd'
import * as echarts from 'echarts/core'
import type { EChartsCoreOption } from 'echarts/core'
import { GraphChart } from 'echarts/charts'
import { TooltipComponent } from 'echarts/components'
import { LabelLayout } from 'echarts/features'
import { CanvasRenderer } from 'echarts/renderers'
import { apiClient } from '../../services/apiClient'
import { AILogo } from '../AILogo'
import {
  buildInitialPositions,
  layoutStorageKey,
  mergePositions,
  readStoredPositions,
  storePositions,
  type NodePosition,
} from './graphLayout'
import type {
  GraphCategory,
  GraphEdge,
  GraphNode,
  KnowledgeGraphData,
  TripPlan,
  TripChatResponse,
} from '../../types/api'

const { Text } = Typography

const GRAPH_HEIGHT = 560

// LabelLayout 是 labelLayout.hideOverlap 生效的前提：不注册它，节点名会互相压字。
// 只有在按需引入 echarts 时才需要手动 use，全量引入时自带。
echarts.use([GraphChart, TooltipComponent, LabelLayout, CanvasRenderer])

interface KnowledgeGraphProps {
  graphData: KnowledgeGraphData | null
  /** 图谱是否由前端根据行程数据推导生成（后端未返回时） */
  derived?: boolean
  /** 供 AI 解读使用的行程数据 */
  tripPlan?: TripPlan | null
}

interface SelectedNode {
  name: string
  category: number
  value?: string
}

interface GraphCanvasProps {
  option: EChartsCoreOption
  onSelectNode: (node: SelectedNode | null) => void
  onError: () => void
  onReady: () => void
  /** 拖动节点后回报位移（布局坐标，已按缩放换算） */
  onNodeMoved?: (id: string, dx: number, dy: number) => void
}

/**
 * Owns the ECharts instance directly instead of going through echarts-for-react.
 * That wrapper's CJS build exposes its component as `exports.default`, and depending
 * on how the bundler unwraps `__esModule` a default import arrives as the module
 * namespace object. React rejects that with "Element type is invalid" (error #130)
 * and the whole tab collapses into the error boundary, which is the crash this
 * replaces. Resize and disposal live here too, so no observer or chart instance can
 * outlive the component.
 */
function GraphCanvas({ option, onSelectNode, onError, onReady, onNodeMoved }: GraphCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)
  const handlersRef = useRef({ onSelectNode, onError, onReady, onNodeMoved })
  const dragRef = useRef<{ id: string; x: number; y: number } | null>(null)

  // Kept current through an effect rather than during render: the chart is created
  // once, but its callbacks must always see the latest props.
  useEffect(() => {
    handlersRef.current = { onSelectNode, onError, onReady, onNodeMoved }
  }, [onError, onNodeMoved, onReady, onSelectNode])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let chart: echarts.ECharts
    try {
      chart = echarts.init(host, undefined, { renderer: 'canvas' })
    } catch {
      // A host without canvas support (headless, very old browser) must degrade to
      // the caller's message rather than blanking the page.
      handlersRef.current.onError()
      return
    }

    chartRef.current = chart
    // 拖动节点：ECharts 只挪像素，不认识"这是不是用户想要的最终位置"，
    // 所以在 mouseup 里把位移记下来写回数据坐标，节点就不会弹回原处。
    chart.on('mousedown', (params) => {
      const event = params as { dataType?: string; data?: { id?: string }; event?: { offsetX: number; offsetY: number } }
      if (event.dataType === 'node' && event.data?.id && event.event) {
        dragRef.current = { id: String(event.data.id), x: event.event.offsetX, y: event.event.offsetY }
      } else {
        dragRef.current = null
      }
    })
    chart.on('mouseup', (params) => {
      const dragged = dragRef.current
      dragRef.current = null
      const event = params as { event?: { offsetX: number; offsetY: number } }
      if (!dragged || !event.event || !handlersRef.current.onNodeMoved) return
      const dx = event.event.offsetX - dragged.x
      const dy = event.event.offsetY - dragged.y
      // 小于 4px 视为点击（点选中不该把节点钉住）
      if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return
      const series = (chart.getOption() as { series?: Array<{ zoom?: number }> }).series?.[0]
      const zoom = series?.zoom && series.zoom > 0 ? series.zoom : 1
      handlersRef.current.onNodeMoved(dragged.id, dx / zoom, dy / zoom)
    })
    chart.on('click', (params) => {
      const event = params as { dataType?: string; data?: { name?: string; category?: number; value?: string } }
      if (event.dataType === 'node' && event.data) {
        handlersRef.current.onSelectNode({
          name: event.data.name ?? '',
          category: event.data.category ?? 0,
          value: event.data.value,
        })
        return
      }
      handlersRef.current.onSelectNode(null)
    })
    handlersRef.current.onReady()

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => chart.resize())
    observer?.observe(host)

    return () => {
      observer?.disconnect()
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    // notMerge keeps the option authoritative. The option identity is stable across
    // selection changes, so clicking a node no longer restarts the force layout.
    chartRef.current?.setOption(option, { notMerge: true })
  }, [option])

  return <div ref={hostRef} style={{ width: '100%', height: GRAPH_HEIGHT }} />
}

// Matched against both the English keys this file once assumed and the Chinese names
// the backend actually sends (城市/日程/景点/酒店/餐饮/天气/预算/偏好·建议). Without the
// Chinese terms every legend entry fell through to the generic "其他" label.
const categoryLabelKeys: Array<{ keywords: string[]; labelKey: string }> = [
  { keywords: ['city', '城市'], labelKey: 'knowledgeGraph.categoryCity' },
  { keywords: ['day', 'schedule', '日程', '行程'], labelKey: 'knowledgeGraph.categoryDay' },
  { keywords: ['attraction', '景点'], labelKey: 'knowledgeGraph.categoryAttraction' },
  { keywords: ['hotel', '酒店', '住宿'], labelKey: 'knowledgeGraph.categoryHotel' },
  { keywords: ['restaurant', 'meal', '餐饮', '美食'], labelKey: 'knowledgeGraph.categoryRestaurant' },
  { keywords: ['transportation', 'transport', '交通'], labelKey: 'knowledgeGraph.categoryTransportation' },
  { keywords: ['weather', '天气'], labelKey: 'knowledgeGraph.categoryWeather' },
  { keywords: ['budget', '预算'], labelKey: 'knowledgeGraph.categoryBudget' },
  { keywords: ['preference', 'suggestion', '偏好', '建议'], labelKey: 'knowledgeGraph.categoryPreference' },
]

const categoryColors: Record<string, string> = {
  attraction: '#d2673f',
  景点: '#d2673f',
  hotel: '#12695c',
  酒店: '#12695c',
  restaurant: '#d99a2b',
  餐饮: '#d99a2b',
  transportation: '#2a6d8f',
  交通: '#2a6d8f',
  city: '#2f9c86',
  城市: '#2f9c86',
  default: '#b6b2a6',
}

function getCategoryLabel(name: string, t: TFunction): string {
  const lower = name.toLowerCase()
  const match = categoryLabelKeys.find(({ keywords }) => keywords.some((keyword) => lower.includes(keyword)))
  return t(match ? match.labelKey : 'knowledgeGraph.categoryOther')
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function getCategoryColor(name: string, index: number): string {
  const lower = name.toLowerCase()
  for (const [key, color] of Object.entries(categoryColors)) {
    if (lower.includes(key.toLowerCase())) return color
  }
  const fallback = ['#12695c', '#d2673f', '#2f9c86', '#d99a2b', '#2a6d8f', '#8a7a5c', '#b3512d', '#5c6f8a']
  return fallback[index % fallback.length]
}

/**
 * Legend colours must match what is actually drawn. Graph nodes carry their colour in
 * `itemStyle` (from the backend), while the legend previously used an unrelated local
 * palette, so the dots pointed at colours no node had. Prefer the colour of a real node
 * in that category and only fall back to the static palette.
 */
function buildCategoryColors(nodes: GraphNode[], categoriesRaw: GraphCategory[]): Map<string, string> {
  const colors = new Map<string, string>()
  for (const node of nodes) {
    const name = categoriesRaw[node.category]?.name
    const color = node.itemStyle?.color
    if (name && color && !colors.has(name)) colors.set(name, color)
  }
  return colors
}

function buildGraphOption(
  nodes: GraphNode[],
  edges: GraphEdge[],
  categoriesRaw: GraphCategory[],
  t: TFunction,
  positions: Record<string, NodePosition>,
): EChartsCoreOption {
  const categories = categoriesRaw.map((cat: GraphCategory, idx: number) => ({
    name: cat.name,
    itemStyle: { color: getCategoryColor(cat.name, idx) },
  }))

  // ECharts resolves a link's source/target against the data item's `id` or `name`.
  // The backend addresses edges by node id (e.g. "trip_root", "city_北京"), so the id
  // has to be carried through: without it every edge points at an undefined node and
  // the renderer dies with "Cannot set properties of undefined (setting 'dataIndex')".
  const nodeIds = new Set(nodes.map((node) => node.id))
  const nodeNames = new Set(nodes.map((node) => node.name))
  const resolvedEdges = edges.filter(
    (edge) => (nodeIds.has(edge.source) || nodeNames.has(edge.source))
      && (nodeIds.has(edge.target) || nodeNames.has(edge.target)),
  )

  // 餐厅/酒店/预算这类节点名称很长，全部显示标签会互相压字；只给主干节点常显标签，
  // 其余节点悬停时再显示（详情面板里也有完整信息）。
  const primaryCategories = new Set<number>()
  categoriesRaw.forEach((category, index) => {
    const name = (category.name ?? '').toLowerCase()
    if (/city|城市|day|schedule|日程|行程|attraction|景点/.test(name)) {
      primaryCategories.add(index)
    }
  })

  return {
    tooltip: {
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      borderColor: 'rgba(53, 42, 24, 0.12)',
      borderWidth: 1,
      textStyle: { color: '#1b2a2f', fontSize: 13 },
      extraCssText: 'border-radius:10px;box-shadow:0 12px 30px -16px rgba(53,42,24,.35);',
      formatter: (params: { data?: { name?: string; category?: number; value?: string } }) => {
        if (params.data) {
          const catName = params.data.category !== undefined && categoriesRaw[params.data.category]
            ? categoriesRaw[params.data.category].name
            : ''
          const detail = params.data.value ? `<br/>${escapeHtml(params.data.value)}` : ''
          return `${escapeHtml(params.data.name)}<br/>${escapeHtml(t('knowledgeGraph.type', { category: catName }))}${detail}`
        }
        return ''
      },
    },
    series: [
      {
        type: 'graph',
        layout: 'none',
        roam: true,
        draggable: true,
        data: nodes.map((node) => ({
          id: node.id,
          name: node.name,
          category: node.category,
          symbolSize: node.symbolSize || 30,
          itemStyle: node.itemStyle,
          value: node.value,
          x: positions[node.id]?.x,
          y: positions[node.id]?.y,
          label: { show: primaryCategories.size === 0 || primaryCategories.has(node.category) },
        })),
        links: resolvedEdges.map((edge) => ({
          source: edge.source,
          target: edge.target,
          label: edge.label ? { show: true, formatter: edge.label } : undefined,
        })),
        categories,
        label: {
          show: true,
          fontSize: 12,
          color: '#ffffff',
          textBorderColor: 'rgba(20, 30, 25, 0.45)',
          textBorderWidth: 2.5,
        },
        // 力导向布局下节点名极易互相压字，交给 ECharts 隐藏重叠标签
        labelLayout: { hideOverlap: true },
        edgeLabel: {
          color: '#8c8a80',
          fontSize: 10,
        },
        lineStyle: {
          color: 'rgba(27, 42, 47, 0.16)',
          curveness: 0.15,
        },
        emphasis: {
          focus: 'adjacency',
          lineStyle: { width: 3 },
          label: { show: true },
        },
      },
    ],
  }
}

function KnowledgeGraph({ graphData, derived = false, tripPlan }: KnowledgeGraphProps) {
  const { t } = useTranslation()
  const [renderError, setRenderError] = useState(false)
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null)
  const [aiQuestion, setAiQuestion] = useState('')
  const [aiAnswer, setAiAnswer] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const aiPresetQuestions = [
    t('knowledgeGraph.presetHighlights'),
    t('knowledgeGraph.presetRoute'),
    t('knowledgeGraph.presetBudget'),
  ]

  // These stay referentially stable for a given plan, which keeps the option memo
  // below from rebuilding on unrelated state changes such as node selection.
  const nodes = useMemo(() => graphData?.nodes ?? [], [graphData])
  const edges = useMemo(() => graphData?.edges ?? [], [graphData])
  const categoriesRaw = useMemo(() => graphData?.categories ?? [], [graphData])

  const storageKey = useMemo(() => layoutStorageKey(nodes, tripPlan), [nodes, tripPlan])
  // 用户拖动过的位置（按当前计划维度做键，换城市/换天数就重新开始）
  const [dragPositions, setDragPositions] = useState<Record<string, NodePosition>>(
    () => readStoredPositions(layoutStorageKey(graphData?.nodes ?? [], tripPlan)),
  )

  const basePositions = useMemo(() => buildInitialPositions(nodes), [nodes])

  const positions = useMemo(
    () => mergePositions(basePositions, dragPositions),
    [basePositions, dragPositions],
  )

  const positionsRef = useRef(positions)
  useEffect(() => {
    positionsRef.current = positions
  }, [positions])

  const handleNodeMoved = useCallback((id: string, dx: number, dy: number) => {
    const current = positionsRef.current[id]
    if (!current) return
    setDragPositions((previous) => {
      const next = { ...previous, [id]: { x: current.x + dx, y: current.y + dy } }
      storePositions(storageKey, next)
      return next
    })
  }, [storageKey])

  const resetLayout = useCallback(() => {
    setDragPositions({})
    try {
      localStorage.removeItem(storageKey)
    } catch {
      // 忽略
    }
  }, [storageKey])

  const hasCustomLayout = Object.keys(dragPositions).length > 0

  const option = useMemo(
    () => (nodes.length === 0 ? null : buildGraphOption(nodes, edges, categoriesRaw, t, positions)),
    [categoriesRaw, edges, nodes, positions, t],
  )

  const nodeCategoryColors = useMemo(
    () => buildCategoryColors(nodes, categoriesRaw),
    [categoriesRaw, nodes],
  )

  if (!graphData || nodes.length === 0 || !option) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <Empty description={t('knowledgeGraph.empty')} />
      </div>
    )
  }

  if (renderError) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <Alert
          type="error"
          showIcon
          title={t('knowledgeGraph.renderFailed')}
          description={t('knowledgeGraph.renderFailedDetail')}
        />
      </div>
    )
  }

  const selectedCategoryName = selectedNode !== null && categoriesRaw[selectedNode.category]
    ? categoriesRaw[selectedNode.category].name
    : ''
  const selectedColor = selectedNode !== null
    ? (nodeCategoryColors.get(selectedCategoryName) ?? getCategoryColor(selectedCategoryName, selectedNode.category))
    : '#ccc'

  const askAi = async (question: string) => {
    const text = question.trim()
    if (!text || aiLoading || !tripPlan) return
    setAiLoading(true)
    setAiAnswer('')
    try {
      const res = await apiClient.post<TripChatResponse>('/api/chat/ask', {
        message: text,
        trip_plan: tripPlan,
        history: [],
      })
      setAiAnswer(res.data.success ? res.data.reply : t('knowledgeGraph.aiUnavailable'))
    } catch {
      setAiAnswer(t('knowledgeGraph.networkFailed'))
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div>
      <div className="kg-toolbar">
        <span className="kg-toolbar-hint">{t('knowledgeGraph.dragHint')}</span>
        {hasCustomLayout && (
          <Button size="small" onClick={resetLayout}>{t('knowledgeGraph.resetLayout')}</Button>
        )}
      </div>
      <GraphCanvas
        option={option}
        onSelectNode={setSelectedNode}
        onError={() => setRenderError(true)}
        onReady={() => setRenderError(false)}
        onNodeMoved={handleNodeMoved}
      />

      {/* 节点详情面板 */}
      <div className={`kg-node-detail${selectedNode ? ' has-selection' : ''}`}>
        {selectedNode ? (
          <>
            <span className="kg-node-detail-dot" style={{ background: selectedColor }} />
            <strong>{selectedNode.name}</strong>
            <Tag style={{ marginInlineStart: 4 }}>{getCategoryLabel(selectedCategoryName, t)}</Tag>
            {selectedNode.value && <p>{selectedNode.value}</p>}
          </>
        ) : (
          <span className="kg-node-detail-hint">{t('knowledgeGraph.interactionHint')}</span>
        )}
      </div>

      {derived && (
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('knowledgeGraph.derived')}
          </Text>
        </div>
      )}

      <div className="kg-legend" style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 16,
        justifyContent: 'center',
        marginTop: 16,
        padding: '0 16px',
        color: 'var(--hj-text-2)',
      }}>
        {categoriesRaw.map((cat: GraphCategory, idx: number) => (
          <span key={cat.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: nodeCategoryColors.get(cat.name) ?? getCategoryColor(cat.name, idx),
              display: 'inline-block',
            }} />
            {getCategoryLabel(cat.name, t)}
          </span>
        ))}
      </div>

      {/* AI 图谱解读（DeepSeek，走后端接口） */}
      <div className="kg-ai-box">
        <div className="kg-ai-head">
          <i className="kg-ai-logo"><AILogo size={18} /></i>
          <span>{t('knowledgeGraph.aiTitle')}</span>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('knowledgeGraph.aiProvider')}
          </Text>
        </div>

        {!tripPlan ? (
          <p className="kg-ai-empty">{t('knowledgeGraph.noPlan')}</p>
        ) : (
          <>
            <div className="kg-ai-presets">
              {aiPresetQuestions.map((question) => (
                <button
                  key={question}
                  type="button"
                  className="kg-ai-preset"
                  disabled={aiLoading}
                  onClick={() => void askAi(question)}
                >
                  {question}
                </button>
              ))}
            </div>

            <div className="kg-ai-input">
              <Input.TextArea
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                placeholder={t('knowledgeGraph.questionPlaceholder')}
                autoSize={{ minRows: 2, maxRows: 4 }}
                disabled={aiLoading}
                onPressEnter={(e) => {
                  if (!e.shiftKey) {
                    e.preventDefault()
                    void askAi(aiQuestion)
                  }
                }}
              />
              <Button
                type="primary"
                loading={aiLoading}
                disabled={!aiQuestion.trim()}
                onClick={() => void askAi(aiQuestion)}
              >
                {t('knowledgeGraph.ask')}
              </Button>
            </div>

            {aiAnswer && <div className="kg-ai-answer">{aiAnswer}</div>}
          </>
        )}
      </div>
    </div>
  )
}

export default KnowledgeGraph
