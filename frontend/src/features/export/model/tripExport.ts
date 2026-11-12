import type { TripPlan } from '@/types/api'
import i18n from '@/i18n'
import type { CaptureElement, DownloadCanvas } from './domCapture'

export function serializeTripPlan(plan: TripPlan, planId?: string): string {
  return JSON.stringify({
    schema_version: 'hello-journey.trip-plan.v3',
    exported_at: new Date().toISOString(),
    plan_id: planId,
    plan,
  }, null, 2)
}

function safeCityName(city: string): string {
  return (city || 'trip')
    .replace(/[\\/:*?"<>|\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'trip'
}

export function tripExportFilename(plan: TripPlan): string {
  return `HelloJourney-${safeCityName(plan.city)}-${plan.start_date}.json`
}

export function tripImageExportFilename(plan: TripPlan): string {
  return `HelloJourney-${safeCityName(plan.city)}-${plan.start_date}.png`
}

type ExportMapStatus = 'included' | 'unavailable' | 'capture-failed'

export interface TripImageExportResult {
  filename: string
  includedMap: boolean
  mapStatus: ExportMapStatus
}

export interface TripImageExportOptions {
  mapElement?: HTMLElement | null
  mountTarget?: HTMLElement
  captureElement?: CaptureElement
  downloadCanvas?: DownloadCanvas
}

/**
 * 导出文档的作用域样式。
 *
 * 导出的容器是挂载在 document.body 里的真实 DOM，页面级元素选择器
 * （global.css 里的 h1/p/strong 规则）会覆盖容器上的继承色，导致浅色头图上的
 * 标题被刷成深色。这里用 .trip-export 前缀提高特异性，让导出文档自带完整样式，
 * 同时也让这份 HTML 可以直接搬进打印 iframe 独立渲染。
 */
const EXPORT_CSS = `
.trip-export, .trip-export * { box-sizing: border-box; }
.trip-export h1, .trip-export h2, .trip-export h3,
.trip-export p, .trip-export strong, .trip-export span, .trip-export div, .trip-export footer {
  font-family: "Inter", "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif;
  letter-spacing: normal;
  text-transform: none;
  margin: 0;
  padding: 0;
}
.trip-export h1 { font-size: 32px; font-weight: 700; line-height: 1.25; }
.trip-export h2 { font-size: 20px; font-weight: 700; line-height: 1.35; }
.trip-export h3 { font-size: 17px; font-weight: 700; line-height: 1.4; }
.trip-export p  { font-size: 14px; line-height: 1.65; }
`

function attachExportStyles(container: HTMLElement): void {
  const style = document.createElement('style')
  style.textContent = EXPORT_CSS
  container.prepend(style)
}

const baseSectionStyle: Partial<CSSStyleDeclaration> = {
  background: '#ffffff',
  border: '1px solid #e6e0d4',
  borderRadius: '18px',
  boxShadow: '0 8px 28px rgba(26, 39, 52, 0.08)',
  marginBottom: '20px',
  padding: '24px',
}

function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
  styles: Partial<CSSStyleDeclaration> = {},
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag)
  if (text !== undefined) element.textContent = text
  Object.assign(element.style, styles)
  return element
}

function createSection(title: string): HTMLDivElement {
  const section = createElement('div', undefined, baseSectionStyle)
  section.className = 'export-section'
  section.append(createElement('h2', title, {
    color: '#1b2a2f',
    fontSize: '22px',
    lineHeight: '1.35',
    margin: '0 0 18px',
  }))
  return section
}

function formatCurrency(value: number | undefined, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0)
}

export function buildTripExportContainer(plan: TripPlan, mapDataUrl = ''): HTMLDivElement {
  const locale = i18n.resolvedLanguage || i18n.language || 'zh'
  const t = i18n.t.bind(i18n)
  const container = createElement('div', undefined, {
    background: '#f6f3ec',
    boxSizing: 'border-box',
    color: '#243746',
    fontFamily: "Inter, 'PingFang SC', 'Microsoft YaHei', 'Segoe UI', sans-serif",
    lineHeight: '1.6',
    padding: '36px',
    width: '900px',
  })
  container.dataset.tripExport = 'image'
  container.className = 'trip-export'
  attachExportStyles(container)

  const header = createElement('header', undefined, {
    background: 'linear-gradient(135deg, #eef4f0 0%, #f8f2e7 56%, #fbeee6 100%)',
    border: '1px solid #e6e0d4',
    borderRadius: '22px',
    color: '#1b2a2f',
    marginBottom: '20px',
    padding: '32px 34px',
  })
  header.append(
    createElement('div', 'HELLOJOURNEY', {
      color: '#12695c',
      fontSize: '11px',
      fontWeight: '700',
      letterSpacing: '0.24em',
    }),
    createElement('h1', t('export.title', { city: plan.city }), {
      color: '#1b2a2f',
      fontSize: '32px',
      lineHeight: '1.25',
      margin: '10px 0 8px',
    }),
    createElement('p', t('export.subtitle', {
      start: plan.start_date,
      end: plan.end_date,
      count: plan.days.length,
    }), {
      color: '#5b6a63',
      fontSize: '14px',
      margin: '0',
    }),
  )
  container.append(header)

  if (plan.overall_suggestions) {
    const summary = createSection(t('export.summary'))
    summary.append(createElement('p', plan.overall_suggestions, {
      color: '#506574',
      fontSize: '15px',
      margin: '0',
      whiteSpace: 'pre-wrap',
    }))
    container.append(summary)
  }

  if (plan.budget) {
    const budget = createSection(t('export.budgetTitle'))
    const grid = createElement('div', undefined, {
      display: 'grid',
      gap: '12px',
      gridTemplateColumns: 'repeat(3, 1fr)',
    })
    const items = [
      [t('budgetPanel.attractions'), plan.budget.total_attractions],
      [t('budgetPanel.hotels'), plan.budget.total_hotels],
      [t('budgetPanel.meals'), plan.budget.total_meals],
      [t('budgetPanel.transportation'), plan.budget.total_transportation],
      [t('budgetPanel.interCity'), plan.budget.total_inter_city_transport],
      [t('export.total'), plan.budget.total],
    ] as const
    items.forEach(([label, value], index) => {
      const item = createElement('div', undefined, {
        background: index === items.length - 1 ? '#1b2a2f' : '#fbf9f5',
        borderRadius: '12px',
        color: index === items.length - 1 ? '#ffffff' : '#243746',
        padding: '14px',
      })
      item.append(
        createElement('span', label, { display: 'block', fontSize: '12px', opacity: '0.72' }),
        createElement('strong', formatCurrency(value, locale), { display: 'block', fontSize: '20px', marginTop: '3px' }),
      )
      grid.append(item)
    })
    budget.append(grid)
    container.append(budget)
  }

  if (mapDataUrl) {
    const mapSection = createSection(t('export.mapTitle'))
    const image = createElement('img', undefined, {
      borderRadius: '14px',
      display: 'block',
      height: 'auto',
      width: '100%',
    })
    image.alt = t('export.mapTitle')
    image.src = mapDataUrl
    mapSection.append(image)
    container.append(mapSection)
  }

  const daily = createSection(t('export.dailyTitle'))
  plan.days.forEach((day, dayIndex) => {
    const dayBlock = createElement('article', undefined, {
      borderTop: dayIndex === 0 ? '0' : '1px solid #e6e0d4',
      padding: dayIndex === 0 ? '0 0 20px' : '20px 0',
    })
    dayBlock.append(createElement('h3', t('export.dayTitle', { day: dayIndex + 1, date: day.date }), {
      color: '#12695c',
      fontSize: '18px',
      margin: '0 0 5px',
    }))
    if (day.description) {
      dayBlock.append(createElement('p', day.description, { color: '#5b6d79', margin: '0 0 12px' }))
    }
    dayBlock.append(createElement('p', `${day.transportation} · ${day.accommodation}`, {
      color: '#71828d',
      fontSize: '13px',
      margin: '0 0 12px',
    }))
    if (day.hotel) {
      dayBlock.append(createElement('p', t('export.hotel', {
        name: day.hotel.name,
        address: day.hotel.address,
      }), {
        background: '#e3f0ea',
        borderRadius: '10px',
        fontSize: '13px',
        margin: '0 0 12px',
        padding: '9px 12px',
      }))
    }

    const attractionGrid = createElement('div', undefined, {
      display: 'grid',
      gap: '10px',
      gridTemplateColumns: 'repeat(2, 1fr)',
    })
    if (day.attractions.length === 0) {
      attractionGrid.append(createElement('p', t('export.noAttractions'), {
        color: '#87959e',
        gridColumn: '1 / -1',
        margin: '0',
      }))
    }
    day.attractions.forEach((attraction, attractionIndex) => {
      const card = createElement('div', undefined, {
        background: '#fafbfc',
        border: '1px solid #e8ecef',
        borderRadius: '12px',
        padding: '13px',
      })
      const details = [
        attraction.address || t('common.addressPending'),
        t('export.duration', { count: attraction.visit_duration }),
      ]
      if (attraction.ticket_price !== undefined) {
        details.push(formatCurrency(attraction.ticket_price, locale))
      }
      card.append(
        createElement('strong', `${dayIndex + 1}-${attractionIndex + 1} ${attraction.name}`, {
          color: '#243746',
          display: 'block',
          fontSize: '15px',
        }),
        createElement('span', details.join(' · '), {
          color: '#70818c',
          display: 'block',
          fontSize: '12px',
          marginTop: '5px',
        }),
      )
      if (attraction.description) {
        card.append(createElement('p', attraction.description, {
          color: '#566a78',
          fontSize: '12px',
          margin: '7px 0 0',
        }))
      }
      attractionGrid.append(card)
    })
    dayBlock.append(attractionGrid)

    if (day.meals.length > 0) {
      dayBlock.append(createElement('p', t('export.meals', {
        items: day.meals.map((meal) => meal.name).join(' · '),
      }), {
        color: '#6b5c3c',
        fontSize: '13px',
        margin: '12px 0 0',
      }))
    }
    daily.append(dayBlock)
  })
  container.append(daily)

  container.append(createElement('footer', t('export.generatedBy'), {
    color: '#7c8b94',
    fontSize: '12px',
    letterSpacing: '0.08em',
    padding: '4px 0 0',
    textAlign: 'center',
  }))
  return container
}

function waitForImages(container: HTMLElement): Promise<void> {
  const pending = Array.from(container.querySelectorAll('img'))
    .filter((image) => !image.complete)
    .map((image) => new Promise<void>((resolve) => {
      image.addEventListener('load', () => resolve(), { once: true })
      image.addEventListener('error', () => resolve(), { once: true })
    }))
  return Promise.all(pending).then(() => undefined)
}

export async function exportTripAsImage(
  plan: TripPlan,
  options: TripImageExportOptions = {},
): Promise<TripImageExportResult> {
  let capture = options.captureElement
  let download = options.downloadCanvas
  if (!capture || !download) {
    const boundary = await import('./domCapture')
    capture ??= boundary.captureElement
    download ??= boundary.downloadCanvasAsPng
  }
  const mountTarget = options.mountTarget ?? document.body
  const { mapDataUrl, mapStatus } = await captureMapSnapshot(capture, options.mapElement)

  const container = buildTripExportContainer(plan, mapDataUrl)
  Object.assign(container.style, {
    left: '-10000px',
    pointerEvents: 'none',
    position: 'fixed',
    top: '0',
    zIndex: '-1',
  })
  mountTarget.appendChild(container)

  try {
    await waitForImages(container)
    const canvas = await capture(container, {
      backgroundColor: '#f6f3ec',
      maxPixelCount: 36_000_000,
      maxScale: 2,
    })
    const filename = tripImageExportFilename(plan)
    await download(canvas, filename)
    return { filename, includedMap: mapStatus === 'included', mapStatus }
  } finally {
    container.remove()
  }
}

/** 把地图 canvas 抓成 dataURL；失败不影响整份文档导出。 */
async function captureMapSnapshot(
  capture: CaptureElement,
  mapElementOption?: HTMLElement | null,
): Promise<{ mapDataUrl: string; mapStatus: ExportMapStatus }> {
  const mapElement = mapElementOption === undefined
    ? document.querySelector<HTMLElement>('[data-trip-map-capture="true"]')
    : mapElementOption
  if (!mapElement) return { mapDataUrl: '', mapStatus: 'unavailable' }

  try {
    const mapCanvas = await capture(mapElement, {
      backgroundColor: '#eef1ea',
      maxPixelCount: 12_000_000,
      maxScale: 2,
      ignoreElements: (element) => element.classList.contains('amap-controls')
        || element.classList.contains('amap-logo')
        || element.classList.contains('amap-copyright'),
    })
    return { mapDataUrl: mapCanvas.toDataURL('image/png'), mapStatus: 'included' }
  } catch {
    return { mapDataUrl: '', mapStatus: 'capture-failed' }
  }
}

/** 打印页样式：A4、去阴影、按"天"分页，关键块不被拦腰截断。 */
const PRINT_PAGE_CSS = `
@page { size: A4; margin: 10mm; }
html, body {
  margin: 0;
  padding: 0;
  background: #ffffff;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
body {
  font-family: "Inter", "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif;
  color: #1b2a2f;
}
.trip-export {
  width: 100% !important;
  padding: 0 !important;
  background: #ffffff !important;
}
.trip-export .export-section {
  box-shadow: none !important;
  border-color: #e6e0d4 !important;
  margin-bottom: 14px !important;
  padding: 18px 20px !important;
}
.trip-export header {
  break-inside: avoid;
  page-break-inside: avoid;
  margin-bottom: 14px !important;
}
.trip-export article {
  break-inside: avoid;
  page-break-inside: avoid;
}
.trip-export img {
  max-width: 100%;
  break-inside: avoid;
}
`

export interface TripPrintOptions {
  mapElement?: HTMLElement | null
  mountTarget?: HTMLElement
  captureElement?: CaptureElement
}/**
 * 打印 / 另存为 PDF。
 *
 * 直接用 window.print() 打印 SPA 会把固定顶栏、分区标签、离屏的概览副本
 * 一起打进纸面（这也是之前"又丑又乱码"的来源）。这里改为把导出文档写进一个
 * 隐藏 iframe，再打印这个独立文档：结构、分页、配色都可控。
 */
export async function printTripPlan(plan: TripPlan, options: TripPrintOptions = {}): Promise<void> {
  let capture = options.captureElement
  if (!capture) {
    const boundary = await import('./domCapture')
    capture = boundary.captureElement
  }
  const { mapDataUrl } = await captureMapSnapshot(capture, options.mapElement)

  const container = buildTripExportContainer(plan, mapDataUrl)
  Object.assign(container.style, {
    width: '760px',
    padding: '0',
    background: '#ffffff',
  })

  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.setAttribute('tabindex', '-1')
  Object.assign(iframe.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '0',
    height: '0',
    border: '0',
    opacity: '0',
    pointerEvents: 'none',
  })
  ;(options.mountTarget ?? document.body).appendChild(iframe)

  const doc = iframe.contentDocument
  if (!doc || !iframe.contentWindow) {
    iframe.remove()
    throw new Error('Print frame is unavailable in this browser')
  }

  const title = i18n.t('export.title', { city: plan.city }).replace(/[<>&]/g, '')
  doc.open()
  doc.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>`
    + `<style>${PRINT_PAGE_CSS}</style></head><body>${container.outerHTML}</body></html>`,
  )
  doc.close()

  await waitForImages(doc.body)
  // 等字体与图片解码落地，否则第一页容易出现空白或断字
  await new Promise((resolve) => window.setTimeout(resolve, 180))

  iframe.contentWindow.focus()
  iframe.contentWindow.print()
  // 打印对话框关闭前不能移除 iframe，给用户留足操作时间
  window.setTimeout(() => iframe.remove(), 60_000)
}

export type TripShareOutcome = 'shared' | 'downloaded' | 'cancelled'

function canShareFiles(): boolean {
  return typeof navigator !== 'undefined'
    && typeof navigator.share === 'function'
    && typeof navigator.canShare === 'function'
}

export interface TripImageArtifact {
  blob: Blob
  filename: string
  /** 调用方负责在合适时机 revoke */
  url: string
}

/** 只渲染长图、不下载：给「分享 / 预览保存」用。 */
export async function renderTripImage(
  plan: TripPlan,
  options: TripImageExportOptions = {},
): Promise<TripImageArtifact> {
  let artifact: TripImageArtifact | null = null
  await exportTripAsImage(plan, {
    ...options,
    downloadCanvas: async (canvas, filename) => {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('Canvas could not be encoded as PNG')
      artifact = { blob, filename, url: URL.createObjectURL(blob) }
    },
  })
  if (!artifact) throw new Error('Image rendering produced no output')
  return artifact
}

export type TripShareResult =
  | { outcome: 'shared' }
  | { outcome: 'cancelled' }
  /** 浏览器不支持文件分享（http、桌面、部分 iOS）：把图交给调用方做预览/保存 */
  | { outcome: 'preview'; artifact: TripImageArtifact }

/**
 * 一键分享到手机。
 *
 * 能用系统分享面板就直接分享（微信 / 相册 / 文件）；不能用就返回图片本身，
 * 由界面弹大图让用户长按保存 —— 而不是像之前那样静默下载或什么都不发生。
 */
export async function shareTripImage(
  plan: TripPlan,
  options: TripImageExportOptions = {},
): Promise<TripShareResult> {
  const artifact = await renderTripImage(plan, options)
  const file = new File([artifact.blob], artifact.filename, { type: 'image/png' })

  if (canShareFiles() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: artifact.filename })
      URL.revokeObjectURL(artifact.url)
      return { outcome: 'shared' }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        URL.revokeObjectURL(artifact.url)
        return { outcome: 'cancelled' }
      }
      // 手势丢失 / 权限被拒：退回到预览保存
    }
  }

  return { outcome: 'preview', artifact }
}
