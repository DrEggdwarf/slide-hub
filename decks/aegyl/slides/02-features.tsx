import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { SlideContext, SlideMeta } from '@engine/types'
import { tokens } from '@design/tokens'
import { Eyebrow } from '@ui/Eyebrow'
import { Stack } from '@ui/Stack'

export const meta: SlideMeta = {
  speaker: ['arnaud'],
  duration: 105,
  steps: 2,
  notes:
    'Step 1 = clavier + tableau incrémental. Step 2 = clavier + 16 sparklines. Layout vertical.',
}

/* ── Data ────────────────────────────────────────────────────── */

const PHRASE = 'portez ce vieux whisky au juge blond qui fume'
const CHAR_MS = 130
const PAUSE_MS = 1400
const GAP_MS = 500

const KB = [
  ['a', 'z', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['q', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm'],
  ['w', 'x', 'c', 'v', 'b', 'n'],
]
const KB_PAD = [0, 0, 122]

const MEAS = PHRASE.split('').map((c, i) => {
  const code = c.charCodeAt(0)
  const seed = code * 31 + i * 97
  const hash = (s: number) => ((s ^ (s >> 3)) * 2654435761) >>> 0
  return {
    char: c === ' ' ? '␣' : c,
    dwell: 45 + (hash(seed) % 90),
    flight: i === 0 ? 0 : -15 + (hash(seed + 777) % 95),
  }
})

/* ── Stats ───────────────────────────────────────────────────── */

const avg = (a: number[]) =>
  a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0
const sd = (a: number[]) => {
  const m = avg(a)
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length || 1))
}
const pct = (a: number[], p: number) => {
  const sorted = [...a].sort((x, y) => x - y)
  return sorted[Math.min(Math.floor(sorted.length * p), sorted.length - 1)] ?? 0
}
const cov = (a: number[]) => {
  const m = avg(a)
  return m ? sd(a) / m : 0
}
const skw = (a: number[]) => {
  const m = avg(a)
  const s = sd(a)
  return s ? a.reduce((r, v) => r + ((v - m) / s) ** 3, 0) / a.length : 0
}

/* ── 16 feature time-series ──────────────────────────────────── */

const FEAT_LABELS = [
  'appui moy', 'appui var', 'appui bas', 'appui haut',
  'interv. moy', 'interv. var', 'interv. bas', 'interv. haut',
  'visée moy', 'visée var', 'visée bas', 'visée haut',
  'régul. appui', 'régul. interv.', 'régul. visée', 'asymétrie',
]

const FEAT_CLR = [
  ...Array<string>(4).fill(tokens.color.accent.aegyl),
  ...Array<string>(4).fill(tokens.color.accent.iforest),
  ...Array<string>(4).fill(tokens.color.accent.snn),
  tokens.color.accent.sketch,
  tokens.color.accent.sketch,
  tokens.color.accent.sketch,
  tokens.color.accent.zscore,
]

const FEAT: number[][] = (() => {
  const out: number[][] = Array.from({ length: 16 }, () => [])
  for (let n = 1; n <= PHRASE.length; n++) {
    const dw = MEAS.slice(0, n).map((m) => m.dwell)
    const fl = n > 1 ? MEAS.slice(1, n).map((m) => m.flight) : []
    const sk =
      n > 1 ? MEAS.slice(1, n).map((m, j) => m.flight + MEAS[j].dwell) : []
    out[0].push(avg(dw))
    out[1].push(sd(dw))
    out[2].push(pct(dw, 0.1))
    out[3].push(pct(dw, 0.9))
    out[4].push(avg(fl))
    out[5].push(sd(fl))
    out[6].push(pct(fl, 0.1))
    out[7].push(pct(fl, 0.9))
    out[8].push(avg(sk))
    out[9].push(sd(sk))
    out[10].push(pct(sk, 0.1))
    out[11].push(pct(sk, 0.9))
    out[12].push(cov(dw))
    out[13].push(cov(fl))
    out[14].push(cov(sk))
    out[15].push(skw(dw))
  }
  return out
})()

/* ── Typing loop ─────────────────────────────────────────────── */

function useTypingLoop(step: number): number {
  const [idx, setIdx] = useState(-1)
  useEffect(() => {
    setIdx(-1)
    if (step < 1) return
    let t: ReturnType<typeof setTimeout>
    let dead = false
    const go = (i: number) => {
      if (dead) return
      if (i >= PHRASE.length) {
        setIdx(PHRASE.length)
        t = setTimeout(() => {
          if (dead) return
          setIdx(-1)
          t = setTimeout(() => go(0), GAP_MS)
        }, PAUSE_MS)
        return
      }
      setIdx(i)
      t = setTimeout(() => go(i + 1), CHAR_MS)
    }
    t = setTimeout(() => go(0), 350)
    return () => {
      dead = true
      clearTimeout(t)
    }
  }, [step])
  return idx
}

/* ── Keyboard ────────────────────────────────────────────────── */

const KS = 56
const KG = 5

function Keys({ hit, clr }: { hit: string; clr: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: KG,
        alignItems: 'center',
      }}
    >
      {KB.map((row, ri) => (
        <div
          key={ri}
          style={{ display: 'flex', gap: KG, paddingLeft: KB_PAD[ri] }}
        >
          {row.map((k) => {
            const on = k === hit
            return (
              <div
                key={k}
                style={{
                  width: KS,
                  height: KS,
                  flexShrink: 0,
                }}
              >
                <motion.div
                  animate={{
                    scale: on ? 0.85 : 1,
                    background: on ? clr : '#f5f5f5',
                    borderColor: on ? clr : tokens.color.surface.line,
                  }}
                  transition={{ duration: 0.07 }}
                  style={{
                    width: KS,
                    height: KS,
                    borderRadius: 8,
                    border: '1.5px solid',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontFamily: tokens.type.family.mono,
                    fontWeight: 600,
                    color: on ? '#fff' : tokens.color.text.tertiary,
                    transformOrigin: 'center',
                  }}
                >
                  {k}
                </motion.div>
              </div>
            )
          })}
        </div>
      ))}
      {/* space */}
      <div style={{ width: KS * 6 + KG * 5, height: KS - 4, flexShrink: 0 }}>
        <motion.div
          animate={{
            scale: hit === ' ' ? 0.95 : 1,
            background: hit === ' ' ? clr : '#f5f5f5',
            borderColor: hit === ' ' ? clr : tokens.color.surface.line,
          }}
          transition={{ duration: 0.07 }}
          style={{
            width: KS * 6 + KG * 5,
            height: KS - 4,
            borderRadius: 8,
            border: '1.5px solid',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 9,
            fontFamily: tokens.type.family.mono,
            fontWeight: 600,
            color: hit === ' ' ? '#fff' : tokens.color.text.muted,
            letterSpacing: tokens.type.tracking.wider,
            transformOrigin: 'center',
          }}
        >
          ESPACE
        </motion.div>
      </div>
    </div>
  )
}

/* ── Keystroke table ─────────────────────────────────────────── */

function Tbl({ n }: { n: number }) {
  const VISIBLE = 15
  const tail = MEAS.slice(Math.max(0, n - VISIBLE), n)
  const off = Math.max(0, n - VISIBLE)
  return (
    <div
      style={{
        fontFamily: tokens.type.family.mono,
        fontSize: 11,
        width: '100%',
        maxWidth: 700,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '36px 50px 72px 72px',
          gap: '0 10px',
          justifyContent: 'center',
          paddingBottom: 4,
          marginBottom: 4,
          borderBottom: `1px solid ${tokens.color.surface.line}`,
          fontSize: 9,
          fontWeight: 700,
          color: tokens.color.text.muted,
          letterSpacing: tokens.type.tracking.wider,
        }}
      >
        <span>#</span>
        <span>Touche</span>
        <span>Appui</span>
        <span>Intervalle</span>
      </div>
      {tail.map((m, i) => {
        const gi = off + i
        const fresh = gi === n - 1
        return (
          <motion.div
            key={gi}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.12 }}
            style={{
              display: 'grid',
              gridTemplateColumns: '36px 50px 72px 72px',
              gap: '0 10px',
              justifyContent: 'center',
              lineHeight: '20px',
              color: fresh
                ? tokens.color.accent.aegyl
                : tokens.color.text.secondary,
              fontWeight: fresh ? 600 : 400,
            }}
          >
            <span>{gi + 1}</span>
            <span>{m.char}</span>
            <span>{m.dwell} ms</span>
            <span>{gi === 0 ? '—' : `${m.flight} ms`}</span>
          </motion.div>
        )
      })}
      <div
        style={{
          marginTop: 6,
          paddingTop: 4,
          borderTop: `1px solid ${tokens.color.surface.line}`,
          color: tokens.color.text.muted,
          fontSize: 9,
          textAlign: 'center',
        }}
      >
        {n} / {PHRASE.length} frappes
      </div>
    </div>
  )
}

/* ── Sparkline ───────────────────────────────────────────────── */

const SW = 80
const SH = 26

function Spk({
  data,
  n,
  clr,
}: {
  data: number[]
  n: number
  clr: string
}) {
  const vis = data.slice(0, n)
  if (!vis.length) return <svg width={SW} height={SH} />
  const lo = Math.min(...vis) * 0.85
  const hi = Math.max(...vis) * 1.15 || 1
  const rng = hi - lo || 1
  const pts = vis
    .map((v, i) => {
      const x = (i / Math.max(data.length - 1, 1)) * SW
      const y = SH - 3 - ((v - lo) / rng) * (SH - 6)
      return `${x},${y}`
    })
    .join(' ')
  const lx = ((vis.length - 1) / Math.max(data.length - 1, 1)) * SW
  const ly = SH - 3 - ((vis[vis.length - 1] - lo) / rng) * (SH - 6)
  return (
    <svg width={SW} height={SH}>
      <polygon points={`0,${SH} ${pts} ${lx},${SH}`} fill={clr + '12'} />
      <polyline
        points={pts}
        fill="none"
        stroke={clr}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {vis.length > 0 && <circle cx={lx} cy={ly} r={2} fill={clr} />}
    </svg>
  )
}

/* ── Feature grid ────────────────────────────────────────────── */

function Grid({ n }: { n: number }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '5px 8px',
        width: '100%',
        maxWidth: 700,
      }}
    >
      {FEAT_LABELS.map((lbl, fi) => (
        <div
          key={fi}
          style={{
            padding: '3px 5px',
            borderRadius: 7,
            border: `1px solid ${n ? FEAT_CLR[fi] + '30' : tokens.color.surface.line}`,
            background: n ? FEAT_CLR[fi] + '06' : 'transparent',
            transition: 'border-color .2s, background .2s',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <span
              style={{
                fontSize: 8,
                fontFamily: tokens.type.family.mono,
                fontWeight: 700,
                color: FEAT_CLR[fi],
                letterSpacing: tokens.type.tracking.wide,
              }}
            >
              {lbl}
            </span>
            <span
              style={{
                fontSize: 8,
                fontFamily: tokens.type.family.mono,
                color: tokens.color.text.muted,
              }}
            >
              {n > 0
                ? FEAT[fi][Math.min(n, FEAT[fi].length) - 1]?.toFixed(1)
                : '—'}
            </span>
          </div>
          <Spk data={FEAT[fi]} n={n} clr={FEAT_CLR[fi]} />
        </div>
      ))}
    </div>
  )
}

/* ── Slide ───────────────────────────────────────────────────── */

export function Component({ step }: SlideContext) {
  const charIdx = useTypingLoop(step)
  const n = charIdx < 0 ? 0 : Math.min(charIdx + 1, PHRASE.length)
  const hit = charIdx >= 0 && charIdx < PHRASE.length ? PHRASE[charIdx] : ''
  const typed = PHRASE.slice(0, n)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        maxWidth: 960,
        height: '100%',
        gap: 10,
        padding: '6px 0',
      }}
    >
      {/* ─── TOP: title ─── */}
      <div style={{ textAlign: 'center', flexShrink: 0 }}>
        <Eyebrow color={tokens.color.accent.aegyl}>Extraction du rythme</Eyebrow>
        <motion.h2
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: tokens.motion.duration.slow,
            ease: tokens.motion.ease.out,
          }}
          style={{
            fontSize: tokens.type.size.xl,
            fontWeight: tokens.type.weight.semibold,
            letterSpacing: tokens.type.tracking.tight,
            color: tokens.color.text.primary,
            margin: '4px 0 0',
          }}
        >
          Du signal brut aux mesures.
        </motion.h2>
      </div>

      {/* ─── MIDDLE: table (step 1) or feature grid (step 2) ─── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: 340,
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="tbl"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              style={{ display: 'flex', justifyContent: 'center', width: '100%' }}
            >
              <Tbl n={n} />
            </motion.div>
          )}
          {step === 2 && (
            <motion.div
              key="grid"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              style={{ display: 'flex', justifyContent: 'center', width: '100%' }}
            >
              <Grid n={n} />
            </motion.div>
          )}
          {step === 0 && (
            <motion.div
              key="hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{
                fontSize: tokens.type.size.sm,
                color: tokens.color.text.muted,
                fontFamily: tokens.type.family.mono,
              }}
            >
              →  pour lancer la saisie
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── BOTTOM: typed text + keyboard ─── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
        }}
      >
        {/* Typed text */}
        <div
          style={{
            fontFamily: tokens.type.family.mono,
            fontSize: 16,
            fontWeight: 500,
            color: tokens.color.text.primary,
            minHeight: 24,
            letterSpacing: '0.03em',
            textAlign: 'center',
          }}
        >
          {typed || '\u00a0'}
          {step >= 1 && (
            <motion.span
              animate={{ opacity: [1, 0] }}
              transition={{ repeat: Infinity, duration: 0.7, ease: 'easeInOut' }}
              style={{ color: tokens.color.accent.aegyl, fontWeight: 300 }}
            >
              |
            </motion.span>
          )}
        </div>

        {/* Keyboard */}
        <Keys hit={hit} clr={tokens.color.accent.aegyl} />

        {/* Footer */}
        <div
          style={{
            fontSize: tokens.type.size.xs,
            color: tokens.color.text.muted,
            fontFamily: tokens.type.family.mono,
            textAlign: 'center',
          }}
        >
          {step <= 1
            ? "Chaque frappe : durée d'appui, intervalle, déplacement"
            : '16 mesures → votre signature rythmique'}
        </div>
      </div>
    </div>
  )
}
