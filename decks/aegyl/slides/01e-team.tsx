import { motion } from 'framer-motion'
import type { SlideContext, SlideMeta } from '@engine/types'
import { tokens } from '@design/tokens'
import { Eyebrow } from '@ui/Eyebrow'

export const meta: SlideMeta = {
  speaker: [],
  duration: 45,
  steps: 3,
  notes: 'Équipe : les 4 membres entrent un par un (au clic), comme les pupitres d\'un orchestre.',
}

const SANS = tokens.type.family.sans
const MONO = tokens.type.family.mono

const MEMBERS = [
  { name: 'Robin BORG', role: 'Développeur', color: '#1d4ed8', initials: 'RB', contrib: 'Architecture full-stack, capture clavier Rust / Tauri, intégration temps réel (SSE).' },
  { name: 'Thomas RIVIÈRES', role: 'Machine Learning', color: '#7c3aed', initials: 'TR', contrib: 'Pipeline d\'anomaly detection one-class : Z-Score, Isolation Forest, distance SNN.' },
  { name: 'Illias LE REVEREND', role: 'Offensive', color: '#b91c1c', initials: 'IL', contrib: 'Modèle de menace, attaques par imitation, durcissement des seuils.' },
  { name: 'Arnaud SASSOUBRE', role: 'Cryptographie', color: '#059669', initials: 'AS', contrib: 'Fuzzy extractor : Secure Sketch + ECC, clé dérivée de la frappe.' },
]

function Card({ m, on }: { m: typeof MEMBERS[number]; on: boolean }) {
  return (
    <motion.div
      initial={false}
      animate={{ opacity: on ? 1 : 0, y: on ? 0 : 14, scale: on ? 1 : 0.96 }}
      transition={{ duration: 0.4, ease: tokens.motion.ease.out }}
      style={{
        width: 252, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        padding: '22px 16px', borderRadius: 14, border: `1px solid ${tokens.color.surface.line}`, background: tokens.color.surface.base,
      }}
    >
      <div style={{
        width: 76, height: 76, borderRadius: '50%', border: `2.5px solid ${m.color}`, background: `${m.color}10`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontWeight: 700, fontSize: 26, color: m.color,
        boxShadow: `0 0 0 6px ${m.color}08`,
      }}>
        {m.initials}
      </div>
      <span style={{ fontSize: tokens.type.size.lg, fontWeight: 700, fontFamily: SANS, color: tokens.color.text.primary, textAlign: 'center', lineHeight: 1.15 }}>
        {m.name}
      </span>
      <span style={{ fontSize: 11, fontFamily: MONO, fontWeight: 700, letterSpacing: tokens.type.tracking.wider, textTransform: 'uppercase', color: m.color, background: `${m.color}12`, border: `1px solid ${m.color}33`, borderRadius: 100, padding: '5px 13px' }}>
        {m.role}
      </span>
      <span style={{ fontSize: 12.5, fontFamily: SANS, color: tokens.color.text.secondary, textAlign: 'center', lineHeight: 1.45 }}>
        {m.contrib}
      </span>
    </motion.div>
  )
}

export function Component({ step }: SlideContext) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: 1180, height: '100%', gap: 26 }}>
      <Eyebrow color={tokens.color.accent.aegyl}>L'orchestre</Eyebrow>
      <motion.h2
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        style={{ fontSize: tokens.type.size.xl, fontWeight: tokens.type.weight.semibold, letterSpacing: tokens.type.tracking.tight, color: tokens.color.text.primary, margin: 0, textAlign: 'center' }}
      >
        Quatre pupitres, une même partition.
      </motion.h2>

      <div style={{ display: 'flex', gap: 18, justifyContent: 'center', alignItems: 'stretch' }}>
        {MEMBERS.map((m, i) => (
          <Card key={m.name} m={m} on={step >= i} />
        ))}
      </div>
    </div>
  )
}
