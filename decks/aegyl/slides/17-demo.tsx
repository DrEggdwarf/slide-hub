import { motion, AnimatePresence } from 'framer-motion'
import { SlideContext, SlideMeta } from '@engine/types'
import { tokens } from '@design/tokens'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Matter from 'matter-js'
import { Avatar, avatarFor } from '../avatars'

export const meta: SlideMeta = {
  speaker: ['illias'],
  duration: 90,
  steps: 0,
  notes: 'Demo live. Chaque tentative tombe en pachinko (vraie physique matter-js) : rebonds sur les pegs, collisions entre billes, rotation. Chaque bille traverse les scanners verts et se fait arreter (rouge) a la couche qui la refuse, ou tombe dans le bassin si acceptee. SSE depuis aegyl.fr/api.',
}

const CLR = tokens.color.accent.aegyl
const GRN = '#22c55e'
const RED = '#ef4444'
const MONO = tokens.type.family.mono
const SANS = tokens.type.family.sans

const DEMO_URL = 'www.aegyl.fr'

/* -- Pipeline : 5 portes de filtrage + bassin "Accepté" -------------- */
const STAGES = [
  { id: 'P1', name: 'Z-Score', color: tokens.color.accent.zscore },
  { id: 'P2', name: 'Isolation Forest', color: tokens.color.accent.iforest },
  { id: 'P3', name: 'SNN Distance', color: tokens.color.accent.snn },
  { id: 'P4', name: 'Secure Sketch', color: tokens.color.accent.sketch },
  { id: 'P5', name: 'ECC Verify', color: '#10b981' },
]

const RESET_KEY_STORAGE = 'aegyl-reset-key'

type Attempt = { pseudo: string; accepted: boolean; stopped_at: number; ts: number; avatar?: Avatar }
function attemptAvatar(a: { pseudo: string; avatar?: Avatar }): Avatar {
  return a.avatar ?? avatarFor(a.pseudo)
}
type Geo = { w: number; h: number }
type Ball = { id: number; avatar: Avatar; pseudo: string; accepted: boolean }

/* ─── Géométrie (dérivée de la taille mesurée du panneau) ──────────── */
function gateY(geo: Geo, i: number) {
  const top = 0.17, bottom = 0.64
  return geo.h * (top + (bottom - top) * (i / (STAGES.length - 1)))
}
function spawnY(geo: Geo) { return geo.h * 0.05 }
function basinY(geo: Geo) { return geo.h * 0.86 }
function centerX(geo: Geo) { return geo.w / 2 }

/** Plots du pachinko : paires symétriques autour du centre, JAMAIS un plot
    pile au centre (sinon une bille s'y équilibre). Le couloir central reste
    dégagé pour que les billes acceptées atteignent le bassin. Partagé entre
    le moteur physique (colliders) et le rendu SVG (visuel). */
function pegPositions(geo: Geo): { x: number; y: number }[] {
  const cx = centerX(geo)
  const pegs: { x: number; y: number }[] = []
  const step = Math.max(2 * BALL_R + 14, geo.w * 0.085) // couloir central > diamètre bille
  for (let i = 0; i < STAGES.length - 1; i++) {
    const y0 = gateY(geo, i), y1 = gateY(geo, i + 1)
    const my = (y0 + y1) / 2
    const pairs = 3 - (i > 2 ? 1 : 0) // moins de plots en bas (entonnoir)
    const shift = i % 2 === 0 ? 0.5 : 1.0 // décalage vertical/horizontal alterné
    for (let j = 0; j < pairs; j++) {
      const dx = (j + shift) * step
      pegs.push({ x: cx - dx, y: my })
      pegs.push({ x: cx + dx, y: my })
    }
  }
  return pegs
}

/* ─── Catégories de collision (filtrage par verdict) ──────────────── */
const CAT = {
  WALL: 0x0001,
  PEG: 0x0002,
  BALL: 0x0004,
  BASIN: 0x0008,
  GATE: [0x0010, 0x0020, 0x0040, 0x0080, 0x0100],
}
const BALL_R = 21

export function Component(_: SlideContext) {
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [connected, setConnected] = useState(false)
  const [balls, setBalls] = useState<Ball[]>([])
  const [confetti, setConfetti] = useState<{ id: number; x: number; y: number; color: string }[]>([])
  const [gatePulse, setGatePulse] = useState<{ gate: number; color: string; id: number } | null>(null)

  const confettiId = useRef(0)
  const ballSeq = useRef(0)

  // physique : moteur + bodies, hors du cycle de rendu React
  const engineRef = useRef<Matter.Engine | null>(null)
  const ballsRef = useRef<Map<number, { body: Matter.Body; el: HTMLDivElement | null; landed: boolean; bornAt: number }>>(new Map())
  const addBallRef = useRef<((a: Attempt) => void) | null>(null)
  const clearRef = useRef<(() => void) | null>(null)
  const pulseSeq = useRef(0)

  /* -- Mesure du panneau -------------------------------------------- */
  const stageRef = useRef<HTMLDivElement>(null)
  const [geo, setGeo] = useState<Geo>({ w: 760, h: 520 })
  useLayoutEffect(() => {
    const el = stageRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setGeo({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setGeo({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  /* -- Moteur physique (rebuild si la géométrie change) ------------- */
  useEffect(() => {
    const { Engine, Bodies, Body, Composite, Events } = Matter
    const engine = Engine.create()
    engine.gravity.y = 1.3
    engineRef.current = engine
    const world = engine.world
    const cx = centerX(geo)
    const bHalf = geo.w * 0.13

    const wallOpt = { isStatic: true, restitution: 0.4, friction: 0.02, label: 'wall', collisionFilter: { category: CAT.WALL, mask: CAT.BALL } }
    const wall = (x: number, y: number, w: number, h: number) => Bodies.rectangle(x, y, w, h, wallOpt)
    // paroi inclinée entre deux points (canalise les billes vers le centre/bassin)
    const ramp = (x1: number, y1: number, x2: number, y2: number) => {
      const len = Math.hypot(x2 - x1, y2 - y1)
      const b = Bodies.rectangle((x1 + x2) / 2, (y1 + y2) / 2, len, 8, wallOpt)
      Body.setAngle(b, Math.atan2(y2 - y1, x2 - x1))
      return b
    }

    Composite.add(world, [
      // murs extérieurs verticaux
      wall(-6, geo.h / 2, 12, geo.h * 2),
      wall(geo.w + 6, geo.h / 2, 12, geo.h * 2),
      // sol de capture PLEINE LARGEUR : aucune bille ne quitte le plateau
      wall(cx, geo.h * 0.965, geo.w, 30),
      // entonnoir : deux rampes du haut large vers les bords du bassin
      ramp(geo.w * 0.06, gateY(geo, 0) - geo.h * 0.04, cx - bHalf, basinY(geo)),
      ramp(geo.w * 0.94, gateY(geo, 0) - geo.h * 0.04, cx + bHalf, basinY(geo)),
    ])

    // portes : barrière ÉPAISSE pleine largeur, chacune sa catégorie → une
    // bille ne percute QUE la porte de son verdict (filtrage de collision).
    // Épaisseur 14 + pas de temps 120 Hz pour éviter le tunneling.
    STAGES.forEach((_s, i) => {
      Composite.add(world, Bodies.rectangle(cx, gateY(geo, i), geo.w * 0.9, 14, {
        isStatic: true, restitution: 0.2, label: `gate-${i}`,
        collisionFilter: { category: CAT.GATE[i], mask: CAT.BALL },
      }))
    })

    // plots pachinko
    pegPositions(geo).forEach(p => Composite.add(world, Bodies.circle(p.x, p.y, 4, {
      isStatic: true, restitution: 0.6, label: 'peg',
      collisionFilter: { category: CAT.PEG, mask: CAT.BALL },
    })))

    // bassin "Accepté" : sol PLEINE LARGEUR (une bille acceptée — qui ne
    // percute aucune porte — atterrit forcément dessus → accept garanti).
    // Les parois centrales rassemblent visuellement la pile au centre.
    Composite.add(world, [
      Bodies.rectangle(cx, basinY(geo) + 12, geo.w, 14, {
        isStatic: true, restitution: 0.05, label: 'basin',
        collisionFilter: { category: CAT.BASIN, mask: CAT.BALL },
      }),
      wall(cx - bHalf - 14, basinY(geo) - 14, 8, 76),
      wall(cx + bHalf + 14, basinY(geo) - 14, 8, 76),
    ])

    // ── ajout / retrait de billes ──────────────────────────────────
    const removeBall = (id: number) => {
      const e = ballsRef.current.get(id)
      if (!e) return
      Composite.remove(world, e.body)
      ballsRef.current.delete(id)
      setBalls(prev => prev.filter(b => b.id !== id))
    }

    const reallySpawn = (a: Attempt) => {
      const id = ballSeq.current++
      const stop = a.stopped_at // 0..5 (5 = accepté)
      // masque : murs + pegs + autres billes + (sa porte de verdict | bassin)
      let mask = CAT.WALL | CAT.PEG | CAT.BALL
      mask |= a.accepted ? CAT.BASIN : CAT.GATE[Math.min(stop, 4)]
      // position X ALÉATOIRE large → chaque bille suit un chemin différent
      const x = cx + (Math.random() * 2 - 1) * geo.w * 0.3
      const body = Bodies.circle(x, spawnY(geo), BALL_R, {
        restitution: 0.42, friction: 0.03, frictionAir: 0.006, density: 0.0025,
        label: `ball:${id}`,
        collisionFilter: { category: CAT.BALL, mask },
      })
      ;(body as any).plugin = { ballId: id, accepted: a.accepted, stop }
      Body.setAngularVelocity(body, (Math.random() * 2 - 1) * 0.3)
      Body.setVelocity(body, { x: (Math.random() * 2 - 1) * 1.5, y: 0 }) // élan latéral léger
      Composite.add(world, body)
      ballsRef.current.set(id, { body, el: null, landed: false, bornAt: performance.now() })
      setBalls(prev => [...prev.slice(-23), { id, avatar: attemptAvatar(a), pseudo: a.pseudo, accepted: a.accepted }])
      // filet de sécurité : retrait si jamais elle ne se pose pas
      window.setTimeout(() => removeBall(id), 7000)
    }

    // File d'attente : si plusieurs saisies arrivent quasi en même temps,
    // les billes sont lâchées une par une (évite qu'elles se chevauchent
    // au point de spawn). ~320 ms d'écart minimum.
    const SPAWN_GAP = 320
    const queue: Attempt[] = []
    let lastSpawn = 0
    let drainTimer = 0
    const drain = () => {
      drainTimer = 0
      const a = queue.shift()
      if (!a) return
      reallySpawn(a)
      lastSpawn = performance.now()
      if (queue.length) drainTimer = window.setTimeout(drain, SPAWN_GAP)
    }
    const enqueue = (a: Attempt) => {
      queue.push(a)
      if (drainTimer) return // écoulement déjà programmé
      const wait = Math.max(0, SPAWN_GAP - (performance.now() - lastSpawn))
      drainTimer = window.setTimeout(drain, wait)
    }

    const clearAll = () => {
      queue.length = 0
      if (drainTimer) { clearTimeout(drainTimer); drainTimer = 0 }
      ballsRef.current.forEach(e => Composite.remove(world, e.body))
      ballsRef.current.clear()
      setBalls([])
      setConfetti([])
    }
    addBallRef.current = enqueue
    clearRef.current = clearAll

    // ── atterrissage : flash de la porte / bassin + confettis ──────
    const onCollision = (evt: Matter.IEventCollision<Matter.Engine>) => {
      for (const pair of evt.pairs) {
        const a = pair.bodyA, b = pair.bodyB
        const ball = (a.label.startsWith('ball:') ? a : b.label.startsWith('ball:') ? b : null)
        const other = ball === a ? b : a
        if (!ball) continue
        const meta = (ball as any).plugin
        const e = ballsRef.current.get(meta?.ballId)
        if (!e || e.landed) continue
        const isGate = other.label.startsWith('gate-')
        const isBasin = other.label === 'basin'
        if (!isGate && !isBasin) continue
        e.landed = true
        const pid = pulseSeq.current++
        const cId = confettiId.current++
        const { x, y } = e.body.position
        // EXPLOSION à l'impact : confettis verts si acceptée (bassin),
        // rouges si refusée (à la porte qui l'arrête).
        const burstColor = meta.accepted && isBasin ? GRN : RED
        setGatePulse({ gate: meta.accepted && isBasin ? 5 : meta.stop, color: burstColor, id: pid })
        setConfetti(prev => [...prev.slice(-6), { id: cId, x, y, color: burstColor }])
        window.setTimeout(() => setConfetti(prev => prev.filter(c => c.id !== cId)), 1100)
        // la bille « explose » : elle disparaît dans la gerbe
        window.setTimeout(() => removeBall(meta.ballId), 70)
      }
    }
    Events.on(engine, 'collisionStart', onCollision)

    // ── boucle de rendu (RAF) : physique à pas fixe 120 Hz + sync DOM.
    // Le pas fixe + barrières épaisses empêchent les billes rapides de
    // traverser les portes (tunneling). ──────────────────────────────
    let raf = 0
    let prev = performance.now()
    let acc = 0
    const STEP = 1000 / 120
    const loop = (now: number) => {
      acc += Math.min(60, now - prev)
      prev = now
      let iter = 0
      while (acc >= STEP && iter < 8) { Engine.update(engine, STEP); acc -= STEP; iter++ }
      ballsRef.current.forEach(e => {
        if (!e.el) return
        const { x, y } = e.body.position
        e.el.style.transform = `translate(${x - BALL_R}px, ${y - BALL_R}px) rotate(${e.body.angle}rad)`
      })
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      if (drainTimer) clearTimeout(drainTimer)
      Events.off(engine, 'collisionStart', onCollision)
      Composite.clear(world, false)
      Engine.clear(engine)
      ballsRef.current.clear()
      addBallRef.current = null
      clearRef.current = null
    }
  }, [geo.w, geo.h])

  /* -- Flux SSE depuis l'API ---------------------------------------- */
  useEffect(() => {
    let closed = false
    fetch('/api/attempts')
      .then(r => r.json())
      .then((initial: Attempt[]) => { if (!closed) setAttempts(initial) })
      .catch(() => {})

    const source = new EventSource('/api/attempts/stream')
    source.onopen = () => setConnected(true)
    source.onerror = () => setConnected(false)
    source.addEventListener('attempt', e => {
      const a: Attempt = JSON.parse((e as MessageEvent).data)
      setAttempts(prev => [...prev, a])
      addBallRef.current?.(a) // lâche une bille dans le pachinko
    })
    source.addEventListener('reset', () => {
      setAttempts([])
      clearRef.current?.()
    })
    return () => { closed = true; source.close() }
  }, [])

  /* -- Dérivés ------------------------------------------------------- */
  const { values, uniqueUsers, feed } = useMemo(() => {
    const values = [0, 0, 0, 0, 0, 0]
    const users = new Set<string>()
    attempts.forEach(a => {
      if (a.stopped_at >= 0 && a.stopped_at <= 5) values[a.stopped_at]++
      users.add(a.pseudo)
    })
    const feedStart = Math.max(0, attempts.length - 6)
    return {
      values, uniqueUsers: users.size,
      feed: attempts.slice(-6).map((a, i) => ({ ...a, key: feedStart + i })).reverse(),
    }
  }, [attempts])

  const totalAttempts = attempts.length
  const passed = values[5]
  const passRate = totalAttempts > 0 ? `${((passed / totalAttempts) * 100).toFixed(0)}%` : '—'
  const lastAccepted = attempts.length > 0 ? attempts[attempts.length - 1].accepted : false

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', width: '100%', height: '100%', maxWidth: 1180,
      alignItems: 'center', justifyContent: 'flex-start', padding: '10px 12px', gap: 12,
    }}>
      {/* -- URL ------------------------------------------------------- */}
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        style={{
          padding: '11px 34px', borderRadius: 12, border: `2.5px solid ${CLR}45`, background: `${CLR}08`,
          display: 'flex', alignItems: 'center', gap: 14,
        }}
      >
        <span style={{ fontSize: 28, fontWeight: 800, fontFamily: MONO, color: CLR, letterSpacing: -0.5 }}>{DEMO_URL}</span>
        <span style={{ fontSize: 14, fontFamily: SANS, color: '#71717a', fontWeight: 600 }}>
          Tapez la phrase — votre bille tombe dans le pachinko
        </span>
      </motion.div>

      {/* -- Pachinko + feed ------------------------------------------- */}
      <div style={{ display: 'flex', gap: 12, width: '100%', flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1, minWidth: 0, borderRadius: 18, background: '#0a0a0f', position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: `radial-gradient(ellipse at 50% 100%, ${GRN}14 0%, transparent 55%)`,
          }} />

          {/* flash vert/rouge à chaque tentative — calque dédié */}
          {totalAttempts > 0 && (
            <motion.div
              key={totalAttempts}
              initial={{ opacity: 0 }} animate={{ opacity: [0, 0.4, 0] }} transition={{ duration: 1.1, ease: 'easeOut' }}
              style={{
                position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1, borderRadius: 18,
                boxShadow: `inset 0 0 90px 12px ${lastAccepted ? GRN : RED}`,
              }}
            />
          )}

          {/* badge LIVE / OFFLINE */}
          <div style={{ position: 'absolute', top: 14, right: 18, zIndex: 6 }}>
            <motion.div
              animate={{ opacity: connected ? [1, 0.4, 1] : 0.5 }}
              transition={{ duration: 1.5, repeat: connected ? Infinity : 0 }}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 12px', borderRadius: 14, background: connected ? '#b91c1c20' : '#52525b30' }}
            >
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: connected ? RED : '#71717a', boxShadow: connected ? `0 0 8px ${RED}` : 'none' }} />
              <span style={{ fontSize: 12, fontWeight: 800, fontFamily: MONO, color: connected ? RED : '#71717a', letterSpacing: 1.5 }}>
                {connected ? 'LIVE' : 'OFFLINE'}
              </span>
            </motion.div>
          </div>

          {/* aire de jeu mesurée */}
          <div ref={stageRef} style={{ position: 'absolute', inset: 0 }}>
            <FunnelStructure geo={geo} rejects={values} accepted={passed} pulse={gatePulse} />

            {/* billes (positionnées par la boucle physique via refs) */}
            {balls.map(b => (
              <div
                key={b.id}
                ref={el => {
                  const e = ballsRef.current.get(b.id)
                  if (e) e.el = el
                }}
                style={{
                  position: 'absolute', left: 0, top: 0, width: BALL_R * 2, height: BALL_R * 2,
                  borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: b.avatar.bg, border: '3px solid #0a0a0f',
                  boxShadow: `0 0 16px ${b.avatar.bg}88`, zIndex: 4, willChange: 'transform',
                }}
              >
                <span style={{ fontSize: 22, lineHeight: 1 }}>{b.avatar.animal}</span>
                <span style={{
                  position: 'absolute', bottom: -7, left: '50%', transform: 'translateX(-50%)',
                  padding: '1px 6px', borderRadius: 7, background: '#0a0a0f', border: `1.5px solid ${b.avatar.bg}`,
                  fontSize: 10, fontWeight: 800, fontFamily: MONO, color: '#fff', lineHeight: 1.3, whiteSpace: 'nowrap',
                }}>
                  {b.pseudo.slice(0, 2).toUpperCase()}
                </span>
              </div>
            ))}

            {/* explosions de confettis (à l'impact des billes) */}
            <AnimatePresence>
              {confetti.map(c => <Confetti key={c.id} x={c.x} y={c.y} color={c.color} />)}
            </AnimatePresence>
          </div>
        </div>

        {/* Feed live */}
        <div style={{ width: 270, flexShrink: 0, borderRadius: 18, background: '#0a0a0f', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
          <span style={{ fontSize: 12, fontWeight: 800, fontFamily: MONO, color: '#ffffff55', textTransform: 'uppercase', letterSpacing: 2, paddingLeft: 4 }}>
            Tentatives
          </span>
          <AnimatePresence initial={false}>
            {feed.length === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ fontSize: 14, fontFamily: SANS, color: '#ffffff40', padding: '20px 4px', textAlign: 'center' }}>
                En attente de la première frappe...
              </motion.div>
            )}
            {feed.map(a => (
              <motion.div
                key={a.key} layout
                initial={{ opacity: 0, x: 36, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', borderRadius: 12,
                  background: a.accepted ? `${GRN}16` : '#ffffff08', border: `1.5px solid ${a.accepted ? `${GRN}40` : '#ffffff10'}`,
                }}
              >
                <span style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: attemptAvatar(a).bg, fontSize: 17, lineHeight: 1 }}>
                  {attemptAvatar(a).animal}
                </span>
                <span style={{ fontSize: 16, fontWeight: 700, fontFamily: SANS, color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.pseudo}
                </span>
                <span style={{ fontSize: 11, fontWeight: 800, fontFamily: MONO, whiteSpace: 'nowrap', padding: '4px 9px', borderRadius: 7, color: a.accepted ? GRN : RED, background: a.accepted ? `${GRN}18` : `${RED}15` }}>
                  {a.accepted ? '✓ ACCEPTÉ' : `✗ ${STAGES[a.stopped_at]?.id ?? '?'}`}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* -- Compteurs ------------------------------------------------- */}
      <div style={{ display: 'flex', gap: 12, width: '100%', justifyContent: 'center' }}>
        <Counter label="Utilisateurs" value={uniqueUsers} color={CLR} />
        <Counter label="Tentatives" value={totalAttempts} color="#a1a1aa" />
        <Counter label="Acceptés" value={passed} color={GRN} />
        <Counter label="Taux d'acceptation" value={passRate} color={passed > 0 ? GRN : '#a1a1aa'} />
      </div>

      <SimulateToolbar />
      <ResetToolbar onDone={() => { setAttempts([]); clearRef.current?.() }} />
    </div>
  )
}

/* ─── Barre de simulation (présentateur) ──────────────────────────── */

/** Loi ~normale (somme de 3 uniformes). */
function randn() { return Math.random() + Math.random() + Math.random() - 1.5 }
/** Frappe synthétique alignée sur les stats du profil (dwell ~106±24,
    seek ~133±70 → flight_mean ≈ 27, ~40% d'overlap, wpm ≈ 450). Ainsi un
    pseudo ≠ "Robin" passe le test réel puis est attrapé par les couches
    profondes (P4/P5) la plupart du temps, accepté 1 fois sur 10. */
function synthEvents(): { d: number; u: number }[] {
  let t = 0
  const e: { d: number; u: number }[] = []
  for (let i = 0; i < 42; i++) {
    const d = t
    const u = t + Math.max(20, 106 + randn() * 24)
    e.push({ d: Math.round(d * 10) / 10, u: Math.round(u * 10) / 10 })
    t += Math.max(40, 133 + randn() * 70)
  }
  return e
}

function SimulateToolbar() {
  const [val, setVal] = useState('')
  const [qty, setQty] = useState('1')
  const [busy, setBusy] = useState(false)
  const [active, setActive] = useState(false)

  const launch = async () => {
    const pseudo = val.trim()
    const n = Math.max(1, Math.min(30, parseInt(qty, 10) || 1)) // 1..30
    if (pseudo.length < 2 || busy) return
    setBusy(true)
    // envoie n tentatives du même pseudo ; la file de la slide les espace
    for (let i = 0; i < n; i++) {
      try {
        await fetch('/api/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pseudo, events: synthEvents() }),
        })
      } catch { /* hors-ligne : on ignore */ }
    }
    setBusy(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
      onMouseEnter={() => setActive(true)} onMouseLeave={() => setActive(false)}
      style={{
        position: 'fixed', bottom: 24, left: 24, zIndex: 200,
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 10px', borderRadius: 100,
        background: '#0a0a0fd9', backdropFilter: 'blur(6px)',
        border: `1.5px solid #ffffff20`,
        opacity: active ? 1 : 0.4, transition: 'opacity 0.2s',
      }}
    >
      <span style={{ fontSize: 14 }}>🪙</span>
      <input
        value={val}
        onChange={e => setVal(e.target.value)}
        // empêche flèches/espace de naviguer entre les slides pendant la saisie
        onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') launch() }}
        placeholder="pseudo…"
        maxLength={20}
        style={{
          width: 104, padding: '5px 9px', borderRadius: 8,
          background: '#ffffff10', border: '1px solid #ffffff20',
          color: '#fff', fontSize: 13, fontFamily: MONO, fontWeight: 600,
          outline: 'none', boxSizing: 'border-box',
        }}
      />
      <span style={{ fontSize: 13, color: '#ffffff66', fontFamily: MONO, fontWeight: 700 }}>×</span>
      <input
        value={qty}
        onChange={e => setQty(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
        onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') launch() }}
        inputMode="numeric"
        title="Nombre de billes (1 à 30)"
        style={{
          width: 42, padding: '5px 6px', borderRadius: 8, textAlign: 'center',
          background: '#ffffff10', border: '1px solid #ffffff20',
          color: '#fff', fontSize: 13, fontFamily: MONO, fontWeight: 700,
          outline: 'none', boxSizing: 'border-box',
        }}
      />
      <motion.button
        onClick={launch} disabled={busy || val.trim().length < 2}
        whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }}
        style={{
          padding: '6px 13px', borderRadius: 100, border: 'none',
          background: busy ? '#ffffff18' : val.trim().length >= 2 ? CLR : '#ffffff18',
          color: !busy && val.trim().length >= 2 ? '#fff' : '#ffffff55',
          fontSize: 12, fontWeight: 800, fontFamily: MONO, letterSpacing: 1,
          cursor: val.trim().length >= 2 && !busy ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap',
        }}
      >
        {busy ? '…' : 'LANCER'}
      </motion.button>
    </motion.div>
  )
}

/* ─── Structure (SVG) : pegs, scanners, bassin, compteurs ─────────── */

function FunnelStructure({ geo, rejects, accepted, pulse }: {
  geo: Geo; rejects: number[]; accepted: number; pulse: { gate: number; color: string; id: number } | null
}) {
  const cx = centerX(geo)
  const by = basinY(geo)
  const bHalf = geo.w * 0.13
  const pegs = useMemo(() => pegPositions(geo), [geo])

  return (
    <>
      <svg width={geo.w} height={geo.h} style={{ position: 'absolute', inset: 0 }}>
        {/* parois de l'entonnoir — visibles : trait clair + lueur */}
        <path
          d={`M ${geo.w * 0.06} ${gateY(geo, 0) - geo.h * 0.04} L ${cx - bHalf} ${by}
              M ${geo.w * 0.94} ${gateY(geo, 0) - geo.h * 0.04} L ${cx + bHalf} ${by}`}
          stroke="#ffffff55" strokeWidth={3} fill="none" strokeLinecap="round"
          style={{ filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.3))' }}
        />
        {/* pegs — disques clairs avec halo, bien visibles sur fond sombre */}
        {pegs.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={7} fill="#ffffff14" />
            <circle cx={p.x} cy={p.y} r={4.5} fill="#e5e7eb" stroke="#ffffff" strokeWidth={1}
              style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.5))' }} />
          </g>
        ))}
        {/* bassin */}
        <rect x={cx - bHalf} y={by + 4} width={bHalf * 2} height={9} rx={4} fill={`${GRN}66`}
          style={{ filter: `drop-shadow(0 0 6px ${GRN}88)` }} />
      </svg>

      {STAGES.map((s, i) => (
        <Scanner
          key={s.id} geo={geo} y={gateY(geo, i)} stage={s} rejectCount={rejects[i]}
          flash={pulse && pulse.gate === i ? pulse.id : null} flashColor={pulse?.color ?? RED}
        />
      ))}

      <BasinLabel geo={geo} accepted={accepted} flash={pulse && pulse.gate === 5 ? pulse.id : null} />
    </>
  )
}

/* Une porte = un "scanner" pleine largeur ; la bille le traverse (vert)
   ou s'y fait arrêter (flash rouge à l'atterrissage). */
function Scanner({ geo, y, stage, rejectCount, flash, flashColor }: {
  geo: Geo; y: number; stage: typeof STAGES[number]; rejectCount: number; flash: number | null; flashColor: string
}) {
  return (
    <>
      <motion.div
        animate={flash != null ? { opacity: [0.5, 1, 0.5], boxShadow: [`0 0 10px ${stage.color}55`, `0 0 22px ${flashColor}`, `0 0 10px ${stage.color}55`] } : {}}
        transition={{ duration: 0.6 }}
        style={{
          position: 'absolute', top: y - 3, left: geo.w * 0.04, width: geo.w * 0.92, height: 6, borderRadius: 3,
          background: `linear-gradient(90deg, transparent, ${stage.color}, transparent)`,
          opacity: 0.55, boxShadow: `0 0 10px ${stage.color}55`,
        }}
      />
      <div style={{ position: 'absolute', top: y - 27, left: 12, display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 20, fontWeight: 800, fontFamily: MONO, color: stage.color }}>{stage.id}</span>
        <span style={{ fontSize: 14, fontWeight: 600, fontFamily: SANS, color: '#ffffffcc' }}>{stage.name}</span>
      </div>
      <motion.div
        key={rejectCount}
        initial={{ scale: rejectCount > 0 ? 1.5 : 1 }} animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 16 }}
        style={{
          position: 'absolute', top: y - 16, right: 12, minWidth: 30, padding: '4px 8px', borderRadius: 8, textAlign: 'center',
          background: rejectCount > 0 ? `${RED}1a` : '#ffffff08', border: `1.5px solid ${rejectCount > 0 ? `${RED}40` : '#ffffff12'}`,
          fontSize: 16, fontWeight: 800, fontFamily: MONO, color: rejectCount > 0 ? RED : '#ffffff35',
          fontVariantNumeric: 'tabular-nums', lineHeight: 1.1,
        }}
      >
        {rejectCount}
      </motion.div>
    </>
  )
}

function BasinLabel({ geo, accepted, flash }: { geo: Geo; accepted: number; flash: number | null }) {
  return (
    <motion.div
      animate={flash != null ? { scale: [1, 1.18, 1] } : {}} transition={{ duration: 0.5 }}
      style={{
        position: 'absolute', top: basinY(geo) + 16, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'center', gap: 10, padding: '6px 18px', borderRadius: 12,
        background: `${GRN}1a`, border: `2px solid ${GRN}50`,
      }}
    >
      <span style={{ fontSize: 17, fontWeight: 800, fontFamily: SANS, color: GRN, letterSpacing: 0.5 }}>✓ ACCEPTÉ</span>
      <motion.span key={accepted} initial={{ scale: 1.4 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 320, damping: 15 }}
        style={{ fontSize: 22, fontWeight: 800, fontFamily: MONO, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
        {accepted}
      </motion.span>
    </motion.div>
  )
}

/* ─── Explosion de confettis (à l'impact d'une bille) ─────────────── */

function Confetti({ x, y, color }: { x: number; y: number; color: string }) {
  // gerbe radiale colorée selon le verdict (rouge/vert) + éclats clairs
  const light = color === GRN ? '#86efac' : '#fecaca'
  const parts = useMemo(() =>
    Array.from({ length: 22 }, (_, i) => {
      const ang = (i / 22) * Math.PI * 2 + (i % 2 ? 0.28 : 0)
      const dist = 46 + (i % 6) * 20
      return {
        i,
        dx: Math.cos(ang) * dist,
        dy: Math.sin(ang) * dist - 14, // léger biais vers le haut
        color: [color, color, light, '#ffffff'][i % 4],
        size: 7 + (i % 3) * 3,
      }
    }), [x, y, color])
  return (
    <>
      {parts.map(p => (
        <motion.div key={p.i}
          initial={{ x, y, opacity: 1, scale: 1.1 }}
          animate={{ x: x + p.dx, y: y + p.dy + 24, opacity: 0, scale: 0.3 }}
          transition={{ duration: 0.95, ease: 'easeOut' }}
          style={{ position: 'absolute', left: -p.size / 2, top: -p.size / 2, width: p.size, height: p.size, borderRadius: 2, background: p.color, zIndex: 7, boxShadow: `0 0 6px ${p.color}` }}
        />
      ))}
    </>
  )
}

/* ─── Compteur ────────────────────────────────────────────────────── */

function Counter({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{ padding: '10px 24px', borderRadius: 12, border: `2px solid ${color}25`, background: `${color}08`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 148 }}>
      <motion.span key={String(value)} initial={{ scale: 1.25 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }}
        style={{ fontSize: 34, fontWeight: 800, fontFamily: MONO, color, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </motion.span>
      <span style={{ fontSize: 11, fontFamily: SANS, color: '#a1a1aa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2 }}>
        {label}
      </span>
    </div>
  )
}

/* ─── Reset toolbar ──────────────────────────────────────────────── */

function ResetToolbar({ onDone }: { onDone: () => void }) {
  const [flash, setFlash] = useState<'idle' | 'ok' | 'err'>('idle')
  const flashFor = (s: 'ok' | 'err') => { setFlash(s); setTimeout(() => setFlash('idle'), 2200) }

  const doReset = useCallback(async () => {
    if (!window.confirm('Vider toutes les tentatives et repartir à zéro ?')) return
    let key = localStorage.getItem(RESET_KEY_STORAGE) ?? ''
    for (let attempt = 0; attempt < 2; attempt++) {
      if (!key) key = window.prompt('Clé de reset (x-demo-key) :')?.trim() ?? ''
      if (!key) return
      let status = 0
      try {
        const res = await fetch('/api/reset', { method: 'POST', headers: { 'x-demo-key': key } })
        status = res.status
      } catch { status = 0 }
      if (status === 204) { localStorage.setItem(RESET_KEY_STORAGE, key); onDone(); flashFor('ok'); return }
      if (status !== 403) break
      localStorage.removeItem(RESET_KEY_STORAGE); key = ''
    }
    flashFor('err')
  }, [onDone])

  const color = flash === 'ok' ? GRN : flash === 'err' ? RED : '#ffffff99'
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 200 }}>
      <motion.button
        onClick={doReset} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }} title="Vider l'historique des tentatives (clé requise)"
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 100,
          border: `1.5px solid ${flash === 'idle' ? '#ffffff20' : `${color}55`}`, background: '#0a0a0fd9', backdropFilter: 'blur(6px)',
          color, fontSize: 12, fontWeight: 800, fontFamily: MONO, letterSpacing: 1.5, cursor: 'pointer',
          opacity: flash === 'idle' ? 0.4 : 1, transition: 'opacity 0.2s, color 0.2s, border-color 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '1' }}
        onMouseLeave={e => { if (flash === 'idle') e.currentTarget.style.opacity = '0.4' }}
      >
        {flash === 'ok' ? '✓ HISTORIQUE VIDÉ' : flash === 'err' ? '✗ ÉCHEC RESET' : '↺ RESET'}
      </motion.button>
    </motion.div>
  )
}
