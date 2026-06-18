// ─────────────────────────────────────────────────────────────────────────
//  Serveur de PRODUCTION du hub (déployable, ex. via Kamal/Docker).
//   1. sert le build statique (dist/) + fallback SPA (toutes les routes /<deck>/…),
//   2. POST /unlock (déverrouillage par mot de passe, rate-limité) + GET /whoami,
//   3. hub de synchro WS (/sync) multi-deck — le MÊME qu'en dev,
//   4. reverse-proxy optionnel /api → API_PROXY_TARGET (decks qui ont une API).
//  http natif + ws. Démarrage : PRESENTER_PASSWORD=… node server/index.js
// ─────────────────────────────────────────────────────────────────────────
import './env.js'
import http from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { attachHub } from './hub.js'
import { handleUnlock, isAdmin, reachableOrigin } from './auth.js'

const DIST = fileURLToPath(new URL('../dist', import.meta.url))
const PORT = Number(process.env.PORT || 3000)
const API_TARGET = process.env.API_PROXY_TARGET ? new URL(process.env.API_PROXY_TARGET) : null

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon', '.map': 'application/json',
}

async function sendFile(res, path, cache = false) {
  const body = await readFile(path)
  res.setHeader('content-type', MIME[extname(path)] || 'application/octet-stream')
  if (cache) res.setHeader('cache-control', 'public, max-age=31536000, immutable')
  res.end(body)
}

function proxyApi(req, res) {
  const opts = { hostname: API_TARGET.hostname, port: API_TARGET.port || 80, path: req.url, method: req.method, headers: { ...req.headers, host: API_TARGET.host } }
  const up = http.request(opts, (r) => { res.writeHead(r.statusCode || 502, r.headers); r.pipe(res) })
  up.on('error', () => { res.statusCode = 502; res.end('API indisponible') })
  req.pipe(up)
}

const json = (res, code, obj) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)) }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost')

  if (url.pathname === '/up') { res.statusCode = 200; return res.end('OK') }
  if (url.pathname === '/whoami') return json(res, 200, { admin: isAdmin(req), origin: reachableOrigin(req) })
  if (API_TARGET && url.pathname.startsWith('/api')) return proxyApi(req, res)
  if (url.pathname === '/unlock' && req.method === 'POST') return handleUnlock(req, res)
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.statusCode = 405; return res.end() }

  const rel = normalize(url.pathname).replace(/^(\.\.([/\\]|$))+/, '')
  const filePath = join(DIST, rel)
  if (filePath.startsWith(DIST)) {
    try {
      const s = await stat(filePath)
      if (s.isFile()) return await sendFile(res, filePath, rel.startsWith('assets/'))
    } catch { /* fallback SPA */ }
  }
  try { return await sendFile(res, join(DIST, 'index.html')) }
  catch { res.statusCode = 404; res.end('Build introuvable — lance `npm run build`.') }
})

attachHub(server)
server.listen(PORT, () => console.log(`Slide Hub (prod) sur le port ${PORT}${API_TARGET ? ` · /api → ${API_TARGET.host}` : ''}`))
