import { Select } from 'antd'
import { GithubOutlined, MoonOutlined, SettingOutlined, SunOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { normalizeAppLocale, type AppLocale } from '@/i18n'
import { useAppTheme } from '@/theme/model/theme'
import './index.css'

interface NavBarProps {
  onBrandClick?: () => void
  onCtaClick?: () => void
  /** 悬浮在头图上时为 true：无底色、文字反白；滚动后切回实心白底。 */
  transparent?: boolean
}

function NavBar({ onBrandClick, onCtaClick, transparent = false }: NavBarProps) {
  const { t, i18n } = useTranslation()
  const activeLocale = normalizeAppLocale(i18n.resolvedLanguage || i18n.language)
  const [appTheme, toggleTheme] = useAppTheme()
  const dark = appTheme === 'dark'

  return (
    <nav className={`site-nav${transparent ? ' site-nav--transparent' : ''}`} aria-label={t('navbar.toggle')}>
      <div className="site-nav-inner">
        <button className="site-brand" type="button" onClick={onBrandClick}>
          <span className="site-brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" />
              <circle cx="12" cy="9" r="2.4" />
            </svg>
          </span>
          <span className="site-brand-text">HelloJourney</span>
        </button>

        <div className="site-nav-actions">
          <a
            className="site-nav-icon"
            rel="noopener noreferrer"
            title={t('navbar.github')}
            aria-label={t('navbar.github')}
            href="https://github.com/kdjfs/HelloJourney"
            target="_blank"
          >
            <GithubOutlined />
          </a>

          <Link className="site-nav-link" to="/settings">
            <SettingOutlined aria-hidden="true" />
            <span className="site-nav-link-text">{t('navbar.settings')}</span>
          </Link>

          <button
            type="button"
            className="site-nav-icon site-nav-theme"
            onClick={toggleTheme}
            aria-label={dark ? t('navbar.switchToLight') : t('navbar.switchToDark')}
            title={dark ? t('navbar.switchToLight') : t('navbar.switchToDark')}
            aria-pressed={dark}
          >
            {dark ? <SunOutlined /> : <MoonOutlined />}
          </button>

          <Select<AppLocale>
            className="site-nav-locale"
            aria-label={t('navbar.language')}
            value={activeLocale}
            onChange={(locale) => void i18n.changeLanguage(locale)}
            variant="borderless"
            options={[
              { value: 'zh', label: '中文' },
              { value: 'en', label: 'English' },
              { value: 'ja', label: '日本語' },
            ]}
            popupMatchSelectWidth={false}
          />

          <button type="button" className="btn btn-round site-nav-cta" onClick={onCtaClick}>
            {t('navbar.generate')}
          </button>
        </div>
      </div>
    </nav>
  )
}

export default NavBar
