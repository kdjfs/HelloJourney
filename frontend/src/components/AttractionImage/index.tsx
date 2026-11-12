import { useState } from 'react'
import { Image } from 'antd'
import { useTranslation } from 'react-i18next'
import './index.css'

interface AttractionImageProps {
  attractionName: string
  city: string
  imageUrl?: string
  className?: string
}

/** 用名字与城市派生一个稳定的色相：同一景点每次都是同一张"插画" */
function hueFrom(seed: string): number {
  let hash = 0
  for (const char of seed) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 360
  }
  return hash
}

/**
 * 景点图片。
 *
 * 拿不到图时不再是空白方块：用本地内联 SVG 画一张与城市/景点名绑定的
 * 确定性插画（渐变天空 + 山峦 + 日照），零网络请求、约 1KB，也不会出现版权问题。
 */
function AttractionImage({ attractionName, city, imageUrl, className = '' }: AttractionImageProps) {
  const { t } = useTranslation()
  const [failedUrl, setFailedUrl] = useState('')

  if (imageUrl && imageUrl !== failedUrl) {
    return (
      <Image
        className={`attraction-image-root ${className}`.trim()}
        src={imageUrl}
        alt={attractionName}
        referrerPolicy="no-referrer"
        loading="lazy"
        decoding="async"
        onError={() => setFailedUrl(imageUrl)}
        preview={{
          cover: (
            <span className="attraction-image-mask">
              <span className="attraction-image-mask-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                  <path d="M11 8v6M8 11h6" />
                </svg>
              </span>
              {t('attractionImage.preview')}
            </span>
          ),
        }}
      />
    )
  }

  const hue = hueFrom(`${city}·${attractionName}`)
  const sky = `hsl(${hue} 42% 90%)`
  const skyDeep = `hsl(${(hue + 24) % 360} 38% 80%)`
  const hillBack = `hsl(${(hue + 12) % 360} 26% 72%)`
  const hillFront = `hsl(${(hue + 18) % 360} 30% 62%)`
  const sun = `hsl(${(hue + 46) % 360} 72% 82%)`

  return (
    <div
      className={`attraction-image-placeholder ${className}`.trim()}
      role="img"
      aria-label={t('attractionImage.unverifiedAria', { name: attractionName })}
    >
      <svg
        className="attraction-image-art"
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient id={`sky-${hue}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={sky} />
            <stop offset="100%" stopColor={skyDeep} />
          </linearGradient>
        </defs>
        <rect width="400" height="300" fill={`url(#sky-${hue})`} />
        <circle cx="300" cy="84" r="34" fill={sun} opacity="0.9" />
        <path d="M-20 214 C 70 168, 120 196, 178 178 C 236 160, 292 196, 420 168 L 420 300 L -20 300 Z" fill={hillBack} opacity="0.55" />
        <path d="M-20 246 C 60 214, 132 244, 196 226 C 262 208, 322 240, 420 222 L 420 300 L -20 300 Z" fill={hillFront} opacity="0.75" />
        <path d="M-20 274 C 88 254, 150 280, 232 268 C 312 256, 356 276, 420 268 L 420 300 L -20 300 Z" fill={hillFront} />
      </svg>

      <span className="attraction-image-placeholder__mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M12 21s7-6.2 7-12A7 7 0 1 0 5 9c0 5.8 7 12 7 12Z" />
          <circle cx="12" cy="9" r="2.4" />
        </svg>
      </span>
      <strong>{attractionName}</strong>
      <span className="attraction-image-caption">{t('attractionImage.pending', { city })}</span>
    </div>
  )
}

export default AttractionImage
