import { describe, expect, it, vi } from 'vitest'
import type { TripPlan } from '@/types/api'
import { exportTripAsImage, serializeTripPlan, tripExportFilename, tripImageExportFilename } from './tripExport'

describe('trip export', () => {
  it('exports a versioned, portable JSON document', () => {
    const plan: TripPlan = {
      city: '北京',
      start_date: '2026-08-21',
      end_date: '2026-08-21',
      days: [],
      weather_info: [],
      overall_suggestions: '',
    }
    const exported = JSON.parse(serializeTripPlan(plan, 'plan-1'))

    expect(exported.schema_version).toBe('hello-journey.trip-plan.v3')
    expect(exported.plan_id).toBe('plan-1')
    expect(exported.plan.city).toBe(plan.city)
    expect(tripExportFilename(plan)).toContain('HelloJourney-')
  })

  it('creates a filesystem-safe deterministic PNG filename', () => {
    const plan: TripPlan = {
      city: '上海 / 苏州',
      start_date: '2026-09-03',
      end_date: '2026-09-05',
      days: [],
      weather_info: [],
      overall_suggestions: '',
    }

    expect(tripImageExportFilename(plan)).toBe('HelloJourney-上海-苏州-2026-09-03.png')
  })

  it('falls back to a map-free image and cleans the temporary container', async () => {
    const plan: TripPlan = {
      city: '北京',
      start_date: '2026-09-03',
      end_date: '2026-09-03',
      days: [],
      weather_info: [],
      overall_suggestions: '',
    }
    const mapElement = document.createElement('div')
    const exportedCanvas = document.createElement('canvas')
    const captureElement = vi.fn()
      .mockRejectedValueOnce(new Error('WebGL capture failed'))
      .mockResolvedValueOnce(exportedCanvas)
    const downloadCanvas = vi.fn().mockResolvedValue(undefined)
    const mountTarget = document.createElement('div')

    const result = await exportTripAsImage(plan, {
      mapElement,
      mountTarget,
      captureElement,
      downloadCanvas,
    })

    expect(result).toMatchObject({ includedMap: false, mapStatus: 'capture-failed' })
    expect(captureElement).toHaveBeenCalledTimes(2)
    expect(downloadCanvas).toHaveBeenCalledWith(exportedCanvas, 'HelloJourney-北京-2026-09-03.png')
    expect(mountTarget).toBeEmptyDOMElement()
  })
})
