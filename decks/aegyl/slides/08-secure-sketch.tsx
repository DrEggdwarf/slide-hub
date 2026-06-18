import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { SlideContext, SlideMeta } from '@engine/types'
import { tokens } from '@design/tokens'
import { Eyebrow } from '@ui/Eyebrow'
import { PipelineBar, STAGES } from './_pipeline'

export const meta: SlideMeta = {
  speaker: ['arnaud'],
  duration: 120,
  steps: 1,
  notes: 'Step 0 = cryptex 2-pass scanner 3 rows. Step 1 = RS explanation panel.',
}

/* ── Palette ───────────────────────────────────────────────────────── */

const MATCH    = '#22A06B'
const FIXED    = '#38BDF8'
const RED      = '#E24B4A'
const ORANGE   = '#D4860B'
const VIOLET   = '#7F77DD'
const YELLOW   = '#D4A015'
const TXT      = tokens.color.text.primary
const TXT2     = tokens.color.text.secondary
const TXT3     = tokens.color.text.tertiary
const MONO     = tokens.type.family.mono
const CLR      = STAGES[3].color

/* ── RS parameters ───────────────────────────────────────────────────── */

const N = 8
const K = 4
const T = Math.floor((N - K) / 2)  // = 2

const W_ENROLL = [3, 7, 2, 5, 6, 1, 4, 7]

/* ── PRNG ────────────────────────────────────────────────────────── */

function makeRng(seed: number) {
  let s = seed
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646 }
}

/* ── Sample ──────────────────────────────────────────────────────── */

interface Sample {
  id: number
  wPrime: number[]
  errors: number
  errorMask: boolean[]
  fixablePositions: number[]
  correctable: boolean
  phase: 'arrive' | 'scan1' | 'pause' | 'scan2' | 'result' | 'fade'
  phaseT: number
}

function genWPrime(rng: () => number, targetErrors: number): number[] {
  const wp = [...W_ENROLL]
  const indices = Array.from({ length: N }, (_, i) => i)
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]]
  }
  for (let i = 0; i < targetErrors; i++) {
    let nv: number
    do { nv = Math.floor(rng() * 8) } while (nv === wp[indices[i]])
    wp[indices[i]] = nv
  }
  return wp
}

function pickErrorCount(rng: () => number): number {
  const r = rng()
  if (r < 0.20) return 0
  if (r < 0.40) return 1
  if (r < 0.60) return T
  if (r < 0.80) return 3
  return 4 + Math.floor(rng() * 4)
}

/* ── Phase timings ─────────────────────────────────────────────────── */

const ARRIVE_MS  = 800
const SCAN1_MS   = 1600
const PAUSE_MS   = 700
const SCAN2_MS   = 1400
const RESULT_MS  = 1400
const FADE_MS    = 400
const SPAWN_MS   = ARRIVE_MS + SCAN1_MS + PAUSE_MS + SCAN2_MS + RESULT_MS + FADE_MS + 400

/* ── Layout ──────────────────────────────────────────────────────── */

const CELL = 42
const GAP  = 6
const GRID_W = N * CELL + (N - 1) * GAP
const LABEL_W = 150
const ROW_GAP = 6

/* ── Cell ────────────────────────────────────────────────────────── */

function CryptexCell({ value, color, borderColor, visible = true }: {
  value: number | null; color: string; borderColor?: string
  visible?: boolean
}) {
  return (
    <div style={{
      width: CELL, height: CELL, borderRadius: 6,
      border: `2px solid ${visible ? (borderColor ?? color) : `${TXT3}15`}`,
      background: visible ? `${color}18` : `${TXT3}04`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 15, fontFamily: MONO, fontWeight: 700,
      color: visible ? color : `${TXT3}20`,
      transition: 'all 0.25s ease',
    }}>
      {value !== null && visible ? value.toString(16).toUpperCase() : ''}
    </div>
  )
}

/* ── Simulation ──────────────────────────────────────────────────── */

function useSimulation() {
  const [samples, setSamples] = useState<Sample[]>([])
  const [accepted, setAccepted] = useState(0)
  const [rejected, setRejected] = useState(0)
  const nextId = useRef(0)
  const rng = useRef(makeRng(42))
  const counted = useRef(new Set<number>())

  const advancePhase = useCallback((s: Sample, now: number): Sample | null => {
    const elapsed = now - s.phaseT
    switch (s.phase) {
      case 'arrive':
        if (elapsed > ARRIVE_MS) return { ...s, phase: 'scan1', phaseT: now }
        return s
      case 'scan1':
        if (elapsed > SCAN1_MS) return { ...s, phase: 'pause', phaseT: now }
        return s
      case 'pause':
        if (elapsed > PAUSE_MS) return { ...s, phase: 'scan2', phaseT: now }
        return s
      case 'scan2':
        if (elapsed > SCAN2_MS) {
          return { ...s, phase: 'result', phaseT: now }
        }
        return s
      case 'result':
        if (elapsed > RESULT_MS) return { ...s, phase: 'fade', phaseT: now }
        return s
      case 'fade':
        if (elapsed > FADE_MS) return null
        return s
    }
  }, [])

  useEffect(() => {
    const tick = () => {
      const now = Date.now()
      setSamples(prev => {
        const updated: Sample[] = []
        for (const s of prev) {
          const next = advancePhase(s, now)
          if (next) updated.push(next)
        }
        return updated
      })
    }
    const id = setInterval(tick, 50)
    return () => clearInterval(id)
  }, [advancePhase])

  /* Count verdicts outside the state updater to avoid StrictMode double-fire */
  useEffect(() => {
    for (const s of samples) {
      if ((s.phase === 'result' || s.phase === 'fade') && !counted.current.has(s.id)) {
        counted.current.add(s.id)
        if (s.correctable) setAccepted(a => a + 1)
        else setRejected(r => r + 1)
      }
    }
  }, [samples])

  useEffect(() => {
    const spawn = () => {
      const errors = pickErrorCount(rng.current)
      const wp = genWPrime(rng.current, errors)
      const mask = wp.map((v, i) => v !== W_ENROLL[i])
      const errorIdxs = mask.map((e, i) => e ? i : -1).filter(i => i >= 0)
      setSamples(prev => [...prev, {
        id: nextId.current++,
        wPrime: wp,
        errors,
        errorMask: mask,
        fixablePositions: errorIdxs.slice(0, T),
        correctable: errors <= T,
        phase: 'arrive',
        phaseT: Date.now(),
      }])
    }
    spawn()
    const id = setInterval(spawn, SPAWN_MS)
    return () => clearInterval(id)
  }, [])

  return { samples, accepted, rejected }
}

/* ── Component ───────────────────────────────────────────────────── */

export function Component({ step }: SlideContext) {
  const showDetail = step >= 1
  const { samples, accepted, rejected } = useSimulation()

  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 40)
    return () => clearInterval(id)
  }, [])

  const activeSample = [...samples].reverse().find(s => s.phase !== 'fade') ?? null
  const phase = activeSample?.phase ?? null
  const elapsed = activeSample ? Math.max(0, now - activeSample.phaseT) : 0

  const wPrime = activeSample?.wPrime ?? W_ENROLL
  const errorMask = activeSample?.errorMask ?? Array(N).fill(false)
  const errors = activeSample?.errors ?? 0
  const correctable = activeSample?.correctable ?? true
  const fixableSet = new Set(activeSample?.fixablePositions ?? [])

  const arriveCol = phase === 'arrive'
    ? Math.floor((elapsed / ARRIVE_MS) * N) : (phase ? N : 0)

  const scan1Pos = phase === 'scan1'
    ? (elapsed / SCAN1_MS) * N
    : (phase === 'pause' || phase === 'scan2' || phase === 'result' || phase === 'fade') ? N : 0

  const scan2Pos = phase === 'scan2'
    ? (elapsed / SCAN2_MS) * N
    : (phase === 'result' || phase === 'fade') ? N : 0

  const scan1Done = scan1Pos >= N
  const scan2Done = scan2Pos >= N
  const showVerdict = phase === 'result' || phase === 'fade'
  const showRow3 = phase === 'pause' || phase === 'scan2' || phase === 'result' || phase === 'fade'

  /* Row 2 state: comparison only (freezes after scan1) */
  function row2Cell(i: number): { color: string; borderColor: string; value: number } {
    const arrived = i < arriveCol || phase !== 'arrive'
    const scanned1 = scan1Pos > i + 0.5
    if (!arrived) return { color: TXT3, borderColor: `${TXT3}20`, value: wPrime[i] }
    if (!scanned1) return { color: ORANGE, borderColor: ORANGE, value: wPrime[i] }
    if (errorMask[i]) return { color: RED, borderColor: RED, value: wPrime[i] }
    return { color: MATCH, borderColor: MATCH, value: wPrime[i] }
  }

  /* Row 3 state: correction results */
  function row3Cell(i: number): { color: string; borderColor: string; value: number; label: string } {
    const scanned2 = scan2Pos > i + 0.5
    if (!scanned2) return { color: TXT3, borderColor: `${TXT3}20`, value: wPrime[i], label: '' }
    const isErr = errorMask[i]
    const isFixable = fixableSet.has(i)
    if (isErr && isFixable) return { color: FIXED, borderColor: FIXED, value: W_ENROLL[i], label: '↻' }
    if (isErr && !isFixable) return { color: RED, borderColor: RED, value: wPrime[i], label: '✗' }
    return { color: MATCH, borderColor: MATCH, value: wPrime[i], label: '✓' }
  }

  const scan1X = (scan1Pos / N) * GRID_W
  const scan2X = (scan2Pos / N) * GRID_W

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', width: '100%', maxWidth: 960,
      height: '100%', gap: 10,
      paddingTop: 80,
    }}>
      <PipelineBar active={3} />
      <Eyebrow color={CLR}>Crypto · Secure Sketch</Eyebrow>

      <div style={{ textAlign: 'center', maxWidth: 620 }}>
        <motion.h2
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            fontSize: tokens.type.size.lg, fontWeight: tokens.type.weight.semibold,
            letterSpacing: tokens.type.tracking.tight,
            color: TXT, margin: 0,
          }}
        >
          Fuzzy Extractor
        </motion.h2>
        <motion.p style={{
          fontSize: 12, color: TXT2, fontFamily: MONO, margin: '4px 0 0',
        }}>
          Tolère jusqu'à {T} différences sur {N}
        </motion.p>
      </div>

      {/* Cryptex grid */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: ROW_GAP,
        alignItems: 'center', position: 'relative',
      }}>

        {/* ROW 1 - Référence (static) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: LABEL_W, textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 12, fontFamily: MONO, fontWeight: 700, color: TXT2 }}>
              Référence
            </div>
            <div style={{ fontSize: 9, fontFamily: MONO, color: TXT3 }}>
              empreinte d'inscription
            </div>
          </div>
          <div style={{ display: 'flex', gap: GAP }}>
            {W_ENROLL.map((v, i) => (
              <CryptexCell key={i} value={v} color={TXT2} borderColor={`${TXT2}60`} />
            ))}
          </div>
        </div>

        {/* Comparison indicators (always present, fade in) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, opacity: scan1Done ? 1 : 0, transition: 'opacity 0.3s' }}>
          <div style={{ width: LABEL_W, textAlign: 'right', flexShrink: 0 }}>
            <span style={{ fontSize: 10, fontFamily: MONO, fontWeight: 600, color: VIOLET }}>
              {scan1Done ? `${errors} différence${errors !== 1 ? 's' : ''}` : '\u00a0'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: GAP }}>
            {Array.from({ length: N }, (_, i) => (
              <div key={i} style={{
                width: CELL, height: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700,
                color: errorMask[i] ? RED : MATCH,
              }}>
                {scan1Done ? (errorMask[i] ? '✗' : '✓') : '·'}
              </div>
            ))}
          </div>
        </div>

        {/* ROW 2 - Empreinte du moment (scan1 comparison) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
          <div style={{ width: LABEL_W, textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 12, fontFamily: MONO, fontWeight: 700, color: ORANGE }}>
              Empreinte du moment
            </div>
            <div style={{ fontSize: 9, fontFamily: MONO, color: TXT3 }}>
              ← sortie réseau de neurones
            </div>
          </div>
          <div style={{ display: 'flex', gap: GAP, position: 'relative' }}>
            {wPrime.map((_, i) => {
              const cs = row2Cell(i)
              const arrived = i < arriveCol || phase !== 'arrive'
              return (
                <div key={i} style={{ opacity: arrived ? 1 : 0.08, transition: 'opacity 0.15s' }}>
                  <CryptexCell
                    value={arrived ? cs.value : null}
                    color={cs.color}
                    borderColor={cs.borderColor}
                    visible={arrived}
                  />
                </div>
              )
            })}

            {/* Scanner 1 bar (comparison - violet) */}
            {phase === 'scan1' && (
              <div style={{
                position: 'absolute', top: -4, bottom: -4,
                left: scan1X, width: 3, borderRadius: 2,
                background: VIOLET,
                boxShadow: `0 0 14px 4px ${VIOLET}60`,
                zIndex: 10,
              }} />
            )}
          </div>
        </div>

        {/* Sketch XOR visual cue (always present, opacity-based) */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          opacity: showRow3 ? 1 : 0, transition: 'opacity 0.3s',
        }}>
          <div style={{ width: LABEL_W, textAlign: 'right', flexShrink: 0 }}>
            <span style={{
              fontSize: 10, fontFamily: MONO, fontWeight: 700, color: VIOLET,
            }}>
              {phase === 'scan2' ? '② Correction RS' : phase === 'pause' ? '⊕ aide publique' : ''}
              {scan2Done ? (
                correctable
                  ? `${errors === 0 ? 'aucune erreur' : `${errors} corrigée${errors > 1 ? 's' : ''}`} ✓`
                  : `${errors - T} restante${errors - T > 1 ? 's' : ''} ✗`
              ) : ''}
              {!showRow3 ? '\u00a0' : ''}
            </span>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: GRID_W, height: 16,
          }}>
            <div style={{ width: 1, height: '100%', background: `${VIOLET}30` }} />
            <span style={{
              fontSize: 9, fontFamily: MONO, color: VIOLET, padding: '0 8px',
              whiteSpace: 'nowrap',
            }}>
              aide ⊕ empreinte → clé
            </span>
            <div style={{ width: 1, height: '100%', background: `${VIOLET}30` }} />
          </div>
        </div>

        {/* ROW 3 - Clé reconstruite (always present, opacity-based) */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, position: 'relative',
          opacity: showRow3 ? 1 : 0, transition: 'opacity 0.3s',
        }}>
          <div style={{ width: LABEL_W, textAlign: 'right', flexShrink: 0 }}>
            <div style={{
              fontSize: 12, fontFamily: MONO, fontWeight: 700,
              color: scan2Done ? (correctable ? MATCH : RED) : VIOLET,
            }}>
              Clé reconstruite
            </div>
            <div style={{ fontSize: 9, fontFamily: MONO, color: TXT3 }}>
              jusqu'à {T} écarts tolérés
            </div>
          </div>
          <div style={{ display: 'flex', gap: GAP, position: 'relative' }}>
            {Array.from({ length: N }, (_, i) => {
              const cs = row3Cell(i)
              const scanned = scan2Pos > i + 0.5
              return (
                <div key={i} style={{ opacity: scanned ? 1 : 0.15, transition: 'opacity 0.15s' }}>
                  <CryptexCell
                    value={scanned ? cs.value : null}
                    color={cs.color}
                    borderColor={cs.borderColor}
                    visible={scanned}
                  />
                </div>
              )
            })}

            {/* Scanner 2 bar (correction - turquoise) */}
            {phase === 'scan2' && (
              <div style={{
                position: 'absolute', top: -4, bottom: -4,
                left: scan2X, width: 3, borderRadius: 2,
                background: FIXED,
                boxShadow: `0 0 14px 4px ${FIXED}60`,
                zIndex: 10,
              }} />
            )}
          </div>
        </div>

        {/* Result indicators below row 3 (always present) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, opacity: scan2Done ? 1 : 0, transition: 'opacity 0.3s' }}>
          <div style={{ width: LABEL_W }} />
          <div style={{ display: 'flex', gap: GAP }}>
            {Array.from({ length: N }, (_, i) => {
              const cs = row3Cell(i)
              return (
                <div key={i} style={{
                  width: CELL, height: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700,
                  color: cs.label ? cs.color : `${TXT3}20`,
                }}>
                  {scan2Done ? (cs.label || '·') : '·'}
                </div>
              )
            })}
          </div>
        </div>

        {/* Verdict */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: 38, gap: 12, width: '100%',
        }}>
          <AnimatePresence mode="wait">
            {showVerdict && activeSample && (
              <motion.div key={activeSample.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                style={{ display: 'flex', alignItems: 'center', gap: 12 }}
              >
                <span style={{
                  fontSize: 14, fontFamily: MONO, fontWeight: 700,
                  padding: '5px 18px', borderRadius: 8,
                  background: correctable ? `${MATCH}15` : `${RED}15`,
                  border: `2px solid ${correctable ? MATCH : RED}35`,
                  color: correctable ? MATCH : RED,
                }}>
                  {correctable
                    ? errors === 0
                      ? '✓ Clé identique — accepté'
                      : `✓ ${errors} corrigée${errors > 1 ? 's' : ''} — clé retrouvée`
                    : `✗ ${errors} erreurs (max ${T}) — refusé`}
                </span>
                {errors === T && correctable && (
                  <span style={{
                    fontSize: 11, fontFamily: MONO, color: YELLOW, fontWeight: 700,
                  }}>
                    ⚠ LIMITE
                  </span>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Counters */}
        <div style={{
          display: 'flex', gap: 28, justifyContent: 'center',
          fontFamily: MONO, fontSize: 12,
        }}>
          <span style={{ color: MATCH, fontWeight: 700 }}>Acceptés : {accepted}</span>
          <span style={{ color: RED, fontWeight: 700 }}>Refusés : {rejected}</span>
        </div>
      </div>

      {/* Step 1: Explanation panel */}
      <AnimatePresence>
        {showDetail && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              padding: '12px 24px', borderRadius: 8,
              border: `1px solid ${VIOLET}25`,
              background: `${VIOLET}06`,
              maxWidth: 560, textAlign: 'center',
              fontFamily: MONO, fontSize: 11, color: VIOLET,
              lineHeight: 1.7,
            }}
          >
            <b style={{ fontSize: 12 }}>Pourquoi « fuzzy » ?</b><br />
            Votre empreinte n'est <b>jamais stockée</b> — on n'en garde qu'un <b>indice public</b>.<br />
            À la frappe suivante, jamais identique, cet indice <b>corrige les petits écarts</b>…<br />
            …et reconstruit <b>exactement la même clé</b>. Trop d'écarts : rien ne sort.
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
