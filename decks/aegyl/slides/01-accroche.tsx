import { motion } from 'framer-motion'
import { SlideContext, SlideMeta } from '@engine/types'
import { tokens } from '@design/tokens'
import { useState } from 'react'

export const meta: SlideMeta = {
  speaker: ['robin'],
  duration: 45,
  steps: 0,
  notes: 'Hook : poser le paradoxe vie privée vs biométrie. 1 min.',
}

export function Component(_: SlideContext) {
  const [resetDone, setResetDone] = useState(false)

  const handleReset = () => {
    const channel = new BroadcastChannel('aegyl-demo')
    channel.postMessage({ type: 'reset' })
    channel.close()
    setResetDone(true)
    setTimeout(() => setResetDone(false), 2000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: tokens.space[7], position: 'relative' }}>
      {/* Reset demo button — top-right, discrete */}
      <button
        onClick={handleReset}
        style={{
          position: 'absolute', top: 16, right: 16,
          padding: '6px 12px', borderRadius: 6,
          background: resetDone ? tokens.color.semantic.success + '20' : tokens.color.text.tertiary + '10',
          border: `1px solid ${resetDone ? tokens.color.semantic.success : tokens.color.text.tertiary}40`,
          color: resetDone ? tokens.color.semantic.success : tokens.color.text.tertiary,
          fontSize: 11, fontFamily: tokens.type.family.mono, fontWeight: 500,
          cursor: 'pointer', transition: 'all 0.2s',
        }}
      >
        {resetDone ? '✓ Reset' : '↺ Reset demo'}
      </button>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: tokens.motion.duration.slow, ease: tokens.motion.ease.out }}
        style={{
          fontSize: tokens.type.size.xs,
          fontFamily: tokens.type.family.mono,
          letterSpacing: tokens.type.tracking.wider,
          color: tokens.color.accent.aegyl,
          textTransform: 'uppercase',
        }}
      >
        Aegyl — Keystroke Dynamics Authentication
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: tokens.motion.duration.slow, ease: tokens.motion.ease.out, delay: 0.15 }}
        style={{
          fontSize: tokens.type.size['3xl'],
          fontWeight: tokens.type.weight.semibold,
          letterSpacing: tokens.type.tracking.tighter,
          lineHeight: tokens.type.leading.snug,
          color: tokens.color.text.primary,
          margin: 0,
          maxWidth: 960,
          textAlign: 'center',
        }}
      >
        Et si votre clavier reconnaissait
        <br />
        que c'est bien{' '}
        <span style={{ color: tokens.color.accent.aegyl }}>VOUS</span> qui tapez,
        <br />
        sans jamais savoir{' '}
        <span style={{ color: tokens.color.text.tertiary }}>CE que vous tapez</span>&thinsp;?
      </motion.h1>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: tokens.motion.duration.slow, delay: 0.5 }}
        style={{
          display: 'flex',
          gap: tokens.space[7],
          marginTop: tokens.space[4],
          fontSize: tokens.type.size.sm,
          color: tokens.color.text.secondary,
        }}
      >
        {['Biométrie comportementale', 'Authentification continue', '100 % local · RGPD-compliant'].map(
          (t, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: tokens.color.accent.aegyl,
                  opacity: 0.6,
                }}
              />
              {t}
            </span>
          ),
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: tokens.motion.duration.slow, delay: 0.7 }}
        style={{
          fontSize: tokens.type.size.xs,
          color: tokens.color.text.tertiary,
          fontFamily: tokens.type.family.mono,
          marginTop: tokens.space[4],
        }}
      >
        Tauri · Rust · React · TypeScript · ~5 KB / profil
      </motion.div>
    </div>
  )
}
