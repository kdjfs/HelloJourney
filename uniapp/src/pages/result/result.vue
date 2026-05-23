<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type {
  TripPlanResponse,
  TripPlan,
  DayPlan,
  WeatherInfo,
  Budget,
  KnowledgeGraphData,
  GraphNode,
  GraphCategory,
  GraphEdge,
} from '@/types/api'
import { askTripChat } from '@/api/chat'
import type { ChatMessage } from '@/types/api'

const planData = ref<TripPlanResponse | null>(null)
const activeTab = ref(0)
const tabs = ['概览', '预算', '天气', '每日行程', '知识图谱']

const expandedDays = ref<Set<number>>(new Set())

const plan = computed<TripPlan | null>(() => planData.value?.data ?? null)
const graphData = computed<KnowledgeGraphData | null>(() => planData.value?.graph_data ?? null)

const chatVisible = ref(false)
const chatInput = ref('')
const chatMessages = ref<ChatMessage[]>([])
const chatSending = ref(false)

function loadPlan() {
  const planId = getPlanIdFromQuery()
  if (planId) {
    const stored = uni.getStorageSync('CURRENT_PLAN')
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as TripPlanResponse
        if (parsed.plan_id === planId) {
          planData.value = parsed
          return
        }
      } catch {}
    }
    fetchPlanFromApi(planId)
  } else {
    const stored = uni.getStorageSync('CURRENT_PLAN')
    if (stored) {
      try {
        planData.value = JSON.parse(stored) as TripPlanResponse
      } catch {}
    }
  }
}

function getPlanIdFromQuery(): string {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  if (currentPage && (currentPage as any).options) {
    return (currentPage as any).options.plan_id || ''
  }
  return ''
}

function fetchPlanFromApi(planId: string) {
  uni.request({
    url: `${uni.getStorageSync('API_BASE_URL') || 'http://127.0.0.1:8000'}/api/trip/plan/${planId}`,
    method: 'GET',
    success: (res: any) => {
      if (res.statusCode >= 200 && res.statusCode < 300 && res.data) {
        planData.value = res.data as TripPlanResponse
        uni.setStorageSync('CURRENT_PLAN', JSON.stringify(planData.value))
      }
    },
    fail: () => {
      uni.showToast({ title: '加载计划失败', icon: 'none' })
    },
  })
}

function switchTab(index: number) {
  activeTab.value = index
}

function toggleDay(dayIndex: number) {
  if (expandedDays.value.has(dayIndex)) {
    expandedDays.value.delete(dayIndex)
  } else {
    expandedDays.value.add(dayIndex)
  }
}

function getWeatherEmoji(weather: string): string {
  if (!weather) return '🌤️'
  const w = weather.toLowerCase()
  if (w.includes('晴')) return '☀️'
  if (w.includes('云') || w.includes('阴')) return '🌤️'
  if (w.includes('雨')) return '🌧️'
  if (w.includes('雷')) return '⛈️'
  if (w.includes('雪')) return '❄️'
  if (w.includes('雾') || w.includes('霾')) return '🌫️'
  return '🌤️'
}

function getMealTypeTag(type: string): string {
  const map: Record<string, string> = {
    早餐: '🌅',
    午餐: '☀️',
    晚餐: '🌙',
    宵夜: '🌃',
  }
  return map[type] || '🍽️'
}

const groupedNodes = computed(() => {
  if (!graphData.value) return []
  const categories = graphData.value.categories
  const nodes = graphData.value.nodes
  const edges = graphData.value.edges

  return categories.map((cat, idx) => {
    const catNodes = nodes.filter((n) => n.category === idx)
    const nodeWithEdges = catNodes.map((node) => {
      const connections = edges
        .filter((e) => e.source === node.id || e.target === node.id)
        .map((e) => {
          const otherId = e.source === node.id ? e.target : e.source
          const otherNode = nodes.find((n) => n.id === otherId)
          return {
            label: e.label,
            targetName: otherNode?.name || otherId,
          }
        })
      return { ...node, connections }
    })
    return { category: cat, nodes: nodeWithEdges }
  }).filter((g) => g.nodes.length > 0)
})

function openChat() {
  chatVisible.value = true
}

function closeChat() {
  chatVisible.value = false
}

async function sendChat() {
  const msg = chatInput.value.trim()
  if (!msg || chatSending.value) return

  chatMessages.value.push({ role: 'user', content: msg })
  chatInput.value = ''
  chatSending.value = true

  try {
    const res = await askTripChat({
      message: msg,
      trip_plan: planData.value?.data ?? {},
      history: chatMessages.value.slice(0, -1),
    })
    chatMessages.value.push({ role: 'assistant', content: res.reply })
  } catch {
    chatMessages.value.push({ role: 'assistant', content: '抱歉，AI 助手暂时无法回复，请稍后再试。' })
  } finally {
    chatSending.value = false
  }
}

onMounted(() => {
  loadPlan()
})
</script>

<template>
  <view class="page">
    <scroll-view scroll-x class="tab-bar">
      <view
        v-for="(tab, idx) in tabs"
        :key="idx"
        :class="['tab-item', activeTab === idx ? 'tab-active' : '']"
        @tap="switchTab(idx)"
      >
        <text class="tab-text">{{ tab }}</text>
        <view v-if="activeTab === idx" class="tab-indicator"></view>
      </view>
    </scroll-view>

    <view class="tab-content">
      <view v-show="activeTab === 0" class="tab-panel">
        <view v-if="plan" class="overview">
          <view class="overview-header">
            <text class="overview-city">{{ plan.city }}</text>
            <text class="overview-date">{{ plan.start_date }} ~ {{ plan.end_date }}</text>
          </view>
          <view class="overview-suggestions">
            <text class="suggestions-label">旅行建议</text>
            <text class="suggestions-text">{{ plan.overall_suggestions }}</text>
          </view>
          <view class="attractions-scroll">
            <text class="section-title">热门景点</text>
            <scroll-view scroll-x class="attractions-list">
              <view
                v-for="(attr, idx) in plan.days.flatMap((d: DayPlan) => d.attractions).slice(0, 10)"
                :key="idx"
                class="attraction-card"
              >
                <image
                  v-if="attr.image_url"
                  :src="attr.image_url"
                  class="attraction-img"
                  mode="aspectFill"
                />
                <view v-else class="attraction-img-placeholder">
                  <text class="placeholder-icon">🏞️</text>
                </view>
                <text class="attraction-name">{{ attr.name }}</text>
                <text class="attraction-category">{{ attr.category }}</text>
              </view>
            </scroll-view>
          </view>
        </view>
        <view v-else class="empty-state">
          <text class="empty-text">暂无计划数据</text>
        </view>
      </view>

      <view v-show="activeTab === 1" class="tab-panel">
        <view v-if="plan" class="budget">
          <view class="budget-total">
            <text class="budget-total-label">总预算</text>
            <text class="budget-total-amount">¥{{ plan.budget.total.toLocaleString() }}</text>
          </view>
          <view class="budget-grid">
            <view class="budget-item">
              <text class="budget-icon">🎫</text>
              <text class="budget-item-label">景点门票</text>
              <text class="budget-item-amount">¥{{ plan.budget.total_attractions.toLocaleString() }}</text>
            </view>
            <view class="budget-item">
              <text class="budget-icon">🏨</text>
              <text class="budget-item-label">酒店住宿</text>
              <text class="budget-item-amount">¥{{ plan.budget.total_hotels.toLocaleString() }}</text>
            </view>
            <view class="budget-item">
              <text class="budget-icon">🍽️</text>
              <text class="budget-item-label">餐饮美食</text>
              <text class="budget-item-amount">¥{{ plan.budget.total_meals.toLocaleString() }}</text>
            </view>
            <view class="budget-item">
              <text class="budget-icon">🚗</text>
              <text class="budget-item-label">交通出行</text>
              <text class="budget-item-amount">¥{{ plan.budget.total_transportation.toLocaleString() }}</text>
            </view>
          </view>
        </view>
      </view>

      <view v-show="activeTab === 2" class="tab-panel">
        <view v-if="plan" class="weather">
          <view class="weather-list">
            <view
              v-for="(w, idx) in plan.weather_info"
              :key="idx"
              class="weather-card"
            >
              <text class="weather-date">{{ w.date }}</text>
              <view class="weather-icons">
                <view class="weather-icon-group">
                  <text class="weather-emoji">{{ getWeatherEmoji(w.day_weather) }}</text>
                  <text class="weather-desc">{{ w.day_weather }}</text>
                </view>
                <view class="weather-icon-group">
                  <text class="weather-emoji">{{ getWeatherEmoji(w.night_weather) }}</text>
                  <text class="weather-desc">{{ w.night_weather }}</text>
                </view>
              </view>
              <view class="weather-temp">
                <text class="temp-day">{{ w.day_temp }}°</text>
                <text class="temp-sep">/</text>
                <text class="temp-night">{{ w.night_temp }}°</text>
              </view>
              <text class="weather-wind">{{ w.wind_direction }} {{ w.wind_power }}</text>
            </view>
          </view>
        </view>
      </view>

      <view v-show="activeTab === 3" class="tab-panel">
        <view v-if="plan" class="itinerary">
          <view
            v-for="(day, idx) in plan.days"
            :key="idx"
            class="day-card"
          >
            <view class="day-header" @tap="toggleDay(idx)">
              <view class="day-header-left">
                <text class="day-index">Day {{ day.day_index }}</text>
                <text class="day-date">{{ day.date }}</text>
              </view>
              <text :class="['day-arrow', expandedDays.has(idx) ? 'day-arrow-up' : '']">▼</text>
            </view>

            <view v-if="expandedDays.has(idx)" class="day-body">
              <text class="day-description">{{ day.description }}</text>

              <view v-if="day.hotel" class="hotel-card">
                <text class="hotel-icon">🏨</text>
                <view class="hotel-info">
                  <text class="hotel-name">{{ day.hotel.name }}</text>
                  <text class="hotel-meta">{{ day.hotel.type }} · ¥{{ day.hotel.estimated_cost }}</text>
                </view>
              </view>

              <view v-if="day.attractions.length" class="attraction-list">
                <text class="sub-title">景点</text>
                <view
                  v-for="(attr, aIdx) in day.attractions"
                  :key="aIdx"
                  class="attraction-item"
                >
                  <image
                    v-if="attr.image_url"
                    :src="attr.image_url"
                    class="attraction-item-img"
                    mode="aspectFill"
                  />
                  <view v-else class="attraction-item-img-placeholder">
                    <text>🏞️</text>
                  </view>
                  <view class="attraction-item-info">
                    <text class="attraction-item-name">{{ attr.name }}</text>
                    <text class="attraction-item-meta">
                      ¥{{ attr.ticket_price }} · {{ attr.visit_duration }}h
                    </text>
                  </view>
                </view>
              </view>

              <view v-if="day.meals.length" class="meal-list">
                <text class="sub-title">餐饮</text>
                <view
                  v-for="(meal, mIdx) in day.meals"
                  :key="mIdx"
                  class="meal-item"
                >
                  <text class="meal-type-tag">{{ getMealTypeTag(meal.type) }} {{ meal.type }}</text>
                  <text class="meal-name">{{ meal.name }}</text>
                  <text class="meal-cost">¥{{ meal.estimated_cost }}</text>
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>

      <view v-show="activeTab === 4" class="tab-panel">
        <view v-if="groupedNodes.length" class="knowledge-graph">
          <view
            v-for="(group, idx) in groupedNodes"
            :key="idx"
            class="graph-group"
          >
            <view class="graph-category">
              <text class="category-name">{{ group.category.name }}</text>
            </view>
            <view class="graph-nodes">
              <view
                v-for="(node, nIdx) in group.nodes"
                :key="nIdx"
                class="graph-node"
              >
                <view class="node-main">
                  <text class="node-name">{{ node.name }}</text>
                  <text v-if="node.value" class="node-value">{{ node.value }}</text>
                </view>
                <view v-if="node.connections.length" class="node-connections">
                  <view
                    v-for="(conn, cIdx) in node.connections"
                    :key="cIdx"
                    class="node-connection"
                  >
                    <text class="conn-label">{{ conn.label }}</text>
                    <text class="conn-arrow">→</text>
                    <text class="conn-target">{{ conn.targetName }}</text>
                  </view>
                </view>
              </view>
            </view>
          </view>
        </view>
        <view v-else class="empty-state">
          <text class="empty-text">暂无知识图谱数据</text>
        </view>
      </view>
    </view>

    <view class="chat-fab" @tap="openChat">
      <text class="chat-fab-icon">💬</text>
    </view>

    <view v-if="chatVisible" class="chat-overlay" @tap.self="closeChat">
      <view class="chat-panel">
        <view class="chat-header">
          <text class="chat-title">AI 旅行助手</text>
          <view class="chat-close" @tap="closeChat">
            <text class="close-icon">✕</text>
          </view>
        </view>
        <scroll-view scroll-y class="chat-messages">
          <view
            v-for="(msg, idx) in chatMessages"
            :key="idx"
            :class="['chat-message', msg.role === 'user' ? 'msg-user' : 'msg-assistant']"
          >
            <text class="msg-text">{{ msg.content }}</text>
          </view>
          <view v-if="chatSending" class="chat-message msg-assistant">
            <text class="msg-text typing">正在思考...</text>
          </view>
        </scroll-view>
        <view class="chat-input-bar">
          <input
            v-model="chatInput"
            class="chat-input"
            placeholder="输入问题..."
            placeholder-class="input-placeholder"
            confirm-type="send"
            @confirm="sendChat"
          />
          <view class="chat-send-btn" @tap="sendChat">
            <text class="send-text">发送</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>


.page {
  min-height: 100vh;
  background: $bg-dark;
  display: flex;
  flex-direction: column;
}

.tab-bar {
  white-space: nowrap;
  background: $bg-card;
  border-bottom: 2rpx solid $border-color;
  padding: 0 10rpx;
  height: 96rpx;
  line-height: 96rpx;
}

.tab-item {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  padding: 0 28rpx;
  position: relative;
  height: 96rpx;
  justify-content: center;
}

.tab-text {
  font-size: 28rpx;
  color: $text-secondary;
  transition: color 0.2s;
}

.tab-active .tab-text {
  color: $primary-color;
  font-weight: 700;
}

.tab-indicator {
  position: absolute;
  bottom: 0;
  width: 48rpx;
  height: 6rpx;
  border-radius: 3rpx;
  background: $primary-color;
}

.tab-content {
  flex: 1;
  overflow-y: auto;
}

.tab-panel {
  padding: 30rpx;
  padding-bottom: calc(30rpx + env(safe-area-inset-bottom));
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 120rpx 0;
}

.empty-text {
  font-size: 28rpx;
  color: $text-muted;
}

.overview-header {
  margin-bottom: 30rpx;
}

.overview-city {
  font-size: 40rpx;
  color: $text-primary;
  font-weight: 700;
  display: block;
}

.overview-date {
  font-size: 26rpx;
  color: $text-secondary;
  margin-top: 8rpx;
  display: block;
}

.overview-suggestions {
  background: $bg-card;
  border-radius: 20rpx;
  padding: 28rpx;
  margin-bottom: 30rpx;
}

.suggestions-label {
  font-size: 26rpx;
  color: $primary-color;
  font-weight: 600;
  margin-bottom: 12rpx;
  display: block;
}

.suggestions-text {
  font-size: 26rpx;
  color: $text-secondary;
  line-height: 1.6;
}

.section-title {
  font-size: 30rpx;
  color: $text-primary;
  font-weight: 700;
  margin-bottom: 20rpx;
  display: block;
}

.attractions-list {
  white-space: nowrap;
}

.attraction-card {
  display: inline-flex;
  flex-direction: column;
  width: 240rpx;
  margin-right: 20rpx;
  background: $bg-card;
  border-radius: 20rpx;
  overflow: hidden;
}

.attraction-img {
  width: 240rpx;
  height: 180rpx;
}

.attraction-img-placeholder {
  width: 240rpx;
  height: 180rpx;
  background: $bg-card-light;
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder-icon {
  font-size: 48rpx;
}

.attraction-name {
  font-size: 24rpx;
  color: $text-primary;
  padding: 12rpx 16rpx 4rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attraction-category {
  font-size: 20rpx;
  color: $text-muted;
  padding: 0 16rpx 14rpx;
}

.budget-total {
  background: $bg-card;
  border-radius: 24rpx;
  padding: 40rpx;
  text-align: center;
  margin-bottom: 30rpx;
}

.budget-total-label {
  font-size: 28rpx;
  color: $text-secondary;
  display: block;
  margin-bottom: 12rpx;
}

.budget-total-amount {
  font-size: 56rpx;
  color: $primary-color;
  font-weight: 700;
}

.budget-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
}

.budget-item {
  width: calc(50% - 10rpx);
  background: $bg-card;
  border-radius: 20rpx;
  padding: 28rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10rpx;
}

.budget-icon {
  font-size: 40rpx;
}

.budget-item-label {
  font-size: 24rpx;
  color: $text-secondary;
}

.budget-item-amount {
  font-size: 30rpx;
  color: $text-primary;
  font-weight: 700;
}

.weather-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.weather-card {
  background: $bg-card;
  border-radius: 20rpx;
  padding: 24rpx 28rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.weather-date {
  font-size: 26rpx;
  color: $text-primary;
  font-weight: 600;
}

.weather-icons {
  display: flex;
  gap: 40rpx;
}

.weather-icon-group {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.weather-emoji {
  font-size: 36rpx;
}

.weather-desc {
  font-size: 24rpx;
  color: $text-secondary;
}

.weather-temp {
  display: flex;
  align-items: baseline;
  gap: 4rpx;
}

.temp-day {
  font-size: 32rpx;
  color: $primary-color;
  font-weight: 700;
}

.temp-sep {
  font-size: 24rpx;
  color: $text-muted;
}

.temp-night {
  font-size: 28rpx;
  color: $text-secondary;
}

.weather-wind {
  font-size: 22rpx;
  color: $text-muted;
}

.itinerary {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.day-card {
  background: $bg-card;
  border-radius: 20rpx;
  overflow: hidden;
}

.day-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 30rpx;
}

.day-header-left {
  display: flex;
  align-items: baseline;
  gap: 16rpx;
}

.day-index {
  font-size: 30rpx;
  color: $primary-color;
  font-weight: 700;
}

.day-date {
  font-size: 24rpx;
  color: $text-secondary;
}

.day-arrow {
  font-size: 22rpx;
  color: $text-muted;
  transition: transform 0.3s;
}

.day-arrow-up {
  transform: rotate(180deg);
}

.day-body {
  padding: 0 30rpx 28rpx;
  border-top: 2rpx solid $border-color;
}

.day-description {
  font-size: 26rpx;
  color: $text-secondary;
  line-height: 1.6;
  padding: 20rpx 0;
  display: block;
}

.hotel-card {
  display: flex;
  align-items: center;
  gap: 16rpx;
  background: $bg-dark;
  border-radius: 16rpx;
  padding: 20rpx;
  margin-bottom: 20rpx;
}

.hotel-icon {
  font-size: 36rpx;
}

.hotel-info {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.hotel-name {
  font-size: 26rpx;
  color: $text-primary;
  font-weight: 600;
}

.hotel-meta {
  font-size: 22rpx;
  color: $text-secondary;
}

.sub-title {
  font-size: 26rpx;
  color: $text-primary;
  font-weight: 600;
  margin-bottom: 16rpx;
  display: block;
}

.attraction-list {
  margin-bottom: 20rpx;
}

.attraction-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 14rpx 0;
  border-bottom: 1rpx solid $border-color;

  &:last-child {
    border-bottom: none;
  }
}

.attraction-item-img {
  width: 80rpx;
  height: 80rpx;
  border-radius: 12rpx;
  flex-shrink: 0;
}

.attraction-item-img-placeholder {
  width: 80rpx;
  height: 80rpx;
  border-radius: 12rpx;
  background: $bg-card-light;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 32rpx;
}

.attraction-item-info {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  overflow: hidden;
}

.attraction-item-name {
  font-size: 26rpx;
  color: $text-primary;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attraction-item-meta {
  font-size: 22rpx;
  color: $text-muted;
}

.meal-list {
  margin-bottom: 10rpx;
}

.meal-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 14rpx 0;
  border-bottom: 1rpx solid $border-color;

  &:last-child {
    border-bottom: none;
  }
}

.meal-type-tag {
  font-size: 22rpx;
  color: $primary-color;
  background: rgba($primary-color, 0.12);
  padding: 4rpx 14rpx;
  border-radius: 8rpx;
  flex-shrink: 0;
}

.meal-name {
  font-size: 26rpx;
  color: $text-primary;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meal-cost {
  font-size: 24rpx;
  color: $text-secondary;
  flex-shrink: 0;
}

.knowledge-graph {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.graph-group {
  background: $bg-card;
  border-radius: 20rpx;
  overflow: hidden;
}

.graph-category {
  background: $bg-card-light;
  padding: 20rpx 28rpx;
}

.category-name {
  font-size: 28rpx;
  color: $primary-color;
  font-weight: 700;
}

.graph-nodes {
  padding: 10rpx 28rpx 20rpx;
}

.graph-node {
  padding: 16rpx 0;
  border-bottom: 1rpx solid $border-color;

  &:last-child {
    border-bottom: none;
  }
}

.node-main {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
  margin-bottom: 8rpx;
}

.node-name {
  font-size: 26rpx;
  color: $text-primary;
  font-weight: 600;
}

.node-value {
  font-size: 22rpx;
  color: $text-muted;
}

.node-connections {
  padding-left: 20rpx;
}

.node-connection {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 4rpx 0;
}

.conn-label {
  font-size: 22rpx;
  color: $primary-color;
}

.conn-arrow {
  font-size: 20rpx;
  color: $text-muted;
}

.conn-target {
  font-size: 22rpx;
  color: $text-secondary;
}

.chat-fab {
  position: fixed;
  right: 36rpx;
  bottom: calc(120rpx + env(safe-area-inset-bottom));
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, $primary-color, #c0392b);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 24rpx rgba($primary-color, 0.4);
  z-index: 100;
}

.chat-fab-icon {
  font-size: 44rpx;
}

.chat-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 200;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.chat-panel {
  width: 100%;
  max-height: 80vh;
  background: $bg-card;
  border-radius: 32rpx 32rpx 0 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 30rpx;
  border-bottom: 2rpx solid $border-color;
}

.chat-title {
  font-size: 30rpx;
  color: $text-primary;
  font-weight: 700;
}

.chat-close {
  padding: 10rpx;
}

.close-icon {
  font-size: 32rpx;
  color: $text-secondary;
}

.chat-messages {
  flex: 1;
  padding: 20rpx 30rpx;
  min-height: 400rpx;
  max-height: 60vh;
}

.chat-message {
  margin-bottom: 20rpx;
  display: flex;
}

.msg-user {
  justify-content: flex-end;
}

.msg-user .msg-text {
  background: $primary-color;
  color: $text-primary;
  border-radius: 20rpx 20rpx 4rpx 20rpx;
}

.msg-assistant {
  justify-content: flex-start;
}

.msg-assistant .msg-text {
  background: $bg-dark;
  color: $text-secondary;
  border-radius: 20rpx 20rpx 20rpx 4rpx;
}

.msg-text {
  font-size: 26rpx;
  padding: 16rpx 24rpx;
  max-width: 80%;
  line-height: 1.5;
}

.msg-text.typing {
  color: $text-muted;
  font-style: italic;
}

.chat-input-bar {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 30rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  border-top: 2rpx solid $border-color;
}

.chat-input {
  flex: 1;
  background: $bg-dark;
  border: 2rpx solid $border-color;
  border-radius: 36rpx;
  padding: 16rpx 28rpx;
  font-size: 26rpx;
  color: $text-primary;
}

.input-placeholder {
  color: $text-muted;
}

.chat-send-btn {
  background: $primary-color;
  border-radius: 36rpx;
  padding: 16rpx 28rpx;
  flex-shrink: 0;
}

.send-text {
  font-size: 26rpx;
  color: $text-primary;
  font-weight: 600;
}
</style>
