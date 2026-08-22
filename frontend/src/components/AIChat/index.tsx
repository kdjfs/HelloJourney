import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { apiClient } from '../../services/apiClient'
import { DeepSeekLogo } from '../DeepSeekLogo'
import type { TripPlan, ChatMessage, TripChatRequest, TripChatResponse } from '../../types/api'

interface AIChatProps {
  tripPlan: TripPlan | null
}

function AIChat({ tripPlan }: AIChatProps) {
  const { t } = useTranslation()
  const [chatOpen, setChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const chatMessagesRef = useRef<HTMLDivElement>(null)
  const quickQuestions = [
    { label: t('aiChat.budgetLabel'), question: t('aiChat.budgetQuestion') },
    { label: t('aiChat.audienceLabel'), question: t('aiChat.audienceQuestion') },
    { label: t('aiChat.foodLabel'), question: t('aiChat.foodQuestion') },
  ]

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (chatMessagesRef.current) {
        chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight
      }
    })
  }

  useEffect(() => {
    if (chatOpen) scrollToBottom()
  }, [chatOpen, chatHistory, chatLoading])

  const sendQuickQuestion = (q: string) => {
    setChatInput(q)
    setTimeout(() => {
      void sendChatMessage(q)
    }, 0)
  }

  const sendChatMessage = async (overrideText?: string) => {
    const text = (overrideText ?? chatInput).trim()
    if (!text || chatLoading || !tripPlan) return

    setChatHistory((prev) => [...prev, { role: 'user', content: text }])
    setChatInput('')
    setChatLoading(true)
    scrollToBottom()

    try {
      const res = await apiClient.post<TripChatResponse>('/api/chat/ask', {
        message: text,
        trip_plan: tripPlan,
        history: chatHistory,
      } satisfies TripChatRequest)

      if (res.data.success) {
        setChatHistory((prev) => [...prev, { role: 'assistant', content: res.data.reply }])
      } else {
        setChatHistory((prev) => [...prev, { role: 'assistant', content: t('aiChat.unavailable') }])
      }
    } catch (err) {
      console.error('AI Chat 请求失败：', err)
      setChatHistory((prev) => [...prev, { role: 'assistant', content: t('aiChat.networkFailed') }])
    } finally {
      setChatLoading(false)
      scrollToBottom()
    }
  }

  return (
    <div className="ai-chat-floating">
      {chatOpen && (
        <div className="chat-panel" role="dialog" aria-label={t('aiChat.title')}>
          <div className="chat-panel-header">
            <span className="chat-panel-brand">
              <i className="chat-panel-logo"><DeepSeekLogo size={22} /></i>
              {t('aiChat.title')}
            </span>
            <button type="button" className="chat-panel-close" onClick={() => setChatOpen(false)} aria-label={t('aiChat.close')}>
              ✕
            </button>
          </div>

          <div className="chat-panel-history" ref={chatMessagesRef}>
            {chatHistory.length === 0 && (
              <div className="chat-empty">
                <p>{t('aiChat.greeting')}</p>
                <div className="chat-suggestions">
                  {quickQuestions.map((q) => (
                    <button
                      key={q.label}
                      type="button"
                      className="chat-suggestion"
                      disabled={chatLoading || !tripPlan}
                      onClick={() => sendQuickQuestion(q.question)}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatHistory.map((msg, idx) => (
              <div key={`chat-${idx}`} className={`chat-msg ${msg.role}`}>
                {msg.content}
              </div>
            ))}

            {chatLoading && (
              <div className="chat-msg assistant typing">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </div>
            )}
          </div>

          <div className="chat-panel-input">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={!tripPlan ? t('aiChat.noPlan') : t('aiChat.inputPlaceholder')}
              disabled={chatLoading || !tripPlan}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void sendChatMessage()
                }
              }}
            />
            <button
              type="button"
              className="chat-send-btn"
              disabled={chatLoading || !chatInput.trim() || !tripPlan}
              onClick={() => {
                void sendChatMessage()
              }}
              aria-label={t('aiChat.send')}
            >
              <svg viewBox="0 0 512 512" width="16" height="16">
                <path d="M473 39.05a24 24 0 0 0-25.5-5.46L47.47 185h-.08a24 24 0 0 0 1 45.16l.41.13l137.3 58.63a16 16 0 0 0 15.54-3.59L422 80a7.07 7.07 0 0 1 10 10L226.66 310.26a16 16 0 0 0-3.59 15.54l58.65 137.38c.06.2.12.38.19.57c3.2 9.27 11.3 15.81 21.09 16.25h1a24.63 24.63 0 0 0 23-15.46L478.39 64.62A24 24 0 0 0 473 39.05" fill="currentColor" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        className="chat-fab"
        onClick={() => setChatOpen((open) => !open)}
        aria-label={chatOpen ? t('aiChat.closeAssistant') : t('aiChat.open')}
      >
        <DeepSeekLogo size={30} />
      </button>
    </div>
  )
}

export default AIChat
