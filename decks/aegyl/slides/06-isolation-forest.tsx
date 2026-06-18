import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { SlideContext, SlideMeta } from '@engine/types'
import { tokens } from '@design/tokens'
import { Eyebrow } from '@ui/Eyebrow'
import { PipelineBar, STAGES } from './_pipeline'

export const meta: SlideMeta = {
  speaker: ['thomas'],
  duration: 120,
  steps: 3,
  notes:
    'Step 0 = scatter. Step 1 = coupes + scores inline. Step 2 = streaming live. Step 3 = 16 mini-charts.',
}

const CLR = STAGES[1].color
const BLU = tokens.color.accent.zscore
const RED = tokens.color.semantic.critical

/* ── Fixed point set ─────────────────────────────────────────── */

const POINTS = [
  /* Legit cluster (12 points, dense) */
  { x: 0.42, y: 0.38, legit: true },
  { x: 0.48, y: 0.44, legit: true },
  { x: 0.44, y: 0.50, legit: true },
  { x: 0.51, y: 0.36, legit: true },
  { x: 0.38, y: 0.46, legit: true },
  { x: 0.53, y: 0.52, legit: true },
  { x: 0.46, y: 0.56, legit: true },
  { x: 0.40, y: 0.42, legit: true },
  { x: 0.56, y: 0.47, legit: true },
  { x: 0.39, y: 0.53, legit: true },
  { x: 0.50, y: 0.60, legit: true },
  { x: 0.43, y: 0.34, legit: true },
  /* Outliers */
  { x: 0.87, y: 0.16, legit: false },   // 12 — bottom-right
  { x: 0.12, y: 0.84, legit: false },   // 13 — top-left
]

/* ── Recursive cuts (tree traversal order) ───────────────────── */

interface Cut { axis: 'x' | 'y'; pos: number; min: number; max: number }

const CUTS: Cut[] = [
  { axis: 'x', pos: 0.72, min: 0, max: 1 },         // 1 — vertical split
  { axis: 'y', pos: 0.26, min: 0.72, max: 1 },      // 2 → isolates atk1 (depth 2)
  { axis: 'y', pos: 0.68, min: 0, max: 0.72 },      // 3 — horizontal split
  { axis: 'x', pos: 0.22, min: 0.68, max: 1 },      // 4 → isolates atk2 (depth 3)
  { axis: 'x', pos: 0.47, min: 0, max: 0.68 },      // 5 — cluster splits
  { axis: 'y', pos: 0.43, min: 0, max: 0.47 },      // 6
  { axis: 'y', pos: 0.51, min: 0.47, max: 0.72 },   // 7
  { axis: 'x', pos: 0.38, min: 0.43, max: 0.68 },   // 8
  { axis: 'x', pos: 0.55, min: 0.51, max: 0.68 },   // 9
]

const ISOLATIONS = [
  { ptIdx: 12, cutNum: 2, depth: 2, dx: 0, dy: 24 },   // label below atk1
  { ptIdx: 13, cutNum: 4, depth: 3, dx: 22, dy: 4 },   // label right of atk2
]

const CUT_MS = 600

/* ── Chart geometry ──────────────────────────────────────────── */

const W = 520, H = 380
const PL = 44, PR = 20, PT = 24, PB = 36
const PW = W - PL - PR, PH = H - PT - PB
const px = (v: number) => PL + v * PW
const py = (v: number) => PT + (1 - v) * PH

function cutCoords(c: Cut, pxFn: (v: number) => number = px, pyFn: (v: number) => number = py) {
  return c.axis === 'x'
    ? { x1: pxFn(c.pos), y1: pyFn(c.min), x2: pxFn(c.pos), y2: pyFn(c.max) }
    : { x1: pxFn(c.min), y1: pyFn(c.pos), x2: pxFn(c.max), y2: pyFn(c.pos) }
}

/* ── Cut animation hook ──────────────────────────────────────── */

function useCutSequence(active: boolean) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!active) { setCount(0); return }
    const id = setInterval(() => {
      setCount(prev => (prev < CUTS.length ? prev + 1 : prev))
    }, CUT_MS)
    return () => clearInterval(id)
  }, [active])
  return count
}

/* ── Streaming points hook ───────────────────────────────────── */

interface StreamPoint { id: number; x: number; y: number; legit: boolean }

function useStreamingPoints(
  active: boolean, cx: number, cy: number,
  maxPts: number = 20, intervalMs: number = 500,
  spread: number = 0.11, atkZones?: [number, number][],
) {
  const [points, setPoints] = useState<StreamPoint[]>([])
  const nextId = useRef(0)

  useEffect(() => {
    if (!active) { setPoints([]); nextId.current = 0; return }
    const zones = atkZones ?? [[0.88, 0.12], [0.12, 0.88]]
    const id = setInterval(() => {
      setPoints(prev => {
        const legit = Math.random() > 0.25
        let pt: StreamPoint
        if (legit) {
          pt = {
            id: nextId.current++,
            x: cx + (Math.random() - 0.5) * spread * 2,
            y: cy + (Math.random() - 0.5) * spread * 2,
            legit: true,
          }
        } else {
          const zone = zones[Math.floor(Math.random() * zones.length)]
          pt = {
            id: nextId.current++,
            x: zone[0] + (Math.random() - 0.5) * 0.12,
            y: zone[1] + (Math.random() - 0.5) * 0.12,
            legit: false,
          }
        }
        const next = [...prev, pt]
        return next.length > maxPts ? next.slice(next.length - maxPts) : next
      })
    }, intervalMs)
    return () => clearInterval(id)
  }, [active, cx, cy, maxPts, intervalMs, spread, atkZones])

  return points
}

/* ── 16-feature mini-charts ──────────────────────────────────── */

const FEAT_LABELS = [
  'appui moy', 'appui var', 'appui bas', 'appui haut',
  'saut moy',  'saut var',  'saut bas',  'saut haut',
  'visée moy', 'visée var', 'visée bas', 'visée haut',
  'régul. appui', 'régul. saut', 'régul. visée', 'asymétrie',
]

const FEAT_CLRS = [
  ...Array<string>(4).fill(tokens.color.accent.aegyl),
  ...Array<string>(4).fill(tokens.color.accent.iforest),
  ...Array<string>(4).fill(tokens.color.accent.snn),
  tokens.color.accent.sketch, tokens.color.accent.sketch,
  tokens.color.accent.sketch, tokens.color.accent.zscore,
]

/* Per-feature chart config: varied cluster positions, spreads, and impostor zones */
interface MiniConfig {
  cx: number; cy: number
  spread: number           // cluster radius
  atkZones: [number, number][]  // impostor spawn corners [x, y]
}

const MINI_CFG: MiniConfig[] = [
  { cx: 0.35, cy: 0.60, spread: 0.14, atkZones: [[0.88, 0.12], [0.90, 0.85]] },
  { cx: 0.62, cy: 0.35, spread: 0.10, atkZones: [[0.08, 0.88]] },
  { cx: 0.28, cy: 0.40, spread: 0.16, atkZones: [[0.85, 0.82], [0.80, 0.12]] },
  { cx: 0.55, cy: 0.65, spread: 0.12, atkZones: [[0.10, 0.10]] },
  { cx: 0.70, cy: 0.50, spread: 0.11, atkZones: [[0.10, 0.85], [0.12, 0.15]] },
  { cx: 0.40, cy: 0.30, spread: 0.15, atkZones: [[0.88, 0.80]] },
  { cx: 0.50, cy: 0.72, spread: 0.10, atkZones: [[0.85, 0.10], [0.10, 0.12]] },
  { cx: 0.25, cy: 0.55, spread: 0.18, atkZones: [[0.90, 0.15]] },
  { cx: 0.60, cy: 0.42, spread: 0.13, atkZones: [[0.08, 0.90], [0.88, 0.88]] },
  { cx: 0.45, cy: 0.25, spread: 0.11, atkZones: [[0.10, 0.85]] },
  { cx: 0.72, cy: 0.62, spread: 0.09, atkZones: [[0.08, 0.10], [0.12, 0.85]] },
  { cx: 0.32, cy: 0.68, spread: 0.14, atkZones: [[0.88, 0.08]] },
  { cx: 0.58, cy: 0.28, spread: 0.12, atkZones: [[0.08, 0.88], [0.85, 0.80]] },
  { cx: 0.42, cy: 0.52, spread: 0.16, atkZones: [[0.90, 0.12]] },
  { cx: 0.65, cy: 0.75, spread: 0.10, atkZones: [[0.10, 0.08]] },
  { cx: 0.30, cy: 0.35, spread: 0.13, atkZones: [[0.88, 0.88], [0.85, 0.10]] },
]

/* Seeded PRNG for deterministic per-chart cuts */
function seededRand(seed: number) {
  let s = seed
  return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646 }
}

/**
 * Generate 5 full-span axis-aligned cuts. Each line crosses the entire chart
 * (min=0, max=1) so no segment stops mid-air in a small SVG.
 * Seeded offsets shift positions per feature for visual variety.
 */
function generateMiniCuts(cfg: MiniConfig, seed: number): Cut[] {
  const rand = seededRand(seed)
  const cl = (v: number) => Math.max(0.06, Math.min(0.94, v))
  const { cx, cy, spread } = cfg
  const r = spread + 0.06
  const o1 = (rand() - 0.5) * 0.04
  const o2 = (rand() - 0.5) * 0.04

  return [
    // 1) vertical right — isolates right outliers
    { axis: 'x', pos: cl(cx + r + o1), min: 0, max: 1 },
    // 2) horizontal bottom — isolates bottom outliers
    { axis: 'y', pos: cl(cy - r - o2), min: 0, max: 1 },
    // 3) horizontal top — isolates top outliers
    { axis: 'y', pos: cl(cy + r + o2), min: 0, max: 1 },
    // 4) vertical left — closes the cluster box
    { axis: 'x', pos: cl(cx - r - o1), min: 0, max: 1 },
    // 5) bisect cluster
    { axis: 'x', pos: cl(cx + (rand() - 0.5) * spread * 0.5), min: 0, max: 1 },
  ]
}

const MW = 185, MH = 115
const ML = 4, MR = 4, MTM = 18, MMB = 4
const MPW = MW - ML - MR, MPH = MH - MTM - MMB

function MiniChart({ label, color, cfg, idx, active }: {
  label: string; color: string; cfg: MiniConfig; idx: number; active: boolean
}) {
  const cuts = useMemo(() => generateMiniCuts(cfg, (idx + 1) * 7919), [cfg, idx])
  const streamPts = useStreamingPoints(
    active, cfg.cx, cfg.cy, 20, 400 + (idx % 5) * 80,
    cfg.spread, cfg.atkZones,
  )

  const mpx = (v: number) => ML + v * MPW
  const mpy = (v: number) => MTM + (1 - v) * MPH

  // Cluster zone bounds (in chart coords)
  const zx1 = mpx(Math.max(0.02, cfg.cx - cfg.spread))
  const zy1 = mpy(Math.min(0.98, cfg.cy + cfg.spread))
  const zx2 = mpx(Math.min(0.98, cfg.cx + cfg.spread))
  const zy2 = mpy(Math.max(0.02, cfg.cy - cfg.spread))

  return (
    <svg width={MW} height={MH} style={{ overflow: 'visible' }}>
      {/* Background */}
      <rect x={ML} y={MTM} width={MPW} height={MPH}
        fill={tokens.color.surface.subtle} stroke={tokens.color.surface.lineStrong}
        strokeWidth={1} rx={3} />
      {/* Cluster zone tint */}
      <rect x={zx1} y={zy1} width={zx2 - zx1} height={zy2 - zy1}
        rx={3} fill={BLU} fillOpacity={0.08} />
      <text x={MW / 2} y={12} textAnchor="middle" fontSize={9}
        fontFamily={tokens.type.family.mono} fontWeight={600} fill={color}>
        {label}
      </text>
      {cuts.map((cut, i) => {
        const coords = cutCoords(cut, mpx, mpy)
        return (
          <line key={`c${i}`}
            x1={coords.x1} y1={coords.y1} x2={coords.x2} y2={coords.y2}
            stroke={CLR} strokeWidth={i >= 3 ? 2 : 1.2}
            strokeDasharray={i >= 3 ? '3 2' : '5 3'} strokeOpacity={i >= 3 ? 0.7 : 0.5}
          />
        )
      })}
      <AnimatePresence>
        {streamPts.map(pt => (
          <motion.circle
            key={pt.id}
            cx={mpx(pt.x)} cy={mpy(pt.y)}
            fill={pt.legit ? BLU : RED}
            initial={{ r: 0, opacity: 0 }}
            animate={{ r: pt.legit ? 3.5 : 4, opacity: pt.legit ? 0.8 : 1 }}
            exit={{ r: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
          />
        ))}
      </AnimatePresence>
    </svg>
  )
}

/* ── Component ───────────────────────────────────────────────── */

export function Component({ step }: SlideContext) {
  const showCuts = step >= 1
  const showStreaming = step >= 2
  const show16 = step >= 3
  const cuts = useCutSequence(showCuts)
  const streamPts = useStreamingPoints(showStreaming && !show16, 0.46, 0.47, 20, 500)
  const showMainChart = !show16

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', width: '100%', maxWidth: 960, height: '100%', gap: 10,
      paddingTop: 80,
    }}>
      <PipelineBar active={1} />

      <Eyebrow color={CLR}>Machine Learning · Isolation Forest</Eyebrow>

      <AnimatePresence mode="wait">
        <motion.h2
          key={show16 ? '16' : showStreaming ? 'stream' : showCuts ? 'c' : 'i0'}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.3 }}
          style={{
            fontSize: tokens.type.size.xl, fontWeight: tokens.type.weight.semibold,
            letterSpacing: tokens.type.tracking.tight,
            color: tokens.color.text.primary, margin: 0, textAlign: 'center',
          }}
        >
          {show16
            ? 'Répliqué sur les 16 mesures'
            : showStreaming
              ? 'Les légitimes restent groupés, les imposteurs sont isolés'
              : showCuts
                ? 'Peu de coupes = anomalie · beaucoup = légitime'
                : "L'algorithme partitionne l'espace par coupes aléatoires"}
        </motion.h2>
      </AnimatePresence>

      <motion.p style={{
        fontSize: tokens.type.size.sm, color: tokens.color.text.secondary,
        fontFamily: tokens.type.family.mono, margin: 0, textAlign: 'center', maxWidth: 620,
      }}>
        {!showCuts && 'Le modèle découpe l\'espace au hasard, encore et encore, pour isoler chaque point'}
        {showCuts && !showStreaming && 'Un imposteur atypique est isolé en quelques coupes ; vous, non.'}
        {showStreaming && !show16 && 'Chaque nouveau point tombe dans sa zone — le modèle classe en temps réel'}
        {show16 && 'Chaque mesure a son propre détecteur — l\'imposteur ressort partout'}
      </motion.p>

      {/* ── Main chart (steps 0–2) ─────────────────────────────── */}
      {showMainChart && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <svg width={W} height={H} style={{ overflow: 'visible' }}>
            {/* Axes */}
            <line x1={PL} y1={PT} x2={PL} y2={PT + PH} stroke={tokens.color.surface.line} strokeWidth={1} />
            <line x1={PL} y1={PT + PH} x2={PL + PW} y2={PT + PH} stroke={tokens.color.surface.line} strokeWidth={1} />
            <text x={PL + PW / 2} y={H - 4} textAnchor="middle" fontSize={10}
              fontFamily={tokens.type.family.mono} fill={tokens.color.text.tertiary}>
              caractéristique 1
            </text>
            <text x={12} y={PT + PH / 2} textAnchor="middle" fontSize={10}
              fontFamily={tokens.type.family.mono} fill={tokens.color.text.tertiary}
              transform={`rotate(-90, 12, ${PT + PH / 2})`}>
              caractéristique 2
            </text>

            {/* Legit zone highlight (step 2) */}
            {showStreaming && (
              <motion.rect
                x={px(0.34)} y={py(0.64)}
                width={px(0.60) - px(0.34)} height={py(0.30) - py(0.64)}
                rx={6}
                fill={BLU} fillOpacity={0.07}
                stroke={BLU} strokeWidth={1.5} strokeOpacity={0.25}
                strokeDasharray="6 4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              />
            )}

            {/* Cut lines */}
            {CUTS.slice(0, cuts).map((cut, i) => {
              const { x1, y1, x2, y2 } = cutCoords(cut)
              const sx = cut.axis === 'y' ? x1 : x2
              const sy = cut.axis === 'x' ? y1 : y2
              return (
                <motion.line
                  key={`cut-${i}`}
                  x1={x1} y1={y1}
                  initial={{ x2: sx, y2: sy }}
                  animate={{ x2, y2 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  stroke={CLR} strokeWidth={i >= 4 ? 2.5 : 1.5}
                  strokeDasharray={i >= 4 ? '4 2' : '6 3'}
                  strokeOpacity={i >= 4 ? 0.7 : 0.5}
                />
              )
            })}

            {/* Static points */}
            {POINTS.map((p, i) => {
              const iso = ISOLATIONS.find(a => a.ptIdx === i)
              const isolated = iso != null && cuts >= iso.cutNum
              return (
                <g key={`pt-${i}`}>
                  <motion.circle
                    cx={px(p.x)} cy={py(p.y)}
                    fill={p.legit ? BLU : RED}
                    initial={{ r: 0, opacity: 0 }}
                    animate={{ r: p.legit ? 5 : 6, opacity: p.legit ? 0.75 : 0.9 }}
                    transition={{ delay: i * 0.04, duration: 0.3 }}
                  />
                  {isolated && !showStreaming && (
                    <>
                      <motion.circle
                        cx={px(p.x)} cy={py(p.y)}
                        fill="none" stroke={RED} strokeWidth={2}
                        initial={{ r: 0, opacity: 0 }}
                        animate={{ r: [0, 16, 14], opacity: [0, 0.9, 0.6] }}
                        transition={{ duration: 0.6 }}
                      />
                      <motion.text
                        x={px(p.x) + iso.dx} y={py(p.y) + iso.dy}
                        fontSize={11} fontWeight={700} fontFamily={tokens.type.family.mono}
                        fill={RED} textAnchor={iso.dx === 0 ? 'middle' : 'start'}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                      >
                        {`${iso.depth} coupes → score 0.87 → ✗`}
                      </motion.text>
                    </>
                  )}
                </g>
              )
            })}

            {/* Streaming points (step 2) */}
            <AnimatePresence>
              {streamPts.map(pt => (
                <motion.circle
                  key={`stream-${pt.id}`}
                  cx={px(pt.x)} cy={py(pt.y)}
                  fill={pt.legit ? BLU : RED}
                  initial={{ r: 0, opacity: 0 }}
                  animate={{ r: pt.legit ? 5 : 6, opacity: pt.legit ? 0.6 : 0.85 }}
                  exit={{ r: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                />
              ))}
            </AnimatePresence>

            {/* Cluster annotation (step 1 only) */}
            {cuts >= CUTS.length && !showStreaming && (
              <motion.text
                x={px(0.46)} y={py(0.25)}
                fontSize={11} fontWeight={600} fontFamily={tokens.type.family.mono}
                fill={BLU} textAnchor="middle"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                {'9 coupes pour vous isoler → légitime ✓'}
              </motion.text>
            )}
          </svg>
        </div>
      )}

      {/* ── 16 mini-charts (step 3+) ──────────────────────────── */}
      {show16 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 6,
            width: '100%', maxWidth: 780,
          }}
        >
          {FEAT_LABELS.map((label, i) => (
            <MiniChart
              key={label}
              label={label}
              color={FEAT_CLRS[i]}
              cfg={MINI_CFG[i]}
              idx={i}
              active={show16}
            />
          ))}
        </motion.div>
      )}

      {/* Legend */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        style={{ display: 'flex', gap: 20, fontFamily: tokens.type.family.mono, fontSize: 11 }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, background: BLU, borderRadius: '50%', display: 'inline-block' }} />
          <span style={{ color: BLU }}>Vos sessions</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, background: RED, borderRadius: '50%', display: 'inline-block' }} />
          <span style={{ color: RED }}>Imposteur</span>
        </span>
        {showCuts && (
          <motion.span
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span style={{
              width: 16, height: 0, borderTop: `1.5px dashed ${CLR}`,
              display: 'inline-block', opacity: 0.5,
            }} />
            <span style={{ color: CLR }}>Coupes</span>
          </motion.span>
        )}
      </motion.div>
    </div>
  )
}


