import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button, Result } from 'antd'

interface Props {
  children: ReactNode
}

interface State {
  failed: boolean
}

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[APP] 页面渲染异常', { name: error.name, componentStack: info.componentStack })
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <Result
        status="error"
        title="页面暂时无法显示"
        subTitle="你的行程草稿仍保存在当前浏览器中，可以刷新页面后继续。"
        extra={<Button type="primary" onClick={() => window.location.reload()}>刷新页面</Button>}
      />
    )
  }
}
