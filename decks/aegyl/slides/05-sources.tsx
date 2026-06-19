import { motion } from 'framer-motion'
import { SlideContext, SlideMeta } from '@engine/types'
import { tokens } from '@design/tokens'
import { Eyebrow } from '@ui/Eyebrow'

export const meta: SlideMeta = {
  title: 'État de l\'art',
  speaker: ['arnaud'],
  duration: 45,
  notes: `25+ ans de littérature — pas un pari.
• 1997 Monrose & Rubin : l'acte fondateur.
• 2009 Killourhy & Maxion : le benchmark (CMU).
• 2015 Mondal & Bours : auth continue.
• 2018 Dhakal : 136M frappes, l'échelle.
• 2023 Huang & Hou : la synthèse.
• 2024 Arrigo : corriger ses fautes = biométrie.`,
}

const MONO = tokens.type.family.mono
const SANS = tokens.type.family.sans
const LINE = tokens.color.surface.line
const A = tokens.color.accent

const REFS = [
  { year: '1997', authors: 'Monrose & Rubin', venue: 'ACM CCS', finding: 'Première authentification par dynamique de frappe', color: A.aegyl },
  { year: '2009', authors: 'Killourhy & Maxion', venue: 'DSN', finding: 'Benchmark CMU (51 sujets) — comparaison rigoureuse des algos', color: A.zscore },
  { year: '2015', authors: 'Mondal & Bours', venue: 'Biometrics', finding: 'Authentification continue pendant toute la session', color: A.iforest },
  { year: '2018', authors: 'Dhakal et al.', venue: 'CHI', finding: '136 millions de frappes — signature inter-individus à grande échelle', color: A.snn },
  { year: '2023', authors: 'Huang & Hou', venue: 'ACM Comput. Surveys', finding: 'État de l\'art : concepts, techniques, applications', color: A.sketch },
  { year: '2024', authors: 'Arrigo', venue: 'IEEE URTC', finding: 'Biométrie via les comportements de correction d\'erreur', color: tokens.color.semantic.info },
]

function Card({ r }: { r: typeof REFS[number] }) {
  return (
    <div style={{
      width: 172, padding: '10px 12px', borderRadius: 10,
      border: `1.5px solid ${r.color}30`, background: `${r.color}06`,
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <span style={{ fontSize: 22, fontWeight: 700, fontFamily: MONO, color: r.color, lineHeight: 1 }}>{r.year}</span>
      <span style={{ fontSize: 12, fontWeight: 700, fontFamily: SANS, color: tokens.color.text.primary }}>{r.authors}</span>
      <span style={{ fontSize: 9, fontFamily: MONO, color: tokens.color.text.muted, textTransform: 'uppercase', letterSpacing: 1 }}>{r.venue}</span>
      <span style={{ fontSize: 10.5, fontFamily: SANS, color: tokens.color.text.secondary, lineHeight: 1.35 }}>{r.finding}</span>
    </div>
  )
}

export function Component(_: SlideContext) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 1180, gap: 26 }}>
      <Eyebrow color={A.aegyl}>État de l'art</Eyebrow>
      <motion.h2
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        style={{
          fontSize: tokens.type.size['2xl'], fontWeight: tokens.type.weight.semibold,
          letterSpacing: tokens.type.tracking.tight, color: tokens.color.text.primary, margin: 0, textAlign: 'center',
        }}
      >
        Prouvé par la recherche <span style={{ color: A.aegyl }}>depuis 1997</span>.
      </motion.h2>

      {/* Timeline */}
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', width: '100%', height: 360 }}>
        <div style={{ position: 'absolute', left: 12, right: 12, top: 180, height: 2, background: LINE }} />
        <motion.div
          initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1.4, ease: tokens.motion.ease.out }}
          style={{ position: 'absolute', left: 12, right: 12, top: 180, height: 2, background: A.aegyl, transformOrigin: 'left' }}
        />
        {REFS.map((r, i) => {
          const up = i % 2 === 0
          return (
            <motion.div
              key={r.year}
              initial={{ opacity: 0, y: up ? -10 : 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.18 }}
              style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
            >
              <div style={{ height: 170, display: 'flex', alignItems: 'flex-end', paddingBottom: 14 }}>{up && <Card r={r} />}</div>
              <div style={{ height: 20, display: 'flex', alignItems: 'center' }}>
                <span style={{ width: 14, height: 14, borderRadius: '50%', background: r.color, border: `3px solid ${tokens.color.surface.base}`, boxShadow: `0 0 0 2px ${r.color}` }} />
              </div>
              <div style={{ height: 170, display: 'flex', alignItems: 'flex-start', paddingTop: 14 }}>{!up && <Card r={r} />}</div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
