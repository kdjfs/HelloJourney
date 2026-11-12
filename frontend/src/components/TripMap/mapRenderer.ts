import type { TripPlan } from '@/types/api'
import type { MapAttractionStop } from './mapGeometry'

/**
 * 两个地图渲染器共同遵守的契约。
 *
 * TripMap 只跟这个接口打交道：选点、清选中、通知尺寸变化、销毁。
 * 具体是 AMap 还是 Google，由 `createRenderer` 按用户偏好在运行时决定，
 * 页面其余部分（标题、图例、全屏、兜底提示）完全共用。
 */
export type MapRendererFailure = 'load-error' | 'security-code-missing' | 'cancelled'

export class MapRendererError extends Error {
  readonly reason: MapRendererFailure

  constructor(reason: MapRendererFailure, message?: string) {
    super(message ?? reason)
    this.name = 'MapRendererError'
    this.reason = reason
  }
}

export function isMapRendererError(error: unknown): error is MapRendererError {
  return error instanceof MapRendererError
}

export type MapTranslate = (key: string, options?: Record<string, unknown>) => string

export interface MapRendererContext {
  container: HTMLElement
  plan: TripPlan
  stops: MapAttractionStop[]
  translate: MapTranslate
  /** 组件已卸载或即将重建：每次 await 之后都要检查，避免给废弃的地图继续加载资源。 */
  isCancelled(): boolean
}

export interface MapRenderer {
  /**
   * 逐段补上驾车/步行路线，画不出来就退化成直线。
   *
   * 单独拆出来是因为两件事的耗时差一个数量级：标记是本地渲染，路网要联网查
   * （每段最多等 6 秒）。建图时只画标记，用户马上就能看能点；路线在后台补，
   * 补不齐也不该把整块地图判成加载失败。
   */
  drawRoutes(): Promise<void>
  /** 高亮某个景点标记，并把视野移过去、弹出信息窗。 */
  selectStop(stopKey: string): void
  /** 清掉上一处高亮。 */
  clearSelection(): void
  /** 容器尺寸变化（例如全屏切换）后重算画布；不需要的 SDK 可以不实现。 */
  resize?(): void
  destroy(): void
}
