import { describe, expect, it } from 'vitest'
import { buildGoogleMapsScriptUrl, googlePolylineOptions, toLatLng } from './googleRenderer'

describe('Google Maps SDK bootstrap', () => {
  it('requests the loader from googleapis with the marker library and the configured key', () => {
    const url = new URL(buildGoogleMapsScriptUrl('test-js-key'))

    expect(url.origin).toBe('https://maps.googleapis.com')
    expect(url.pathname).toBe('/maps/api/js')
    expect(url.searchParams.get('key')).toBe('test-js-key')
    expect(url.searchParams.get('v')).toBe('weekly')
    // AdvancedMarkerElement lives in `marker`; Map/InfoWindow/Polyline/Directions
    // are in the core bundle, so no other library may be requested.
    expect(url.searchParams.get('libraries')).toBe('marker')
  })

  it('does not pin a UI language, so basemap labels follow the browser', () => {
    expect(buildGoogleMapsScriptUrl('test-js-key')).not.toContain('language=')
  })
})

describe('Google coordinate conversion', () => {
  it('maps the shared [lng, lat] order onto Google lat/lng', () => {
    expect(toLatLng([116.397, 39.918])).toEqual({ lat: 39.918, lng: 116.397 })
  })
})

describe('Google polyline styling', () => {
  it('draws driving as a solid blue line', () => {
    expect(googlePolylineOptions('driving')).toMatchObject({
      strokeColor: '#2f7fd0',
      strokeOpacity: 0.95,
    })
  })

  it('draws walking and straight fallbacks as dashed lines', () => {
    for (const [mode, color] of [['walking', '#1f8a5f'], ['straight', '#c9752a']] as const) {
      const options = googlePolylineOptions(mode)
      // Google has no `strokeStyle: 'dashed'`: the base stroke goes fully
      // transparent and a repeated icon paints the ticks.
      expect(options.strokeOpacity).toBe(0)
      expect(options.strokeColor).toBe(color)
      expect(Array.isArray(options.icons)).toBe(true)
    }
  })

  it('treats an unknown mode as the straight fallback', () => {
    expect(googlePolylineOptions('transit' as never)).toMatchObject({ strokeColor: '#c9752a' })
  })
})
