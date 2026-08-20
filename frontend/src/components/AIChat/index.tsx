import { useState, useRef, useEffect } from 'react'
import { apiClient } from '../../services/apiClient'
import { DeepSeekLogo } from '../DeepSeekLogo'
import type { TripPlan, ChatMessage, TripChatRequest, TripChatResponse } from '../../types/api'

interface AIChatProps {
  tripPlan: TripPlan | null
}

const quickQuestions = [
  {
    label: '整体预算',
    question: '这个行程的整体预算大概是多少？',
  },
  {
    label: '适合谁',
    question: '这个行程适合带老人小孩吗？',
  },
  {
    label: '美食推荐',
    question: '行程中有哪些特色美食值得一试？',
  },
]

function AIChat({ tripPlan }: AIChatProps) {
  const [chatOpen, setChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const chatMessagesRef = useRef<HTMLDivElement>(null)

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
        setChatHistory((prev) => [...prev, { role: 'assistant', content: '抱歉，AI 暂时无法回答，请稍后再试。' }])
      }
    } catch (err) {
      console.error('AI Chat 请求失败：', err)
      setChatHistory((prev) => [...prev, { role: 'assistant', content: '网络请求失败，请检查网络连接。' }])
    } finally {
      setChatLoading(false)
      scrollToBottom()
    }
  }

  return (
    <div className="ai-chat-floating">
      {chatOpen && (
        <div className="chat-panel" role="dialog" aria-label="AI 旅行助手">
          <div className="chat-panel-header">
            <span className="chat-panel-brand">
              <i className="chat-panel-logo"><DeepSeekLogo size={22} /></i>
              AI 旅行助手
            </span>
            <button type="button" className="chat-panel-close" onClick={() => setChatOpen(false)} aria-label="关闭聊天">
              ✕
            </button>
          </div>

          <div className="chat-panel-history" ref={chatMessagesRef}>
            {chatHistory.length === 0 && (
              <div className="chat-empty">
                <p>你好！我是你的 AI 旅行助手，有什么问题随时问我~</p>
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
              placeholder={!tripPlan ? '没有旅行计划数据' : '输入你的问题...'}
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
              aria-label="发送"
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
        aria-label={chatOpen ? '关闭 AI 旅行助手' : '打开 AI 旅行助手'}
      >
        <DeepSeekLogo size={30} />
      </button>
    </div>
  )
}

export default AIChat
