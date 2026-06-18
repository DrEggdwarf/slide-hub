import { useEffect, useState } from 'react'
import type { SlideModule } from './types'
import { deckConfig, setActiveDeck, loadDeck, type DeckConfig } from './decks'
import { unlock } from './sync'
import { Presentation } from './Presentation'
import { Console } from './Console'
import { MobilePilot } from './MobilePilot'
import { HubIndex } from '../ui/HubIndex'
import { tokens } from '../design/tokens'

// Porte d'accès à un deck :
//  - deck public, ou vue /pilote (gatée par token) → on charge directement.
//  - deck privé en /  ou /console → exige l'admin (mot de passe) avant de
//    charger les slides (les chunks ne sont même pas téléchargés sinon).
export function DeckGate({ deckName, view }: { deckName: string; view?: string }) {
  const cfg = deckConfig(deckName)
  const isPrivate = (cfg?.visibility ?? 'private') === 'private'
  const needGate = !!cfg && isPrivate && view !== 'pilote'
  if (cfg) setActiveDeck(cfg) // synchrone : les vues lisent brand()/speakerColor()

  const [admin, setAdmin] = useState(!needGate)
  const [slides, setSlides] = useState<SlideModule[] | null>(null)

  useEffect(() => {
    if (needGate) fetch('/whoami').then((r) => r.json()).then((d) => setAdmin(!!d.admin)).catch(() => setAdmin(false))
  }, [needGate])

  useEffect(() => {
    if (cfg && admin && !slides) loadDeck(deckName).then((d) => setSlides(d?.slides ?? []))
  }, [cfg, admin, slides, deckName])

  if (!cfg) return <HubIndex notFound={deckName} />
  if (!admin) return <UnlockGate cfg={cfg} onAdmin={() => setAdmin(true)} />
  if (!slides) return <Splash label="Chargement du deck…" />
  return view === 'pilote' ? <MobilePilot slides={slides} deckName={deckName} />
    : view === 'console' ? <Console slides={slides} deckName={deckName} />
      : <Presentation slides={slides} deckName={deckName} />
}

function Splash({ label }: { label: string }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: tokens.type.family.mono, fontSize: 13, color: tokens.color.text.muted, background: tokens.color.surface.base }}>{label}</div>
  )
}

function UnlockGate({ cfg, onAdmin }: { cfg: DeckConfig; onAdmin: () => void }) {
  const [pw, setPw] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (!pw) return
    setBusy(true); setErr('')
    const r = await unlock(pw)
    setBusy(false)
    if (r.ok) onAdmin(); else setErr(r.error || 'Échec')
  }
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: tokens.type.family.sans, background: tokens.color.surface.base }}>
      <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'center' }}>
        <div style={{ fontFamily: tokens.type.family.mono, fontSize: tokens.type.size.xs, letterSpacing: tokens.type.tracking.wider, textTransform: 'uppercase', color: tokens.color.text.muted }}>Deck privé</div>
        <div style={{ fontSize: tokens.type.size.lg, fontWeight: 700, color: tokens.color.text.primary }}>{cfg.title ?? cfg.brand}</div>
        <input type="password" value={pw} autoFocus placeholder="Mot de passe" onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          style={{ fontFamily: tokens.type.family.mono, fontSize: 15, textAlign: 'center', padding: '12px 14px', borderRadius: 12, border: `1px solid ${tokens.color.surface.line}`, background: tokens.color.surface.subtle, color: tokens.color.text.primary, outline: 'none' }} />
        {err && <div style={{ fontFamily: tokens.type.family.mono, fontSize: 12, color: tokens.color.semantic.critical }}>{err}</div>}
        <button onClick={submit} disabled={busy || !pw} style={{ padding: 13, borderRadius: 12, border: 'none', background: busy || !pw ? tokens.color.surface.line : tokens.color.text.primary, color: tokens.color.surface.base, fontWeight: 700 }}>{busy ? '…' : 'Déverrouiller'}</button>
      </div>
    </div>
  )
}
