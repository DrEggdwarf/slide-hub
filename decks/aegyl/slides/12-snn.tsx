import { useState, useEffect, useRef, useCallback, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { SlideContext, SlideMeta } from '@engine/types'
import { tokens } from '@design/tokens'
import { Eyebrow } from '@ui/Eyebrow'
import { PipelineBar, STAGES } from './_pipeline'

export const meta: SlideMeta = {
  speaker: ['robin'],
  duration: 120,
  steps: 0,
  notes:
    `Input comparé à l'utilisateur, qui accepte des variations. ` +
    `Speed slider + live counter at bottom.`,
}

/* ── Palette ─────────────────────────────────────────────────── */

const AMBER   = '#BA7517'
const TEAL    = '#1D9E75'
const VIOLET  = '#7F77DD'
const RED     = tokens.color.semantic.critical
const GRN     = tokens.color.semantic.success
const TXT     = tokens.color.text.primary
const TXT2    = tokens.color.text.secondary
const TXT3    = tokens.color.text.tertiary
const SANS    = tokens.type.family.sans
const MONO    = tokens.type.family.mono
const SURF    = tokens.color.surface.line

/* ── Layout ──────────────────────────────────────────────────── */

const W  = 720
const H  = 520

// Pipeline Y zones
const PIPE_TOP    = 30       // top of feature dots
const PIPE_BOT    = 100      // bottom of feature dots before compressor
const COMP_TOP    = 115      // compressor box top
const COMP_BOT    = 290      // compressor box bottom (bigger funnel)
const SPACE_TOP   = 310      // signature space top
const SPACE_BOT   = 480      // signature space bottom
const SPACE_CY    = (SPACE_TOP + SPACE_BOT) / 2
const SPACE_CX    = W / 2
const SPACE_R     = 65       // smaller signature space

// Horizontal
const LEFT_X  = W * 0.25     // live pipeline center
const RIGHT_X = W * 0.75     // profile pipeline center

// Compressor layer Y positions (funnel: top=16 wide, middle=8, bottom=2 narrow)
const LAYER_DY = [0, 65, 130]  // 3 layers spaced for bigger funnel

/* ── Data ────────────────────────────────────────────────────── */

const PROFILE_16 = [0.45,0.38,0.52,0.41,0.55,0.33,0.48,0.60,0.42,0.35,0.50,0.58,0.40,0.46,0.52,0.37]
const THRESHOLD  = 0.25

function makeRng(seed: number) {
  let s = seed
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646 }
}

function genSample(rng: () => number, legit: boolean): number[] {
  return PROFILE_16.map(v => {
    if (legit) return Math.max(0.05, Math.min(0.95, v + (rng() - 0.5) * 0.10))
    return Math.max(0.05, Math.min(0.95, rng() * 0.7 + 0.15))
  })
}

function calcDist(a: number[], b: number[]): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2
  return Math.sqrt(s / a.length)
}

/** Deterministic 2D embedding from 16D */
function embed2D(vals: number[]): [number, number] {
  let x = 0, y = 0
  for (let i = 0; i < vals.length; i++) {
    x += vals[i] * Math.cos(i * 0.9 + 0.3)
    y += vals[i] * Math.sin(i * 0.9 + 0.3)
  }
  return [x / 4, y / 4]
}

const PROFILE_EMB = embed2D(PROFILE_16)

/** Map embedding to pixel coords in signature space */
function embToPixel(emb: [number, number]): [number, number] {
  const [px, py] = PROFILE_EMB
  const dx = emb[0] - px, dy = emb[1] - py
  const amp = 4.0  // amplify for visibility
  return [SPACE_CX + dx * amp * SPACE_R, SPACE_CY + dy * amp * SPACE_R]
}

const PROFILE_PX = embToPixel(PROFILE_EMB)

/* ── Sample lifecycle ────────────────────────────────────────── */

type SamplePhase =
  | 'enter'       // features appearing
  | 'compress'    // flowing through layers
  | 'project'     // signature appears in 2D
  | 'verdict'     // flash result
  | 'fade'        // fading out

interface Sample {
  id: number
  values: number[]
  legit: boolean
  dist: number
  emb: [number, number]
  px: [number, number]     // pixel position in signature space
  phase: SamplePhase
  phaseT: number           // ms timestamp of phase start
  layerLit: number         // 0=none, 1=input, 2=hidden, 3=output
}

/* ── Compressor visuals ──────────────────────────────────────── */

const LAYER_SIZES = [16, 8, 2]

/** Horizontal row of dots at a given Y — wider rows for more dots (funnel) */
function layerDotPositions(cx: number, y: number, size: number): { x: number; y: number }[] {
  const gap = Math.min(10, 120 / size)
  const totalW = (size - 1) * gap
  const startX = cx - totalW / 2
  return Array.from({ length: size }, (_, i) => ({
    x: startX + i * gap,
    y,
  }))
}

/** Entire static layer — separate SVG, never re-renders */
const StaticLayer = memo(function StaticLayer() {
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}
      style={{ overflow: 'visible', position: 'absolute', top: 0, left: 0 }}>
      <defs>
        <marker id="arr" markerWidth={6} markerHeight={4} refX={5} refY={2}
          orient="auto">
          <path d="M0,0 L6,2 L0,4" fill={TXT3} />
        </marker>
      </defs>

      {/* Pipeline labels */}
      <text x={LEFT_X} y={PIPE_TOP - 8} textAnchor="middle"
        fontSize={11} fontFamily={SANS} fill={AMBER} fontWeight={600}>
        Frappe en direct
      </text>
      <text x={RIGHT_X} y={PIPE_TOP - 8} textAnchor="middle"
        fontSize={11} fontFamily={SANS} fill={TEAL} fontWeight={600}>
        Profil enregistré
      </text>

      {/* Profile dots (right, always visible) */}
      {PROFILE_16.map((v, i) => {
        const [px] = linePos(i, RIGHT_X, 0)
        return (
          <g key={`p${i}`} transform={`translate(${px}, ${PIPE_TOP + 20})`}>
            <ShapePath shape={shapeForIndex(i)} r={valToR(v)}
              fill={TEAL} fillOpacity={0.75} />
          </g>
        )
      })}

      {/* Arrows into compressors */}
      <line x1={LEFT_X} y1={PIPE_BOT + 5} x2={LEFT_X} y2={COMP_TOP - 2}
        stroke={TXT3} strokeWidth={1} markerEnd="url(#arr)" />
      <line x1={RIGHT_X} y1={PIPE_BOT + 5} x2={RIGHT_X} y2={COMP_TOP - 2}
        stroke={TXT3} strokeWidth={1} markerEnd="url(#arr)" />

      {/* Funnel outlines */}
      <path
        d={`M${LEFT_X - 75},${COMP_TOP} L${LEFT_X + 75},${COMP_TOP} L${LEFT_X + 20},${COMP_BOT} L${LEFT_X - 20},${COMP_BOT} Z`}
        fill="none" stroke={VIOLET} strokeWidth={1.5} strokeDasharray="6 3" />
      <text x={LEFT_X} y={COMP_TOP - 6} textAnchor="middle"
        fontSize={10} fontFamily={SANS} fill={VIOLET} fontWeight={600}>
        Réseau A
      </text>
      <path
        d={`M${RIGHT_X - 75},${COMP_TOP} L${RIGHT_X + 75},${COMP_TOP} L${RIGHT_X + 20},${COMP_BOT} L${RIGHT_X - 20},${COMP_BOT} Z`}
        fill="none" stroke={VIOLET} strokeWidth={1.5} strokeDasharray="6 3" />
      <text x={RIGHT_X} y={COMP_TOP - 6} textAnchor="middle"
        fontSize={10} fontFamily={SANS} fill={VIOLET} fontWeight={600}>
        Réseau B
      </text>

      {/* Arrows from compressors to signature space */}
      <line x1={LEFT_X} y1={COMP_BOT + 16} x2={SPACE_CX - 20} y2={SPACE_TOP - 5}
        stroke={TXT3} strokeWidth={1} markerEnd="url(#arr)" />
      <line x1={RIGHT_X} y1={COMP_BOT + 16} x2={SPACE_CX + 20} y2={SPACE_TOP - 5}
        stroke={TXT3} strokeWidth={1} markerEnd="url(#arr)" />

      {/* Signature space */}
      <text x={SPACE_CX} y={SPACE_TOP - 10} textAnchor="middle"
        fontSize={11} fontFamily={SANS} fill={TXT2} fontWeight={600}>
        Espace de signature
      </text>
      <circle cx={SPACE_CX} cy={SPACE_CY} r={SPACE_R}
        fill="none" stroke={SURF} strokeWidth={0.8} />
      <line x1={SPACE_CX - SPACE_R} y1={SPACE_CY} x2={SPACE_CX + SPACE_R} y2={SPACE_CY}
        stroke={SURF} strokeWidth={0.4} />
      <line x1={SPACE_CX} y1={SPACE_CY - SPACE_R} x2={SPACE_CX} y2={SPACE_CY + SPACE_R}
        stroke={SURF} strokeWidth={0.4} />

      {/* Rejection zone */}
      <circle cx={PROFILE_PX[0]} cy={PROFILE_PX[1]} r={SPACE_R}
        fill={`${RED}04`} stroke="none" />
      <text x={PROFILE_PX[0] + SPACE_R - 8} y={PROFILE_PX[1] - SPACE_R + 14}
        textAnchor="end" fontSize={7} fontFamily={MONO} fill={RED} opacity={0.6}>
        zone de rejet
      </text>

      {/* Acceptance zone */}
      <circle cx={PROFILE_PX[0]} cy={PROFILE_PX[1]}
        r={THRESHOLD * SPACE_R * 4}
        fill={`${GRN}06`} stroke={TEAL} strokeWidth={1.5} strokeDasharray="5 3" />
      <text x={PROFILE_PX[0]} y={PROFILE_PX[1] - THRESHOLD * SPACE_R * 4 - 6}
        textAnchor="middle" fontSize={7} fontFamily={MONO} fill={TEAL} fontWeight={600}>
        zone d'acceptation
      </text>

      {/* Profile point */}
      <circle cx={PROFILE_PX[0]} cy={PROFILE_PX[1]} r={7}
        fill={TEAL} fillOpacity={0.8} />
      <circle cx={PROFILE_PX[0]} cy={PROFILE_PX[1]} r={2.5}
        fill="white" />
      <text x={PROFILE_PX[0]} y={PROFILE_PX[1] + 18} textAnchor="middle"
        fontSize={8} fontFamily={SANS} fill={TEAL} fontWeight={600}>
        profil
      </text>
    </svg>
  )
})

/** Animated neuron layers inside the funnel */
function CompressorLayers({
  cx, litLayer, sampleLegit,
}: {
  cx: number; litLayer: number; sampleLegit?: boolean
}) {
  // Left funnel: use green/red for dots based on sample legit status
  const activeColor = sampleLegit === undefined ? VIOLET
    : (sampleLegit ? GRN : RED)
  const dimColor = sampleLegit === undefined ? `${VIOLET}30`
    : (sampleLegit ? `${GRN}30` : `${RED}30`)

  return (
    <g>
      {/* Layers — horizontal rows stacked vertically */}
      {LAYER_SIZES.map((size, li) => {
        const ly = COMP_TOP + 18 + LAYER_DY[li]
        const dots = layerDotPositions(cx, ly, size)
        const lit = litLayer > li
        const active = litLayer === li + 1
        return (
          <g key={li}>
            {dots.map((d, di) => (
              <motion.circle key={di} cx={d.x} cy={d.y}
                r={active ? 4 : 3}
                fill={lit || active ? activeColor : dimColor}
                animate={{
                  fillOpacity: active ? [0.4, 1, 0.4] : (lit ? 0.7 : 0.15),
                  r: active ? [3, 5, 3] : 3,
                }}
                transition={active ? {
                  duration: 0.6,
                  repeat: 0,
                  delay: di * 0.02,
                } : { duration: 0.3 }}
              />
            ))}
            {/* Layer count */}
            <text x={cx + (size === 16 ? 80 : size === 8 ? 50 : 22)} y={ly + 4}
              fontSize={7} fontFamily={MONO} fill={TXT3}>
              {size}
            </text>
          </g>
        )
      })}

      {/* Connections between layers (subtle) */}
      {[0, 1].map(li => {
        const fromY = COMP_TOP + 18 + LAYER_DY[li]
        const toY = COMP_TOP + 18 + LAYER_DY[li + 1]
        const fromDots = layerDotPositions(cx, fromY, LAYER_SIZES[li])
        const toDots = layerDotPositions(cx, toY, LAYER_SIZES[li + 1])
        const lit = litLayer > li + 1
        return fromDots.filter((_, i) => i % Math.max(1, Math.floor(LAYER_SIZES[li] / 4)) === 0)
          .map((from, fi) => toDots.map((to, ti) => (
            <line key={`c${li}-${fi}-${ti}`}
              x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke={VIOLET} strokeWidth={0.5}
              opacity={lit ? 0.25 : 0.06} />
          )))
      })}
    </g>
  )
}

/* ── Feature shapes ──────────────────────────────────────────── */

/** Map feature value to shape radius (4–9px) */
function valToR(v: number): number {
  return 4 + v * 5
}

/** 5 shapes cycling across the 16 features */
type Shape = 'circle' | 'square' | 'diamond' | 'triangle' | 'star'
const SHAPES: Shape[] = ['circle', 'square', 'diamond', 'triangle', 'star']
function shapeForIndex(i: number): Shape { return SHAPES[i % SHAPES.length] }

/** Render a shape centered at (0,0) — caller wraps in <g transform> */
function ShapePath({ shape, r, fill, fillOpacity, stroke, strokeWidth }: {
  shape: Shape; r: number; fill: string; fillOpacity: number
  stroke?: string; strokeWidth?: number
}) {
  const s = stroke ?? 'none'
  const sw = strokeWidth ?? 0
  switch (shape) {
    case 'circle':
      return <circle cx={0} cy={0} r={r} fill={fill} fillOpacity={fillOpacity} stroke={s} strokeWidth={sw} />
    case 'square':
      return <rect x={-r} y={-r} width={r * 2} height={r * 2} fill={fill} fillOpacity={fillOpacity} stroke={s} strokeWidth={sw} />
    case 'diamond':
      return <polygon points={`0,${-r} ${r},0 0,${r} ${-r},0`} fill={fill} fillOpacity={fillOpacity} stroke={s} strokeWidth={sw} />
    case 'triangle':
      return <polygon points={`0,${-r} ${r * 0.87},${r * 0.5} ${-r * 0.87},${r * 0.5}`} fill={fill} fillOpacity={fillOpacity} stroke={s} strokeWidth={sw} />
    case 'star': {
      const pts: string[] = []
      for (let k = 0; k < 5; k++) {
        const a1 = (k * 72 - 90) * Math.PI / 180
        const a2 = ((k * 72 + 36) - 90) * Math.PI / 180
        pts.push(`${Math.cos(a1) * r},${Math.sin(a1) * r}`)
        pts.push(`${Math.cos(a2) * r * 0.45},${Math.sin(a2) * r * 0.45}`)
      }
      return <polygon points={pts.join(' ')} fill={fill} fillOpacity={fillOpacity} stroke={s} strokeWidth={sw} />
    }
  }
}

/* ── Feature dots entering pipeline ──────────────────────────── */

/** Line position for feature i (row of 16) */
function linePos(i: number, cx: number, y: number): [number, number] {
  const gap = 14
  const totalW = 15 * gap
  return [cx - totalW / 2 + i * gap, y]
}

/** Per-feature match threshold */
const FEAT_MATCH = 0.12

function FeatureDots({
  cx, values, color, visible, descending, profile, sampleId,
}: {
  cx: number; values: number[]; color: string; visible: boolean; descending: boolean
  profile?: number[]; sampleId?: number
}) {
  const startY = PIPE_TOP + 20

  return (
    <AnimatePresence mode="wait">
      {visible && (
        <motion.g key={sampleId ?? 'idle'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {values.map((v, i) => {
            const r = valToR(v)
            const shape = shapeForIndex(i)
            const dotColor = profile
              ? (Math.abs(v - profile[i]) < FEAT_MATCH ? GRN : RED)
              : color
            const [lineX] = linePos(i, cx, 0)
            // Aspiration: converge horizontally toward cx and descend into funnel
            const targetX = descending ? cx + (lineX - cx) * 0.15 : lineX
            const targetY = descending ? COMP_TOP + 8 : startY
            const targetScale = descending ? 0.3 : 1
            const targetOpacity = descending ? 0 : 1
            return (
              <motion.g key={i}
                initial={{ translateX: lineX, translateY: startY, scale: 1, opacity: 0 }}
                animate={{
                  translateX: targetX,
                  translateY: targetY,
                  scale: targetScale,
                  opacity: targetOpacity,
                }}
                transition={{
                  duration: descending ? 0.8 : 0.4,
                  delay: descending ? i * 0.01 : i * 0.02,
                  ease: descending ? [0.6, 0, 0.4, 1] : 'easeOut',
                }}
              >
                <ShapePath shape={shape} r={r} fill={dotColor} fillOpacity={0.85} />
              </motion.g>
            )
          })}
        </motion.g>
      )}
    </AnimatePresence>
  )
}

/* ── Signature in 2D space ───────────────────────────────────── */

function SignaturePoint({
  sample, profilePx,
}: {
  sample: Sample; profilePx: [number, number]
}) {
  const ok = sample.legit
  const [tx, ty] = ok
    // Legit: move toward profile (partial overlap, not full merge)
    ? [profilePx[0] + (sample.px[0] - profilePx[0]) * 0.15,
       profilePx[1] + (sample.px[1] - profilePx[1]) * 0.15]
    : sample.px

  const isFading = sample.phase === 'fade'
  const isNew = sample.phase === 'project' || sample.phase === 'verdict'

  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: isFading ? 0 : 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: isFading ? 3.0 : 0.4 }}
    >
      {/* Conveying dot from funnel bottom to signature point */}
      <motion.circle
        r={4}
        fill={ok ? GRN : RED}
        fillOpacity={0.9}
        initial={{ cx: LEFT_X, cy: COMP_BOT + 10 }}
        animate={{ cx: tx, cy: ty }}
        transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
      />
      {/* Signature dot */}
      <motion.circle
        r={7}
        fill={ok ? GRN : RED}
        fillOpacity={0.7}
        initial={{ cx: tx, cy: ty, scale: 0 }}
        animate={{ cx: tx, cy: ty, scale: 1 }}
        transition={{ duration: 0.3, delay: 0.7 }}
      />
      {/* Distance line for impostors */}
      {!ok && (
        <motion.line
          x1={profilePx[0]} y1={profilePx[1]}
          stroke={RED} strokeWidth={1} strokeDasharray="4 3"
          initial={{ x2: profilePx[0], y2: profilePx[1] }}
          animate={{ x2: tx, y2: ty }}
          transition={{ duration: 0.8, delay: 0.3 }}
        />
      )}
      {/* Match pulse for legit */}
      {ok && isNew && (
        <motion.circle
          cx={tx} cy={ty} r={7}
          fill="none" stroke={TEAL} strokeWidth={1.5}
          initial={{ r: 7, opacity: 0.8 }}
          animate={{ r: 18, opacity: 0 }}
          transition={{ duration: 0.8 }}
        />
      )}
    </motion.g>
  )
}

/* ── Verdict flash ───────────────────────────────────────────── */

function Verdict({ ok, visible }: { ok: boolean; visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.g
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <rect x={SPACE_CX - 55} y={SPACE_BOT - 10} width={110} height={22}
            rx={4} fill={ok ? `${GRN}15` : `${RED}15`}
            stroke={ok ? GRN : RED} strokeWidth={1} />
          <text x={SPACE_CX} y={SPACE_BOT + 5} textAnchor="middle"
            fontSize={12} fontWeight={700} fontFamily={SANS}
            fill={ok ? GRN : RED}>
            {ok ? 'Accepte' : 'Refuse'}
          </text>
        </motion.g>
      )}
    </AnimatePresence>
  )
}

/* ── Main animation loop ─────────────────────────────────────── */

function useSimulation(active: boolean, speed: number) {
  const [samples, setSamples] = useState<Sample[]>([])
  const [accepted, setAccepted] = useState(0)
  const [rejected, setRejected] = useState(0)
  const nextId = useRef(0)
  const rng = useRef(makeRng(42))
  const timerRef = useRef<ReturnType<typeof setInterval>>()

  // Phase durations (ms, before speed multiplier)
  // Chain: enter(1200) → compress(1000) → project(900) → verdict(1200) → fade(4000)
  // Total active = 4300ms, interval must be >= this
  const BASE_INTERVAL = 4500
  const ENTER_MS   = 1200
  const COMPRESS_MS = 1000
  const PROJECT_MS  = 900
  const VERDICT_MS  = 1200
  const FADE_MS     = 4000

  const advancePhase = useCallback((s: Sample, now: number): Sample | null => {
    const elapsed = now - s.phaseT
    const dt = (ms: number) => ms / speed

    switch (s.phase) {
      case 'enter':
        if (elapsed > dt(ENTER_MS)) {
          return { ...s, phase: 'compress', phaseT: now, layerLit: 1 }
        }
        // Advance layer lighting within enter
        return s

      case 'compress': {
        const perLayer = dt(COMPRESS_MS / 3)
        const newLayer = Math.min(3, Math.floor(elapsed / perLayer) + 1)
        if (elapsed > dt(COMPRESS_MS)) {
          return { ...s, phase: 'project', phaseT: now, layerLit: 3 }
        }
        if (newLayer !== s.layerLit) return { ...s, layerLit: newLayer }
        return s
      }

      case 'project':
        if (elapsed > dt(PROJECT_MS)) {
          if (s.legit) setAccepted(a => a + 1)
          else setRejected(r => r + 1)
          return { ...s, phase: 'verdict', phaseT: now, layerLit: 0 }
        }
        return s

      case 'verdict':
        if (elapsed > dt(VERDICT_MS)) {
          return { ...s, phase: 'fade', phaseT: now }
        }
        return s

      case 'fade':
        if (elapsed > dt(FADE_MS)) return null  // remove
        return s
    }
  }, [speed])

  // Main tick
  useEffect(() => {
    if (!active) return
    const tick = () => {
      const now = Date.now()
      setSamples(prev => {
        const updated: Sample[] = []
        for (const s of prev) {
          const next = advancePhase(s, now)
          if (next) updated.push(next)
        }
        return updated
      })
    }
    const id = setInterval(tick, 60)
    return () => clearInterval(id)
  }, [active, advancePhase])

  // Spawn new samples
  useEffect(() => {
    if (!active) return
    const spawn = () => {
      const legit = rng.current() < 0.75
      const vals = genSample(rng.current, legit)
      const emb = embed2D(vals)
      const px = embToPixel(emb)
      const dist = calcDist(vals, PROFILE_16)
      const sample: Sample = {
        id: nextId.current++,
        values: vals,
        legit,
        dist,
        emb,
        px,
        phase: 'enter',
        phaseT: Date.now(),
        layerLit: 0,
      }
      setSamples(prev => [...prev, sample])
    }
    // First sample immediately
    spawn()
    timerRef.current = setInterval(spawn, BASE_INTERVAL / speed)
    return () => clearInterval(timerRef.current)
  }, [active, speed])

  // Reset on deactivate
  useEffect(() => {
    if (!active) {
      setSamples([])
      setAccepted(0)
      setRejected(0)
      nextId.current = 0
      rng.current = makeRng(42)
    }
  }, [active])

  return { samples, accepted, rejected }
}

/* ── Component ───────────────────────────────────────────────── */

export function Component({ step }: SlideContext) {
  const [speed] = useState(1)
  const { samples, accepted, rejected } = useSimulation(true, 1)

  // Current active sample (most recent non-fade)
  const activeSample = [...samples].reverse().find((s: Sample) => s.phase !== 'fade') ?? null
  const litLayerLeft = activeSample
    ? (['compress'].includes(activeSample.phase) ? activeSample.layerLit : 0)
    : 0

  // Verdict
  const verdictSample = [...samples].reverse().find((s: Sample) => s.phase === 'verdict')
  const verdictOk = verdictSample ? verdictSample.legit : true

  // Projected signatures (project, verdict, fade phases)
  const projected = samples.filter(s =>
    s.phase === 'project' || s.phase === 'verdict' || s.phase === 'fade'
  )

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', width: '100%', maxWidth: 960, height: '100%', gap: 10,
      paddingTop: 80,
    }}>
      <PipelineBar active={2} />
      <Eyebrow color={VIOLET}>Deep Learning · Réseau Siamois (SNN)</Eyebrow>

      <motion.h2
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          fontSize: tokens.type.size.xl, fontWeight: tokens.type.weight.semibold,
          letterSpacing: tokens.type.tracking.tight,
          color: TXT, margin: 0, textAlign: 'center',
        }}
      >
        Deux réseaux jumeaux, une décision
      </motion.h2>

      <motion.p style={{
        fontSize: tokens.type.size.sm, color: TXT2,
        fontFamily: MONO, margin: 0, textAlign: 'center', maxWidth: 650,
      }}>
        Votre frappe est résumée en une signature unique — la ressemblance décide.
      </motion.p>

      {/* ── Static SVG layer (never re-renders) ──────────── */}
      <div style={{ position: 'relative', width: W, height: H }}>
        <StaticLayer />

        {/* ── Animated SVG layer ─────────────────────────────── */}
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}
          style={{ overflow: 'visible', position: 'absolute', top: 0, left: 0 }}>

          {/* ── Feature dots — live (left) ──────────────────────── */}
          <FeatureDots
            cx={LEFT_X}
            values={activeSample?.values ?? PROFILE_16}
            color={AMBER}
            visible={activeSample != null && (activeSample.phase === 'enter' || activeSample.phase === 'compress')}
            descending={activeSample?.phase === 'compress'}
            profile={PROFILE_16}
            sampleId={activeSample?.id}
          />

          {/* ── Compressor neuron layers (animated) ────────────── */}
          <CompressorLayers cx={LEFT_X} litLayer={litLayerLeft}
            sampleLegit={activeSample?.legit} />
          <CompressorLayers cx={RIGHT_X} litLayer={3} />
          {/* Projected sample signatures */}
          <AnimatePresence>
            {projected.map(s => (
              <SignaturePoint key={s.id} sample={s} profilePx={PROFILE_PX} />
            ))}
          </AnimatePresence>

          {/* Verdict */}
          <Verdict ok={verdictOk} visible={verdictSample != null} />
        </svg>
      </div>

      {/* ── Controls ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 24,
        fontFamily: MONO, fontSize: 12, color: TXT2,
      }}>

        <span style={{ color: GRN, fontWeight: 700 }}>Acceptés : {accepted}</span>
        <span style={{ color: RED, fontWeight: 700 }}>Refusés : {rejected}</span>
      </div>
    </div>
  )
}
