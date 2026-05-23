<template>
  <view class="settings-page">
    <view class="settings-card">
      <view class="card-title">服务器配置</view>

      <view class="form-item">
        <text class="form-label">服务器地址</text>
        <view class="input-row">
          <input
            class="form-input"
            v-model="form.apiBaseUrl"
            placeholder="http://127.0.0.1:8000"
            placeholder-class="input-placeholder"
          />
          <view class="btn-save-inline" @tap="saveApiBaseUrl">
            <text class="btn-save-text">保存</text>
          </view>
        </view>
      </view>

      <view class="form-item">
        <text class="form-label">腾讯地图 Key</text>
        <input
          class="form-input"
          v-model="form.tencent_maps_key"
          placeholder="请输入腾讯地图 Key"
          placeholder-class="input-placeholder"
        />
      </view>

      <view class="form-item">
        <text class="form-label">Google Maps API Key</text>
        <input
          class="form-input"
          v-model="form.google_maps_api_key"
          placeholder="请输入 Google Maps API Key"
          placeholder-class="input-placeholder"
        />
      </view>

      <view class="form-item">
        <text class="form-label">小红书 Cookie</text>
        <textarea
          class="form-textarea"
          v-model="form.xhs_cookie"
          placeholder="请输入小红书 Cookie"
          placeholder-class="input-placeholder"
          :maxlength="-1"
          auto-height
        />
      </view>

      <view class="form-item">
        <text class="form-label">LLM 供应商</text>
        <picker
          :range="providerNames"
          :value="providerIndex"
          @change="onProviderChange"
        >
          <view class="picker-value">
            <text :class="['picker-text', !form.llm_active_provider && 'picker-placeholder']">
              {{ form.llm_active_provider || '请选择 LLM 供应商' }}
            </text>
            <text class="picker-arrow">▶</text>
          </view>
        </picker>
      </view>
    </view>

    <view class="btn-save-block" @tap="handleSave">
      <text class="btn-save-block-text">保存配置</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getSettings, updateSettings, getLlmProviders } from '@/api/settings'
import type { RuntimeSettings, LlmProviderInfo } from '@/types/api'

const form = ref({
  apiBaseUrl: '',
  tencent_maps_key: '',
  google_maps_api_key: '',
  xhs_cookie: '',
  llm_active_provider: '',
})

const providers = ref<LlmProviderInfo[]>([])

const providerNames = computed(() => providers.value.map((p) => p.name))

const providerIndex = computed(() => {
  const idx = providers.value.findIndex(
    (p) => p.key === form.value.llm_active_provider
  )
  return idx >= 0 ? idx : 0
})

function onProviderChange(e: { detail: { value: number } }) {
  const idx = e.detail.value
  if (providers.value[idx]) {
    form.value.llm_active_provider = providers.value[idx].key
  }
}

function saveApiBaseUrl() {
  const url = form.value.apiBaseUrl.trim()
  if (!url) {
    uni.showToast({ title: '请输入服务器地址', icon: 'none' })
    return
  }
  uni.setStorageSync('API_BASE_URL', url.replace(/\/+$/, ''))
  uni.showToast({ title: '服务器地址已保存', icon: 'success' })
}

async function loadSettings() {
  try {
    const data = await getSettings()
    form.value.tencent_maps_key = data.tencent_maps_key || ''
    form.value.google_maps_api_key = data.google_maps_api_key || ''
    form.value.xhs_cookie = data.xhs_cookie || ''
    form.value.llm_active_provider = data.llm_active_provider || ''
  } catch {
    uni.showToast({ title: '加载设置失败', icon: 'none' })
  }
}

async function loadProviders() {
  try {
    const data = await getLlmProviders()
    providers.value = data.providers || []
    if (!form.value.llm_active_provider && data.active_provider) {
      form.value.llm_active_provider = data.active_provider
    }
  } catch {
    // ignore
  }
}

async function handleSave() {
  try {
    await updateSettings({
      tencent_maps_key: form.value.tencent_maps_key,
      google_maps_api_key: form.value.google_maps_api_key,
      xhs_cookie: form.value.xhs_cookie,
      llm_active_provider: form.value.llm_active_provider,
    })
    uni.showToast({ title: '配置已保存', icon: 'success' })
  } catch {
    uni.showToast({ title: '保存失败', icon: 'none' })
  }
}

onMounted(() => {
  const stored = uni.getStorageSync('API_BASE_URL')
  form.value.apiBaseUrl = stored || 'http://127.0.0.1:8000'
  loadSettings()
  loadProviders()
})
</script>

<style lang="scss" scoped>


.settings-page {
  min-height: 100vh;
  background-color: $bg-dark;
  padding: 24rpx 32rpx;
}

.settings-card {
  background-color: $bg-card;
  border-radius: 24rpx;
  padding: 32rpx;
  margin-bottom: 40rpx;
}

.card-title {
  color: $text-primary;
  font-size: 34rpx;
  font-weight: 600;
  margin-bottom: 32rpx;
}

.form-item {
  margin-bottom: 32rpx;
}

.form-item:last-child {
  margin-bottom: 0;
}

.form-label {
  color: $text-secondary;
  font-size: 26rpx;
  margin-bottom: 12rpx;
  display: block;
}

.form-input {
  background-color: $bg-card-light;
  border: 2rpx solid $border-color;
  border-radius: 16rpx;
  color: $text-primary;
  font-size: 28rpx;
  padding: 20rpx 24rpx;
  width: 100%;
  box-sizing: border-box;
}

.form-textarea {
  background-color: $bg-card-light;
  border: 2rpx solid $border-color;
  border-radius: 16rpx;
  color: $text-primary;
  font-size: 28rpx;
  padding: 20rpx 24rpx;
  width: 100%;
  box-sizing: border-box;
  min-height: 160rpx;
}

.input-placeholder {
  color: $text-muted;
}

.input-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.input-row .form-input {
  flex: 1;
}

.btn-save-inline {
  background-color: $primary-color;
  border-radius: 16rpx;
  padding: 16rpx 28rpx;
  flex-shrink: 0;
}

.btn-save-text {
  color: $text-primary;
  font-size: 26rpx;
  font-weight: 500;
}

.picker-value {
  background-color: $bg-card-light;
  border: 2rpx solid $border-color;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.picker-text {
  color: $text-primary;
  font-size: 28rpx;
}

.picker-placeholder {
  color: $text-muted;
}

.picker-arrow {
  color: $text-muted;
  font-size: 22rpx;
  transform: rotate(90deg);
  display: inline-block;
}

.btn-save-block {
  background-color: $primary-color;
  border-radius: 24rpx;
  padding: 28rpx;
  text-align: center;
}

.btn-save-block-text {
  color: $text-primary;
  font-size: 32rpx;
  font-weight: 600;
}
</style>
