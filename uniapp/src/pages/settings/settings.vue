<template>
  <view class="settings-page">
    <view class="settings-card">
      <view class="card-title">连接设置</view>
      <view class="form-item">
        <text class="form-label">HelloJourney 服务地址</text>
        <view class="input-row">
          <input
            class="form-input"
            v-model="apiBaseUrl"
            type="url"
            aria-label="HelloJourney 服务地址"
            placeholder="https://travel-api.example.com"
            placeholder-class="input-placeholder"
          />
          <button class="btn-save-inline" @tap="saveApiBaseUrl">保存</button>
        </view>
        <text class="form-help">真机不能使用 127.0.0.1，请填写可访问的 HTTPS 测试或生产域名。</text>
      </view>
    </view>

    <view class="settings-card" aria-live="polite">
      <view class="card-title">服务状态</view>
      <view v-if="loading" class="state-message">正在读取服务配置…</view>
      <view v-else-if="loadError" class="state-message state-error">
        <text>{{ loadError }}</text>
        <button class="btn-retry" @tap="loadSettings">重试</button>
      </view>
      <template v-else>
        <view v-for="item in serviceStatuses" :key="item.label" class="status-row">
          <text class="status-label">{{ item.label }}</text>
          <text :class="['status-pill', item.configured ? 'is-ready' : 'is-missing']">
            {{ item.configured ? '已配置' : '未配置' }}
          </text>
        </view>
      </template>
    </view>

    <view class="settings-card">
      <view class="card-title">模型供应商</view>
      <view v-if="providers.length === 0" class="state-message">暂无可用供应商信息</view>
      <view v-for="provider in providers" :key="provider.key" class="provider-row">
        <view>
          <view class="provider-title-row">
            <text class="provider-name">{{ provider.name }}</text>
            <text v-if="provider.active" class="active-tag">当前</text>
          </view>
          <text class="provider-model">{{ provider.model || '未指定模型' }}</text>
        </view>
        <text :class="['status-pill', provider.configured ? 'is-ready' : 'is-missing']">
          {{ provider.configured ? '可用' : '需配置' }}
        </text>
      </view>
    </view>

    <view class="security-note">
      <text class="security-title">为什么不能在这里填写 API Key？</text>
      <text class="security-copy">
        模型、地图和内容服务凭证只由服务器环境变量管理，移动端只读取“是否已配置”，不会下载或保存服务器 Secret。
      </text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { getSettings } from '@/api/settings'
import type { LlmProviderInfo, RuntimeSettings } from '@/types/api'

const apiBaseUrl = ref('')
const settings = ref<RuntimeSettings | null>(null)
const loading = ref(false)
const loadError = ref('')

const providers = computed<LlmProviderInfo[]>(() => settings.value?.llm_providers || [])
const serviceStatuses = computed(() => [
  { label: '腾讯地图', configured: settings.value?.tencent_maps_configured ?? false },
  { label: 'Google Maps', configured: settings.value?.google_maps_configured ?? false },
  { label: '内容灵感服务', configured: settings.value?.xhs_configured ?? false },
])

function saveApiBaseUrl() {
  const value = apiBaseUrl.value.trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(value)) {
    uni.showToast({ title: '请输入 http:// 或 https:// 地址', icon: 'none' })
    return
  }
  uni.setStorageSync('API_BASE_URL', value)
  apiBaseUrl.value = value
  uni.showToast({ title: '服务地址已保存', icon: 'success' })
  loadSettings()
}

async function loadSettings() {
  loading.value = true
  loadError.value = ''
  try {
    settings.value = await getSettings()
  } catch {
    loadError.value = '无法读取服务器状态，请检查地址和网络。'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  const stored = uni.getStorageSync('API_BASE_URL')
  apiBaseUrl.value = stored || 'http://127.0.0.1:8000'
  loadSettings()
})
</script>

<style lang="scss" scoped>
.settings-page {
  min-height: 100vh;
  background-color: $bg-dark;
  padding: 24rpx 32rpx 56rpx;
}

.settings-card {
  background-color: $bg-card;
  border: 2rpx solid $border-color;
  border-radius: 24rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
}

.card-title {
  color: $text-primary;
  font-size: 34rpx;
  font-weight: 600;
  margin-bottom: 28rpx;
}

.form-label,
.status-label {
  color: $text-secondary;
  font-size: 26rpx;
}

.form-label {
  display: block;
  margin-bottom: 12rpx;
}

.input-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.form-input {
  flex: 1;
  min-width: 0;
  background-color: $bg-card-light;
  border: 2rpx solid $border-color;
  border-radius: 16rpx;
  color: $text-primary;
  font-size: 27rpx;
  padding: 20rpx 24rpx;
  box-sizing: border-box;
}

.input-placeholder {
  color: $text-muted;
}

.btn-save-inline,
.btn-retry {
  border: 0;
  color: $text-primary;
  font-size: 26rpx;
  line-height: 1;
}

.btn-save-inline {
  margin: 0;
  background-color: $primary-color;
  border-radius: 16rpx;
  padding: 25rpx 28rpx;
}

.form-help {
  display: block;
  color: $text-muted;
  font-size: 23rpx;
  line-height: 1.6;
  margin-top: 14rpx;
}

.status-row,
.provider-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
  padding: 22rpx 0;
  border-bottom: 2rpx solid $border-color;
}

.status-row:last-child,
.provider-row:last-child {
  border-bottom: 0;
}

.status-pill,
.active-tag {
  border-radius: 999rpx;
  font-size: 22rpx;
  padding: 8rpx 16rpx;
}

.is-ready {
  color: #8ee6bd;
  background: rgba(48, 190, 128, 0.14);
}

.is-missing {
  color: #e7b878;
  background: rgba(210, 148, 64, 0.14);
}

.provider-title-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.provider-name {
  color: $text-primary;
  font-size: 28rpx;
  font-weight: 500;
}

.provider-model {
  display: block;
  color: $text-muted;
  font-size: 23rpx;
  margin-top: 8rpx;
}

.active-tag {
  color: $primary-color;
  background: rgba(64, 158, 255, 0.14);
}

.state-message {
  color: $text-muted;
  font-size: 26rpx;
  line-height: 1.6;
}

.state-error {
  color: #efb0a8;
}

.btn-retry {
  display: inline-block;
  margin: 18rpx 0 0;
  background: $bg-card-light;
  border: 2rpx solid $border-color;
  border-radius: 14rpx;
  padding: 18rpx 24rpx;
}

.security-note {
  padding: 24rpx 8rpx;
}

.security-title,
.security-copy {
  display: block;
}

.security-title {
  color: $text-secondary;
  font-size: 25rpx;
  font-weight: 600;
  margin-bottom: 10rpx;
}

.security-copy {
  color: $text-muted;
  font-size: 23rpx;
  line-height: 1.7;
}
</style>
