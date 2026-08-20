import { delay, http, HttpResponse } from 'msw'
import { mockTripPlanResponse } from './mockData'

const taskId = 'mock1234'

export const handlers = [
  http.get('*/health', () => {
    return HttpResponse.json({
      status: 'healthy',
      service: 'HelloAgents智能旅行助手',
      version: '2.0.0',
    })
  }),

  http.post('*/api/trip/plan', async ({ request }) => {
    const body = await request.json()

    console.log('[MSW] 命中 Mock：POST /api/trip/plan')
    console.log('[MSW] 请求参数：', body)

    await delay(800)

    return HttpResponse.json({
      task_id: taskId,
      plan_id: taskId,
      status: 'processing',
      ws_url: `/api/trip/ws/${taskId}`,
      message: 'Mock 任务已提交',
    })
  }),

  http.get('*/api/trip/status/:taskId', async () => {
    console.log('[MSW] 命中 Mock：GET /api/trip/status/:taskId')

    await delay(800)

    return HttpResponse.json({
      task_id: taskId,
      plan_id: taskId,
      status: 'completed',
      result: mockTripPlanResponse,
    })
  }),

  http.get('*/api/trip/history', () => {
    return HttpResponse.json({
      items: [
        {
          plan_id: taskId,
          task_id: taskId,
          city: '北京',
          start_date: '2026-06-01',
          end_date: '2026-06-03',
          travel_days: 3,
          updated_at: new Date().toISOString(),
          overall_suggestions: '建议提前预约热门景点。',
        },
      ],
    })
  }),

  http.get('*/api/poi/photo', () => {
    return HttpResponse.json({
      success: true,
      message: '暂无已验证图片',
      data: {
        imageUrl: '',
        provider: 'none',
        matchedName: '',
        matchedPoiId: '',
        confidence: 0,
        verified: false,
      },
    })
  }),

  http.post('*/api/chat/ask', () => {
    return HttpResponse.json({
      success: true,
      reply: '这是 Mock AI 回复：这个行程整体预算约 1540 元，适合第一次来北京的游客。',
    })
  }),

  http.get('*/api/settings', () => {
    return HttpResponse.json({
      success: true,
      message: 'ok',
      data: {
        tencent_maps_configured: true,
        google_maps_configured: false,
        xhs_configured: false,
        llm_active_provider: 'deepseek',
        llm_providers: [
          {
            key: 'deepseek',
            name: 'DeepSeek',
            model: 'deepseek-chat',
            configured: true,
            active: true,
          },
        ],
      },
    })
  }),

  http.delete('*/api/trip/tasks/:taskId', ({ params }) => {
    return HttpResponse.json({ task_id: params.taskId, status: 'cancelled', message: 'Mock 任务已取消' })
  }),

  http.post('*/api/trip/plans/:planId/replan', async () => {
    await delay(500)
    return HttpResponse.json({
      id: 'change-mock-1',
      title: '放慢下午节奏',
      summary: '将第二个景点移到后一天，减少当天步行距离。',
      operations: [{ type: 'attraction.move', fromDayIndex: 0, attractionIndex: 1, toDayIndex: 1, at: 0 }],
    })
  }),
]
