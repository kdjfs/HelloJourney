<template>
  <view class="history-page">
    <view v-if="historyList.length > 0" class="history-list">
      <view
        class="history-card"
        v-for="item in historyList"
        :key="item.plan_id"
        @tap="goToResult(item.plan_id)"
        hover-class="history-card-hover"
      >
        <view class="card-header">
          <text class="city-name">{{ item.city }}</text>
          <text class="date-range">{{ item.start_date }} ~ {{ item.end_date }}</text>
        </view>
        <view class="card-suggestions">
          <text class="suggestions-text">{{ item.overall_suggestions }}</text>
        </view>
        <view class="card-footer">
          <text class="updated-time">{{ formatTime(item.updated_at) }}</text>
        </view>
      </view>
    </view>

    <view v-else class="empty-state">
      <text class="empty-icon">📋</text>
      <text class="empty-text">暂无历史记录</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { getTripHistory } from '@/api/trip'
import type { TripHistoryItem } from '@/types/api'

const historyList = ref<TripHistoryItem[]>([])

async function loadHistory() {
  try {
    const res = await getTripHistory(50)
    historyList.value = res.items || []
  } catch {
    uni.showToast({ title: '加载历史失败', icon: 'none' })
  }
}

function goToResult(planId: string) {
  uni.navigateTo({
    url: `/pages/result/result?plan_id=${planId}`,
  })
}

function formatTime(isoStr: string): string {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

onShow(() => {
  loadHistory()
})

onPullDownRefresh(async () => {
  await loadHistory()
  uni.stopPullDownRefresh()
})
</script>

<style lang="scss" scoped>


.history-page {
  min-height: 100vh;
  background-color: $bg-dark;
  padding: 24rpx 32rpx;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.history-card {
  background-color: $bg-card;
  border-radius: 24rpx;
  padding: 32rpx;
  transition: opacity 0.15s;
}

.history-card-hover {
  opacity: 0.7;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.city-name {
  color: $text-primary;
  font-size: 36rpx;
  font-weight: 700;
}

.date-range {
  color: $text-muted;
  font-size: 24rpx;
}

.card-suggestions {
  margin-bottom: 20rpx;
}

.suggestions-text {
  color: $text-secondary;
  font-size: 26rpx;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-footer {
  display: flex;
  justify-content: flex-end;
}

.updated-time {
  color: $text-muted;
  font-size: 22rpx;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 300rpx;
}

.empty-icon {
  font-size: 80rpx;
  margin-bottom: 24rpx;
}

.empty-text {
  color: $text-muted;
  font-size: 30rpx;
}
</style>
