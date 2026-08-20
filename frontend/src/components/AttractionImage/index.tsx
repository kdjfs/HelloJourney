import { useState } from 'react'
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
      <img
        className={className}
        src={imageUrl}
        alt={attractionName}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailedUrl(imageUrl)}
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
