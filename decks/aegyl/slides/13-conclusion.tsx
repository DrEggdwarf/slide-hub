import { motion } from 'framer-motion'
import type { SlideContext, SlideMeta } from '@engine/types'
import { tokens } from '@design/tokens'
import { Eyebrow } from '@ui/Eyebrow'

export const meta: SlideMeta = {
  title: 'Conclusion',
  speaker: ['arnaud'],
  duration: 75,
  steps: 1,
  notes: "Positionnement honnête : la frappe seule ne suffit pas comme facteur unique (faux rejets, coïncidence, drift, replay vus au convoyeur). Mais comme signal comportemental CONTINU alimentant un SIEM (détection de session anormale, ré-auth invisible, corrélation), c'est puissant. Aegyl ne remplace pas le mot de passe — il surveille qui tape, en continu.",
}

const MONO = tokens.type.family.mono
const SANS = tokens.type.family.sans
const TXT = tokens.color.text.primary
const TXT2 = tokens.color.text.secondary
const MUTED = tokens.color.text.muted
const A = tokens.color.accent.aegyl
const RED = tokens.color.semantic.critical
const GRN = tokens.color.accent.sketch

function Card({ on, accent, badge, title, points, verdict }: { on: boolean; accent: string; badge: string; title: string; points: string[]; verdict: string }) {
  return (
    <motion.div
      initial={false}
      animate={{ opacity: on ? 1 : 0.25, y: on ? 0 : 10 }}
      transition={{ duration: 0.4, ease: tokens.motion.ease.out }}
      style={{
        width: 380, display: 'flex', flexDirection: 'column', gap: 14,
        padding: '24px 26px', borderRadius: 16,
        border: `1.5px solid ${accent}33`, background: `${accent}07`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 28, height: 28, borderRadius: '50%', background: accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16 }}>{badge}</span>
        <span style={{ fontSize: tokens.type.size.lg, fontWeight: 700, fontFamily: SANS, color: TXT }}>{title}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {points.map((p, i) => (
          <span key={i} style={{ fontSize: 13.5, fontFamily: SANS, color: TXT2, lineHeight: 1.4 }}>{p}</span>
        ))}
      </div>
      <span style={{ marginTop: 'auto', fontFamily: MONO, fontSize: 12, fontWeight: 700, color: accent }}>{verdict}</span>
    </motion.div>
  )
}

export function Component({ step }: SlideContext) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: 1000, height: '100%', gap: 28 }}>
      <Eyebrow color={A}>Conclusion · où placer Aegyl</Eyebrow>
      <motion.h2
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        style={{ fontSize: tokens.type.size['2xl'], fontWeight: tokens.type.weight.semibold, letterSpacing: tokens.type.tracking.tight, color: TXT, margin: 0, textAlign: 'center' }}
      >
        Pas un mot de passe. Un <span style={{ color: A }}>signal</span>.
      </motion.h2>

      <div style={{ display: 'flex', gap: 26, alignItems: 'stretch' }}>
        <Card
          on
          accent={RED}
          badge="✗"
          title="Comme auth unique"
          points={[
            'Faux rejets quand votre frappe dérive (fatigue, autre clavier).',
            'Coïncidence biométrique : un inconnu au rythme proche.',
            'Le replay reste un angle mort sans texte-défi.',
          ]}
          verdict="trop risqué comme facteur unique"
        />
        <Card
          on={step >= 1}
          accent={GRN}
          badge="✓"
          title="Comme signal continu (SIEM)"
          points={[
            'Surveille qui tape pendant toute la session, sans friction.',
            "Lève une alerte sur une session anormale → ré-auth ciblée.",
            'Se corrèle aux autres signaux de sécurité (un score parmi d\'autres).',
          ]}
          verdict="là, c'est puissant"
        />
      </div>

      <motion.p
        initial={{ opacity: 0 }} animate={{ opacity: step >= 1 ? 1 : 0 }} transition={{ delay: 0.2 }}
        style={{ fontSize: tokens.type.size.md, fontFamily: SANS, color: MUTED, textAlign: 'center', maxWidth: 760, lineHeight: 1.5 }}
      >
        Aegyl n'ouvre pas la porte à votre place — il veille sur <b style={{ color: TXT2 }}>qui est derrière le clavier</b>, en continu.
      </motion.p>
    </div>
  )
}
