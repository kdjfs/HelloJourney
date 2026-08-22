import { describe, expect, it } from 'vitest'
import { calculateCaptureScale } from './domCapture'

describe('DOM capture sizing', () => {
  it('caps long exports to the configured pixel budget', () => {
    expect(calculateCaptureScale(900, 20_000, 2, 36_000_000)).toBeCloseTo(Math.sqrt(2))
    expect(calculateCaptureScale(900, 1_000, 2, 36_000_000)).toBe(2)
  })
})
