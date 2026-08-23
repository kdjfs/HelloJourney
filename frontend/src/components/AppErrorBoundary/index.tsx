import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button, Result } from 'antd'
import { Translation } from 'react-i18next'

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
    console.error('[APP] Page render error', { name: error.name, componentStack: info.componentStack })
  }

  render() {
    if (!this.state.failed) return this.props.children
    return <Translation>{(t) => (
      <Result
        status="error"
        title={t('errorBoundary.title')}
        subTitle={t('errorBoundary.subtitle')}
        extra={<Button type="primary" onClick={() => window.location.reload()}>{t('errorBoundary.reload')}</Button>}
      />
    )}</Translation>
  }
}
