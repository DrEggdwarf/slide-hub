import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SlideContext, SlideMeta } from '@engine/types'
import { tokens } from '@design/tokens'
import { Eyebrow } from '@ui/Eyebrow'
import { Stack } from '@ui/Stack'

export const meta: SlideMeta = {
  speaker: ['robin'],
  duration: 75,
  steps: 3,
  notes: `A partir de l'input d'un clavier on peut dériver 3 mesures`,
}

/* ── Loop timings (ms) ───────────────────────────────────────── */

const DWELL_TARGET = 85
const FLIGHT_TARGET = 52
const SEEK_TARGET = 137

const PHASE = { idle: 500, action: 1400, hold: 700 }
const LOOP_TOTAL = PHASE.idle + PHASE.action + PHASE.hold

/* ── Hook: looping phase timer ───────────────────────────────── */

type LoopPhase = 'idle' | 'action' | 'hold'

function useLoopPhase(active: boolean): { phase: LoopPhase; progress: number } {
  const [state, setState] = useState<{ phase: LoopPhase; progress: number }>({
    phase: 'idle',
    progress: 0,
  })

  useEffect(() => {
    if (!active) {
      setState({ phase: 'idle', progress: 0 })
      return
    }
    const start = performance.now()
    let raf: number
    const tick = () => {
      const t = (performance.now() - start) % LOOP_TOTAL
      if (t < PHASE.idle) {
        setState({ phase: 'idle', progress: 0 })
      } else if (t < PHASE.idle + PHASE.action) {
        setState({ phase: 'action', progress: (t - PHASE.idle) / PHASE.action })
      } else {
        setState({ phase: 'hold', progress: 1 })
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active])

  return state
}

/* ── Keycap ──────────────────────────────────────────────────── */

function KeyCap({
  letter,
  pressed,
  highlight,
}: {
  letter: string
  pressed: boolean
  highlight: string
}) {
  return (
    <motion.div
      animate={{
        scale: pressed ? 0.91 : 1,
        background: pressed ? highlight : '#f5f5f5',
        borderColor: pressed ? highlight : tokens.color.surface.line,
        boxShadow: pressed
          ? `0 0 0 4px ${highlight}20`
          : '0 0 0 0px transparent',
      }}
      transition={{ duration: 0.12 }}
      style={{
        width: 100,
        height: 100,
        borderRadius: 16,
        border: '2px solid',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        userSelect: 'none',
      }}
    >
      <span
        style={{
          fontSize: 30,
          fontFamily: tokens.type.family.mono,
          fontWeight: 700,
          color: pressed ? '#fff' : tokens.color.text.primary,
          transition: 'color 0.12s',
        }}
      >
        {letter}
      </span>
      <motion.span
        animate={{ opacity: pressed ? 1 : 0 }}
        transition={{ duration: 0.1 }}
        style={{
          fontSize: 9,
          fontFamily: tokens.type.family.mono,
          fontWeight: 600,
          color: '#fff',
          letterSpacing: tokens.type.tracking.wider,
        }}
      >
        ↓ PRESS
      </motion.span>
    </motion.div>
  )
}

/* ── Running counter ─────────────────────────────────────────── */

function Counter({
  color,
  progress,
  target,
  active,
  label,
  formula,
}: {
  color: string
  progress: number
  target: number
  active: boolean
  label: string
  formula: string
}) {
  const value = Math.round(progress * target)
  const done = progress >= 1

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        padding: '14px 24px',
        borderRadius: 14,
        border: `2px solid ${active || done ? color : tokens.color.surface.line}`,
        background: active ? color + '08' : tokens.color.surface.base,
        transition: 'border-color 0.15s, background 0.15s',
        width: '100%',
        maxWidth: 520,
      }}
    >
      <div style={{ width: 64, textAlign: 'right' }}>
        <div
          style={{
            fontSize: tokens.type.size.sm,
            fontFamily: tokens.type.family.mono,
            fontWeight: 700,
            color: active || done ? color : tokens.color.text.muted,
          }}
        >
          {label}
        </div>
      </div>
      <div style={{ flex: '0 0 auto', minWidth: 100, textAlign: 'center' }}>
        <div
          style={{
            fontSize: 36,
            fontFamily: tokens.type.family.mono,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            color: active || done ? color : tokens.color.text.muted,
          }}
        >
          {active ? value : done ? target : 0}
          <span style={{ fontSize: 16, fontWeight: 500, marginLeft: 2 }}>ms</span>
        </div>
      </div>
      <div
        style={{
          flex: 1,
          fontSize: 11,
          fontFamily: tokens.type.family.mono,
          color: active || done ? tokens.color.text.secondary : tokens.color.text.muted,
          textAlign: 'right',
        }}
      >
        {formula}
      </div>
    </motion.div>
  )
}

/* ── Step configs ────────────────────────────────────────────── */

const STEPS_CFG = [
  {
    label: 'Dwell',
    desc: "Durée d'appui — combien de temps le doigt reste sur H",
    formula: 'release(n) − press(n)',
    target: DWELL_TARGET,
    color: tokens.color.accent.aegyl,
  },
  {
    label: 'Flight',
    desc: "Gap entre touches — temps entre relâcher H et appuyer E",
    formula: 'press(n) − release(n−1)',
    target: FLIGHT_TARGET,
    color: tokens.color.accent.iforest,
  },
  {
    label: 'Seek',
    desc: "Press-to-press — rythme global entre H↓ et E↓",
    formula: 'press(n) − press(n−1)',
    target: SEEK_TARGET,
    color: tokens.color.accent.sketch,
  },
]

/* ── Slide ───────────────────────────────────────────────────── */

export function Component({ step }: SlideContext) {
  const cfg = step >= 1 ? STEPS_CFG[step - 1] : null
  const color = cfg?.color ?? tokens.color.accent.aegyl

  // Loop animation — restarts each time step changes
  const loop1 = useLoopPhase(step === 1)
  const loop2 = useLoopPhase(step === 2)
  const loop3 = useLoopPhase(step === 3)

  const activeLoop = step === 1 ? loop1 : step === 2 ? loop2 : step === 3 ? loop3 : { phase: 'idle' as LoopPhase, progress: 0 }
  const { phase, progress } = activeLoop

  const getKeyStates = useCallback((): [boolean, boolean] => {
    if (step === 0) return [false, false]
    if (step === 1) return [phase === 'action', false]
    if (step === 2) return [phase === 'idle', phase === 'hold']
    return [phase === 'action' || phase === 'idle', phase === 'hold']
  }, [step, phase])

  const [keyAPressed, keyBPressed] = getKeyStates()

  const keyALabel =
    step === 1
      ? phase === 'action'
        ? '↓ appuyée'
        : phase === 'hold'
          ? '↑ relâchée'
          : ''
      : step === 2
        ? phase === 'idle'
          ? '↓ appuyée'
          : '↑ relâchée'
        : step === 3
          ? '↓ appuyée'
          : ''

  const keyBLabel =
    (step === 2 || step === 3) && phase === 'hold' ? '↓ appuyée' : ''

  return (
    <Stack gap={20} align="center" style={{ width: '100%', maxWidth: 960, height: '100%', justifyContent: 'center' }}>
      <Eyebrow color={tokens.color.accent.aegyl}>Ce qu'on mesure</Eyebrow>

      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: tokens.motion.duration.slow,
          ease: tokens.motion.ease.out,
        }}
        style={{
          fontSize: tokens.type.size['2xl'],
          fontWeight: tokens.type.weight.semibold,
          letterSpacing: tokens.type.tracking.tight,
          color: tokens.color.text.primary,
          margin: 0,
          textAlign: 'center',
        }}
      >
        Votre frappe a une signature musicale.
      </motion.h2>

      {/* Phase description */}
      <div
        style={{
          height: 22,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AnimatePresence mode="wait">
          {cfg && (
            <motion.div
              key={step}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.2 }}
              style={{
                fontSize: tokens.type.size.sm,
                fontFamily: tokens.type.family.mono,
                color,
                letterSpacing: tokens.type.tracking.wide,
              }}
            >
              {cfg.desc}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Keyboard row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 32 }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <KeyCap letter="H" pressed={keyAPressed} highlight={color} />
          <span
            style={{
              fontSize: 10,
              fontFamily: tokens.type.family.mono,
              height: 14,
              color: keyALabel ? color : 'transparent',
              transition: 'color 0.1s',
            }}
          >
            {keyALabel}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            width: 60,
            paddingTop: 36,
          }}
        >
          <motion.div
            animate={{
              opacity: step === 2 && phase === 'action' ? 1 : 0.15,
              color:
                step === 2
                  ? tokens.color.accent.iforest
                  : tokens.color.text.muted,
            }}
            transition={{ duration: 0.15 }}
            style={{ fontSize: 28, fontWeight: 300 }}
          >
            →
          </motion.div>
          {step === 2 && phase === 'action' && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                fontSize: 9,
                fontFamily: tokens.type.family.mono,
                color: tokens.color.accent.iforest,
                fontWeight: 600,
              }}
            >
              gap
            </motion.span>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <KeyCap letter="E" pressed={keyBPressed} highlight={color} />
          <span
            style={{
              fontSize: 10,
              fontFamily: tokens.type.family.mono,
              height: 14,
              color: keyBLabel ? color : 'transparent',
              transition: 'color 0.1s',
            }}
          >
            {keyBLabel}
          </span>
        </div>
      </div>

      {/* Seek bracket */}
      <motion.div
        animate={{ opacity: step === 3 ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        style={{ marginTop: -12, height: 24 }}
      >
        <svg width={280} height={24} viewBox="0 0 280 24">
          <path
            d="M10 4 L10 16 L270 16 L270 4"
            fill="none"
            stroke={tokens.color.accent.sketch}
            strokeWidth={2}
          />
          <circle cx={10} cy={4} r={3} fill={tokens.color.accent.sketch} />
          <circle cx={270} cy={4} r={3} fill={tokens.color.accent.sketch} />
        </svg>
      </motion.div>

      {/* Counters */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          alignItems: 'center',
          width: '100%',
          minHeight: 80,
        }}
      >
        {STEPS_CFG.map((s, i) => {
          if (step < i + 1) return null
          const isActive = step === i + 1
          const loopForThis =
            i === 0 ? loop1 : i === 1 ? loop2 : loop3
          return (
            <Counter
              key={s.label}
              label={s.label}
              formula={s.formula}
              color={s.color}
              target={s.target}
              progress={isActive ? loopForThis.progress : 1}
              active={isActive && loopForThis.phase === 'action'}
            />
          )
        })}
      </div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: tokens.motion.duration.slow, delay: 0.4 }}
        style={{
          display: 'flex',
          gap: tokens.space[5],
          fontSize: tokens.type.size.xs,
          color: tokens.color.text.tertiary,
          fontFamily: tokens.type.family.mono,
        }}
      >
        <span>Flight négatif = rollover (chevauchement)</span>
        <span style={{ color: tokens.color.surface.line }}>·</span>
        <span style={{ fontStyle: 'italic' }}>
          Aucun keycode stocké — uniquement du temps.
        </span>
      </motion.div>
    </Stack>
  )
}
