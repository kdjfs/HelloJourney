export function buildMarkerElement(label: string, attractionName: string): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'trip-map-marker'
  button.setAttribute('aria-label', `${label} ${attractionName}`)
  const core = document.createElement('span')
  core.className = 'trip-map-marker__core'
  core.setAttribute('aria-hidden', 'true')
  core.textContent = label
  button.append(core)
  return button
}

export function buildInfoWindowElement(
  dayNumber: number,
  attractionNumber: number,
  name: string,
  address: string,
  visitDuration: number,
): HTMLDivElement {
  const content = document.createElement('div')
  content.className = 'trip-map-info'
  const title = document.createElement('strong')
  title.textContent = name
  const sequence = document.createElement('span')
  sequence.textContent = `第 ${dayNumber} 天 · 第 ${attractionNumber} 个景点`
  const location = document.createElement('span')
  location.textContent = address || '地址待补充'
  const duration = document.createElement('span')
  duration.textContent = `建议游览 ${Number.isFinite(visitDuration) ? visitDuration : '—'} 分钟`
  content.append(title, sequence, location, duration)
  return content
}
