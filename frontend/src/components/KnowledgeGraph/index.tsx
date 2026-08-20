import { useState } from 'react'
import { Typography, Empty, Alert } from 'antd'
import ReactECharts from 'echarts-for-react'
import type { KnowledgeGraphData, GraphCategory } from '../../types/api'

const { Text } = Typography

interface KnowledgeGraphProps {
  graphData: KnowledgeGraphData | null
  /** 图谱是否由前端根据行程数据推导生成（后端未返回时） */
  derived?: boolean
}

const categoryLabels: Record<string, string> = {
  attraction: '景点',
  hotel: '酒店',
  restaurant: '餐厅',
  transportation: '交通',
  city: '城市',
  default: '其他',
}

const categoryColors: Record<string, string> = {
  attraction: '#d76e42',
  hotel: '#51cbce',
  restaurant: '#fbc658',
  transportation: '#6bd098',
  city: '#51bcda',
  default: '#ccc',
}

function getCategoryLabel(name: string): string {
  const lower = name.toLowerCase()
  for (const [key, label] of Object.entries(categoryLabels)) {
    if (lower.includes(key)) return label
  }
  return categoryLabels.default
}

function getCategoryColor(name: string, index: number): string {
  const lower = name.toLowerCase()
  for (const [key, color] of Object.entries(categoryColors)) {
    if (lower.includes(key)) return color
  }
  const fallback = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4']
  return fallback[index % fallback.length]
}

function KnowledgeGraph({ graphData, derived = false }: KnowledgeGraphProps) {
  const [renderError, setRenderError] = useState(false)

  const nodes = Array.isArray(graphData?.nodes) ? graphData.nodes : []
  const edges = Array.isArray(graphData?.edges) ? graphData.edges : []
  const categoriesRaw = Array.isArray(graphData?.categories) ? graphData.categories : []

  if (!graphData || nodes.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <Empty description="暂无知识图谱数据" />
      </div>
    )
  }

  if (renderError) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <Alert
          type="error"
          showIcon
          message="图谱渲染失败"
          description="可能是浏览器兼容问题，请尝试刷新页面或更换浏览器。"
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
          const detail = params.data.value ? `<br/>${params.data.value}` : ''
          return `${params.data.name}<br/>类型：${catName}${detail}`
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

  return (
    <div>
      <ReactECharts
        option={option}
        style={{ width: '100%', height: 600 }}
        notMerge
        opts={{ renderer: 'canvas' }}
        onChartReady={() => setRenderError(false)}
      />
      {derived && (
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            · 本图谱由行程数据自动生成 ·
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
            {getCategoryLabel(cat.name)}
          </span>
        ))}
      </div>
    </div>
  )
}

export default KnowledgeGraph
