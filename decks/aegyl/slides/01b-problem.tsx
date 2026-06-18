import { motion } from 'framer-motion'
import type { SlideContext, SlideMeta } from '@engine/types'
import { tokens } from '@design/tokens'
import { Eyebrow } from '@ui/Eyebrow'

export const meta: SlideMeta = {
  speaker: ['robin'],
  duration: 75,
  steps: 1,
  notes: 'Step 0 = pictogrammes (cadenas brisés / 1 sur 2 / 13 jetons). Step 1 = mur de post-it = la triche humaine.',
}

const RED = tokens.color.semantic.critical
const TXT2 = tokens.color.text.secondary
const MUTED = tokens.color.text.muted
const MONO = tokens.type.family.mono
const SANS = tokens.type.family.sans
const LINE = tokens.color.surface.line

/* ── Pictogrammes ─────────────────────────────────────────────── */

function Lock({ broken }: { broken: boolean }) {
  const c = broken ? RED : MUTED
  return (
    <svg width={22} height={26} viewBox="0 0 22 26">
      <path
        d={broken ? 'M5 12 V8 a6 6 0 0 1 11 -2.5' : 'M6 12 V8 a5 5 0 0 1 10 0 V12'}
        fill="none" stroke={c} strokeWidth={2.2} strokeLinecap="round"
      />
      <rect x={4} y={12} width={14} height={11} rx={2.5} fill={broken ? `${RED}16` : 'none'} stroke={c} strokeWidth={2} />
      {broken && <line x1={8} y1={15} x2={14} y2={20} stroke={c} strokeWidth={1.8} strokeLinecap="round" />}
    </svg>
  )
}

function Person({ on }: { on: boolean }) {
  const c = on ? RED : LINE
  return (
    <svg width={20} height={26} viewBox="0 0 20 26">
      <circle cx={10} cy={7} r={5} fill={on ? `${RED}16` : 'none'} stroke={c} strokeWidth={2} />
      <path d="M2.5 25 a7.5 7.5 0 0 1 15 0" fill={on ? `${RED}16` : 'none'} stroke={c} strokeWidth={2} />
    </svg>
  )
}

function Chip() {
  return (
    <div style={{ width: 32, height: 17, borderRadius: 4, border: `1.5px solid ${LINE}`, background: tokens.color.surface.subtle, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, letterSpacing: 1, fontFamily: MONO, color: MUTED }}>
      ••••
    </div>
  )
}

function StatBlock({ value, label, valueColor, delay, children, singleLine }: {
  value: string; label: string; valueColor: string; delay: number; children: React.ReactNode; singleLine?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '0 10px' }}
    >
      <div style={{ display: 'flex', flexWrap: singleLine ? 'nowrap' : 'wrap', gap: singleLine ? 4 : 6, justifyContent: 'center', maxWidth: singleLine ? 'none' : 252, minHeight: 58, alignItems: 'center' }}>
        {children}
      </div>
      <span style={{ fontSize: 38, fontWeight: 700, fontFamily: MONO, color: valueColor, lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 13, fontFamily: SANS, color: TXT2, textAlign: 'center', lineHeight: 1.35, maxWidth: 190 }}>{label}</span>
    </motion.div>
  )
}

function Icons({ n, delay, render }: { n: number; delay: number; render: (i: number) => React.ReactNode }) {
  return (
    <>
      {Array.from({ length: n }).map((_, i) => (
        <motion.div key={i}
          initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: delay + i * 0.035, type: 'spring', stiffness: 320, damping: 18 }}
          style={{ display: 'flex' }}
        >
          {render(i)}
        </motion.div>
      ))}
    </>
  )
}

/* ── Post-it ──────────────────────────────────────────────────── */

const POSTITS = [
  { text: 'Julien2024!', rot: -4, x: 0, y: 0, bg: '#FEF3C7' },
  { text: 'azerty123', rot: 3, x: 1, y: 0, bg: '#FECACA' },
  { text: 'P@ssw0rd', rot: -2, x: 2, y: 0, bg: '#BFDBFE' },
  { text: 'entreprise1', rot: 5, x: 0, y: 1, bg: '#BBF7D0' },
  { text: '********\n(même partout)', rot: -3, x: 1, y: 1, bg: '#FDE68A' },
  { text: 'mdp écrit\nsur post-it', rot: 2, x: 2, y: 1, bg: '#FED7AA' },
]

/* ── Component ────────────────────────────────────────────────── */

export function Component({ step }: SlideContext) {
  const showPostits = step >= 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: 1040, height: '100%', gap: 30 }}>
      <Eyebrow color={RED}>Problématique</Eyebrow>

      <motion.h2
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        style={{ fontSize: tokens.type.size.xl, fontWeight: tokens.type.weight.semibold, letterSpacing: tokens.type.tracking.tight, color: tokens.color.text.primary, margin: 0, textAlign: 'center' }}
      >
        Le mot de passe est le maillon faible.
      </motion.h2>

      {/* Pictogrammes — palette rouge=danger / gris=neutre */}
      <div style={{ display: 'flex', gap: 28, width: '100%', maxWidth: 900, justifyContent: 'center', alignItems: 'flex-start' }}>
        <StatBlock value="81 %" label="des brèches via un mot de passe" valueColor={RED} delay={0.15} singleLine>
          <Icons n={10} delay={0.2} render={(i) => <Lock broken={i < 8} />} />
        </StatBlock>
        <StatBlock value="1 sur 2" label="réutilise le même partout" valueColor={RED} delay={0.3} singleLine>
          <Icons n={10} delay={0.4} render={(i) => <Person on={i % 2 === 0} />} />
        </StatBlock>
        <StatBlock value="× 13" label="mots de passe à retenir" valueColor={TXT2} delay={0.45}>
          <Icons n={13} delay={0.55} render={() => <Chip />} />
        </StatBlock>
      </div>

      {/* Mur de post-it = la triche humaine (step 1) */}
      <div style={{ position: 'relative', width: 340, height: 160, opacity: showPostits ? 1 : 0, transition: 'opacity 0.4s', pointerEvents: showPostits ? 'auto' : 'none' }}>
        {POSTITS.map((p, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, scale: 0.8, rotate: 0 }}
            animate={showPostits ? { opacity: 1, scale: 1, rotate: p.rot } : {}}
            transition={{ delay: i * 0.08, type: 'spring', stiffness: 300, damping: 18 }}
            style={{ position: 'absolute', left: p.x * 115, top: p.y * 82, width: 105, height: 72, background: p.bg, borderRadius: 3, boxShadow: '1px 2px 6px rgba(0,0,0,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}
          >
            <span style={{ fontSize: 11, fontFamily: MONO, fontWeight: 600, color: '#1a1a1a', textAlign: 'center', whiteSpace: 'pre-line', lineHeight: 1.3 }}>
              {p.text}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
