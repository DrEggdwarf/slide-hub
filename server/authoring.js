// ─────────────────────────────────────────────────────────────────────────
//  API d'authoring (DEV uniquement, gated admin).
//  CRUD decks (créer/dupliquer/renommer/supprimer) + réglages (visibilité,
//  orateurs+couleurs, durée/orateur par slide). Écrit dans decks/ ; le client
//  recharge après mutation (Vite re-globbe). NON exposée en prod (read-only).
// ─────────────────────────────────────────────────────────────────────────
import { fileURLToPath } from 'node:url'
import { mkdir, writeFile, readFile, rename, cp, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { exec as execCb } from 'node:child_process'
import { promisify } from 'node:util'
import { isAdmin, setTunnelUrl, getTunnelUrl } from './auth.js'

const exec = promisify(execCb)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const TUNNEL_CONTAINER = 'slide-hub-tunnel'

const DECKS = fileURLToPath(new URL('../decks', import.meta.url))
const TRASH = join(DECKS, '.trash')
const README_TPL = fileURLToPath(new URL('./templates/deck-README.md', import.meta.url))
const okName = (n) => typeof n === 'string' && /^[a-z0-9-]{1,40}$/.test(n)

const deckConfigTpl = (name) => `import type { DeckConfig } from '@engine/decks'

const config: DeckConfig = {
  brand: '${name}',
  title: '${name}',
  visibility: 'private', // 'public' = visible par tous
  speakers: { moi: '#1d4ed8' },
  // Couleurs du projet (utilisables dans les slides via deckColor('primary')) :
  colors: { primary: '#6366f1', highlight: '#059669' },
}
export default config
`
const slideTpl = (name) => `import type { SlideContext, SlideMeta } from '@engine/types'

export const meta: SlideMeta = { speaker: ['moi'], duration: 60 }

export function Component(_: SlideContext) {
  return (
    <h1 style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.1 }}>
      ${name}
      <span style={{ display: 'block', fontSize: 18, fontWeight: 400, opacity: 0.6, marginTop: 16 }}>
        Édite decks/${name}/slides/ — une slide = un fichier .tsx
      </span>
    </h1>
  )
}
`

const send = (res, code, obj) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)) }
const readJson = (req) => new Promise((r) => { let d = ''; req.on('data', (c) => { d += c; if (d.length > 16384) req.destroy() }); req.on('end', () => { try { r(JSON.parse(d || '{}')) } catch { r({}) } }); req.on('error', () => r({})) })
const exists = async (p) => { try { await stat(p); return true } catch { return false } }

// ── Parsers / écritures (regex sur le format des templates) ──────────────
const strList = (inner) => [...inner.matchAll(/'([^']*)'/g)].map((m) => m[1])

function parseConfig(src) {
  const vis = src.match(/visibility:\s*'(public|private)'/)?.[1] ?? 'private'
  const title = src.match(/title:\s*'([^']*)'/)?.[1]
  const brand = src.match(/brand:\s*'([^']*)'/)?.[1]
  const order = src.match(/order:\s*\[([^\]]*)\]/) ? strList(src.match(/order:\s*\[([^\]]*)\]/)[1]) : null
  const speakers = {}
  const sp = src.match(/speakers:\s*\{([^}]*)\}/)?.[1] ?? ''
  for (const m of sp.matchAll(/([A-Za-z0-9_]+):\s*'([^']*)'/g)) speakers[m[1]] = m[2]
  return { visibility: vis, title, brand, speakers, order }
}
function parseSlide(src, id) {
  const duration = Number(src.match(/duration:\s*(\d+)/)?.[1] ?? 0) || undefined
  const steps = Number(src.match(/steps:\s*(\d+)/)?.[1] ?? 0) || undefined
  const title = src.match(/title:\s*'([^']*)'/)?.[1]
  const spm = src.match(/speaker:\s*\[([^\]]*)\]/)
  const speaker = spm ? strList(spm[1]) : []
  return { id, duration, steps, title, speaker }
}
function setField(src, key, value) {
  const re = new RegExp(`(${key}:\\s*)'[^']*'`)
  return re.test(src) ? src.replace(re, `$1'${value}'`) : src.replace(/(const config: DeckConfig = \{\s*)/, `$1\n  ${key}: '${value}',`)
}
function setSpeakers(src, speakers) {
  const inner = Object.entries(speakers).map(([n, c]) => `${n}: '${c}'`).join(', ')
  return src.replace(/speakers:\s*\{[^}]*\}/, `speakers: { ${inner} }`)
}
function setSlideMeta(src, { duration, speaker }) {
  let out = src
  if (duration !== undefined) {
    out = /duration:\s*\d+/.test(out) ? out.replace(/duration:\s*\d+/, `duration: ${duration}`)
      : out.replace(/(meta(?::\s*SlideMeta)?\s*=\s*\{)/, `$1 duration: ${duration},`)
  }
  if (speaker !== undefined) {
    const arr = `[${speaker.map((s) => `'${s}'`).join(', ')}]`
    out = /speaker:\s*\[[^\]]*\]/.test(out) ? out.replace(/speaker:\s*\[[^\]]*\]/, `speaker: ${arr}`)
      : out.replace(/(meta(?::\s*SlideMeta)?\s*=\s*\{)/, `$1 speaker: ${arr},`)
  }
  return out
}

export async function handleAuthoring(req, res) {
  const url = new URL(req.url || '/', 'http://localhost')
  if (!url.pathname.startsWith('/authoring/')) return false
  if (url.pathname === '/authoring/ping') { send(res, 200, { authoring: true, decksPath: DECKS }); return true }
  if (!isAdmin(req)) { send(res, 403, { error: 'admin requis' }); return true }

  const parts = url.pathname.split('/').filter(Boolean) // authoring, deck, name, action, id

  // ── Tunnel public (cloudflared via Docker) : statut / start / stop ──────
  if (parts[1] === 'tunnel') {
    if (req.method === 'GET') { send(res, 200, { url: getTunnelUrl() }); return true }
    if (req.method === 'POST' && parts[2] === 'stop') {
      await exec(`docker rm -f ${TUNNEL_CONTAINER}`).catch(() => {})
      setTunnelUrl(null); send(res, 200, { ok: true }); return true
    }
    if (req.method === 'POST' && parts[2] === 'start') {
      const port = process.env.HUB_PORT || '5173'
      try {
        await exec(`docker rm -f ${TUNNEL_CONTAINER}`).catch(() => {})
        await exec(`docker run -d --name ${TUNNEL_CONTAINER} --network host cloudflare/cloudflared:latest tunnel --no-autoupdate --url http://localhost:${port}`)
      } catch (e) { send(res, 500, { error: 'Docker indisponible : ' + String(e?.message || e) }); return true }
      let turl = null
      for (let i = 0; i < 30 && !turl; i++) {
        await sleep(1500)
        const out = await exec(`docker logs ${TUNNEL_CONTAINER} 2>&1`).catch(() => ({ stdout: '', stderr: '' }))
        turl = `${out.stdout || ''}${out.stderr || ''}`.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)?.[0] || null
      }
      if (!turl) { await exec(`docker rm -f ${TUNNEL_CONTAINER}`).catch(() => {}); send(res, 504, { error: 'Tunnel non établi (réseau / image cloudflared ?)' }); return true }
      setTunnelUrl(turl); send(res, 200, { url: turl }); return true
    }
    send(res, 405, { error: 'méthode non gérée' }); return true
  }
  const name = parts[2]; const action = parts[3]
  const cfgPath = (n) => join(DECKS, n, 'deck.config.ts')
  const slidePath = (n, id) => join(DECKS, n, 'slides', `${id}.tsx`)

  try {
    if (req.method === 'POST' && parts.length === 2 && parts[1] === 'deck') {
      const { name: n } = await readJson(req)
      if (!okName(n)) return send(res, 400, { error: 'nom invalide (a-z 0-9 -)' }), true
      if (await exists(join(DECKS, n))) return send(res, 409, { error: 'existe déjà' }), true
      await mkdir(join(DECKS, n, 'slides'), { recursive: true })
      await writeFile(cfgPath(n), deckConfigTpl(n))
      await writeFile(slidePath(n, '01-intro'), slideTpl(n))
      // README d'authoring (guide pour humain / LLM) — pour le workflow Claude Code
      const readme = (await readFile(README_TPL, 'utf8')).replaceAll('__NAME__', n)
      await writeFile(join(DECKS, n, 'README.md'), readme)
      return send(res, 200, { ok: true }), true
    }
    if (!okName(name) || !(await exists(join(DECKS, name)))) return send(res, 404, { error: 'deck introuvable' }), true

    // GET /authoring/deck/:name → réglages complets
    if (req.method === 'GET' && !action) {
      const config = parseConfig(await readFile(cfgPath(name), 'utf8'))
      const files = (await readdir(join(DECKS, name, 'slides'))).filter((f) => f.endsWith('.tsx') && !f.startsWith('_'))
      let slides = await Promise.all(files.map(async (f) => parseSlide(await readFile(join(DECKS, name, 'slides', f), 'utf8'), f.replace(/\.tsx$/, ''))))
      const rank = (id) => { const i = config.order ? config.order.indexOf(id) : -1; return i === -1 ? 1e9 : i }
      slides.sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id))
      return send(res, 200, { name, config, slides }), true
    }

    if (req.method === 'POST' && (action === 'duplicate' || action === 'rename')) {
      const { to } = await readJson(req)
      if (!okName(to)) return send(res, 400, { error: 'nom invalide' }), true
      if (await exists(join(DECKS, to))) return send(res, 409, { error: 'cible existe déjà' }), true
      if (action === 'duplicate') await cp(join(DECKS, name), join(DECKS, to), { recursive: true })
      else await rename(join(DECKS, name), join(DECKS, to))
      return send(res, 200, { ok: true }), true
    }

    if (req.method === 'PATCH' && !action) {
      const body = await readJson(req)
      let src = await readFile(cfgPath(name), 'utf8')
      if (body.visibility === 'public' || body.visibility === 'private') src = setField(src, 'visibility', body.visibility)
      if (typeof body.title === 'string') src = setField(src, 'title', body.title.replace(/'/g, ''))
      await writeFile(cfgPath(name), src)
      return send(res, 200, { ok: true }), true
    }

    // PATCH /authoring/deck/:name/speakers { speakers: {nom:'#color'} }
    if (req.method === 'PATCH' && action === 'speakers') {
      const { speakers } = await readJson(req)
      if (!speakers || typeof speakers !== 'object') return send(res, 400, { error: 'speakers invalide' }), true
      const clean = {}
      for (const [n, c] of Object.entries(speakers)) if (/^[A-Za-z0-9_]+$/.test(n) && /^#[0-9a-fA-F]{3,8}$/.test(String(c))) clean[n] = c
      await writeFile(cfgPath(name), setSpeakers(await readFile(cfgPath(name), 'utf8'), clean))
      return send(res, 200, { ok: true }), true
    }

    // PATCH /authoring/deck/:name/slide/:id { duration?, speaker? }
    if (req.method === 'PATCH' && action === 'slide') {
      const id = parts[4]
      if (!okName(id) || !(await exists(slidePath(name, id)))) return send(res, 404, { error: 'slide introuvable' }), true
      const body = await readJson(req)
      const patch = {}
      if (Number.isInteger(body.duration) && body.duration >= 0) patch.duration = body.duration
      if (Array.isArray(body.speaker)) patch.speaker = body.speaker.filter((s) => /^[A-Za-z0-9_]+$/.test(s))
      await writeFile(slidePath(name, id), setSlideMeta(await readFile(slidePath(name, id), 'utf8'), patch))
      return send(res, 200, { ok: true }), true
    }

    if (req.method === 'DELETE' && !action) {
      await mkdir(TRASH, { recursive: true })
      await rename(join(DECKS, name), join(TRASH, `${name}-${Date.now()}`))
      return send(res, 200, { ok: true }), true
    }

    return send(res, 405, { error: 'méthode non gérée' }), true
  } catch (e) {
    return send(res, 500, { error: String(e?.message || e) }), true
  }
}
