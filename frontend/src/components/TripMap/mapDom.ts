export function buildMarkerElement(label: string, ariaLabel: string): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'trip-map-marker'
  button.setAttribute('aria-label', ariaLabel)
  const core = document.createElement('span')
  core.className = 'trip-map-marker__core'
  core.setAttribute('aria-hidden', 'true')
  core.textContent = label
  button.append(core)
  return button
}

export function buildInfoWindowElement(
  name: string,
  sequenceText: string,
  addressText: string,
  durationText: string,
): HTMLDivElement {
  const content = document.createElement('div')
  content.className = 'trip-map-info'
  const title = document.createElement('strong')
  title.textContent = name
  const sequence = document.createElement('span')
  sequence.textContent = sequenceText
  const location = document.createElement('span')
  location.textContent = addressText
  const duration = document.createElement('span')
  duration.textContent = durationText
  content.append(title, sequence, location, duration)
  return content
}
