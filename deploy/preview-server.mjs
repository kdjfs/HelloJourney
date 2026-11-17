#!/usr/bin/env node
/**
 * 生产产物的本地预览服务器（零依赖）。
 *
 * 它的行为和容器里的 nginx 一致：
 *   - 托管 frontend/dist
 *   - /api/* 反向代理到后端（默认 127.0.0.1:8001，可用 API_TARGET 覆盖）
 *   - 其余路径回退 index.html（SPA 路由）
 *
 * 用途：部署前在本地确认"静态产物 + 同源 /api"这套组合真的能用，
 * 和生产环境的差异只剩 TLS 与域名。
 *
 *   npm run build            # 先在 frontend 目录构建
 *   node deploy/preview-server.mjs
 *   # 打开 http://127.0.0.1:8080
 */
import http from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'

const PORT = Number(process.env.PORT || 8080)
const API_TARGET = new URL(process.env.API_TARGET || 'http://127.0.0.1:8001')
const ROOT = resolve(process.env.DIST_DIR || 'frontend/dist')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
}

if (!existsSync(ROOT)) {
  console.error(`[preview] 找不到 ${ROOT}，请先在 frontend 目录执行 npm run build`)
  process.exit(1)
}

function proxy(req, res) {
  const target = new URL(req.url, API_TARGET)
  const proxyReq = http.request(
    {
      hostname: target.hostname,
      port: target.port || 80,
      path: target.pathname + target.search,
      method: req.method,
      headers: { ...req.headers, host: target.host },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers)
      proxyRes.pipe(res)
    },
  )
  proxyReq.on('error', (error) => {
    res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ success: false, message: `后端不可达：${error.message}` }))
  })
  req.pipe(proxyReq)
}

http
  .createServer((req, res) => {
    const url = req.url || '/'
    if (url.startsWith('/api/')) {
      proxy(req, res)
      return
    }

    const requested = normalize(decodeURIComponent(url.split('?')[0])).replace(/^(\.\.[/\\])+/, '')
    const filePath = join(ROOT, requested)
    const target = existsSync(filePath) && statSync(filePath).isFile() ? filePath : join(ROOT, 'index.html')
    const ext = extname(target).toLowerCase()

    res.writeHead(200, {
      'content-type': MIME[ext] || 'application/octet-stream',
      // 带 hash 的资源可以长缓存，index.html 不缓存
      'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=604800',
    })
    createReadStream(target).pipe(res)
  })
  .listen(PORT, () => {
    console.log(`[preview] http://127.0.0.1:${PORT}  (dist=${ROOT}, /api -> ${API_TARGET.href})`)
  })
