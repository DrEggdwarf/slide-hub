import { motion, AnimatePresence } from 'framer-motion'
import type { SlideContext, SlideMeta } from '@engine/types'
import { tokens } from '@design/tokens'
import { Eyebrow } from '@ui/Eyebrow'

export const meta: SlideMeta = {
  speaker: ['illias'],
  duration: 60,
  steps: 5,
  notes: "Cahier des charges de l'auth idéale : 5 exigences cochées une par clic (l'inverse des défauts du mdp). Au bout : le hook « ? » → enchaîne sur la révélation (frappe).",
}

const CLR = tokens.color.accent.aegyl
const GRN = tokens.color.semantic.success
const TXT = tokens.color.text.primary
const TXT2 = tokens.color.text.secondary
const MUTED = tokens.color.text.muted
const LINE = tokens.color.surface.line
const MONO = tokens.type.family.mono

const REQS = [
  { title: 'ne demande rien à retenir', sub: '0 mot de passe à mémoriser', vs: '↔ les ×13' },
  { title: "n'a rien à voler", sub: 'aucun secret stocké à dérober', vs: '↔ 81 % des brèches' },
  { title: "n'appartient qu'à vous", sub: 'impossible à réutiliser ou partager', vs: '↔ 1 sur 2 réutilise' },
  { title: "résiste à l'imitation", sub: 'même en vous observant', vs: '' },
  { title: 'vérifie en continu', sub: 'toute la session, sans friction', vs: '' },
]

function CheckRow({ r, on }: { r: typeof REQS[number]; on: boolean }) {
  return (
    <motion.div
      initial={false}
      animate={{ opacity: on ? 1 : 0.32 }}
      transition={{ duration: 0.35 }}
      style={{ display: 'flex', alignItems: 'center', gap: 18, width: '100%', maxWidth: 660 }}
    >
      <motion.div
        animate={{ background: on ? GRN : 'transparent', borderColor: on ? GRN : LINE, scale: on ? [1, 1.18, 1] : 1 }}
        transition={{ duration: 0.3 }}
        style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
      >
        {on && (
          <svg width={18} height={18} viewBox="0 0 16 16">
            <motion.path d="M3 8 l3.4 3.4 L13 4" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3, delay: 0.08 }} />
          </svg>
        )}
      </motion.div>
      <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', flex: 1 }}>
        <span style={{ fontSize: tokens.type.size.lg, fontWeight: 700, color: TXT, lineHeight: 1.2 }}>{r.title}</span>
        <span style={{ fontSize: tokens.type.size.sm, color: TXT2 }}>{r.sub}</span>
      </div>
      {r.vs && <span style={{ fontSize: 11, fontFamily: MONO, color: MUTED, whiteSpace: 'nowrap' }}>{r.vs}</span>}
    </motion.div>
  )
}

export function Component({ step }: SlideContext) {
  const all = step >= REQS.length
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: 1040, height: '100%', gap: 22 }}>
      <Eyebrow color={CLR}>Le système idéal</Eyebrow>

      <motion.h2
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        style={{ fontSize: tokens.type.size.xl, fontWeight: tokens.type.weight.semibold, letterSpacing: tokens.type.tracking.tight, color: TXT, margin: 0, textAlign: 'center', maxWidth: 820 }}
      >
        Il nous faudrait un moyen de prouver que c'est vous, qui…
      </motion.h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 4 }}>
        {REQS.map((r, i) => (
          <CheckRow key={i} r={r} on={step >= i + 1} />
        ))}
      </div>

      <div style={{ minHeight: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 6 }}>
        <AnimatePresence>
          {all && (
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
              style={{ display: 'flex', alignItems: 'center', gap: 16 }}
            >
              <motion.span
                animate={{ scale: [1, 1.14, 1] }} transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
                style={{ fontSize: 42, fontWeight: 700, color: CLR, lineHeight: 1 }}
              >
                ?
              </motion.span>
              <span style={{ fontSize: tokens.type.size.xl, fontWeight: tokens.type.weight.semibold, color: TXT }}>
                Mais qu'est-ce qui coche <span style={{ color: CLR }}>toutes</span> ces cases ?
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
