import { Select } from 'antd'
import { useTranslation } from 'react-i18next'
import { normalizeAppLocale, type AppLocale } from '@/i18n'

interface NavBarProps {
  onBrandClick?: () => void
  onCtaClick?: () => void
}

function NavBar({ onBrandClick, onCtaClick }: NavBarProps) {
  const { t, i18n } = useTranslation()
  const activeLocale = normalizeAppLocale(i18n.resolvedLanguage || i18n.language)

  return (
    <nav className="navbar navbar-toggleable-md fixed-top navbar-transparent landing-navbar">
      <div className="container">
        <div className="navbar-translate">
          <button
            className="navbar-toggler navbar-toggler-right navbar-burger landing-burger"
            type="button"
            aria-label={t('navbar.toggle')}
          >
            <span className="navbar-toggler-bar" />
            <span className="navbar-toggler-bar" />
            <span className="navbar-toggler-bar" />
          </button>
          <button className="navbar-brand landing-brand" type="button" onClick={onBrandClick}>
            HelloJourney
          </button>
        </div>
        <div className="navbar-collapse landing-navbar-collapse">
          <ul className="navbar-nav ml-auto landing-nav">
            <li className="nav-item">
              <a
                className="nav-link"
                rel="tooltip"
                title={t('navbar.github')}
                data-placement="bottom"
                href="https://github.com/kdjfs/HelloJourney"
                target="_blank"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <svg height="18" width="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                </svg>
              </a>
            </li>
            <li className="nav-item landing-locale-item">
              <Select<AppLocale>
                className="landing-locale-select"
                aria-label={t('navbar.language')}
                value={activeLocale}
                onChange={(locale) => void i18n.changeLanguage(locale)}
                options={[
                  { value: 'zh', label: '中文' },
                  { value: 'en', label: 'English' },
                  { value: 'ja', label: '日本語' },
                ]}
                popupMatchSelectWidth={false}
              />
            </li>
            <li className="nav-item">
              <button
                type="button"
                className="btn btn-danger btn-round landing-cta"
                onClick={onCtaClick}
              >
                {t('navbar.generate')}
              </button>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  )
}

export default NavBar
