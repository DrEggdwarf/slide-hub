/**
 * Shared pipeline visual components.
 * Used by slides 06–09 to give a unified look & feel.
 */
import { motion } from 'framer-motion'
import { tokens } from '@design/tokens'

/* ── Pipeline stages (5 étapes) ──────────────────────────────── */

export const STAGES = [
  { id: 'zscore', label: 'Z-Score', color: tokens.color.accent.zscore },
  { id: 'iforest', label: 'Isolation Forest', color: tokens.color.accent.iforest },
  { id: 'snn', label: 'Réseau Siamois', color: tokens.color.accent.snn },
  { id: 'sketch', label: 'Secure Sketch', color: tokens.color.accent.sketch },
  { id: 'summary', label: 'Résumé', color: tokens.color.accent.ecc },
] as const

/* ── Pipeline progress bar ───────────────────────────────────── */

export function PipelineBar({ active }: { active: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 18,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        width: '100%',
        maxWidth: 700,
        zIndex: 5,
      }}
    >
      {STAGES.map((s, i) => {
        const done = i < active
        const current = i === active
        return (
          <div
            key={s.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              flex: i < STAGES.length - 1 ? 1 : 0,
            }}
          >
            <motion.div
              animate={{
                background: current ? s.color : done ? s.color : tokens.color.surface.subtle,
                borderColor: current || done ? s.color : tokens.color.surface.line,
                scale: current ? 1.15 : 1,
              }}
              transition={{ duration: 0.3 }}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                border: '2px solid',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                position: 'relative',
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontFamily: tokens.type.family.mono,
                  fontWeight: 700,
                  color: current || done ? '#fff' : tokens.color.text.tertiary,
                }}
              >
                {i + 1}
              </span>
              <span
                style={{
                  position: 'absolute',
                  top: 36,
                  fontSize: 8,
                  fontFamily: tokens.type.family.mono,
                  fontWeight: current ? 700 : 500,
                  color: current ? s.color : done ? s.color : tokens.color.text.tertiary,
                  whiteSpace: 'nowrap',
                  letterSpacing: tokens.type.tracking.wide,
                }}
              >
                {s.label}
              </span>
            </motion.div>

            {i < STAGES.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  background: done ? STAGES[i].color : tokens.color.surface.line,
                  transition: 'background 0.3s',
                  minWidth: 16,
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ── Arrow between sections ──────────────────────────────────── */

export function Arrow({ color }: { color: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 0.6, scale: 1 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      style={{
        fontSize: 24,
        color,
        fontWeight: 300,
        padding: '0 8px',
      }}
    >
      →
    </motion.div>
  )
}
