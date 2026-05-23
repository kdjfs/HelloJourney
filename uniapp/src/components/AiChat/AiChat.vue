<template>
  <view class="ai-chat">
    <view
      v-if="!expanded"
      class="chat-fab"
      @tap="expand"
    >
      <text class="fab-icon">💬</text>
    </view>

    <view
      v-else
      class="chat-panel"
      :class="{ 'panel-visible': panelVisible }"
    >
      <view class="panel-header">
        <text class="panel-title">AI 助手</text>
        <view class="panel-close" @tap="collapse">
          <text class="close-icon">✕</text>
        </view>
      </view>

      <scroll-view
        class="message-list"
        scroll-y
        :scroll-top="scrollTop"
        :scroll-with-animation="true"
      >
        <view
          v-for="(msg, idx) in messages"
          :key="idx"
          :class="['message-row', msg.role === 'user' ? 'message-row-user' : 'message-row-assistant']"
        >
          <view :class="['message-bubble', msg.role === 'user' ? 'bubble-user' : 'bubble-assistant']">
            <text class="message-text">{{ msg.content }}</text>
          </view>
        </view>
        <view v-if="loading" class="message-row message-row-assistant">
          <view class="message-bubble bubble-assistant">
            <view class="typing-indicator">
              <view class="typing-dot" />
              <view class="typing-dot" />
              <view class="typing-dot" />
            </view>
          </view>
        </view>
      </scroll-view>

      <view class="quick-actions">
        <view
          class="quick-btn"
          v-for="q in quickQuestions"
          :key="q"
          @tap="sendQuickQuestion(q)"
        >
          <text class="quick-btn-text">{{ q }}</text>
        </view>
      </view>

      <view class="input-bar">
        <input
          class="chat-input"
          v-model="inputText"
          placeholder="输入问题..."
          placeholder-class="input-placeholder"
          :disabled="loading"
          confirm-type="send"
          @confirm="sendMessage"
        />
        <view
          :class="['send-btn', (!inputText.trim() || loading) && 'send-btn-disabled']"
          @tap="sendMessage"
        >
          <text class="send-icon">➤</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { askTripChat } from '@/api/chat'
import type { TripPlan, ChatMessage } from '@/types/api'

const props = defineProps<{
  tripPlan: TripPlan
}>()

const expanded = ref(false)
const panelVisible = ref(false)
const messages = ref<ChatMessage[]>([])
const inputText = ref('')
const loading = ref(false)
const scrollTop = ref(0)

const quickQuestions = ['整体预算', '适合谁', '美食推荐']

function expand() {
  expanded.value = true
  nextTick(() => {
    setTimeout(() => {
      panelVisible.value = true
    }, 30)
  })
}

function collapse() {
  panelVisible.value = false
  setTimeout(() => {
    expanded.value = false
  }, 300)
}

function scrollToBottom() {
  nextTick(() => {
    scrollTop.value = scrollTop.value + 9999
  })
}

async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || loading.value) return

  messages.value.push({ role: 'user', content: text })
  inputText.value = ''
  scrollToBottom()

  await requestChat(text)
}

async function sendQuickQuestion(question: string) {
  if (loading.value) return

  messages.value.push({ role: 'user', content: question })
  scrollToBottom()

  await requestChat(question)
}

async function requestChat(message: string) {
  loading.value = true
  scrollToBottom()

  try {
    const res = await askTripChat({
      message,
      trip_plan: props.tripPlan as unknown as Record<string, any>,
      history: messages.value.slice(0, -1),
    })

    if (res.success) {
      messages.value.push({ role: 'assistant', content: res.reply })
    } else {
      messages.value.push({ role: 'assistant', content: res.message || '请求失败，请重试' })
    }
  } catch {
    messages.value.push({ role: 'assistant', content: '网络错误，请重试' })
  } finally {
    loading.value = false
    scrollToBottom()
  }
}
</script>

<style lang="scss" scoped>


.ai-chat {
  position: relative;
  z-index: 999;
}

.chat-fab {
  position: fixed;
  right: 32rpx;
  bottom: 120rpx;
  width: 112rpx;
  height: 112rpx;
  border-radius: 56rpx;
  background-color: $primary-color;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 32rpx rgba(233, 69, 96, 0.4);
  animation: pulse 2s ease-in-out infinite;
}

.fab-icon {
  font-size: 44rpx;
}

@keyframes pulse {
  0% {
    box-shadow: 0 8rpx 32rpx rgba(233, 69, 96, 0.4);
  }
  50% {
    box-shadow: 0 8rpx 48rpx rgba(233, 69, 96, 0.7);
  }
  100% {
    box-shadow: 0 8rpx 32rpx rgba(233, 69, 96, 0.4);
  }
}

.chat-panel {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: 60vh;
  background-color: $bg-card;
  border-radius: 32rpx 32rpx 0 0;
  display: flex;
  flex-direction: column;
  transform: translateY(100%);
  transition: transform 0.3s ease-out;
}

.panel-visible {
  transform: translateY(0);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx;
  border-bottom: 2rpx solid $border-color;
  flex-shrink: 0;
}

.panel-title {
  color: $text-primary;
  font-size: 32rpx;
  font-weight: 600;
}

.panel-close {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-icon {
  color: $text-muted;
  font-size: 32rpx;
}

.message-list {
  flex: 1;
  padding: 24rpx 32rpx;
  overflow-y: auto;
}

.message-row {
  display: flex;
  margin-bottom: 24rpx;
}

.message-row-user {
  justify-content: flex-end;
}

.message-row-assistant {
  justify-content: flex-start;
}

.message-bubble {
  max-width: 75%;
  padding: 20rpx 28rpx;
  border-radius: 24rpx;
}

.bubble-user {
  background-color: $primary-color;
  border-bottom-right-radius: 8rpx;
}

.bubble-assistant {
  background-color: $bg-card-light;
  border-bottom-left-radius: 8rpx;
}

.message-text {
  color: $text-primary;
  font-size: 28rpx;
  line-height: 1.6;
}

.typing-indicator {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 4rpx 0;
}

.typing-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 6rpx;
  background-color: $text-muted;
  animation: typingBounce 1.4s ease-in-out infinite;
}

.typing-dot:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typingBounce {
  0%, 60%, 100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  30% {
    transform: translateY(-12rpx);
    opacity: 1;
  }
}

.quick-actions {
  display: flex;
  gap: 16rpx;
  padding: 16rpx 32rpx;
  flex-shrink: 0;
}

.quick-btn {
  background-color: $bg-card-light;
  border: 2rpx solid $border-color;
  border-radius: 32rpx;
  padding: 12rpx 24rpx;
}

.quick-btn-text {
  color: $text-secondary;
  font-size: 24rpx;
}

.input-bar {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 32rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  border-top: 2rpx solid $border-color;
  flex-shrink: 0;
}

.chat-input {
  flex: 1;
  background-color: $bg-card-light;
  border: 2rpx solid $border-color;
  border-radius: 24rpx;
  color: $text-primary;
  font-size: 28rpx;
  padding: 16rpx 24rpx;
  height: 72rpx;
  box-sizing: border-box;
}

.input-placeholder {
  color: $text-muted;
}

.send-btn {
  width: 72rpx;
  height: 72rpx;
  border-radius: 36rpx;
  background-color: $primary-color;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.send-btn-disabled {
  opacity: 0.4;
}

.send-icon {
  color: $text-primary;
  font-size: 32rpx;
}
</style>
