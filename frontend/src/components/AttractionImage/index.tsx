import { useState } from 'react'
import { Image } from 'antd'
import './index.css'

interface AttractionImageProps {
  attractionName: string
  city: string
  imageUrl?: string
  className?: string
}

function AttractionImage({ attractionName, city, imageUrl, className = '' }: AttractionImageProps) {
  const [failedUrl, setFailedUrl] = useState('')

  if (imageUrl && imageUrl !== failedUrl) {
    return (
      <Image
        className={`attraction-image-root ${className}`.trim()}
        src={imageUrl}
        alt={attractionName}
        referrerPolicy="no-referrer"
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
              点击预览
            </span>
          ),
        }}
      />
    )
  }

  return (
    <div
      className={`attraction-image-placeholder ${className}`.trim()}
      role="img"
      aria-label={`${attractionName}暂无已验证景点图片`}
    >
      <span className="attraction-image-placeholder__mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M12 21s7-6.2 7-12A7 7 0 1 0 5 9c0 5.8 7 12 7 12Z" />
          <circle cx="12" cy="9" r="2.4" />
        </svg>
      </span>
      <strong>{attractionName}</strong>
      <span>{city} · 等待图片补充</span>
    </div>
  )
}

export default AttractionImage
