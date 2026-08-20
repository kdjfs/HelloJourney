import { useState, useRef, useEffect } from 'react'
import { apiClient } from '../../services/apiClient'
import type { TripPlan, ChatMessage, TripChatRequest, TripChatResponse } from '../../types/api'

interface AIChatProps {
  tripPlan: TripPlan | null
}

/* DeepSeek 官方 Logo（simple-icons，CC0） */
export function DeepSeekLogo({ size = 30 }: { size?: number }) {
  return (
    <svg role="img" width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-label="DeepSeek">
      <path fill="currentColor" d="M23.748 4.651c-.254-.124-.364.113-.512.233-.051.04-.094.09-.137.137-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.155-.708-.311-.955-.65-.172-.24-.219-.509-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.094.172.187.129.323-.082.28-.18.553-.266.833-.055.179-.137.218-.328.14a5.5 5.5 0 0 1-1.737-1.179c-.857-.828-1.631-1.743-2.597-2.46a12 12 0 0 0-.689-.47c-.985-.957.13-1.743.387-1.836.27-.098.094-.433-.778-.428-.872.003-1.67.295-2.687.685a3 3 0 0 1-.465.136 9.6 9.6 0 0 0-2.883-.101c-1.885.21-3.39 1.1-4.497 2.622C.082 8.776-.231 10.854.152 13.02c.403 2.284 1.568 4.175 3.36 5.653 1.857 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.132-.284 4.994-1.86.47.234.962.328 1.78.398.629.058 1.235-.031 1.705-.129.735-.155.684-.836.418-.961-2.155-1.004-1.682-.595-2.112-.926 1.095-1.295 2.768-3.598 3.284-6.733.05-.346.115-.834.108-1.114-.004-.171.035-.238.23-.257a4.2 4.2 0 0 0 1.545-.475c1.397-.763 1.96-2.016 2.093-3.517.02-.23-.004-.467-.247-.588M11.58 18.168c-2.088-1.642-3.101-2.183-3.52-2.16-.39.024-.32.472-.234.763.09.288.207.487.371.74.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.168-1.361-.801-2.5-1.86-3.301-3.306-.775-1.393-1.225-2.888-1.299-4.482-.02-.385.094-.522.477-.592a4.7 4.7 0 0 1 1.53-.038c2.131.311 3.946 1.264 5.467 2.774.868.86 1.525 1.887 2.202 2.89.72 1.066 1.494 2.082 2.48 2.915.348.291.626.513.892.677-.802.09-2.14.109-3.055-.615zm1.001-6.44a.306.306 0 0 1 .415-.287.3.3 0 0 1 .113.074.3.3 0 0 1 .086.214c0 .17-.136.307-.308.307a.303.303 0 0 1-.306-.307m3.11 1.596c-.2.081-.4.151-.591.16a1.25 1.25 0 0 1-.798-.254c-.274-.23-.47-.358-.551-.758a1.7 1.7 0 0 1 .015-.588c.07-.327-.007-.537-.238-.727-.188-.156-.426-.199-.689-.199a.6.6 0 0 1-.254-.078.253.253 0 0 1-.114-.358 1 1 0 0 1 .192-.21c.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.392.451.462.576.685.915.176.264.336.536.446.848.066.194-.02.353-.25.45" />
    </svg>
  )
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
