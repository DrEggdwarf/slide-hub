import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { SlideContext, SlideMeta } from '@engine/types'
import { tokens } from '@design/tokens'
import { Eyebrow } from '@ui/Eyebrow'
import { PipelineBar } from './_pipeline'

export const meta: SlideMeta = {
  speaker: ['illias'],
  duration: 105,
  steps: 1,
  notes:
    `Le 1 er filtre n'est pas de machine learning mais juste de l'analyse statistique par rapport a un ecart type connu.  Attaque par replay peut passer ce filtre. Ne pas dire jamais` ,
}

const AEGYL = tokens.color.accent.aegyl
const BLU = tokens.color.accent.zscore
const RED = tokens.color.semantic.critical

/* ── Reference profile (μ per key position, 16 features) ───── */

const REF = [82, 78, 91, 85, 73, 88, 95, 80, 76, 84, 90, 87, 79, 83, 86, 92]
const SIGMA = 8
const N = REF.length

/* ── Typing phrase + keyboard ────────────────────────────────── */

const PHRASE = 'portez ce vieux whisky'
const TICK_MS = 200

const KB = [
  ['a', 'z', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['q', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm'],
  ['w', 'x', 'c', 'v', 'b', 'n'],
]
const KB_PAD = [0, 0, 70]

/* ── RNG ─────────────────────────────────────────────────────── */

function makeRng(seed: number) {
  let s = seed
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646 }
}

/* ── Chart ───────────────────────────────────────────────────── */

const W = 620, H = 240
const PL = 44, PR = 20, PT = 20, PB = 32
const PW = W - PL - PR, PH = H - PT - PB
const Y_MIN = 40, Y_MAX = 140

const sx = (i: number) => PL + (i / (N - 1)) * PW
const sy = (v: number) => PT + ((Y_MAX - v) / (Y_MAX - Y_MIN)) * PH

/* ── Band path (static) ──────────────────────────────────────── */

const bandPath = (() => {
  const top = REF.map((v, i) => `${i === 0 ? 'M' : 'L'}${sx(i)},${sy(v + SIGMA)}`).join(' ')
  const bot = [...REF].reverse().map((v, i) => `L${sx(N - 1 - i)},${sy(REF[N - 1 - i] - SIGMA)}`).join(' ')
  return `${top} ${bot} Z`
})()

/* ── Build SVG path ──────────────────────────────────────────── */

function buildPath(values: number[]): string {
  return values.map((v, i) => `${i === 0 ? 'M' : 'L'}${sx(i)},${sy(v)}`).join(' ')
}

/* ── Combined typing + curve hook ────────────────────────────── */

interface LiveState {
  legit: number[]
  atk: number[]
  charIdx: number       // current char in PHRASE (-1 = pause)
  activeKey: string     // key currently pressed ('' = none)
}

function useLiveTyping(active: boolean): LiveState {
  const [state, setState] = useState<LiveState>({
    legit: REF.slice(),
    atk: REF.map(v => v + 25),
    charIdx: -1,
    activeKey: '',
  })
  const rng = useRef(makeRng(77))
  const pos = useRef(0)
  const pausing = useRef(false)

  const genCurves = useCallback(() => {
    const r = rng.current
    const legit: number[] = []
    const atk: number[] = []

    for (let i = 0; i < N; i++) {
      const ref = REF[i]
      // Legit: 95% inside ±σ, 5% outside
      if (r() < 0.95) {
        legit.push(ref + (r() - 0.5) * SIGMA * 1.6)
      } else {
        const sign = r() > 0.5 ? 1 : -1
        legit.push(ref + sign * (SIGMA * 2 + r() * SIGMA * 1.5))
      }
      // Attacker: 95% outside ±σ, 5% inside
      if (r() < 0.95) {
        const sign = (i % 3 === 0) ? -1 : 1
        atk.push(ref + sign * (SIGMA * 2 + r() * SIGMA * 2))
      } else {
        atk.push(ref + (r() - 0.5) * SIGMA * 1.2)
      }
    }
    return { legit, atk }
  }, [])

  useEffect(() => {
    if (!active) {
      setState({ legit: REF.slice(), atk: REF.map(v => v + 25), charIdx: -1, activeKey: '' })
      rng.current = makeRng(77)
      pos.current = 0
      pausing.current = false
      return
    }

    const tick = () => {
      if (pausing.current) {
        // Brief pause between loops — keep curves but clear key
        pausing.current = false
        pos.current = 0
        setState(prev => ({ ...prev, charIdx: -1, activeKey: '' }))
        return
      }

      const idx = pos.current
      const char = idx < PHRASE.length ? PHRASE[idx] : ''
      const { legit, atk } = genCurves()

      if (idx >= PHRASE.length) {
        // End of phrase — pause one tick
        pausing.current = true
        setState({ legit, atk, charIdx: -1, activeKey: '' })
      } else {
        setState({ legit, atk, charIdx: idx, activeKey: char })
        pos.current++
      }
    }

    tick()
    const id = setInterval(tick, TICK_MS)
    return () => clearInterval(id)
  }, [active, genCurves])

  return state
}

/* ── Component ───────────────────────────────────────────────── */

export function Component({ step }: SlideContext) {
  const showLive = step >= 1
  const { legit, atk, activeKey } = useLiveTyping(showLive)

  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length
  const legitMeanZ = showLive ? mean(legit.map((v, i) => Math.abs(v - REF[i]) / SIGMA)) : 0
  const atkMeanZ = showLive ? mean(atk.map((v, i) => Math.abs(v - REF[i]) / SIGMA)) : 0

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', width: '100%', maxWidth: 1050, height: '100%', gap: 12,
      paddingTop: 80,
    }}>
      <PipelineBar active={0} />

      <Eyebrow color={AEGYL}>Normalisation · Z-Score</Eyebrow>

      <motion.h2
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
        style={{
          fontSize: tokens.type.size.xl, fontWeight: tokens.type.weight.semibold,
          letterSpacing: tokens.type.tracking.tight, color: tokens.color.text.primary, margin: 0, textAlign: 'center',
        }}
      >
        La fausse note saute aux yeux.
      </motion.h2>

      {/* sans → avec : la plus-value de l'étape */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', fontSize: 13, fontFamily: tokens.type.family.mono, flexWrap: 'wrap', justifyContent: 'center' }}>
        <span style={{ color: tokens.color.semantic.critical }}>✕ sans : des touches lentes, d'autres rapides — incomparables</span>
        <span style={{ color: tokens.color.text.muted }}>→</span>
        <span style={{ color: tokens.color.semantic.success }}>✓ avec : tout ramené à la même échelle</span>
      </div>

      {/* Chart + stats row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>

        {/* Chart */}
        <svg width={W} height={H} style={{ overflow: 'visible' }}>
          {/* Axes */}
          <line x1={PL} y1={PT} x2={PL} y2={PT + PH} stroke={tokens.color.surface.line} strokeWidth={1} />
          <line x1={PL} y1={PT + PH} x2={PL + PW} y2={PT + PH} stroke={tokens.color.surface.line} strokeWidth={1} />

          {/* Y axis labels */}
          {[60, 80, 100, 120].map(v => (
            <g key={v}>
              <line x1={PL - 3} y1={sy(v)} x2={PL} y2={sy(v)} stroke={tokens.color.surface.line} strokeWidth={1} />
              <text x={PL - 6} y={sy(v) + 3} textAnchor="end" fontSize={8} fontFamily={tokens.type.family.mono} fill={tokens.color.text.tertiary}>{v}</text>
            </g>
          ))}
          <text x={10} y={PT + PH / 2} textAnchor="middle" fontSize={9} fontFamily={tokens.type.family.mono} fill={tokens.color.text.tertiary} transform={`rotate(-90, 10, ${PT + PH / 2})`}>
            {"appui (ms)"}
          </text>

          {/* X axis labels */}
          {REF.map((_, i) => (
            <text key={i} x={sx(i)} y={PT + PH + 14} textAnchor="middle" fontSize={7} fontFamily={tokens.type.family.mono} fill={tokens.color.text.tertiary}>
              {`k${i + 1}`}
            </text>
          ))}

          {/* σ band (always visible — the ONLY reference) */}
          <path d={bandPath} fill={AEGYL} opacity={0.12} />

          {/* Band label — la zone "rythme habituel" */}
          <text
            x={sx(N - 1) + 6} y={sy(REF[N - 1] + SIGMA) + 1}
            fontSize={8} fontFamily={tokens.type.family.mono} fill={AEGYL} opacity={0.6}
          >{"rythme"}</text>
          <text
            x={sx(N - 1) + 6} y={sy(REF[N - 1] - SIGMA) + 1}
            fontSize={8} fontFamily={tokens.type.family.mono} fill={AEGYL} opacity={0.6}
          >{"habituel"}</text>

          {/* Live curves (only when active) */}
          {showLive && (
            <>
              {/* Legit line */}
              <motion.path
                d={buildPath(legit)} fill="none" stroke={BLU} strokeWidth={2} opacity={0.8}
                initial={false} animate={{ d: buildPath(legit) }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
              />
              {legit.map((v, i) => (
                <motion.circle
                  key={`l${i}`} cx={sx(i)} r={3.5} fill={BLU} opacity={0.85}
                  animate={{ cy: sy(v) }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                />
              ))}

              {/* Attacker line */}
              <motion.path
                d={buildPath(atk)} fill="none" stroke={RED} strokeWidth={2} opacity={0.7} strokeDasharray="5 3"
                initial={false} animate={{ d: buildPath(atk) }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
              />
              {atk.map((v, i) => (
                <motion.circle
                  key={`a${i}`} cx={sx(i)} r={3.5} fill={RED} opacity={0.85}
                  animate={{ cy: sy(v) }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                />
              ))}
            </>
          )}
        </svg>

      </div>

      {/* Keyboard below chart (always rendered, opacity toggle) */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center',
        opacity: showLive ? 1 : 0, transition: 'opacity 0.3s',
        pointerEvents: showLive ? 'auto' : 'none',
      }}>
          {KB.map((row, ri) => (
            <div key={ri} style={{ display: 'flex', gap: 3, paddingLeft: KB_PAD[ri] }}>
              {row.map(k => {
                const on = k === activeKey
                return (
                  <motion.div
                    key={k}
                    animate={{
                      scale: on ? 0.85 : 1,
                      background: on ? AEGYL : '#f5f5f5',
                      borderColor: on ? AEGYL : tokens.color.surface.line,
                    }}
                    transition={{ duration: 0.06 }}
                    style={{
                      width: 32, height: 32, borderRadius: 5,
                      border: '1.5px solid', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontFamily: tokens.type.family.mono,
                      fontWeight: 600,
                      color: on ? '#fff' : tokens.color.text.tertiary,
                    }}
                  >
                    {k}
                  </motion.div>
                )
              })}
            </div>
          ))}
          <motion.div
            animate={{
              scale: activeKey === ' ' ? 0.95 : 1,
              background: activeKey === ' ' ? AEGYL : '#f5f5f5',
              borderColor: activeKey === ' ' ? AEGYL : tokens.color.surface.line,
            }}
            transition={{ duration: 0.06 }}
            style={{
              width: 160, height: 28, borderRadius: 5,
              border: '1.5px solid', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: 8, fontFamily: tokens.type.family.mono,
              color: activeKey === ' ' ? '#fff' : tokens.color.text.tertiary,
            }}
          >
            espace
          </motion.div>
        </div>

      {/* Legend + inline z-scores */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        style={{ display: 'flex', gap: 18, alignItems: 'center', fontFamily: tokens.type.family.mono, fontSize: 10 }}
      >
        <LegendDot color={AEGYL} label="rythme habituel" />
        {showLive && <LegendDot color={BLU} label={`Vous · écart ${legitMeanZ.toFixed(1)}`} />}
        {showLive && <LegendDot color={RED} label={`Imposteur · écart ${atkMeanZ.toFixed(1)}`} />}
        {showLive && (
          <span style={{ fontSize: 9, color: tokens.color.text.tertiary }}>
            {"seuil d'alerte : 2.0"}
          </span>
        )}
      </motion.div>
    </div>
  )
}

/* ── Helpers ──────────────────────────────────────────────────── */

function StatLine({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 9, fontFamily: tokens.type.family.mono, color: tokens.color.text.tertiary }}>{label}</span>
      <span style={{ fontSize: 11, fontFamily: tokens.type.family.mono, fontWeight: 700, color }}>{value}</span>
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 8, height: 8, background: color, borderRadius: '50%', display: 'inline-block' }} />
      <span style={{ color }}>{label}</span>
    </span>
  )
}
