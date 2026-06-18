import { motion } from 'framer-motion'
import { SlideContext, SlideMeta } from '@engine/types'
import { tokens } from '@design/tokens'
import { Eyebrow } from '@ui/Eyebrow'

export const meta: SlideMeta = {
  title: 'Roadmap',
  speaker: ['illias'],
  duration: 60,
  notes: "Roadmap déc 2025 → juin 2026 : 7 phases en crescendo jusqu'à la soutenance. La musique est seulement suggérée (forme montante + vocabulaire), pas dessinée.",
}

const MONO = tokens.type.family.mono
const SANS = tokens.type.family.sans
const SERIF = 'Georgia, "Times New Roman", serif'
const A = tokens.color.accent.aegyl
const TXT = tokens.color.text.primary
const TXT2 = tokens.color.text.secondary
const MUTED = tokens.color.text.muted
const LINE = tokens.color.surface.line

const CHART_H = 248

// 7 phases en crescendo : la hauteur et l'intensité montent jusqu'à la soutenance.
// Les marques de tempo restent un clin d'œil discret (elles passent pour des libellés).
const STEPS = [
  { month: 'Déc 25', tempo: 'Largo', label: 'POC capture clavier', h: 54, op: 0.42 },
  { month: 'Janv 26', tempo: 'Andante', label: 'Extraction des mesures', h: 86, op: 0.53 },
  { month: 'Févr 26', tempo: 'Moderato', label: 'Z-Score · Isolation Forest', h: 118, op: 0.64 },
  { month: 'Mars 26', tempo: 'Allegro', label: 'Distance SNN · robustesse', h: 150, op: 0.75 },
  { month: 'Avr 26', tempo: 'Vivace', label: 'Secure Sketch · ECC', h: 182, op: 0.86 },
  { month: 'Mai 26', tempo: 'Presto', label: 'Démo live (API SSE)', h: 214, op: 0.94 },
  { month: 'Juin 26', tempo: 'Finale', label: 'Soutenance · livrables', h: CHART_H, op: 1, last: true },
]

export function Component(_: SlideContext) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 1180, gap: 32 }}>
      <Eyebrow color={A}>Déc 2025 → Juin 2026</Eyebrow>
      <motion.h2
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        style={{
          fontSize: tokens.type.size['2xl'], fontWeight: tokens.type.weight.semibold,
          letterSpacing: tokens.type.tracking.tight, color: TXT, margin: 0, textAlign: 'center',
        }}
      >
        Sept mouvements, un <span style={{ color: A }}>crescendo</span> jusqu'à la soutenance.
      </motion.h2>

      <div style={{ width: '100%', maxWidth: 1060 }}>
        {/* Zone des barres montantes (le crescendo) */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: CHART_H + 30, padding: '0 4px' }}>
          {/* Ligne de sol unique (un seul trait, pas une portée) */}
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 1, background: LINE, zIndex: 0 }} />

          {STEPS.map((s, i) => (
            <div key={s.month} style={{ flex: 1, position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
              {/* Marque de tempo — clin d'œil discret, lue comme un libellé d'intensité */}
              <motion.span
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 + i * 0.12 }}
                style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 13, fontWeight: s.last ? 600 : 400, color: s.last ? A : MUTED, marginBottom: 10, whiteSpace: 'nowrap' }}
              >
                {s.tempo}
              </motion.span>

              {/* Barre épurée (sommet arrondi, sans tête de note) */}
              <motion.div
                initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
                transition={{ delay: 0.2 + i * 0.12, duration: 0.6, ease: tokens.motion.ease.out }}
                style={{
                  width: s.last ? 62 : 52, height: s.h, transformOrigin: 'bottom',
                  borderRadius: '7px 7px 0 0',
                  background: `linear-gradient(180deg, ${A} 0%, ${A}cc 100%)`,
                  opacity: s.op,
                  boxShadow: s.last ? `0 -6px 26px ${A}38` : 'none',
                }}
              />
            </div>
          ))}
        </div>

        {/* Légende : mois + jalon, alignés sous chaque phase */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, padding: '0 4px' }}>
          {STEPS.map((s, i) => (
            <motion.div
              key={s.month}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 + i * 0.12 }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '0 5px' }}
            >
              <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: s.last ? A : TXT, background: s.last ? `${A}12` : 'transparent', border: s.last ? `1px solid ${A}33` : '1px solid transparent', borderRadius: 100, padding: '3px 9px', whiteSpace: 'nowrap' }}>
                {s.month}
              </span>
              <span style={{ fontFamily: SANS, fontSize: 11.5, fontWeight: 600, color: TXT2, textAlign: 'center', lineHeight: 1.3 }}>
                {s.label}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
