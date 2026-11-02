// ─────────────────────────────────────────────────────────────────────────
//  API d'authoring (DEV uniquement, gated admin).
//  CRUD decks (créer/dupliquer/renommer/supprimer) + réglages (visibilité,
//  orateurs+couleurs, durée/orateur par slide). Écrit dans decks/ ; le client
//  recharge après mutation (Vite re-globbe). NON exposée en prod (read-only).
// ─────────────────────────────────────────────────────────────────────────
import { fileURLToPath } from 'node:url'
import { mkdir, writeFile, readFile, rename as fsRename, cp, rm, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { exec as execCb, execSync } from 'node:child_process'
import { promisify } from 'node:util'
import { isAdmin, setTunnelUrl, getTunnelUrl, hasCustomPassword } from './auth.js'

const exec = promisify(execCb)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// Un conteneur par port : deux hubs sur la même machine ne se coupent pas mutuellement le tunnel.
const tunnelName = () => `slide-hub-tunnel-${process.env.HUB_PORT || '5173'}`
const TUNNEL_TTL_MS = Math.max(0.1, Number(process.env.TUNNEL_TTL_HOURS || 4)) * 3600_000
let tunnelTimer = null
let tunnelExpiresAt = null

// Coupe le tunnel (conteneur + état) — appelé à l'arrêt manuel, à l'expiration et à la sortie du process.
async function stopTunnel() {
  clearTimeout(tunnelTimer); tunnelTimer = null; tunnelExpiresAt = null
  await exec(`docker rm -f ${tunnelName()}`).catch(() => {})
  setTunnelUrl(null)
}
// Ne laisse jamais un tunnel public derrière soi quand le serveur s'arrête (Ctrl+C, kill, fermeture du terminal).
let exitHooked = false
function hookExit() {
  if (exitHooked) return
  exitHooked = true
  const cleanup = () => { try { execSync(`docker rm -f ${tunnelName()}`, { stdio: 'ignore' }) } catch { /* docker absent / déjà coupé */ } }
  process.on('exit', cleanup)
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { cleanup(); process.exit(0) })
}

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

// Slides du modèle « talk » (plan type d'une présentation de 10 à 15 min).
const talkSlides = (name) => ({
  '01-titre': `import type { SlideContext, SlideMeta } from '@engine/types'
import { Eyebrow } from '@ui/Eyebrow'
import { Headline } from '@ui/Headline'
import { Lede } from '@ui/Lede'
import { Stack } from '@ui/Stack'

export const meta: SlideMeta = { title: 'Titre', speaker: ['moi'], duration: 45, notes: 'Accroche : une phrase, puis le plan.' }

export function Component(_: SlideContext) {
  return (
    <Stack gap={20}>
      <Eyebrow>Contexte · Date</Eyebrow>
      <Headline size="xl">${name}</Headline>
      <Lede>Une phrase d'accroche en une ligne.</Lede>
    </Stack>
  )
}
`,
  '02-plan': `import type { SlideContext, SlideMeta } from '@engine/types'
import { Eyebrow } from '@ui/Eyebrow'
import { Headline } from '@ui/Headline'
import { Stack } from '@ui/Stack'
import { Reveal } from '@ui/Reveal'
import { tokens } from '@design/tokens'

export const meta: SlideMeta = { title: 'Plan', speaker: ['moi'], duration: 60, steps: 3, notes: 'Annonce les trois parties (→ pour les faire apparaître).' }

const PARTS = ['Le problème', 'La solution', 'Et maintenant ?']

export function Component({ step }: SlideContext) {
  return (
    <Stack gap={28} align="start" style={{ width: '100%', maxWidth: 820 }}>
      <Eyebrow>Plan</Eyebrow>
      <Headline size="lg" align="left">Trois parties</Headline>
      <Stack gap={16} align="start">
        {PARTS.map((p, i) => (
          <Reveal key={p} show={step >= i + 1}>
            <span style={{ fontSize: tokens.type.size.lg, color: tokens.color.text.secondary }}>{i + 1}. {p}</span>
          </Reveal>
        ))}
      </Stack>
    </Stack>
  )
}
`,
  '03-section-1': sectionSlide('Le problème', 'Décris le constat, avec un chiffre ou un exemple concret.'),
  '04-section-2': sectionSlide('La solution', 'Montre comment ça marche, le plus simplement possible.'),
  '05-section-3': sectionSlide('Et maintenant ?', 'Prochaines étapes, ce que tu attends du public.'),
  '06-conclusion': `import type { SlideContext, SlideMeta } from '@engine/types'
import { Eyebrow } from '@ui/Eyebrow'
import { Headline } from '@ui/Headline'
import { Lede } from '@ui/Lede'
import { Stack } from '@ui/Stack'

export const meta: SlideMeta = { title: 'Conclusion', speaker: ['moi'], duration: 45, notes: 'Une idée à retenir, puis les questions.' }

export function Component(_: SlideContext) {
  return (
    <Stack gap={20}>
      <Eyebrow>Conclusion</Eyebrow>
      <Headline size="xl">Merci !</Headline>
      <Lede>Des questions ?</Lede>
    </Stack>
  )
}
`,
})
function sectionSlide(title, text) {
  return `import type { SlideContext, SlideMeta } from '@engine/types'
import { Eyebrow } from '@ui/Eyebrow'
import { Headline } from '@ui/Headline'
import { Lede } from '@ui/Lede'
import { Stack } from '@ui/Stack'

export const meta: SlideMeta = { title: '${title}', speaker: ['moi'], duration: 120, notes: '${text}' }

export function Component(_: SlideContext) {
  return (
    <Stack gap={20}>
      <Eyebrow>Section</Eyebrow>
      <Headline size="lg">${title}</Headline>
      <Lede>${text}</Lede>
    </Stack>
  )
}
`
}

const send = (res, code, obj) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)) }
const readJson = (req) => new Promise((r) => { let d = ''; req.on('data', (c) => { d += c; if (d.length > 16384) req.destroy() }); req.on('end', () => { try { r(JSON.parse(d || '{}')) } catch { r({}) } }); req.on('error', () => r({})) })
// Déplace un dossier. Sous Windows, `rename` échoue (EPERM/EBUSY) tant que le serveur de dev surveille
// le dossier : on retombe sur copie + suppression (avec nouvelles tentatives).
async function rename(from, to) {
  try { return await fsRename(from, to) } catch (e) {
    if (!['EPERM', 'EBUSY', 'EXDEV', 'EACCES'].includes(e?.code)) throw e
    await cp(from, to, { recursive: true })
    await rm(from, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 })
  }
}
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
  if (url.pathname === '/authoring/ping') {
    const mtimes = {}
    let trash = 0
    try {
      for (const d of await readdir(DECKS, { withFileTypes: true })) {
        if (!d.isDirectory() || d.name.startsWith('.')) continue
        let m = 0
        const walk = async (dir) => { for (const e of await readdir(dir, { withFileTypes: true })) { const f = join(dir, e.name); if (e.isDirectory()) await walk(f); else m = Math.max(m, (await stat(f)).mtimeMs) } }
        await walk(join(DECKS, d.name)); mtimes[d.name] = Math.round(m)
      }
      trash = (await readdir(TRASH).catch(() => [])).length
    } catch { /* ignore */ }
    send(res, 200, { authoring: true, decksPath: DECKS, mtimes, trash, customPassword: hasCustomPassword() }); return true
  }
  if (!isAdmin(req)) { send(res, 403, { error: 'admin requis' }); return true }

  const parts = url.pathname.split('/').filter(Boolean) // authoring, deck, name, action, id

  // ── Corbeille : liste / restauration des decks supprimés ────────────────
  if (parts[1] === 'trash') {
    if (req.method === 'GET') {
      const entries = (await readdir(TRASH).catch(() => [])).map((id) => {
        const m = id.match(/^(.*)-(\d{10,})$/)
        return { id, name: m ? m[1] : id, deletedAt: m ? Number(m[2]) : 0 }
      }).sort((a, b) => b.deletedAt - a.deletedAt)
      send(res, 200, { entries }); return true
    }
    if (req.method === 'POST' && parts[3] === 'restore') {
      const id = parts[2]
      const m = id.match(/^([a-z0-9-]{1,40})-(\d{10,})$/)
      if (!m || !(await exists(join(TRASH, id)))) { send(res, 404, { error: 'introuvable dans la corbeille' }); return true }
      let target = m[1]
      if (await exists(join(DECKS, target))) target = `${m[1]}-restaure`
      if (await exists(join(DECKS, target))) { send(res, 409, { error: 'un deck du même nom existe déjà' }); return true }
      await rename(join(TRASH, id), join(DECKS, target))
      send(res, 200, { ok: true, name: target }); return true
    }
    send(res, 405, { error: 'méthode non gérée' }); return true
  }

  // ── Tunnel public (cloudflared via Docker) : statut / start / stop ──────
  if (parts[1] === 'tunnel') {
    if (req.method === 'GET') { send(res, 200, { url: getTunnelUrl(), expiresAt: tunnelExpiresAt }); return true }
    if (req.method === 'POST' && parts[2] === 'stop') {
      await stopTunnel(); send(res, 200, { ok: true }); return true
    }
    if (req.method === 'POST' && parts[2] === 'start') {
      if (!hasCustomPassword()) { send(res, 400, { error: 'Définis un mot de passe avant de partager (sinon « demo » donnerait la main à tout le monde) : npm run password -- "monsecret" puis relance npm run dev.' }); return true }
      const port = process.env.HUB_PORT || '5173'
      try {
        hookExit()
        await exec(`docker rm -f ${tunnelName()}`).catch(() => {})
        // Linux : réseau hôte. Docker Desktop (Windows/macOS) : `--network host` n'atteint pas
        // la machine → on passe par host.docker.internal.
        const linux = process.platform === 'linux'
        const net = linux ? '--network host' : ''
        const target = linux ? `http://localhost:${port}` : `http://host.docker.internal:${port}`
        await exec(`docker run -d --name ${tunnelName()} ${net} cloudflare/cloudflared:latest tunnel --no-autoupdate --url ${target}`)
      } catch (e) { send(res, 500, { error: 'Docker indisponible : ' + String(e?.message || e) }); return true }
      let turl = null
      for (let i = 0; i < 30 && !turl; i++) {
        await sleep(1500)
        const out = await exec(`docker logs ${tunnelName()} 2>&1`).catch(() => ({ stdout: '', stderr: '' }))
        turl = `${out.stdout || ''}${out.stderr || ''}`.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)?.[0] || null
      }
      if (!turl) { await stopTunnel(); send(res, 504, { error: 'Tunnel non établi (réseau / image cloudflared ?)' }); return true }
      setTunnelUrl(turl)
      tunnelExpiresAt = Date.now() + TUNNEL_TTL_MS
      clearTimeout(tunnelTimer); tunnelTimer = setTimeout(() => { void stopTunnel() }, TUNNEL_TTL_MS)
      send(res, 200, { url: turl, expiresAt: tunnelExpiresAt }); return true
    }
    send(res, 405, { error: 'méthode non gérée' }); return true
  }
  const name = parts[2]; const action = parts[3]
  const cfgPath = (n) => join(DECKS, n, 'deck.config.ts')
  const slidePath = (n, id) => join(DECKS, n, 'slides', `${id}.tsx`)

  try {
    if (req.method === 'POST' && parts.length === 2 && parts[1] === 'deck') {
      const { name: n, template } = await readJson(req)
      if (!okName(n)) return send(res, 400, { error: 'nom invalide (a-z 0-9 -)' }), true
      if (await exists(join(DECKS, n))) return send(res, 409, { error: 'existe déjà' }), true
      await mkdir(join(DECKS, n, 'slides'), { recursive: true })
      await writeFile(cfgPath(n), deckConfigTpl(n))
      if (template === 'talk') for (const [id, src] of Object.entries(talkSlides(n))) await writeFile(slidePath(n, id), src)
      else await writeFile(slidePath(n, '01-intro'), slideTpl(n))
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
