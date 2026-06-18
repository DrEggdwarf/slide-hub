import { useEffect, useState } from 'react'
import { deckNames, deckConfig, loadDeck, setActiveDeck } from '@engine/decks'
import type { ComponentType } from 'react'
import type { SlideContext } from '@engine/types'
import { tokens } from '@design/tokens'

const MONO = tokens.type.family.mono
const SANS = tokens.type.family.sans
const NAME_RE = /^[a-z0-9-]{1,40}$/

// ── Icônes (SVG inline, style Feather — aucune dépendance) ────────────────
const PATHS: Record<string, string> = {
  play: '<polygon points="6 4 20 12 6 20 6 4"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
  sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  pencil: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
}
function Icon({ name, size = 17 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={name === 'play' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: PATHS[name] }} />
}

// ── Miniature : rendu mis à l'échelle de la 1re slide du deck ─────────────
function Thumb({ name }: { name: string }) {
  const [Slide, setSlide] = useState<ComponentType<SlideContext> | null>(null)
  useEffect(() => {
    let ok = true
    loadDeck(name).then((d) => { if (ok && d?.slides[0]) { setActiveDeck(d.config); setSlide(() => d.slides[0].Component) } })
    return () => { ok = false }
  }, [name])
  const scale = 300 / 1280
  return (
    <div style={{ width: '100%', aspectRatio: '16 / 9', borderRadius: 10, overflow: 'hidden', background: '#fff', border: `1px solid ${tokens.color.surface.line}`, position: 'relative' }}>
      {Slide && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: 1280, height: 800, transform: `scale(${scale})`, transformOrigin: 'top left', pointerEvents: 'none' }}>
          <div style={{ width: '100%', height: '100%', padding: '36px 72px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <Slide step={0} totalSteps={0} isActive={false} next={() => {}} prev={() => {}} />
          </div>
        </div>
      )}
    </div>
  )
}

async function api(method: string, path: string, body?: object): Promise<{ ok: boolean; error?: string }> {
  const r = await fetch('/authoring' + path, { method, headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
  if (r.ok) return { ok: true }
  const e = await r.json().catch(() => ({}))
  return { ok: false, error: e.error || `Erreur ${r.status}` }
}

type Modal = { kind: 'create' | 'rename' | 'duplicate' | 'delete'; name?: string }

export function HubIndex({ notFound }: { notFound?: string }) {
  const names = deckNames()
  const [authoring, setAuthoring] = useState(false)
  const [admin, setAdmin] = useState(false)
  const [modal, setModal] = useState<Modal | null>(null)
  const [settings, setSettings] = useState<string | null>(null)
  const [origin, setOrigin] = useState(location.origin) // adresse joignable (fournie par le serveur)
  const [decksPath, setDecksPath] = useState('')
  const [tunnel, setTunnel] = useState<string | null>(null)
  const [tunnelBusy, setTunnelBusy] = useState(false)

  useEffect(() => {
    fetch('/authoring/ping').then((r) => r.ok ? r.json() : null).then((d) => { setAuthoring(!!d?.authoring); setDecksPath(d?.decksPath || '') }).catch(() => {})
    fetch('/whoami').then((r) => r.json()).then((d) => { setAdmin(!!d.admin); if (d.origin) setOrigin(d.origin) }).catch(() => {})
    fetch('/authoring/tunnel').then((r) => r.ok ? r.json() : null).then((d) => setTunnel(d?.url || null)).catch(() => {})
  }, [])

  const startTunnel = async () => {
    setTunnelBusy(true)
    const r = await fetch('/authoring/tunnel/start', { method: 'POST' })
    const d = await r.json().catch(() => ({}))
    setTunnelBusy(false)
    if (r.ok) location.reload(); else alert(d.error || 'Échec du tunnel')
  }
  const stopTunnel = async () => { setTunnelBusy(true); await fetch('/authoring/tunnel/stop', { method: 'POST' }); location.reload() }
  const canEdit = authoring && admin

  const toggle = async (name: string, cur?: string) => {
    const r = await api('PATCH', `/deck/${name}`, { visibility: cur === 'public' ? 'private' : 'public' })
    if (r.ok) location.reload(); else alert(r.error)
  }

  return (
    <div style={{ minHeight: '100vh', background: tokens.color.surface.subtle, fontFamily: SANS, padding: '40px 32px 64px' }}>
      <style>{`.hub-ic{transition:background .12s} .hub-ic:hover{background:rgba(0,0,0,0.07)}`}</style>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 3, textTransform: 'uppercase', color: tokens.color.text.muted }}>Slide Hub</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: tokens.color.text.primary, marginTop: 4 }}>Mes présentations</div>
          </div>
          {canEdit && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {tunnel ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 12, background: `${tokens.color.semantic.success}14`, border: `1px solid ${tokens.color.semantic.success}55` }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: tokens.color.semantic.success }} />
                  <span style={{ fontFamily: MONO, fontSize: 11, color: tokens.color.text.secondary }}>en ligne</span>
                  <button onClick={stopTunnel} disabled={tunnelBusy} style={{ ...linkBtn, fontSize: 11 }}>repasser en LAN</button>
                </div>
              ) : (
                <button onClick={startTunnel} disabled={tunnelBusy} title="Rendre le hub joignable depuis internet (tunnel Cloudflare). Indépendant de la visibilité public/privé des decks."
                  style={{ padding: '11px 16px', borderRadius: 12, border: `1px solid ${tokens.color.surface.line}`, background: 'transparent', color: tokens.color.text.secondary, fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: tunnelBusy ? 'default' : 'pointer' }}>
                  {tunnelBusy ? 'démarrage…' : 'Exposer sur internet'}
                </button>
              )}
              <button onClick={() => setModal({ kind: 'create' })} style={{ padding: '12px 20px', borderRadius: 12, border: 'none', background: tokens.color.text.primary, color: tokens.color.surface.base, fontFamily: SANS, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                + Nouveau deck
              </button>
            </div>
          )}
        </div>

        {notFound && <div style={{ fontFamily: MONO, fontSize: 13, color: tokens.color.semantic.critical, marginBottom: 16 }}>Deck « {notFound} » introuvable.</div>}
        {!canEdit && <div style={{ fontFamily: MONO, fontSize: 11, color: tokens.color.text.muted, marginBottom: 16 }}>Mode lecture seule {authoring ? '(déverrouille pour gérer)' : '(édition disponible en local)'}.</div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 22 }}>
          {names.length === 0 && <div style={{ color: tokens.color.text.muted }}>Aucun deck. {canEdit ? 'Clique « Nouveau deck ».' : 'Ajoute un dossier dans decks/.'}</div>}
          {names.map((name) => {
            const cfg = deckConfig(name)
            const pub = cfg?.visibility === 'public'
            return (
              <div key={name} style={{ background: tokens.color.surface.base, border: `1px solid ${tokens.color.surface.line}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column' }}>
                <a href={`/${name}`} style={{ display: 'block', padding: 12, paddingBottom: 0 }}><Thumb name={name} /></a>
                <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: tokens.color.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cfg?.title ?? cfg?.brand ?? name}</span>
                    <button onClick={() => canEdit && toggle(name, cfg?.visibility)} disabled={!canEdit} title={canEdit ? 'Basculer public / privé' : undefined}
                      style={{ flexShrink: 0, fontFamily: MONO, fontSize: 10, padding: '3px 9px', borderRadius: 20, cursor: canEdit ? 'pointer' : 'default', border: `1px solid ${pub ? tokens.color.semantic.success : tokens.color.surface.line}`, background: pub ? `${tokens.color.semantic.success}14` : 'transparent', color: pub ? tokens.color.semantic.success : tokens.color.text.muted }}>
                      {pub ? 'public' : 'privé'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <a href={`/${name}`} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 10px', borderRadius: 9, textDecoration: 'none', fontFamily: SANS, fontSize: 13, fontWeight: 600, background: tokens.color.text.primary, color: tokens.color.surface.base }}>
                      <Icon name="play" size={14} /> Présenter
                    </a>
                    <a href={`/${name}/console`} title="Régie présentateur" className="hub-ic" style={iconLink}><Icon name="monitor" /></a>
                  </div>
                  <div style={{ display: 'flex', gap: 3, marginTop: 2, alignItems: 'center' }}>
                    <IconCopy icon="link" title="Copier le lien" text={`${origin}/${name}`} />
                    <IconBtn icon="external" title="Ouvrir dans un onglet" href={`${origin}/${name}`} />
                    {canEdit && <>
                      <span style={{ width: 1, height: 18, background: tokens.color.surface.line, margin: '0 3px' }} />
                      <IconBtn icon="sliders" title="Réglages (orateurs, durées)" onClick={() => setSettings(name)} />
                      {decksPath && <IconCopy icon="folder" title="Copier le chemin du dossier" text={`${decksPath}/${name}`} />}
                      <IconBtn icon="pencil" title="Renommer" onClick={() => setModal({ kind: 'rename', name })} />
                      <IconBtn icon="copy" title="Dupliquer" onClick={() => setModal({ kind: 'duplicate', name })} />
                      <span style={{ flex: 1 }} />
                      <IconBtn icon="trash" title="Supprimer" danger onClick={() => setModal({ kind: 'delete', name })} />
                    </>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {modal && <DeckModal modal={modal} onClose={() => setModal(null)} />}
      {settings && <SettingsModal name={settings} origin={origin} onClose={() => setSettings(null)} />}
    </div>
  )
}

// ── Copier le lien (avec retour visuel) ───────────────────────────────────
function CopyLink({ url, label = 'Copier le lien' }: { url: string; label?: string }) {
  const [done, setDone] = useState(false)
  const copy = async () => { try { await navigator.clipboard.writeText(url); setDone(true); setTimeout(() => setDone(false), 1500) } catch { /* ignore */ } }
  return <button onClick={copy} style={{ ...linkBtn, color: done ? tokens.color.semantic.success : tokens.color.text.muted }}>{done ? 'copié !' : label}</button>
}

// ── Panneau Réglages : orateurs + couleurs, durée/orateur par slide ───────
interface DeckInfo { name: string; config: { visibility: string; title?: string; brand?: string; speakers: Record<string, string> }; slides: { id: string; title?: string; duration?: number; steps?: number; speaker: string[] }[] }

function SettingsModal({ name, origin, onClose }: { name: string; origin: string; onClose: () => void }) {
  const [info, setInfo] = useState<DeckInfo | null>(null)
  const [speakers, setSpeakers] = useState<Record<string, string>>({})
  const [slides, setSlides] = useState<DeckInfo['slides']>([])
  const [newSpk, setNewSpk] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    fetch(`/authoring/deck/${name}`).then((r) => r.json()).then((d: DeckInfo) => { setInfo(d); setSpeakers(d.config.speakers); setSlides(d.slides) }).catch(() => setErr('Chargement impossible'))
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [name, onClose])

  const total = slides.reduce((a, s) => a + (s.duration ?? 0), 0)
  const setSlide = (id: string, patch: Partial<DeckInfo['slides'][0]>) => setSlides((ls) => ls.map((s) => s.id === id ? { ...s, ...patch } : s))
  const toggleSpk = (id: string, spk: string) => setSlide(id, { speaker: slides.find((s) => s.id === id)!.speaker.includes(spk) ? slides.find((s) => s.id === id)!.speaker.filter((x) => x !== spk) : [...slides.find((s) => s.id === id)!.speaker, spk] })
  const addSpeaker = () => { const n = newSpk.trim(); if (/^[A-Za-z0-9_]+$/.test(n) && !speakers[n]) { setSpeakers({ ...speakers, [n]: '#6366f1' }); setNewSpk('') } }
  const rmSpeaker = (n: string) => { const c = { ...speakers }; delete c[n]; setSpeakers(c) }

  const save = async () => {
    setBusy(true); setErr('')
    let r = await api('PATCH', `/deck/${name}/speakers`, { speakers })
    if (r.ok) for (const s of slides) { r = await api('PATCH', `/deck/${name}/slide/${s.id}`, { duration: s.duration ?? 0, speaker: s.speaker }); if (!r.ok) break }
    if (r.ok) location.reload(); else { setErr(r.error || 'Échec'); setBusy(false) }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.45)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, maxHeight: '88vh', overflow: 'auto', background: tokens.color.surface.base, borderRadius: 16, padding: '24px 24px 20px', boxShadow: '0 24px 64px rgba(0,0,0,0.22)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: tokens.color.text.primary }}>Réglages — {info?.config.title ?? name}</div>
          <button onClick={onClose} style={{ ...linkBtn, fontSize: 13 }}>Fermer</button>
        </div>

        {/* Lien */}
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: tokens.color.surface.subtle, border: `1px solid ${tokens.color.surface.line}` }}>
          <span style={{ fontFamily: MONO, fontSize: 12, color: tokens.color.text.secondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{origin}/{name}</span>
          <CopyLink url={`${origin}/${name}`} />
          <a href={`${origin}/${name}`} target="_blank" rel="noreferrer" style={linkBtn}>Ouvrir</a>
        </div>

        {/* Orateurs */}
        <Section title="Orateurs">
          {Object.entries(speakers).map(([n, c]) => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <input type="color" value={c} onChange={(e) => setSpeakers({ ...speakers, [n]: e.target.value })} style={{ width: 34, height: 30, border: 'none', background: 'none', padding: 0, cursor: 'pointer' }} />
              <span style={{ fontFamily: MONO, fontSize: 13, color: tokens.color.text.primary, flex: 1 }}>{n}</span>
              <button onClick={() => rmSpeaker(n)} style={{ ...linkBtn, color: tokens.color.semantic.critical }}>retirer</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <input value={newSpk} placeholder="nouvel orateur" onChange={(e) => setNewSpk(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addSpeaker() }}
              style={{ flex: 1, fontFamily: MONO, fontSize: 13, padding: '7px 10px', borderRadius: 8, border: `1px solid ${tokens.color.surface.line}`, background: tokens.color.surface.subtle, color: tokens.color.text.primary, outline: 'none' }} />
            <button onClick={addSpeaker} style={{ ...btn(tokens.color.text.primary, tokens.color.surface.base), flex: 'none', padding: '7px 14px' }}>Ajouter</button>
          </div>
        </Section>

        {/* Slides */}
        <Section title={`Slides — durée totale ${Math.floor(total / 60)} min ${total % 60}s`}>
          {slides.map((s) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: `1px solid ${tokens.color.surface.line}` }}>
              <span style={{ fontFamily: MONO, fontSize: 12, color: tokens.color.text.primary, width: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.id}>{s.title ?? s.id}</span>
              <span style={{ display: 'flex', gap: 5, flex: 1, flexWrap: 'wrap' }}>
                {Object.keys(speakers).map((spk) => {
                  const on = s.speaker.includes(spk)
                  return <button key={spk} onClick={() => toggleSpk(s.id, spk)} style={{ fontFamily: MONO, fontSize: 10, padding: '2px 7px', borderRadius: 12, cursor: 'pointer', border: `1px solid ${on ? speakers[spk] : tokens.color.surface.line}`, background: on ? `${speakers[spk]}22` : 'transparent', color: on ? speakers[spk] : tokens.color.text.muted }}>{spk}</button>
                })}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <input type="number" min={0} value={s.duration ?? 0} onChange={(e) => setSlide(s.id, { duration: Math.max(0, Number(e.target.value) || 0) })}
                  style={{ width: 56, fontFamily: MONO, fontSize: 12, padding: '5px 6px', borderRadius: 7, border: `1px solid ${tokens.color.surface.line}`, background: tokens.color.surface.subtle, color: tokens.color.text.primary, outline: 'none' }} />
                <span style={{ fontFamily: MONO, fontSize: 10, color: tokens.color.text.muted }}>s</span>
              </span>
            </div>
          ))}
        </Section>

        {err && <div style={{ marginTop: 8, fontFamily: MONO, fontSize: 12, color: tokens.color.semantic.critical }}>{err}</div>}
        <div style={{ marginTop: 18, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: 10, border: `1px solid ${tokens.color.surface.line}`, background: 'transparent', color: tokens.color.text.secondary, fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Annuler</button>
          <button onClick={save} disabled={busy || !info} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', cursor: busy ? 'default' : 'pointer', fontFamily: SANS, fontSize: 14, fontWeight: 700, color: tokens.color.surface.base, background: busy || !info ? tokens.color.surface.line : tokens.color.text.primary }}>{busy ? '…' : 'Enregistrer'}</button>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: tokens.color.text.muted, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  )
}

// ── Modal d'action (créer / renommer / dupliquer / supprimer) ─────────────
function DeckModal({ modal, onClose }: { modal: Modal; onClose: () => void }) {
  const { kind, name } = modal
  const isDelete = kind === 'delete'
  const [val, setVal] = useState(kind === 'rename' ? name ?? '' : kind === 'duplicate' ? `${name}-copie` : '')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const valid = isDelete || NAME_RE.test(val)
  const titles = { create: 'Nouveau deck', rename: 'Renommer le deck', duplicate: 'Dupliquer le deck', delete: 'Supprimer le deck' }

  const confirm = async () => {
    if (!valid || busy) return
    setBusy(true); setErr('')
    let r
    if (kind === 'create') r = await api('POST', '/deck', { name: val })
    else if (kind === 'rename') r = await api('POST', `/deck/${name}/rename`, { to: val })
    else if (kind === 'duplicate') r = await api('POST', `/deck/${name}/duplicate`, { to: val })
    else r = await api('DELETE', `/deck/${name}`)
    if (r.ok) location.reload()
    else { setErr(r.error || 'Échec'); setBusy(false) }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.45)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 400, background: tokens.color.surface.base, borderRadius: 16, padding: '24px 24px 20px', boxShadow: '0 24px 64px rgba(0,0,0,0.22)' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: tokens.color.text.primary }}>{titles[kind]}</div>
        {isDelete ? (
          <div style={{ marginTop: 12, fontSize: 14, color: tokens.color.text.secondary, lineHeight: 1.5 }}>
            Le deck <b style={{ color: tokens.color.text.primary }}>{name}</b> sera déplacé dans <code>.trash</code> (récupérable). Confirmer ?
          </div>
        ) : (
          <>
            <input value={val} autoFocus placeholder="nom-du-deck" onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') confirm() }}
              style={{ width: '100%', marginTop: 16, fontFamily: MONO, fontSize: 15, padding: '11px 13px', borderRadius: 10, border: `1px solid ${val && !valid ? tokens.color.semantic.critical : tokens.color.surface.line}`, background: tokens.color.surface.subtle, color: tokens.color.text.primary, outline: 'none', boxSizing: 'border-box' }} />
            <div style={{ marginTop: 7, fontFamily: MONO, fontSize: 11, color: val && !valid ? tokens.color.semantic.critical : tokens.color.text.muted }}>
              minuscules, chiffres et tirets — sert d'URL : /{val || 'nom-du-deck'}
            </div>
          </>
        )}
        {err && <div style={{ marginTop: 8, fontFamily: MONO, fontSize: 12, color: tokens.color.semantic.critical }}>{err}</div>}
        <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: 10, border: `1px solid ${tokens.color.surface.line}`, background: 'transparent', color: tokens.color.text.secondary, fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Annuler</button>
          <button onClick={confirm} disabled={!valid || busy}
            style={{ padding: '10px 18px', borderRadius: 10, border: 'none', cursor: valid && !busy ? 'pointer' : 'default', fontFamily: SANS, fontSize: 14, fontWeight: 700, color: tokens.color.surface.base, background: !valid || busy ? tokens.color.surface.line : isDelete ? tokens.color.semantic.critical : tokens.color.text.primary }}>
            {busy ? '…' : isDelete ? 'Supprimer' : 'Valider'}
          </button>
        </div>
      </div>
    </div>
  )
}

const btn = (bg: string, fg: string, outline = false): React.CSSProperties => ({
  flex: 1, textAlign: 'center', padding: '8px 10px', borderRadius: 9, textDecoration: 'none', fontFamily: SANS, fontSize: 13, fontWeight: 600,
  background: bg, color: fg, border: outline ? `1px solid ${tokens.color.surface.line}` : 'none',
})
const linkBtn: React.CSSProperties = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: tokens.color.text.muted, fontFamily: MONO, fontSize: 11, textDecoration: 'underline' }
const iconLink: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, borderRadius: 9, border: `1px solid ${tokens.color.surface.line}`, color: tokens.color.text.secondary, textDecoration: 'none', cursor: 'pointer' }
const iconBox: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', textDecoration: 'none' }

function IconBtn({ icon, title, onClick, href, danger }: { icon: string; title: string; onClick?: () => void; href?: string; danger?: boolean }) {
  const style = { ...iconBox, color: danger ? tokens.color.semantic.critical : tokens.color.text.muted }
  return href
    ? <a className="hub-ic" href={href} target="_blank" rel="noreferrer" title={title} style={style}><Icon name={icon} size={16} /></a>
    : <button className="hub-ic" onClick={onClick} title={title} style={style}><Icon name={icon} size={16} /></button>
}

function IconCopy({ icon, title, text }: { icon: string; title: string; text: string }) {
  const [done, setDone] = useState(false)
  const copy = async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1400) } catch { /* ignore */ } }
  return <button className="hub-ic" onClick={copy} title={title} style={{ ...iconBox, color: done ? tokens.color.semantic.success : tokens.color.text.muted }}><Icon name={done ? 'check' : icon} size={16} /></button>
}
