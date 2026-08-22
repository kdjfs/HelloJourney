import html2canvas, { type Options as Html2CanvasOptions } from 'html2canvas'

const DEFAULT_PIXEL_BUDGET = 36_000_000

export interface CaptureOptions extends Partial<Html2CanvasOptions> {
  maxScale?: number
  maxPixelCount?: number
}

export type CaptureElement = (element: HTMLElement, options?: CaptureOptions) => Promise<HTMLCanvasElement>
export type DownloadCanvas = (canvas: HTMLCanvasElement, filename: string) => Promise<void>

export function calculateCaptureScale(
  width: number,
  height: number,
  maxScale = 2,
  maxPixelCount = DEFAULT_PIXEL_BUDGET,
): number {
  if (width <= 0 || height <= 0) return 1
  const budgetScale = Math.sqrt(maxPixelCount / (width * height))
  return Math.max(1, Math.min(maxScale, budgetScale))
}

export const captureElement: CaptureElement = async (element, options = {}) => {
  const { maxScale = 2, maxPixelCount = DEFAULT_PIXEL_BUDGET, ...html2canvasOptions } = options
  const bounds = element.getBoundingClientRect()
  const width = Math.max(element.scrollWidth, bounds.width)
  const height = Math.max(element.scrollHeight, bounds.height)
  const scale = html2canvasOptions.scale
    ?? calculateCaptureScale(width, height, maxScale, maxPixelCount)

  return html2canvas(element, {
    backgroundColor: '#f3f5f7',
    logging: false,
    useCORS: true,
    scrollX: 0,
    scrollY: 0,
    ...html2canvasOptions,
    scale,
  })
}

export const downloadCanvasAsPng: DownloadCanvas = (canvas, filename) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (!blob) {
      reject(new Error('Canvas could not be encoded as PNG'))
      return
    }

    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.style.display = 'none'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    resolve()
  }, 'image/png')
})
