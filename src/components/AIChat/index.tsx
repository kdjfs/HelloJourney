import { useState, useRef, useEffect } from 'react'
import { Button } from 'antd'
import { apiClient } from '../../services/apiClient'
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

  const openChatPanel = () => {
    if (!chatOpen) setChatOpen(true)
  }

  const closeChatPanel = () => {
    setChatOpen(false)
  }

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
        trip_plan: tripPlan as unknown as Record<string, unknown>,
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
      <div className="container-wrap" style={chatOpen ? { padding: 0 } : undefined}>
        <div className="card">
          {/* 装饰球 */}
          <div className="background-blur-balls" style={chatOpen ? { borderRadius: 24 } : undefined}>
            <div className="balls">
              <span className="ball rosa" />
              <span className="ball violet" />
              <span className="ball green" />
              <span className="ball cyan" />
            </div>
          </div>

          {/* 未打开状态：猫头鹰脸 */}
          <div className="content-card" style={{ cursor: chatOpen ? 'default' : 'pointer' }} onClick={openChatPanel}>
            <div className="background-blur-card">
              <div className="eyes" style={chatOpen ? { opacity: 0 } : undefined}>
                <span className="eye" />
                <span className="eye" />
              </div>
              <div className="eyes happy" style={chatOpen ? { opacity: 0 } : undefined}>
                <svg fill="none" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M8.28386 16.2843C8.9917 15.7665 9.8765 14.731 12 14.731C14.1235 14.731 15.0083 15.7665 15.7161 16.2843C17.8397 17.8376 18.7542 16.4845 18.9014 15.7665C19.4323 13.1777 17.6627 11.1066 17.3088 10.5888C16.3844 9.23666 14.1235 8 12 8C9.87648 8 7.61556 9.23666 6.69122 10.5888C6.33728 11.1066 4.56771 13.1777 5.09858 15.7665C5.24582 16.4845 6.16034 17.8376 8.28386 16.2843Z" />
                </svg>
                <svg fill="none" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M8.28386 16.2843C8.9917 15.7665 9.8765 14.731 12 14.731C14.1235 14.731 15.0083 15.7665 15.7161 16.2843C17.8397 17.8376 18.7542 16.4845 18.9014 15.7665C19.4323 13.1777 17.6627 11.1066 17.3088 10.5888C16.3844 9.23666 14.1235 8 12 8C9.87648 8 7.61556 9.23666 6.69122 10.5888C6.33728 11.1066 4.56771 13.1777 5.09858 15.7665C5.24582 16.4845 6.16034 17.8376 8.28386 16.2843Z" />
                </svg>
              </div>
            </div>
          </div>

          {/* 聊天面板 */}
          {chatOpen && (
            <div className="container-ai-chat" onClick={(e) => e.stopPropagation()}>
              <Button
                type="text"
                className="chat-close-btn"
                onClick={closeChatPanel}
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 12,
                  zIndex: 10,
                  fontSize: 20,
                  color: '#f5593d',
                }}
              >
                ✕
              </Button>

              <div className="chat">
                <div className="chat-bot">
                  <div className="chat-history" ref={chatMessagesRef}>
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

                  <div className="options">
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

                    <div className="btns-add">
                      <button type="button" disabled>
                        <svg viewBox="0 0 24 24" height="20" width="20" xmlns="http://www.w3.org/2000/svg">
                          <path d="M7 8v8a5 5 0 1 0 10 0V6.5a3.5 3.5 0 1 0-7 0V15a2 2 0 0 0 4 0V8" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" stroke="currentColor" fill="none" />
                        </svg>
                      </button>
                      <button type="button" disabled>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
                          <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zm0 10a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zm10 0a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1zm0-8h6m-3-3v6" />
                        </svg>
                      </button>
                      <button type="button" disabled>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
                          <path fill="currentColor" d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10s-4.477 10-10 10m-2.29-2.333A17.9 17.9 0 0 1 8.027 13H4.062a8.01 8.01 0 0 0 5.648 6.667M10.03 13c.151 2.439.848 4.73 1.97 6.752A15.9 15.9 0 0 0 13.97 13zm9.908 0h-3.965a17.9 17.9 0 0 1-1.683 6.667A8.01 8.01 0 0 0 19.938 13M4.062 11h3.965A17.9 17.9 0 0 1 9.71 4.333A8.01 8.01 0 0 0 4.062 11m5.969 0h3.938A15.9 15.9 0 0 0 12 4.248A15.9 15.9 0 0 0 10.03 11m4.259-6.667A17.9 17.9 0 0 1 15.973 11h3.965a8.01 8.01 0 0 0-5.648-6.667" />
                        </svg>
                      </button>
                    </div>
                    <button
                      type="button"
                      className="btn-submit"
                      disabled={chatLoading || !chatInput.trim() || !tripPlan}
                      onClick={() => {
                        void sendChatMessage()
                      }}
                    >
                      <i>
                        <svg viewBox="0 0 512 512">
                          <path d="M473 39.05a24 24 0 0 0-25.5-5.46L47.47 185h-.08a24 24 0 0 0 1 45.16l.41.13l137.3 58.63a16 16 0 0 0 15.54-3.59L422 80a7.07 7.07 0 0 1 10 10L226.66 310.26a16 16 0 0 0-3.59 15.54l58.65 137.38c.06.2.12.38.19.57c3.2 9.27 11.3 15.81 21.09 16.25h1a24.63 24.63 0 0 0 23-15.46L478.39 64.62A24 24 0 0 0 473 39.05" fill="currentColor" />
                        </svg>
                      </i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AIChat