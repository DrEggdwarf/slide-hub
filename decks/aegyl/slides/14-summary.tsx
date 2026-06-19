import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { SlideContext, SlideMeta } from '@engine/types'
import { tokens } from '@design/tokens'
import { Eyebrow } from '@ui/Eyebrow'
import { PipelineBar } from './_pipeline'

export const meta: SlideMeta = {
  speaker: ['robin'],
  duration: 150,
  steps: 4,
  notes: "Derniere etape de vulgarisation ",
}

const MONO = tokens.type.family.mono
const TXT = tokens.color.text.primary
const TXT2 = tokens.color.text.secondary
const MUTED = tokens.color.text.muted
const LINE = tokens.color.surface.line
const A = tokens.color.accent

const PERSON = '#5b6678'
const ACCESS = '#1f2733'
const RED = tokens.color.semantic.critical
const ACCEPT = A.sketch

const W = 1180
const H = 300
const GROUND = 196
const BASE_HT = 52
const SPEED = 72
const CW = 30
const CC = CW / 2

const GATES = [
  { x: 210, name: 'TAILLE', algo: 'Z-Score', color: A.zscore, reason: 'hors gabarit' },
  { x: 466, name: 'COMPORTEMENT', algo: 'Isolation Forest', color: A.iforest, reason: 'agité · anormal' },
  { x: 722, name: 'VISAGE', algo: 'Réseau Siamois', color: A.snn, reason: 'pas vous' },
  { x: 978, name: 'CLÉ', algo: 'Secure Sketch', color: A.sketch, reason: '' },
]

type Kind = 'you' | 'giant' | 'agite' | 'sosie' | 'twin' | 'brute' | 'replay'
type Attack = 'brute' | 'replay'
interface Slot { k: Kind; attack?: Attack }

const BASE: Kind[] = ['giant', 'agite', 'sosie', 'twin', 'you', 'giant', 'agite', 'sosie', 'twin', 'you']
const POOL: Slot[] = [
  ...BASE.map(k => ({ k } as Slot)),
  { k: 'brute', attack: 'brute' }, { k: 'brute', attack: 'brute' }, { k: 'brute', attack: 'brute' },
  { k: 'replay', attack: 'replay' },
]
const rgOf = (k: Kind) => (k === 'giant' ? 0 : k === 'agite' ? 1 : k === 'brute' ? 1 : k === 'sosie' ? 2 : k === 'twin' ? 3 : -1)
const reasonOf = (k: Kind) => (k === 'giant' ? 'hors gabarit' : k === 'agite' ? 'agité · anormal' : k === 'brute' ? 'force brute' : k === 'sosie' ? 'pas vous' : k === 'twin' ? 'clé inexacte' : k === 'replay' ? 'mauvaise phrase' : '')

const KEYMETAL = '#5b6678'
const REF_BIT = [5, 9, 5, 9, 6]
const TWIN_BIT = [5, 9, 11, 9, 2]
function MiniKey({ kind }: { kind: Kind }) {
  if (kind !== 'you' && kind !== 'twin') return null
  const bit = kind === 'you' ? REF_BIT : TWIN_BIT
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      {kind === 'twin' && <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 800, color: RED }}>≠</span>}
      <svg width={50} height={22} viewBox="0 0 50 22" style={{ display: 'block' }}>
        <circle cx={6} cy={7} r={5} fill="none" stroke={KEYMETAL} strokeWidth={2} />
        <rect x={10} y={5} width={38} height={4} rx={1} fill={KEYMETAL} />
        {bit.map((h, i) => {
          const wrong = kind === 'twin' && REF_BIT[i] !== TWIN_BIT[i]
          return <rect key={i} x={16 + i * 7} y={9} width={3.6} height={h} rx={1} fill={wrong ? RED : KEYMETAL} />
        })}
      </svg>
    </div>
  )
}

function KeyIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size * 2.1} height={size} viewBox="0 0 44 20" fill="none" style={{ display: 'block' }}>
      <circle cx="9" cy="10" r="6.4" stroke={color} strokeWidth="2.4" /><circle cx="9" cy="10" r="1.9" fill={color} />
      <line x1="15.4" y1="10" x2="41" y2="10" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
      <line x1="34" y1="10" x2="34" y2="16" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
      <line x1="39" y1="10" x2="39" y2="15.5" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

function CharFig({ kind }: { kind: Kind }) {
  const c = 'var(--c)'
  const acc = kind !== 'sosie'   // chapeau + lunettes pour tous sauf le sosie (le replay imite "vous", donc il les a)
  const giant = kind === 'giant'
  return (
    <div style={{ position: 'relative', width: CW, height: BASE_HT, transform: giant ? 'scale(1.5)' : 'none', transformOrigin: 'bottom center' }}>
      <div style={{ position: 'absolute', bottom: 0, left: 9, width: 5, height: 15, borderRadius: 2.5, background: c }} />
      <div style={{ position: 'absolute', bottom: 0, left: 16, width: 5, height: 15, borderRadius: 2.5, background: c }} />
      <div style={{ position: 'absolute', bottom: 13, left: 7, width: 16, height: 23, borderRadius: 8, background: c }} />
      <div style={{ position: 'absolute', top: 7, left: 8, width: 14, height: 14, borderRadius: '50%', background: c }} />
      {acc && (
        <svg width={18} height={8} viewBox="0 0 18 8" style={{ position: 'absolute', top: 10, left: 6 }}>
          <circle cx={4} cy={4} r={3} fill="none" stroke={ACCESS} strokeWidth={1.4} />
          <circle cx={14} cy={4} r={3} fill="none" stroke={ACCESS} strokeWidth={1.4} />
          <line x1={7} y1={4} x2={11} y2={4} stroke={ACCESS} strokeWidth={1.4} />
        </svg>
      )}
      {acc && (
        <>
          <div style={{ position: 'absolute', top: 6, left: 4, width: 22, height: 3, borderRadius: 1.5, background: ACCESS }} />
          <div style={{ position: 'absolute', top: -1, left: 9, width: 12, height: 8, borderRadius: '3px 3px 0 0', background: ACCESS }} />
        </>
      )}
    </div>
  )
}

function MiniFace({ color }: { color: string }) {
  return (
    <svg width={28} height={30} viewBox="0 0 28 30">
      <circle cx={14} cy={16} r={8} fill="none" stroke={color} strokeWidth={1.6} />
      <circle cx={10} cy={15} r={2.4} fill="none" stroke={color} strokeWidth={1.3} />
      <circle cx={18} cy={15} r={2.4} fill="none" stroke={color} strokeWidth={1.3} />
      <line x1={12.4} y1={15} x2={15.6} y2={15} stroke={color} strokeWidth={1.3} />
      <rect x={4} y={6} width={20} height={2.4} rx={1.2} fill={color} />
      <rect x={9} y={1} width={10} height={6} rx={1.5} fill={color} />
    </svg>
  )
}

function GateView({ g, i, active, onToggle }: { g: typeof GATES[number]; i: number; active: boolean; onToggle: () => void }) {
  const top = GROUND - 134
  const col = active ? g.color : LINE
  const isKey = i === 3
  return (
    <>
      <div style={{ position: 'absolute', left: g.x - 31, top, width: 6, height: 134, borderRadius: 3, background: col, opacity: active ? 0.9 : 0.5 }} />
      <div style={{ position: 'absolute', left: g.x + 25, top, width: 6, height: 134, borderRadius: 3, background: col, opacity: active ? 0.9 : 0.5 }} />
      <div style={{ position: 'absolute', left: g.x - 31, top: top - 7, width: 62, height: 7, borderRadius: 3, background: col, opacity: active ? 0.9 : 0.5 }} />

      <div onClick={onToggle} style={{ position: 'absolute', left: g.x - 2, top: top - 52, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', userSelect: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 15, height: 15, borderRadius: 4, border: `2px solid ${active ? g.color : MUTED}`, background: active ? g.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {active && <svg width={9} height={9} viewBox="0 0 12 12"><path d="M2.5 6.5 L5 9 L9.5 3.5" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: active ? g.color : MUTED, whiteSpace: 'nowrap' }}>{i + 1}. {g.name}</span>
        </div>
        <span style={{ fontFamily: MONO, fontSize: 8.5, color: MUTED, whiteSpace: 'nowrap' }}>{g.algo}</span>
      </div>

      <div style={{ position: 'absolute', left: g.x - 2, top: top + 22, transform: 'translateX(-50%)', opacity: active ? 0.95 : 0.3 }}>
        {i === 0 && <svg width={26} height={42} viewBox="0 0 26 42"><line x1={3} y1={2} x2={3} y2={40} stroke={col} strokeWidth={1.3} />{[6, 14, 22, 30, 38].map(y => <line key={y} x1={1} y1={y} x2={6} y2={y} stroke={col} strokeWidth={1.1} />)}<rect x={9} y={12} width={14} height={26} rx={2} fill="none" stroke={col} strokeWidth={1.4} strokeDasharray="2 2" /></svg>}
        {i === 1 && <svg width={34} height={20} viewBox="0 0 34 20"><path d="M1 10 q4 -6 8 0 t8 0 t8 0 t8 0" fill="none" stroke={col} strokeWidth={1.6} strokeLinecap="round" /></svg>}
        {i === 2 && <MiniFace color={col} />}
        {isKey && <KeyIcon size={18} color={col} />}
      </div>

      {!isKey
        ? active && <span style={{ position: 'absolute', left: g.x - 2, top: GROUND + 12, transform: 'translateX(-50%)', fontFamily: MONO, fontSize: 9.5, fontWeight: 700, color: RED, whiteSpace: 'nowrap' }}>✗ {g.reason}</span>
        : active && <span style={{ position: 'absolute', left: g.x - 2, top: GROUND + 12, transform: 'translateX(-50%)', fontFamily: MONO, fontSize: 9.5, fontWeight: 700, color: ACCEPT, whiteSpace: 'nowrap' }}>✓ exact → clé</span>}
    </>
  )
}

/* ── convoyeur ─────────────────────────────────────────────────── */
interface Menaces { brute: boolean; replay: boolean; drift: boolean; fraicheur: boolean }

function Convoyeur({ enabled, onToggle, menaces }: { enabled: boolean[]; onToggle: (i: number) => void; menaces: Menaces }) {
  const enRef = useRef(enabled); enRef.current = enabled
  const menRef = useRef(menaces); menRef.current = menaces
  const roots = useRef<(HTMLDivElement | null)[]>([])
  const tags = useRef<(HTMLDivElement | null)[]>([])
  const keys = useRef<(HTMLDivElement | null)[]>([])
  const slips = useRef<(HTMLDivElement | null)[]>([])
  const keyEls = useRef<(HTMLDivElement | null)[]>([])
  const drifts = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const chars = POOL.map((s, i) => {
      const rg = rgOf(s.k)
      const lane = Math.floor(i / 5)
      const gateX = rg >= 0 ? GATES[rg].x : GATES[3].x
      const nudge = s.k === 'you' ? 60 : s.k === 'twin' ? -40 : 0
      const base = s.attack === 'replay' ? 70
        : s.attack === 'brute' ? -30 - (i % 3) * 150
          : gateX - 120 + nudge - lane * 780
      return { k: s.k, attack: s.attack, rg, parkX: base, x: base, y: 0, opacity: 1, judged: false, reject: false, keyed: false, slip: false, faille: false, dropT: 0 }
    })
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now
      const en = enRef.current
      const men = menRef.current
      for (const c of chars) {
        // attaquant dont la menace est désactivée : garé hors-champ
        if (c.attack && !men[c.attack]) {
          c.x = c.parkX - 200; c.y = 0; c.opacity = 0
          c.judged = false; c.reject = false; c.keyed = false; c.slip = false; c.faille = false; c.dropT = 0
          continue
        }
        const spd = c.k === 'brute' ? SPEED * 1.5 : SPEED
        if (!c.reject) c.x += spd * dt
        const center = c.x + CC
        // refus standard à SA porte (giant/agité/sosie/twin/brute)
        if (!c.judged && c.rg >= 0 && en[c.rg] && center >= GATES[c.rg].x) { c.judged = true; c.reject = true }
        // porte clé
        if (!c.judged && !c.keyed && !c.slip && !c.faille && center >= GATES[3].x) {
          if (c.k === 'replay') {
            if (men.fraicheur) { c.judged = true; c.reject = true }  // anti-rejeu → bloqué
            else c.faille = true                                      // rejeu accepté = FAILLE
          } else if (c.rg < 0) {
            if (en[3]) c.keyed = true                                 // vous → clé
          } else {
            c.slip = true                                             // imposteur non filtré
          }
        }
        if (c.reject) { c.dropT += dt; if (c.dropT > 0.55) { c.y += 240 * dt; c.opacity = Math.max(0, c.opacity - 1.5 * dt) } }
        if (c.x > W + 50 || c.opacity <= 0) {
          if (c.attack) { c.x = c.parkX } else { const minX = Math.min(...chars.filter(o => !o.attack).map(o => o.x)); c.x = minX - 256 }
          c.y = 0; c.opacity = 1; c.judged = false; c.reject = false; c.keyed = false; c.slip = false; c.faille = false; c.dropT = 0
        }
      }
      chars.forEach((c, i) => {
        const el = roots.current[i]
        if (el) {
          const shake = (c.k === 'agite' || c.k === 'brute') && !c.reject
          const jx = shake ? Math.sin(now / 26 + i * 1.7) * 4.5 : 0
          const jy = shake ? Math.cos(now / 19 + i * 2.3) * 3.2 : 0
          const rot = shake ? Math.sin(now / 30 + i) * 4 : 0
          el.style.transform = `translate(${c.x + jx}px, ${c.y + jy}px) rotate(${rot}deg)`
          el.style.opacity = String(c.opacity)
          el.style.setProperty('--c', c.reject ? RED : c.keyed ? ACCEPT : c.faille ? RED : c.slip ? RED : PERSON)
        }
        const tg = tags.current[i]; if (tg) tg.style.opacity = c.reject ? '1' : '0'
        const ky = keys.current[i]; if (ky) ky.style.opacity = c.keyed ? '1' : '0'
        const sl = slips.current[i]; if (sl) sl.style.opacity = c.slip ? '1' : '0'
        const dr = drifts.current[i]; if (dr) dr.style.opacity = (c.k === 'you' && men.drift) ? '1' : '0'
        const kl = keyEls.current[i]
        if (kl) {
          if (c.k === 'you' || c.k === 'twin') kl.style.opacity = (en[3] && (c.x + CC) >= GATES[3].x - 35 && !c.slip) ? '1' : '0'
          else if (c.k === 'replay') kl.style.opacity = c.faille ? '1' : '0'
        }
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div style={{ position: 'relative', width: W, height: H }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: GROUND, height: 2.5, background: LINE }} />
      {GATES.map((g, i) => <GateView key={i} g={g} i={i} active={enabled[i]} onToggle={() => onToggle(i)} />)}

      {POOL.map((s, i) => {
        const k = s.k
        return (
          <div key={i} ref={el => { roots.current[i] = el }} style={{ position: 'absolute', top: GROUND - BASE_HT, left: 0, willChange: 'transform', ['--c' as any]: PERSON }}>
            <CharFig kind={k} />

            {/* clé révélée à la porte 4 (vous / jumeau) ou clé rouge (replay en faille) */}
            {(k === 'you' || k === 'twin') && (
              <div ref={el => { keyEls.current[i] = el }} style={{ position: 'absolute', top: -30, left: CC, transform: 'translateX(-50%)', opacity: 0, transition: 'opacity .2s' }}>
                <MiniKey kind={k} />
              </div>
            )}
            {k === 'replay' && (
              <div ref={el => { keyEls.current[i] = el }} style={{ position: 'absolute', top: -28, left: CC - 19, opacity: 0, transition: 'opacity .2s' }}>
                <KeyIcon size={17} color={RED} />
              </div>
            )}

            {/* marqueur "rejeu" permanent sur le replay */}
            {k === 'replay' && (
              <div style={{ position: 'absolute', top: -16, left: CC, transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: RED }} />
                <span style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 700, color: RED }}>rejeu</span>
              </div>
            )}

            {/* étiquette de refus */}
            {k !== 'you' && (
              <div ref={el => { tags.current[i] = el }} style={{ position: 'absolute', top: -54, left: CC, transform: 'translateX(-50%)', opacity: 0, transition: 'opacity .15s', display: 'flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 5, background: '#fff', border: `1.5px solid ${RED}`, boxShadow: '0 2px 6px rgba(0,0,0,.12)', whiteSpace: 'nowrap' }}>
                <span style={{ color: RED, fontWeight: 800, fontSize: 11 }}>✗</span>
                <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: RED }}>{reasonOf(k)}</span>
              </div>
            )}
            {/* non filtré (porte éteinte) */}
            {k !== 'you' && k !== 'replay' && (
              <div ref={el => { slips.current[i] = el }} style={{ position: 'absolute', top: -52, left: CC, transform: 'translateX(-50%)', opacity: 0, transition: 'opacity .15s', display: 'flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 5, background: `${RED}10`, border: `1.5px dashed ${RED}`, whiteSpace: 'nowrap' }}>
                <span style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, color: RED }}>⚠ non filtré</span>
              </div>
            )}
            {/* clé OK (vous) */}
            {k === 'you' && (
              <div ref={el => { keys.current[i] = el }} style={{ position: 'absolute', top: -34, left: CC + 30, opacity: 0, transition: 'opacity .2s' }}>
                <div style={{ width: 17, height: 17, borderRadius: '50%', background: ACCEPT, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 8px ${ACCEPT}66` }}>
                  <svg width={9} height={9} viewBox="0 0 12 12"><path d="M2.5 6.5 L5 9 L9.5 3.5" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
              </div>
            )}
            {/* drift : ré-apprentissage (vous) */}
            {k === 'you' && (
              <div ref={el => { drifts.current[i] = el }} style={{ position: 'absolute', top: -34, left: CC - 52, opacity: 0, transition: 'opacity .2s', display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}>
                <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, color: A.snn }}>↻</span>
                <span style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 700, color: A.snn }}>ré-appris</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ── chip menace ───────────────────────────────────────────────── */
function MenaceChip({ label, on, color, onClick }: { label: string; on: boolean; color: string; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', userSelect: 'none', padding: '4px 10px', borderRadius: 8, border: `1.5px solid ${on ? color : LINE}`, background: on ? `${color}10` : 'transparent', transition: 'all .15s' }}>
      <span style={{ width: 14, height: 14, borderRadius: 4, border: `2px solid ${on ? color : MUTED}`, background: on ? color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {on && <svg width={8} height={8} viewBox="0 0 12 12"><path d="M2.5 6.5 L5 9 L9.5 3.5" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </span>
      <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: on ? color : TXT2, whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  )
}

export function Component({ step }: SlideContext) {
  const [enabled, setEnabled] = useState<boolean[]>([false, false, false, false])
  useEffect(() => { setEnabled(Array.from({ length: 4 }, (_, i) => i < step)) }, [step])
  const toggle = (i: number) => setEnabled(e => e.map((v, j) => (j === i ? !v : v)))

  const [menaces, setMenaces] = useState<Menaces>({ brute: false, replay: false, drift: false, fraicheur: false })
  const tm = (k: keyof Menaces) => setMenaces(m => ({ ...m, [k]: !m[k] }))

  const note = menaces.brute
    ? 'Force brute : des tentatives au hasard → rythmes atypiques → bloquées au Comportement.'
    : menaces.replay && !menaces.fraicheur
      ? 'Replay : votre frappe enregistrée et rejouée franchit les 4 portes (c\'est votre empreinte exacte) → faille.'
      : menaces.replay && menaces.fraicheur
        ? 'Phrase aléatoire : une nouvelle phrase à chaque session → la frappe rejouée est sur l\'ancienne, elle ne correspond pas. Le rejeu ne sert à rien.'
        : menaces.drift
          ? 'Drift : votre frappe évolue avec le temps — ce n\'est pas une attaque. Le gabarit se ré-apprend → vous restez reconnu.'
          : ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: 1240, height: '100%', gap: 10, paddingTop: 66 }}>
      <PipelineBar active={4} />
      <Eyebrow color={A.sketch}>Le grand tri · 4 portes</Eyebrow>
      <motion.h2
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        style={{ fontSize: tokens.type.size.lg, fontWeight: tokens.type.weight.semibold, letterSpacing: tokens.type.tracking.tight, color: TXT, margin: 0, textAlign: 'center' }}
      >
        On attend <span style={{ color: A.sketch }}>une</span> personne précise.
      </motion.h2>

      <Convoyeur enabled={enabled} onToggle={toggle} menaces={menaces} />

      {/* panneau Menaces */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 700, letterSpacing: 1, color: MUTED }}>MENACES</span>
        <MenaceChip label="Brute force" on={menaces.brute} color={A.iforest} onClick={() => tm('brute')} />
        <MenaceChip label="Replay" on={menaces.replay} color={RED} onClick={() => tm('replay')} />
        <MenaceChip label="Drift" on={menaces.drift} color={A.snn} onClick={() => tm('drift')} />
        {menaces.replay && <MenaceChip label="🎲 Phrase aléatoire (parade)" on={menaces.fraicheur} color={ACCEPT} onClick={() => tm('fraicheur')} />}
      </div>
      <div style={{ minHeight: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {menaces.replay && !menaces.fraicheur ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 8, background: `${RED}10`, border: `2px solid ${RED}` }}>
            <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 800, color: RED }}>⚠ Faille — le rejeu repart avec votre clé.</span>
            <span style={{ fontFamily: MONO, fontSize: 11, color: RED }}>Parade : activez la Fraîcheur.</span>
          </div>
        ) : note ? (
          <span style={{ fontFamily: MONO, fontSize: 11, color: TXT2, textAlign: 'center' }}>{note}</span>
        ) : null}
      </div>
    </div>
  )
}
