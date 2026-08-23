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

const baseSectionStyle: Partial<CSSStyleDeclaration> = {
  background: '#ffffff',
  border: '1px solid #e6e9ed',
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
  section.append(createElement('h2', title, {
    color: '#153448',
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
    background: '#f3f5f7',
    boxSizing: 'border-box',
    color: '#243746',
    fontFamily: "Inter, 'PingFang SC', 'Microsoft YaHei', 'Segoe UI', sans-serif",
    lineHeight: '1.6',
    padding: '36px',
    width: '900px',
  })
  container.dataset.tripExport = 'image'

  const header = createElement('header', undefined, {
    background: 'linear-gradient(135deg, #0a2536 0%, #176b87 58%, #d76e42 100%)',
    borderRadius: '22px',
    color: '#ffffff',
    marginBottom: '20px',
    padding: '34px',
  })
  header.append(
    createElement('div', 'HELLOJOURNEY', {
      fontSize: '12px',
      fontWeight: '700',
      letterSpacing: '0.24em',
      opacity: '0.76',
    }),
    createElement('h1', t('export.title', { city: plan.city }), {
      fontSize: '34px',
      lineHeight: '1.25',
      margin: '10px 0 6px',
    }),
    createElement('p', t('export.subtitle', {
      start: plan.start_date,
      end: plan.end_date,
      count: plan.days.length,
    }), {
      fontSize: '15px',
      margin: '0',
      opacity: '0.9',
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
        background: index === items.length - 1 ? '#153448' : '#f4f7f9',
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
      borderTop: dayIndex === 0 ? '0' : '1px solid #e3e8ec',
      padding: dayIndex === 0 ? '0 0 20px' : '20px 0',
    })
    dayBlock.append(createElement('h3', t('export.dayTitle', { day: dayIndex + 1, date: day.date }), {
      color: '#176b87',
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
        background: '#eef7f9',
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
  const mapElement = options.mapElement === undefined
    ? document.querySelector<HTMLElement>('[data-trip-map-capture="true"]')
    : options.mapElement
  let mapDataUrl = ''
  let mapStatus: ExportMapStatus = mapElement ? 'capture-failed' : 'unavailable'

  if (mapElement) {
    try {
      const mapCanvas = await capture(mapElement, {
        backgroundColor: '#0a1520',
        maxPixelCount: 12_000_000,
        maxScale: 2,
        ignoreElements: (element) => element.classList.contains('amap-controls')
          || element.classList.contains('amap-logo')
          || element.classList.contains('amap-copyright'),
      })
      mapDataUrl = mapCanvas.toDataURL('image/png')
      mapStatus = 'included'
    } catch {
      mapStatus = 'capture-failed'
    }
  }

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
      backgroundColor: '#f3f5f7',
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
