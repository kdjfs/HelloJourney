import { describe, expect, it } from 'vitest'
// Raw source imports keep this check inside the app's browser type space. Only
// committed configuration is inspected, never a real credential.
import indexHtml from '../../../index.html?raw'
import nginxConf from '../../../nginx.conf?raw'

/**
 * The AMap map only renders when two pieces of deployment wiring hold together,
 * and both fail silently rather than loudly:
 *
 *  1. AMap reads `window._AMapSecurityConfig` while its bundle executes and appends
 *     the value to every tile, style, and service request as `jscode`. Requests
 *     without it are rejected, which paints an empty canvas with no error. The SDK
 *     cannot be handed the code as a loader option, so the value has to be on
 *     `window` before `load()` injects the script.
 *  2. The deployment serves the app through nginx, whose CSP is strict enough to
 *     block an inline <script> and to block AMap's own data hosts and blob workers.
 *     Widening it back to webapi/restapi only renders no basemap.
 *
 * These invariants are pinned here because neither failure surfaces in the test
 * suite or in a code review of the map component alone.
 */
function policyDirective(name: string): string[] {
  const policy = nginxConf.match(/add_header Content-Security-Policy "([^"]+)"/)?.[1]
  if (!policy) throw new Error('nginx.conf declares no Content-Security-Policy')
  const directive = policy
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `))
  return directive ? directive.slice(name.length).trim().split(/\s+/).filter(Boolean) : []
}

/** Mirrors how a browser matches a URL against one CSP source expression. */
function allows(sources: string[], target: string): boolean {
  const url = new URL(target)
  return sources.some((source) => {
    if (source === '*') return true
    // Scheme-only source, e.g. `https:` or `blob:`.
    if (/^[a-z][a-z0-9+.-]*:$/i.test(source)) return source.toLowerCase() === url.protocol
    if (source === "'self'") return false

    const parsed = /^([a-z][a-z0-9+.-]*):\/\/(.*)$/i.exec(source)
    if (!parsed) return false
    const [, scheme, host] = parsed
    if (`${scheme.toLowerCase()}:` !== url.protocol) return false
    if (host === '*') return true
    if (host.startsWith('*.')) {
      const suffix = host.slice(1)
      return url.hostname.endsWith(suffix) && url.hostname.length > suffix.length
    }
    return host === url.host || host === url.hostname
  })
}

describe('AMap bootstrap contract', () => {
  it('keeps every script in index.html external, so a strict CSP cannot block it', () => {
    const inlineScripts = [...indexHtml.matchAll(/<script\b[^>]*>/g)]
      .map((match) => match[0])
      .filter((tag) => !/\bsrc\s*=/.test(tag))

    expect(inlineScripts).toEqual([])
    expect(indexHtml).not.toMatch(/_AMapSecurityConfig\s*=/)
  })
})

describe('AMap deployment CSP', () => {
  it('loads the SDK script from the AMap CDN', () => {
    expect(allows(policyDirective('script-src'), 'https://webapi.amap.com/maps?v=2.0')).toBe(true)
  })

  it('keeps inline scripts forbidden, which is why the code is set from the bundle', () => {
    expect(policyDirective('script-src')).not.toContain("'unsafe-inline'")
  })

  it('allows the WebAssembly module the renderer compiles', () => {
    expect(policyDirective('script-src')).toContain("'wasm-unsafe-eval'")
  })

  it('allows the AMap data hosts used for styles, vector tiles, and routes', () => {
    const connectSrc = policyDirective('connect-src')
    for (const host of [
      'https://webapi.amap.com/v4/map/styles',
      'https://restapi.amap.com/v3/direction/driving',
      'https://vdata.amap.com/',
      'https://mvt.amap.com/',
      'https://custyle.amap.com/',
      'https://wprd01.is.autonavi.com/appmaptile',
    ]) {
      expect(allows(connectSrc, host), `connect-src must allow ${host}`).toBe(true)
    }
  })

  it('allows raster tiles and glyph textures to load as images', () => {
    const imgSrc = policyDirective('img-src')
    expect(allows(imgSrc, 'https://webst01.is.autonavi.com/appmaptile')).toBe(true)
    expect(allows(imgSrc, 'https://sdf01.amap.com/')).toBe(true)
  })

  it('allows the glyph fonts AMap requests', () => {
    expect(allows(policyDirective('font-src'), 'https://glyph01.amap.com/')).toBe(true)
  })

  it('allows the blob worker the renderer spawns', () => {
    expect(policyDirective('worker-src')).toContain('blob:')
  })
})

/**
 * The Google basemap is opt-in (settings → basemap), but when a user picks it the
 * same CSP applies to the whole app. A policy that only knew about AMap would
 * block Google's loader chunk and every tile/route request, and the map would
 * fail exactly like a missing key — a confusing, silent deployment bug.
 */
describe('Google basemap deployment CSP', () => {
  it('loads the SDK loader and its versioned chunk as scripts', () => {
    const scriptSrc = policyDirective('script-src')
    expect(allows(scriptSrc, 'https://maps.googleapis.com/maps/api/js?key=x')).toBe(true)
    expect(allows(scriptSrc, 'https://maps.gstatic.com/maps-api-v3/api/js/56/1/main.js')).toBe(true)
  })

  it('allows directions, place details, and vector tile traffic', () => {
    const connectSrc = policyDirective('connect-src')
    expect(allows(connectSrc, 'https://maps.googleapis.com/maps/api/directions/json')).toBe(true)
    expect(allows(connectSrc, 'https://maps.googleapis.com/maps/vt')).toBe(true)
  })

  it('allows the label fonts served from gstatic', () => {
    expect(allows(policyDirective('font-src'), 'https://fonts.gstatic.com/s/roboto/v30/font.woff2')).toBe(true)
  })

  it('keeps raster tiles and marker sprites loadable as images', () => {
    const imgSrc = policyDirective('img-src')
    expect(allows(imgSrc, 'https://maps.googleapis.com/maps/vt/tile')).toBe(true)
    expect(allows(imgSrc, 'https://maps.gstatic.com/mapfiles/markers2/marker.png')).toBe(true)
  })
})
