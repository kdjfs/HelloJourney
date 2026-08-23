import type { KnowledgeGraphData, GraphNode, GraphEdge, TripPlan } from '../types/api'

export const GRAPH_CATEGORIES = [
  { name: '城市' },
  { name: '日行程' },
  { name: '景点' },
  { name: '酒店' },
  { name: '餐饮' },
  { name: '天气' },
  { name: '预算' },
  { name: '偏好/建议' },
]

const formatMinutes = (minutes: number) => {
  const hours = Math.floor((minutes || 0) / 60)
  const mins = (minutes || 0) % 60
  if (hours === 0) return `${mins}分钟`
  if (mins === 0) return `${hours}小时`
  return `${hours}小时${mins}分钟`
}

/**
 * 后端没有返回 graph_data 时，根据行程数据在前端推导知识图谱，
 * 保证"知识图谱"页签始终有内容可展示。
 */
export function buildFallbackGraphData(plan: TripPlan): KnowledgeGraphData {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const cityName = plan.city || '目的地'

  nodes.push({
    id: `city_${cityName}`,
    name: cityName,
    category: 0,
    symbolSize: 70,
    value: `${plan.start_date} ~ ${plan.end_date}`,
  })

  for (const day of plan.days) {
    const dayId = `day_${day.day_index}`
    const dayName = `第${day.day_index + 1}天`
    nodes.push({
      id: dayId,
      name: dayName,
      category: 1,
      symbolSize: 45,
      value: day.date,
    })
    edges.push({ source: `city_${cityName}`, target: dayId, label: '行程' })

    for (const [attrIndex, attr] of day.attractions.entries()) {
      const attrId = `attr_${day.day_index}_${attrIndex}_${attr.name}`
      const detail = [
        attr.address,
        formatMinutes(attr.visit_duration),
        attr.ticket_price !== undefined && attr.ticket_price > 0 ? `门票¥${attr.ticket_price}` : '',
      ]
        .filter(Boolean)
        .join(' | ')
      nodes.push({
        id: attrId,
        name: attr.name,
        category: 2,
        symbolSize: 35,
        value: detail || undefined,
      })
      edges.push({ source: dayId, target: attrId, label: '游览' })
      if (attrIndex > 0) {
        const prevAttr = day.attractions[attrIndex - 1]
        edges.push({
          source: `attr_${day.day_index}_${attrIndex - 1}_${prevAttr.name}`,
          target: attrId,
          label: '下一站',
        })
      }
    }

    if (day.hotel) {
      const hotelId = `hotel_${day.day_index}_${day.hotel.name}`
      nodes.push({
        id: hotelId,
        name: day.hotel.name,
        category: 3,
        symbolSize: 35,
        value: `${day.hotel.price_range} | ${day.hotel.rating}分`,
      })
      edges.push({ source: dayId, target: hotelId, label: '入住' })
    }

    for (const [mealIndex, meal] of day.meals.entries()) {
      const mealId = `meal_${day.day_index}_${mealIndex}_${meal.name}`
      nodes.push({
        id: mealId,
        name: meal.name,
        category: 4,
        symbolSize: 25,
        value: meal.estimated_cost !== undefined && meal.estimated_cost > 0 ? `¥${meal.estimated_cost}` : undefined,
      })
      edges.push({ source: dayId, target: mealId, label: meal.type === 'breakfast' ? '早餐' : meal.type === 'lunch' ? '午餐' : meal.type === 'dinner' ? '晚餐' : '餐饮' })
    }
  }

  for (const [weatherIndex, weather] of plan.weather_info.entries()) {
    const weatherId = `weather_${weather.date}_${weatherIndex}`
    nodes.push({
      id: weatherId,
      name: `${weather.day_weather} ${weather.day_temp}°C`,
      category: 5,
      symbolSize: 28,
      value: weather.date,
    })
    if (plan.days[weatherIndex]) {
      edges.push({ source: `day_${plan.days[weatherIndex].day_index}`, target: weatherId, label: '天气' })
    }
  }

  if (plan.budget) {
    const budgetTotalId = 'budget_total'
    nodes.push({
      id: budgetTotalId,
      name: `总预算 ¥${plan.budget.total.toLocaleString()}`,
      category: 6,
      symbolSize: 40,
    })
    edges.push({ source: `city_${cityName}`, target: budgetTotalId, label: '预算' })

    const budgetItems: Array<[string, number]> = [
      ['景点', plan.budget.total_attractions],
      ['酒店', plan.budget.total_hotels],
      ['餐饮', plan.budget.total_meals],
      ['交通', plan.budget.total_transportation + (plan.budget.total_inter_city_transport || 0)],
    ]
    for (const [label, value] of budgetItems) {
      if (value > 0) {
        const id = `budget_budget_${label}`
        nodes.push({ id, name: `${label} ¥${value.toLocaleString()}`, category: 6, symbolSize: 40 })
        edges.push({ source: budgetTotalId, target: id })
      }
    }
  }

  if (plan.overall_suggestions) {
    const suggestionId = 'suggestion_overall'
    nodes.push({
      id: suggestionId,
      name: '出行建议',
      category: 7,
      symbolSize: 30,
      value: plan.overall_suggestions,
    })
    edges.push({ source: `city_${cityName}`, target: suggestionId, label: '建议' })
  }

  return {
    nodes,
    edges,
    categories: GRAPH_CATEGORIES,
  }
}
