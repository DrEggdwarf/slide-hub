import { motion } from 'framer-motion'
import { SlideContext, SlideMeta } from '@engine/types'
import { tokens } from '@design/tokens'
import { Eyebrow } from '@ui/Eyebrow'

export const meta: SlideMeta = {
  title: 'La réponse — Aegyl',
  speaker: ['thomas'],
  duration: 45,
  steps: 0,
  notes: "Reveal de la solution : Λegyl (Cinzel). Réponse à « qu'est-ce qui coche toutes ces cases ? ». Soundwave en boucle continue.",
}

const CLR = tokens.color.accent.aegyl
const TXT = tokens.color.text.primary
const TXT2 = tokens.color.text.secondary
const MONO = tokens.type.family.mono
const CINZEL = '"Cinzel", serif'

const BARS = [14, 30, 22, 44, 18, 52, 26, 38, 16, 48, 24, 34, 20, 42]

export function Component(_: SlideContext) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      width: '100%', maxWidth: 960, height: '100%', gap: 24,
    }}>
      <Eyebrow color={CLR}>La réponse</Eyebrow>

      <motion.span
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        style={{ fontSize: tokens.type.size.md, fontFamily: MONO, color: tokens.color.text.muted, letterSpacing: tokens.type.tracking.wide }}
      >
        Une seule chose les coche toutes :
      </motion.span>

      {/* REVEAL de la marque — Λegyl en Cinzel */}
      <motion.h1
        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.6, ease: tokens.motion.ease.out }}
        style={{
          fontFamily: CINZEL, fontWeight: 600, fontSize: 104, color: TXT, margin: 0, lineHeight: 1,
          display: 'flex', alignItems: 'baseline', letterSpacing: '0.06em',
        }}
      >
        <span style={{ fontWeight: 400, transform: 'scaleX(0.9)', display: 'inline-block', transformOrigin: 'bottom center' }}>Λ</span>
        <span>egyl</span>
      </motion.h1>

      {/* sous-titre */}
      <motion.span
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
        style={{ fontSize: tokens.type.size.lg, fontFamily: tokens.type.family.sans, color: CLR, textAlign: 'center', fontWeight: 600 }}
      >
        qui vous identifie par votre <span style={{ textDecoration: 'underline', textDecorationColor: `${CLR}55` }}>rythme de frappe</span>.
      </motion.span>

      {/* signature de frappe — équaliseur en boucle continue */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, height: 80, marginTop: 6 }}>
        {BARS.map((h, i) => (
          <motion.div
            key={i}
            initial={{ height: 6, opacity: 0 }}
            animate={{ height: [h * 0.5, h * 1.2, h * 0.7, h, h * 0.55], opacity: 1 }}
            transition={{
              height: { duration: 1.9, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut', delay: i * 0.07 },
              opacity: { duration: 0.4, delay: 0.4 + i * 0.03 },
            }}
            style={{ width: 8, borderRadius: 4, background: CLR }}
          />
        ))}
      </div>

      <motion.span
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
        style={{ fontSize: tokens.type.size.sm, fontFamily: MONO, color: TXT2, textAlign: 'center', lineHeight: 1.5, maxWidth: 640 }}
      >
        Une biométrie comportementale — ni mot de passe à retenir, ni secret à voler.
      </motion.span>
    </div>
  )
}
