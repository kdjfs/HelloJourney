<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { submitTripPlan, getTripHistory } from '@/api/trip'
import type { TripRequest, TripHistoryItem, TripTaskEvent, TripPlanResponse } from '@/types/api'
import { connectTripTaskWebSocket } from '@/utils/websocket'

const destination = ref('')
const startDate = ref('')
const endDate = ref('')
const transportation = ref('公共交通')
const accommodation = ref('舒适型')
const preferences = ref<string[]>([])
const freeText = ref('')

const transportOptions = ['公共交通', '自驾', '步行', '混合']
const accommodationOptions = ['经济型', '舒适型', '豪华型', '民宿']
const preferenceOptions = [
  { label: '历史文化', value: '历史' },
  { label: '自然风光', value: '自然' },
  { label: '美食', value: '美食' },
  { label: '购物', value: '购物' },
  { label: '艺术', value: '艺术' },
  { label: '休闲', value: '休闲' },
]

const travelDays = computed(() => {
  if (!startDate.value || !endDate.value) return 0
  const start = new Date(startDate.value)
  const end = new Date(endDate.value)
  const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  return diff > 0 ? diff : 0
})

const isGenerating = ref(false)
const progress = ref(0)
const currentStep = ref(0)
const stepMessage = ref('')
const steps = [
  { label: '搜索景点', icon: '🔍' },
  { label: '查询天气', icon: '🌤' },
  { label: '推荐酒店', icon: '🏨' },
  { label: '生成计划', icon: '📋' },
]

const historyList = ref<TripHistoryItem[]>([])
const historyLoading = ref(false)

let socketTask: UniApp.SocketTask | null = null

function onStartDateChange(e: any) {
  startDate.value = e.detail.value
}

function onEndDateChange(e: any) {
  endDate.value = e.detail.value
}

function onTransportChange(e: any) {
  transportation.value = e.detail.value
}

function onAccommodationChange(e: any) {
  accommodation.value = e.detail.value
}

function onPreferenceChange(e: any) {
  const value = e.detail.value
  if (preferences.value.includes(value)) {
    preferences.value = preferences.value.filter((v) => v !== value)
  } else {
    preferences.value.push(value)
  }
}

function mapProgressToStep(progressValue: number) {
  if (progressValue < 25) return 0
  if (progressValue < 50) return 1
  if (progressValue < 75) return 2
  return 3
}

async function handleGenerate() {
  if (!destination.value.trim()) {
    uni.showToast({ title: '请输入目的地', icon: 'none' })
    return
  }
  if (!startDate.value || !endDate.value) {
    uni.showToast({ title: '请选择日期', icon: 'none' })
    return
  }
  if (travelDays.value <= 0) {
    uni.showToast({ title: '日期范围无效', icon: 'none' })
    return
  }

  const tripData: TripRequest = {
    city: destination.value.trim(),
    cities: [{ city: destination.value.trim(), days: travelDays.value }],
    start_date: startDate.value,
    end_date: endDate.value,
    travel_days: travelDays.value,
    transportation: transportation.value,
    accommodation: accommodation.value,
    preferences: preferences.value,
    free_text_input: freeText.value,
    language: 'zh',
  }

  isGenerating.value = true
  progress.value = 0
  currentStep.value = 0
  stepMessage.value = '正在提交计划...'

  try {
    const result = await submitTripPlan(tripData)

    stepMessage.value = '已提交，等待处理...'

    socketTask = connectTripTaskWebSocket(
      result.task_id,
      (event: TripTaskEvent) => {
        progress.value = event.progress
        currentStep.value = mapProgressToStep(event.progress)
        stepMessage.value = event.message
      },
      (planResult: TripPlanResponse) => {
        isGenerating.value = false
        uni.setStorageSync('CURRENT_PLAN', JSON.stringify(planResult))
        uni.navigateTo({ url: `/pages/result/result?plan_id=${planResult.plan_id}` })
      },
      (error: string) => {
        isGenerating.value = false
        uni.showToast({ title: error, icon: 'none', duration: 3000 })
      }
    )
  } catch (e: any) {
    isGenerating.value = false
    uni.showToast({ title: e.message || '提交失败', icon: 'none' })
  }
}

async function loadHistory() {
  historyLoading.value = true
  try {
    const res = await getTripHistory(10)
    historyList.value = res.items || []
  } catch {
    historyList.value = []
  } finally {
    historyLoading.value = false
  }
}

function goToResult(planId: string) {
  uni.navigateTo({ url: `/pages/result/result?plan_id=${planId}` })
}

onMounted(() => {
  loadHistory()
})

onUnmounted(() => {
  if (socketTask) {
    socketTask.close({})
    socketTask = null
  }
})
</script>

<template>
  <view class="page">
    <view class="hero">
      <view class="hero-content">
        <text class="hero-title">HelloJourney</text>
        <text class="hero-subtitle">AI 智能旅行助手</text>
      </view>
    </view>

    <scroll-view scroll-y class="form-scroll">
      <view class="form-section">
        <view class="form-card">
          <view class="form-group">
            <text class="form-label">目的地</text>
            <input
              v-model="destination"
              class="form-input"
              placeholder="输入目的地城市"
              placeholder-class="input-placeholder"
            />
          </view>

          <view class="form-group">
            <text class="form-label">出发日期</text>
            <picker mode="date" :value="startDate" @change="onStartDateChange">
              <view class="form-picker">
                <text :class="['picker-text', startDate ? '' : 'picker-placeholder']">
                  {{ startDate || '选择出发日期' }}
                </text>
              </view>
            </picker>
          </view>

          <view class="form-group">
            <text class="form-label">返回日期</text>
            <picker mode="date" :value="endDate" @change="onEndDateChange">
              <view class="form-picker">
                <text :class="['picker-text', endDate ? '' : 'picker-placeholder']">
                  {{ endDate || '选择返回日期' }}
                </text>
              </view>
            </picker>
          </view>

          <view class="form-group">
            <text class="form-label">旅行天数</text>
            <view class="days-display">
              <text class="days-text">{{ travelDays > 0 ? `${travelDays} 天` : '请选择日期' }}</text>
            </view>
          </view>

          <view class="form-group">
            <text class="form-label">交通方式</text>
            <radio-group @change="onTransportChange">
              <view class="radio-row">
                <label v-for="opt in transportOptions" :key="opt" class="radio-item">
                  <radio :value="opt" :checked="transportation === opt" color="#e94560" />
                  <text class="radio-label">{{ opt }}</text>
                </label>
              </view>
            </radio-group>
          </view>

          <view class="form-group">
            <text class="form-label">住宿类型</text>
            <radio-group @change="onAccommodationChange">
              <view class="radio-row">
                <label v-for="opt in accommodationOptions" :key="opt" class="radio-item">
                  <radio :value="opt" :checked="accommodation === opt" color="#e94560" />
                  <text class="radio-label">{{ opt }}</text>
                </label>
              </view>
            </radio-group>
          </view>

          <view class="form-group">
            <text class="form-label">兴趣偏好</text>
            <view class="checkbox-grid">
              <label v-for="opt in preferenceOptions" :key="opt.value" class="checkbox-item">
                <checkbox
                  :value="opt.value"
                  :checked="preferences.includes(opt.value)"
                  color="#e94560"
                  @tap="onPreferenceChange({ detail: { value: opt.value } })"
                />
                <text class="checkbox-label">{{ opt.label }}</text>
              </label>
            </view>
          </view>

          <view class="form-group">
            <text class="form-label">补充说明</text>
            <textarea
              v-model="freeText"
              class="form-textarea"
              placeholder="输入额外需求或偏好..."
              placeholder-class="input-placeholder"
              :maxlength="500"
            />
          </view>
        </view>

        <button class="generate-btn" :disabled="isGenerating" @tap="handleGenerate">
          <text class="generate-btn-text">{{ isGenerating ? '生成中...' : '生成旅行计划' }}</text>
        </button>
      </view>

      <view v-if="isGenerating" class="progress-section">
        <view class="progress-card">
          <view class="steps-row">
            <view
              v-for="(step, idx) in steps"
              :key="idx"
              :class="['step-item', idx <= currentStep ? 'step-active' : '']"
            >
              <view :class="['step-dot', idx < currentStep ? 'step-done' : '', idx === currentStep ? 'step-current' : '']">
                <text class="step-icon">{{ idx < currentStep ? '✓' : step.icon }}</text>
              </view>
              <text class="step-label">{{ step.label }}</text>
            </view>
          </view>
          <view class="progress-bar-wrap">
            <view class="progress-bar" :style="{ width: progress + '%' }"></view>
          </view>
          <text class="progress-percent">{{ progress }}%</text>
          <text class="progress-message">{{ stepMessage }}</text>
        </view>
      </view>

      <view v-if="!isGenerating" class="history-section">
        <view class="history-header">
          <text class="history-title">最近计划</text>
          <view class="refresh-btn" @tap="loadHistory">
            <text class="refresh-icon">{{ historyLoading ? '⏳' : '🔄' }}</text>
          </view>
        </view>
        <view v-if="historyList.length === 0 && !historyLoading" class="history-empty">
          <text class="empty-text">暂无历史记录</text>
        </view>
        <view v-else class="history-list">
          <view
            v-for="item in historyList"
            :key="item.plan_id"
            class="history-item"
            @tap="goToResult(item.plan_id)"
          >
            <view class="history-item-main">
              <text class="history-city">{{ item.city }}</text>
              <text class="history-date">{{ item.start_date }} ~ {{ item.end_date }}</text>
            </view>
            <text class="history-arrow">›</text>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<style lang="scss" scoped>


.page {
  min-height: 100vh;
  background: $bg-dark;
  display: flex;
  flex-direction: column;
}

.hero {
  background: linear-gradient(135deg, $bg-dark 0%, $bg-card 100%);
  padding: 80rpx 40rpx 60rpx;
  text-align: center;
}

.hero-content {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.hero-title {
  font-size: 64rpx;
  font-weight: 700;
  color: $primary-color;
  letter-spacing: 4rpx;
}

.hero-subtitle {
  font-size: 28rpx;
  color: $text-secondary;
  margin-top: 12rpx;
}

.form-scroll {
  flex: 1;
  padding-bottom: env(safe-area-inset-bottom);
}

.form-section {
  padding: 30rpx;
}

.form-card {
  background: $bg-card;
  border-radius: 24rpx;
  padding: 40rpx 30rpx;
}

.form-group {
  margin-bottom: 36rpx;
}

.form-label {
  font-size: 28rpx;
  color: $text-primary;
  font-weight: 600;
  margin-bottom: 16rpx;
  display: block;
}

.form-input {
  background: $bg-dark;
  border: 2rpx solid $border-color;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  font-size: 28rpx;
  color: $text-primary;
}

.input-placeholder {
  color: $text-muted;
}

.form-picker {
  background: $bg-dark;
  border: 2rpx solid $border-color;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
}

.picker-text {
  font-size: 28rpx;
  color: $text-primary;
}

.picker-placeholder {
  color: $text-muted;
}

.days-display {
  background: $bg-dark;
  border: 2rpx solid $border-color;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
}

.days-text {
  font-size: 28rpx;
  color: $primary-color;
  font-weight: 600;
}

.radio-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.radio-item {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.radio-label {
  font-size: 26rpx;
  color: $text-secondary;
}

.checkbox-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.checkbox-label {
  font-size: 26rpx;
  color: $text-secondary;
}

.form-textarea {
  background: $bg-dark;
  border: 2rpx solid $border-color;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  font-size: 28rpx;
  color: $text-primary;
  width: 100%;
  height: 180rpx;
  box-sizing: border-box;
}

.generate-btn {
  margin-top: 40rpx;
  background: linear-gradient(135deg, $primary-color 0%, #c0392b 100%);
  border-radius: 48rpx;
  height: 96rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;

  &::after {
    border: none;
  }

  &[disabled] {
    opacity: 0.6;
  }
}

.generate-btn-text {
  font-size: 32rpx;
  color: $text-primary;
  font-weight: 700;
  letter-spacing: 2rpx;
}

.progress-section {
  padding: 0 30rpx 30rpx;
}

.progress-card {
  background: $bg-card;
  border-radius: 24rpx;
  padding: 40rpx 30rpx;
}

.steps-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 40rpx;
}

.step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  opacity: 0.4;
  transition: opacity 0.3s;
}

.step-active {
  opacity: 1;
}

.step-dot {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: $bg-dark;
  border: 3rpx solid $border-color;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
}

.step-done {
  background: $primary-color;
  border-color: $primary-color;
}

.step-current {
  border-color: $primary-color;
  box-shadow: 0 0 16rpx rgba($primary-color, 0.4);
}

.step-icon {
  font-size: 28rpx;
}

.step-label {
  font-size: 22rpx;
  color: $text-secondary;
}

.progress-bar-wrap {
  height: 12rpx;
  background: $bg-dark;
  border-radius: 6rpx;
  overflow: hidden;
  margin-bottom: 20rpx;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, $primary-color, #ff6b81);
  border-radius: 6rpx;
  transition: width 0.4s ease;
}

.progress-percent {
  font-size: 28rpx;
  color: $primary-color;
  font-weight: 700;
  display: block;
  text-align: center;
  margin-bottom: 12rpx;
}

.progress-message {
  font-size: 24rpx;
  color: $text-secondary;
  display: block;
  text-align: center;
}

.history-section {
  padding: 0 30rpx 60rpx;
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
}

.history-title {
  font-size: 32rpx;
  color: $text-primary;
  font-weight: 700;
}

.refresh-btn {
  padding: 10rpx 20rpx;
}

.refresh-icon {
  font-size: 32rpx;
}

.history-empty {
  background: $bg-card;
  border-radius: 24rpx;
  padding: 60rpx;
  text-align: center;
}

.empty-text {
  font-size: 28rpx;
  color: $text-muted;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.history-item {
  background: $bg-card;
  border-radius: 20rpx;
  padding: 28rpx 30rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: background 0.2s;

  &:active {
    background: $bg-card-light;
  }
}

.history-item-main {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.history-city {
  font-size: 30rpx;
  color: $text-primary;
  font-weight: 600;
}

.history-date {
  font-size: 24rpx;
  color: $text-secondary;
}

.history-arrow {
  font-size: 40rpx;
  color: $text-muted;
}
</style>
