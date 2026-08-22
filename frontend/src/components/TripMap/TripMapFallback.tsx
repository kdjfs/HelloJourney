import { EnvironmentOutlined, WarningOutlined } from '@ant-design/icons'

export type TripMapFallbackKind = 'missing-key' | 'missing-coordinate' | 'load-error'

const FALLBACK_CONTENT: Record<TripMapFallbackKind, { label: string; title: string; detail: string }> = {
  'missing-key': {
    label: '地图暂不可用',
    title: '尚未配置高德地图 Web JS Key',
    detail: '请在本地 .env 中配置 VITE_AMAP_WEB_JS_KEY，行程其余内容仍可正常使用。',
  },
  'missing-coordinate': {
    label: '地图暂无坐标',
    title: '行程中还没有可用的景点坐标',
    detail: '补充景点经纬度后，地图会自动生成标记与路线。',
  },
  'load-error': {
    label: '地图加载失败',
    title: '地图服务暂时无法加载',
    detail: '请检查网络、Key 的域名白名单与安全密钥配置，稍后刷新重试。',
  },
}

export default function TripMapFallback({ kind }: { kind: TripMapFallbackKind }) {
  const content = FALLBACK_CONTENT[kind]
  return (
    <div className="trip-map-fallback" role="status" aria-label={content.label}>
      <span className="trip-map-fallback__icon" aria-hidden="true">
        {kind === 'missing-coordinate' ? <EnvironmentOutlined /> : <WarningOutlined />}
      </span>
      <strong>{content.title}</strong>
      <span>{content.detail}</span>
    </div>
  )
}
