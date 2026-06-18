import { motion } from 'framer-motion'
import { SlideContext, SlideMeta } from '@engine/types'
import { tokens } from '@design/tokens'
import { Eyebrow } from '@ui/Eyebrow'
import { Stack } from '@ui/Stack'
import { Reveal } from '@ui/Reveal'
import { Rule } from '@ui/Rule'

export const meta: SlideMeta = {
  speaker: ['thomas'],
  duration: 75,
  steps: 1,
  notes: 'Limitations assumées + pistes futures. 2 min.',
}

const limits = [
  { title: 'Coïncidence biométrique', desc: "Imposteur tapant par hasard comme moi → accepté (faiblesse intrinsèque one-class)" },
  { title: 'Drift utilisateur', desc: 'Fatigue, clavier différent, position des mains → pas de re-enrôlement adaptatif' },
  { title: 'Adversaire actif', desc: 'Replay attack, modèle adversarial entraîné sur ma signature — non testé' },
  { title: 'Précision navigateur', desc: 'ms (pas µs) → démo web légèrement dégradée vs app native Tauri' },
]

const futures = [
  { title: 'Dynamique de souris', desc: 'Trajectoires, vitesse, accélération, jerk — complément naturel' },
  { title: 'Mobile', desc: 'Pression tactile, surface du doigt, gyroscope, accéléromètre' },
  { title: 'Siamese Network', desc: 'Entraîné en contrastive sur datasets publics (CMU, Buffalo, Aalto 136M)' },
  { title: 'Re-enrôlement adaptatif', desc: 'Sliding window N=50 sessions, mise à jour continue du profil' },
]

export function Component({ step }: SlideContext) {
  return (
    <Stack gap={28} align="start" style={{ width: '100%', maxWidth: 960 }}>
      <Eyebrow>Limitations & ouverture</Eyebrow>

      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: tokens.motion.duration.slow, ease: tokens.motion.ease.out }}
        style={{
          fontSize: tokens.type.size['2xl'],
          fontWeight: tokens.type.weight.semibold,
          letterSpacing: tokens.type.tracking.tight,
          color: tokens.color.text.primary,
          margin: 0,
        }}
      >
        Ce qu'Aegyl ne fait pas (encore)
      </motion.h2>

      <div style={{ display: 'flex', gap: tokens.space[7], width: '100%', alignItems: 'flex-start' }}>
        {/* Limits — always visible */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: tokens.motion.duration.slow, ease: tokens.motion.ease.out, delay: 0.15 }}
          style={{ flex: '1 1 50%', textAlign: 'left' }}
        >
          <div style={{
            fontSize: tokens.type.size.xs, fontFamily: tokens.type.family.mono,
            color: tokens.color.semantic.critical, fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: tokens.type.tracking.wider, marginBottom: 12,
          }}>Limites assumées</div>

          <Stack gap={12} align="start">
            {limits.map((l, i) => (
              <motion.div
                key={l.title}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.2 + i * 0.08 }}
                style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}
              >
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: tokens.color.semantic.critical, marginTop: 7, flexShrink: 0,
                }} />
                <div>
                  <div style={{ fontSize: tokens.type.size.sm, fontWeight: 600, color: tokens.color.text.primary }}>{l.title}</div>
                  <div style={{ fontSize: tokens.type.size.xs, color: tokens.color.text.tertiary, lineHeight: tokens.type.leading.relaxed }}>{l.desc}</div>
                </div>
              </motion.div>
            ))}
          </Stack>
        </motion.div>

        <Rule vertical width={200} />

        {/* Futures — step >= 1 */}
        <Reveal show={step >= 1} delay={0.05}>
          <div style={{ flex: '1 1 50%', textAlign: 'left' }}>
            <div style={{
              fontSize: tokens.type.size.xs, fontFamily: tokens.type.family.mono,
              color: tokens.color.accent.sketch, fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: tokens.type.tracking.wider, marginBottom: 12,
            }}>Pistes futures</div>

            <Stack gap={12} align="start">
              {futures.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}
                >
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: tokens.color.accent.sketch, marginTop: 7, flexShrink: 0,
                  }} />
                  <div>
                    <div style={{ fontSize: tokens.type.size.sm, fontWeight: 600, color: tokens.color.text.primary }}>{f.title}</div>
                    <div style={{ fontSize: tokens.type.size.xs, color: tokens.color.text.tertiary, lineHeight: tokens.type.leading.relaxed }}>{f.desc}</div>
                  </div>
                </motion.div>
              ))}
            </Stack>
          </div>
        </Reveal>
      </div>
    </Stack>
  )
}
