import { useState } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { Typography, Empty, Alert, Tag, Input, Button } from 'antd'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { GraphChart } from 'echarts/charts'
import { TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { apiClient } from '../../services/apiClient'
import { DeepSeekLogo } from '../DeepSeekLogo'
import type { KnowledgeGraphData, GraphCategory, TripPlan, TripChatResponse } from '../../types/api'

const { Text } = Typography

echarts.use([GraphChart, TooltipComponent, CanvasRenderer])

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

const categoryLabelKeys: Record<string, string> = {
  attraction: 'knowledgeGraph.categoryAttraction',
  hotel: 'knowledgeGraph.categoryHotel',
  restaurant: 'knowledgeGraph.categoryRestaurant',
  transportation: 'knowledgeGraph.categoryTransportation',
  city: 'knowledgeGraph.categoryCity',
  default: 'knowledgeGraph.categoryOther',
}

const categoryColors: Record<string, string> = {
  attraction: '#d76e42',
  hotel: '#51cbce',
  restaurant: '#fbc658',
  transportation: '#6bd098',
  city: '#51bcda',
  default: '#ccc',
}

function getCategoryLabel(name: string, t: TFunction): string {
  const lower = name.toLowerCase()
  for (const [key, labelKey] of Object.entries(categoryLabelKeys)) {
    if (lower.includes(key)) return t(labelKey)
  }
  return t(categoryLabelKeys.default)
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
    if (lower.includes(key)) return color
  }
  const fallback = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4']
  return fallback[index % fallback.length]
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

  const nodes = Array.isArray(graphData?.nodes) ? graphData.nodes : []
  const edges = Array.isArray(graphData?.edges) ? graphData.edges : []
  const categoriesRaw = Array.isArray(graphData?.categories) ? graphData.categories : []

  if (!graphData || nodes.length === 0) {
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
          message={t('knowledgeGraph.renderFailed')}
          description={t('knowledgeGraph.renderFailedDetail')}
        />
      </div>
    )
  }

  const categories: Array<{ name: string; itemStyle: { color: string } }> = categoriesRaw.map(
    (cat: GraphCategory, idx: number) => ({
      name: cat.name,
      itemStyle: { color: getCategoryColor(cat.name, idx) },
    })
  )

  const option = {
    tooltip: {
      backgroundColor: 'rgba(10, 21, 32, 0.95)',
      borderColor: 'rgba(236, 243, 250, 0.18)',
      textStyle: { color: '#ecf3fa' },
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
        layout: 'force',
        force: { repulsion: 300, edgeLength: [100, 280], gravity: 0.12 },
        roam: true,
        draggable: true,
        data: nodes.map((node) => ({
          name: node.name,
          category: node.category,
          symbolSize: node.symbolSize || 30,
          itemStyle: node.itemStyle,
          value: node.value,
        })),
        links: edges.map((edge) => ({
          source: edge.source,
          target: edge.target,
          label: edge.label ? { show: true, formatter: edge.label } : undefined,
        })),
        categories,
        label: {
          show: true,
          fontSize: 12,
          color: '#e8f0f8',
        },
        edgeLabel: {
          color: 'rgba(236, 243, 250, 0.55)',
          fontSize: 10,
        },
        lineStyle: {
          color: 'rgba(236, 243, 250, 0.25)',
          curveness: 0.15,
        },
        emphasis: {
          focus: 'adjacency',
          lineStyle: { width: 3 },
        },
      },
    ],
  }

  const selectedCategoryName = selectedNode !== null && categoriesRaw[selectedNode.category]
    ? categoriesRaw[selectedNode.category].name
    : ''
  const selectedColor = selectedNode !== null
    ? getCategoryColor(selectedCategoryName, selectedNode.category)
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
      <ReactEChartsCore
        echarts={echarts}
        option={option}
        style={{ width: '100%', height: 560 }}
        notMerge
        opts={{ renderer: 'canvas' }}
        onEvents={{
          click: (params: { dataType?: string; data?: { name?: string; category?: number; value?: string } }) => {
            if (params.dataType === 'node' && params.data) {
              setSelectedNode({
                name: params.data.name ?? '',
                category: params.data.category ?? 0,
                value: params.data.value,
              })
            } else {
              setSelectedNode(null)
            }
          },
        }}
        onChartReady={() => setRenderError(false)}
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
        color: 'rgba(236, 243, 250, 0.8)',
      }}>
        {categoriesRaw.map((cat: GraphCategory, idx: number) => (
          <span key={cat.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: getCategoryColor(cat.name, idx),
              display: 'inline-block',
            }} />
            {getCategoryLabel(cat.name, t)}
          </span>
        ))}
      </div>

      {/* AI 图谱解读（DeepSeek，走后端接口） */}
      <div className="kg-ai-box">
        <div className="kg-ai-head">
          <i className="kg-ai-logo"><DeepSeekLogo size={18} /></i>
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
