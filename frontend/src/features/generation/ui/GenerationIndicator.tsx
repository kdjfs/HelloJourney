import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useGeneration } from '../model/generationContext'
import './index.css'

/**
 * 后台生成任务的全局指示器。
 *
 * 生成不再绑定在首页：切到设置页、结果页时这里依然显示进度，
 * 生成完成后一键回到结果页，中途可取消。
 */
export default function GenerationIndicator() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { snapshot, isRunning, cancel, dismiss, openResult } = useGeneration()

  // 首页自带完整的进度视图，不需要再叠一个浮层
  if (!snapshot || location.pathname === '/') return null

  const done = snapshot.status === 'completed'
  const failed = snapshot.status === 'failed' || snapshot.status === 'cancelled'
  const title = done ? t('generation.view') : failed ? t('landing.stageFailed') : t('generation.running')

  const handleMain = () => {
    if (done) {
      openResult()
      return
    }
    if (isRunning) navigate('/')
  }

  return (
    <div
      className={`generation-pill${done ? ' is-done' : failed ? ' is-failed' : ''}`}
      role="status"
      aria-live="polite"
    >
      <button type="button" className="generation-pill-main" onClick={handleMain} disabled={failed}>
        <span className="generation-pill-icon" aria-hidden="true">
          {isRunning ? <i className="generation-spin" /> : done ? '✓' : '!'}
        </span>
        <span className="generation-pill-text">
          <strong>{snapshot.city || title}</strong>
          <small>
            {isRunning
              ? `${snapshot.message || t('landing.waiting')} · ${Math.round(snapshot.progress)}%`
              : done
                ? t('generation.view')
                : snapshot.error || t('landing.generationFailed')}
          </small>
        </span>
        {isRunning && (
          <span className="generation-pill-bar" aria-hidden="true">
            <i style={{ width: `${Math.max(4, Math.min(100, snapshot.progress))}%` }} />
          </span>
        )}
      </button>
      <button
        type="button"
        className="generation-pill-close"
        aria-label={isRunning ? t('landing.cancel') : t('generation.dismiss')}
        title={isRunning ? t('landing.cancel') : t('generation.dismiss')}
        onClick={() => { if (isRunning) cancel(); else dismiss() }}
      >
        ✕
      </button>
    </div>
  )
}
