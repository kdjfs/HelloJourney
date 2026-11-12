import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { KnowledgeGraphData } from '@/types/api'
import KnowledgeGraph from './index'

// echarts needs a real canvas, which jsdom does not provide. Stubbing the entry
// point keeps these tests on the component contract: that it renders, applies an
// option, and reports selection. The render crash this file guards against was not
// an echarts failure at all — the chart element was a plain object, which React
// rejects with "Element type is invalid" (#130) and which removed the whole tab.
const initMock = vi.hoisted(() => vi.fn())
const setOptionMock = vi.hoisted(() => vi.fn())
const onMock = vi.hoisted(() => vi.fn())
const resizeMock = vi.hoisted(() => vi.fn())
const disposeMock = vi.hoisted(() => vi.fn())

vi.mock('echarts/core', () => ({ init: initMock, use: vi.fn() }))
vi.mock('echarts/charts', () => ({ GraphChart: {} }))
vi.mock('echarts/components', () => ({ TooltipComponent: {} }))
vi.mock('echarts/renderers', () => ({ CanvasRenderer: {} }))

const graphData: KnowledgeGraphData = {
  nodes: [
    { id: 'city', name: '北京', category: 0, symbolSize: 70 },
    { id: 'attr', name: '故宫博物院', category: 2, symbolSize: 35, value: '东城区 | 游览 210 分钟' },
  ],
  edges: [{ source: 'city', target: 'attr', label: '游览' }],
  categories: [{ name: '城市' }, { name: '景点' }],
}

// The backend addresses edges by node id while nodes are labelled by name. Carrying
// the id through matters: ECharts resolves a link against the data item's id or name,
// and an unresolved endpoint crashes the renderer with "Cannot set properties of
// undefined (setting 'dataIndex')" while drawing the edge.
const graphWithDanglingEdge: KnowledgeGraphData = {
  ...graphData,
  edges: [
    { source: 'city', target: 'attr', label: '游览' },
    { source: 'city', target: 'missing-node', label: '幽灵边' },
  ],
}

const graphWithColors: KnowledgeGraphData = {
  nodes: [
    { id: 'city', name: '北京', category: 0, symbolSize: 70, itemStyle: { color: '#4A90D9' } },
    { id: 'attr', name: '故宫博物院', category: 2, symbolSize: 35, itemStyle: { color: '#5AD8A6' } },
  ],
  edges: [{ source: 'city', target: 'attr' }],
  // Mirrors the backend: categories are a positional list the node index points into.
  categories: [{ name: '城市' }, { name: '日程' }, { name: '景点' }],
}

beforeEach(() => {
  vi.clearAllMocks()
  initMock.mockReturnValue({
    on: onMock,
    setOption: setOptionMock,
    resize: resizeMock,
    dispose: disposeMock,
  })
})

describe('KnowledgeGraph', () => {
  it('renders the graph and applies the chart option', () => {
    render(<KnowledgeGraph graphData={graphData} />)

    expect(screen.getByText('💡 点击图中任意节点查看详情 · 拖拽移动 · 滚轮缩放')).toBeInTheDocument()
    expect(initMock).toHaveBeenCalledTimes(1)
    expect(setOptionMock).toHaveBeenCalledTimes(1)

    const [option] = setOptionMock.mock.calls[0]
    expect(option.series[0].data).toHaveLength(2)
    expect(option.series[0].categories).toHaveLength(2)
  })

  it('carries node ids so every link resolves to a real node', () => {
    render(<KnowledgeGraph graphData={graphData} />)

    const [option] = setOptionMock.mock.calls[0]
    const ids = option.series[0].data.map((node: { id?: string }) => node.id)
    expect(ids).toEqual(['city', 'attr'])
    for (const link of option.series[0].links) {
      expect(ids).toContain(link.source)
      expect(ids).toContain(link.target)
    }
  })

  it('drops links whose endpoints are not in the node set', () => {
    render(<KnowledgeGraph graphData={graphWithDanglingEdge} />)

    const [option] = setOptionMock.mock.calls[0]
    expect(option.series[0].links).toHaveLength(1)
    expect(option.series[0].links[0]).toMatchObject({ source: 'city', target: 'attr' })
  })

  it('shows node details when a node is clicked', () => {
    render(<KnowledgeGraph graphData={graphData} />)
    const clickHandler = onMock.mock.calls.find(([event]) => event === 'click')?.[1]
    expect(clickHandler).toBeTypeOf('function')

    act(() => {
      clickHandler({ dataType: 'node', data: { name: '故宫博物院', category: 2, value: '东城区 | 游览 210 分钟' } })
    })

    expect(screen.getByText('故宫博物院')).toBeInTheDocument()
    expect(screen.getByText('东城区 | 游览 210 分钟')).toBeInTheDocument()
  })

  it('translates the Chinese category names the backend sends', () => {
    render(<KnowledgeGraph graphData={graphData} />)

    // Every entry used to fall through to the generic "其他" label because only
    // English keywords were matched.
    expect(screen.getByText('城市')).toBeInTheDocument()
    expect(screen.getByText('景点')).toBeInTheDocument()
    expect(screen.queryByText('其他')).not.toBeInTheDocument()
  })

  it('colours the legend swatches with the colours the nodes are drawn in', () => {
    const { container } = render(<KnowledgeGraph graphData={graphWithColors} />)

    const swatches = [...container.querySelectorAll<HTMLElement>('.kg-legend span')]
      .filter((element) => element.style.backgroundColor !== '')
      .map((element) => element.style.backgroundColor)

    expect(swatches).toContain('rgb(74, 144, 217)')
    expect(swatches).toContain('rgb(90, 216, 166)')
  })

  it('does not rebuild the option when only the selection changes', () => {
    render(<KnowledgeGraph graphData={graphData} />)
    const clickHandler = onMock.mock.calls.find(([event]) => event === 'click')?.[1]

    act(() => {
      clickHandler({ dataType: 'node', data: { name: '故宫博物院', category: 2 } })
    })

    // Re-applying the option would restart the force layout under the user's cursor.
    expect(setOptionMock).toHaveBeenCalledTimes(1)
  })

  it('renders the empty state without touching the canvas', () => {
    render(<KnowledgeGraph graphData={null} />)

    expect(screen.getByText('暂无知识图谱数据')).toBeInTheDocument()
    expect(initMock).not.toHaveBeenCalled()
  })

  it('degrades to a readable message when no canvas is available', () => {
    initMock.mockImplementationOnce(() => {
      throw new Error('canvas unavailable')
    })

    render(<KnowledgeGraph graphData={graphData} />)

    expect(screen.getByText('图谱渲染失败')).toBeInTheDocument()
  })

  it('disposes the chart on unmount', () => {
    const { unmount } = render(<KnowledgeGraph graphData={graphData} />)

    unmount()

    expect(disposeMock).toHaveBeenCalledTimes(1)
  })
})
