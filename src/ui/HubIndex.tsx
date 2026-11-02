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
  globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  smartphone: '<rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  restore: '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
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
  const allNames = deckNames()
  const [authoring, setAuthoring] = useState(false)
  const [admin, setAdmin] = useState(false)
  const [modal, setModal] = useState<Modal | null>(null)
  const [settings, setSettings] = useState<string | null>(null)
  const [origin, setOrigin] = useState(location.origin) // adresse joignable (fournie par le serveur)
  const [decksPath, setDecksPath] = useState('')
  const [tunnel, setTunnel] = useState<string | null>(null)
  const [tunnelBusy, setTunnelBusy] = useState(false)
  const [tunnelExpires, setTunnelExpires] = useState<number | null>(null)
  const [confirmTunnel, setConfirmTunnel] = useState(false)
  const [customPassword, setCustomPassword] = useState(true)
  const [mtimes, setMtimes] = useState<Record<string, number>>({})
  const [trashCount, setTrashCount] = useState(0)
  const [trashOpen, setTrashOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'name' | 'recent'>('name')
  const [help, setHelp] = useState(() => { try { return localStorage.getItem('hub-help') !== 'hidden' } catch { return true } })
  const setHelpPersist = (v: boolean) => { setHelp(v); try { localStorage.setItem('hub-help', v ? 'shown' : 'hidden') } catch { /* ignore */ } }

  useEffect(() => {
    fetch('/authoring/ping').then((r) => r.ok ? r.json() : null).then((d) => { setAuthoring(!!d?.authoring); setDecksPath(d?.decksPath || ''); setMtimes(d?.mtimes || {}); setTrashCount(d?.trash || 0); setCustomPassword(d?.customPassword !== false) }).catch(() => {})
    fetch('/whoami').then((r) => r.json()).then((d) => { setAdmin(!!d.admin); if (d.origin) setOrigin(d.origin) }).catch(() => {})
    fetch('/authoring/tunnel').then((r) => r.ok ? r.json() : null).then((d) => { setTunnel(d?.url || null); setTunnelExpires(d?.expiresAt ?? null) }).catch(() => {})
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

  // Recherche + tri (le tri « récent » n'existe qu'en mode authoring : le serveur fournit les dates).
  const hasMtimes = Object.keys(mtimes).length > 0
  const q = query.trim().toLowerCase()
  const names = allNames
    .filter((n) => { if (!q) return true; const c = deckConfig(n); return [n, c?.title, c?.brand].some((v) => v?.toLowerCase().includes(q)) })
    .sort((a, b) => (sort === 'recent' && hasMtimes ? (mtimes[b] ?? 0) - (mtimes[a] ?? 0) : 0) || a.localeCompare(b))
  const tunnelDecks = allNames.map((n) => ({ name: n, label: deckConfig(n)?.title ?? deckConfig(n)?.brand ?? n, pub: deckConfig(n)?.visibility === 'public' }))

  const toggle = async (name: string, cur?: string) => {
    const r = await api('PATCH', `/deck/${name}`, { visibility: cur === 'public' ? 'private' : 'public' })
    if (r.ok) location.reload(); else alert(r.error)
  }

  return (
    <div style={{ minHeight: '100vh', background: tokens.color.surface.subtle, fontFamily: SANS, padding: '40px 32px 64px' }}>
      <style>{HUB_CSS}</style>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 3, textTransform: 'uppercase', color: tokens.color.text.muted }}>Slide Hub</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: tokens.color.text.primary, marginTop: 4 }}>Mes présentations</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {!help && (
              <button className="hub-ic" onClick={() => setHelpPersist(true)} data-tip="Rappel du parcours : scène, régie, téléphone" data-tip-end=""
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 12px', borderRadius: 12, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: SANS, fontSize: 14, fontWeight: 600, color: tokens.color.text.secondary }}>
                <Icon name="help" size={16} /> Aide
              </button>
            )}
            {canEdit && trashCount > 0 && (
              <button className="hub-ic" onClick={() => setTrashOpen(true)} data-tip="Decks supprimés : les restaurer" data-tip-end=""
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 12px', borderRadius: 12, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: SANS, fontSize: 14, fontWeight: 600, color: tokens.color.text.secondary }}>
                <Icon name="restore" size={16} /> Corbeille ({trashCount})
              </button>
            )}
            {canEdit && (tunnel ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px 6px 12px', borderRadius: 12, background: `${tokens.color.semantic.success}14`, border: `1px solid ${tokens.color.semantic.success}55` }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: tokens.color.semantic.success }} />
                <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: tokens.color.text.secondary }}>En ligne{tunnelExpires ? <span style={{ fontWeight: 500, color: tokens.color.text.muted }}> · coupure auto à {new Date(tunnelExpires).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span> : null}</span>
                <CopyBtn text={tunnel} label="Copier l'URL publique" tip="Lien internet à envoyer : fonctionne partout, y compris en 4G" icon="globe" />
                <button onClick={stopTunnel} disabled={tunnelBusy} data-tip="Coupe le lien internet : le hub redevient accessible seulement sur ton réseau" data-tip-end="" style={{ ...linkBtn, fontFamily: SANS, fontSize: 12, padding: '6px 6px' }}>Arrêter</button>
              </div>
            ) : (
              <button onClick={() => setConfirmTunnel(true)} disabled={tunnelBusy} data-tip="Crée un lien internet temporaire (tunnel Cloudflare) pour que des personnes hors de ton réseau accèdent au hub. Sans rapport avec public / privé." data-tip-end=""
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 16px', borderRadius: 12, border: `1px solid ${tokens.color.surface.line}`, background: 'transparent', color: tokens.color.text.secondary, fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: tunnelBusy ? 'default' : 'pointer' }}>
                <Icon name="globe" size={15} /> {tunnelBusy ? 'Démarrage…' : 'Partager sur internet'}
              </button>
            ))}
            {canEdit && (
              <button onClick={() => setModal({ kind: 'create' })} style={{ padding: '12px 20px', borderRadius: 12, border: 'none', background: tokens.color.text.primary, color: tokens.color.surface.base, fontFamily: SANS, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                + Nouveau deck
              </button>
            )}
          </div>
        </div>

        {help && <HowItWorks onClose={() => setHelpPersist(false)} />}

        {notFound && <div style={{ fontFamily: MONO, fontSize: 13, color: tokens.color.semantic.critical, marginBottom: 16 }}>Deck « {notFound} » introuvable.</div>}
        {!canEdit && <div style={{ fontFamily: MONO, fontSize: 11, color: tokens.color.text.muted, marginBottom: 16 }}>Mode lecture seule — {authoring ? 'ouvre une scène et entre le mot de passe (touche h) pour pouvoir gérer.' : "la création et l'édition des decks sont disponibles en local (npm run dev)."}</div>}

        {allNames.length >= 4 && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
            <label style={{ flex: '1 1 240px', maxWidth: 380, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', borderRadius: 10, border: `1px solid ${tokens.color.surface.line}`, background: tokens.color.surface.base, color: tokens.color.text.muted }}>
              <Icon name="search" size={15} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un deck…" aria-label="Rechercher un deck"
                style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', padding: '10px 0', fontFamily: SANS, fontSize: 14, color: tokens.color.text.primary }} />
            </label>
            <select value={sort} onChange={(e) => setSort(e.target.value as 'name' | 'recent')} aria-label="Trier les decks"
              style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${tokens.color.surface.line}`, background: tokens.color.surface.base, fontFamily: SANS, fontSize: 14, color: tokens.color.text.secondary }}>
              <option value="name">Trier : nom</option>
              {hasMtimes && <option value="recent">Trier : modifié récemment</option>}
            </select>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 22 }}>
          {names.length === 0 && <div style={{ color: tokens.color.text.muted }}>{allNames.length > 0 ? `Aucun deck ne correspond à « ${query} ».` : <>Aucun deck. {canEdit ? 'Clique « Nouveau deck ».' : 'Ajoute un dossier dans decks/.'}</>}</div>}
          {names.map((name) => {
            const cfg = deckConfig(name)
            const pub = cfg?.visibility === 'public'
            return (
              <div key={name} style={{ background: tokens.color.surface.base, border: `1px solid ${tokens.color.surface.line}`, borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column' }}>
                <a href={`/${name}`} style={{ display: 'block', padding: 12, paddingBottom: 0 }}><Thumb name={name} /></a>
                <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: tokens.color.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cfg?.title ?? cfg?.brand ?? name}</span>
                    <button onClick={() => canEdit && toggle(name, cfg?.visibility)} disabled={!canEdit} data-tip-end=""
                      data-tip={(pub ? 'Public : visible par tous.' : "Privé : mot de passe demandé avant d'afficher quoi que ce soit.") + (canEdit ? (pub ? ' Clique pour passer en privé.' : ' Clique pour passer en public.') : '')}
                      style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: SANS, fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 20, cursor: canEdit ? 'pointer' : 'default', border: `1px solid ${pub ? tokens.color.semantic.success : tokens.color.surface.line}`, background: pub ? `${tokens.color.semantic.success}14` : 'transparent', color: pub ? tokens.color.semantic.success : tokens.color.text.muted }}>
                      <Icon name={pub ? 'globe' : 'lock'} size={12} /> {pub ? 'Public' : 'Privé'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Action primary icon="play" label="Présenter" tip="Ouvre la scène en plein écran : ce que voit le public" href={`/${name}`} />
                    <Action icon="monitor" label="Régie" tip="Écran du présentateur : aperçus, notes, chrono et QR code pour piloter au téléphone" href={`/${name}/console`} tipEnd />
                  </div>
                  <div style={{ display: 'flex', gap: 2, alignItems: 'center', marginTop: 2 }}>
                    <CopyBtn text={`${origin}/${name}`} label="Copier le lien" tip="Copie l'adresse de la scène à envoyer au public" />
                    <IconBtn icon="external" title="Ouvrir dans un nouvel onglet" href={`${origin}/${name}`} />
                    <IconBtn icon="download" title="Exporter en PDF : ouvre la vue d'impression" href={`/${name}/print`} />
                    <span style={{ flex: 1 }} />
                    {canEdit && (
                      <ManageMenu items={[
                        { icon: 'sliders', label: 'Réglages (orateurs, durées)', onClick: () => setSettings(name) },
                        { icon: 'pencil', label: 'Renommer', onClick: () => setModal({ kind: 'rename', name }) },
                        { icon: 'copy', label: 'Dupliquer', onClick: () => setModal({ kind: 'duplicate', name }) },
                        ...(decksPath ? [{ icon: 'folder', label: 'Copier le chemin du dossier', onClick: () => { void navigator.clipboard?.writeText(`${decksPath}/${name}`) } }] : []),
                        { icon: 'trash', label: 'Supprimer', danger: true, onClick: () => setModal({ kind: 'delete', name }) },
                      ]} />
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {modal && <DeckModal modal={modal} onClose={() => setModal(null)} />}
      {confirmTunnel && <TunnelConfirm decks={tunnelDecks} customPassword={customPassword} busy={tunnelBusy} onCancel={() => setConfirmTunnel(false)} onConfirm={() => { setConfirmTunnel(false); void startTunnel() }} />}
      {trashOpen && <TrashModal onClose={() => setTrashOpen(false)} />}
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
  const [template, setTemplate] = useState<'talk' | 'blank'>('talk')
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
    if (kind === 'create') r = await api('POST', '/deck', { name: val, template })
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
            {kind === 'create' && (
              <div role="radiogroup" aria-label="Modèle" style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {([['talk', 'Présentation type', '6 slides prêtes : titre, plan, 3 sections, conclusion'], ['blank', 'Vide', 'Une seule slide à modifier']] as const).map(([id, label, text]) => (
                  <button key={id} role="radio" aria-checked={template === id} onClick={() => setTemplate(id)}
                    style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left', padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontFamily: SANS, border: `1.5px solid ${template === id ? tokens.color.text.primary : tokens.color.surface.line}`, background: template === id ? tokens.color.surface.subtle : 'transparent' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: tokens.color.text.primary }}>{label}</span>
                    <span style={{ fontSize: 12, color: tokens.color.text.muted }}>{text}</span>
                  </button>
                ))}
              </div>
            )}
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

// Tooltip CSS instantané (data-tip) — remplace l'attribut title natif (lent, absent au tactile).
const HUB_CSS = `
.hub-ic{transition:background .12s} .hub-ic:hover{background:rgba(0,0,0,0.07)}
[data-tip]{position:relative}
[data-tip]::after{content:attr(data-tip);position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%) translateY(3px);width:max-content;max-width:240px;padding:7px 10px;border-radius:8px;background:#111;color:#fff;font:500 12px/1.4 ${SANS};text-align:left;white-space:normal;pointer-events:none;opacity:0;transition:opacity .12s,transform .12s;z-index:50;box-shadow:0 4px 14px rgba(0,0,0,.25)}
[data-tip]:hover::after,[data-tip]:focus-visible::after{opacity:1;transform:translateX(-50%) translateY(0)}
[data-tip-end]::after{left:auto;right:0;transform:translateY(3px)} [data-tip-end]:hover::after,[data-tip-end]:focus-visible::after{transform:translateY(0)}
.hub-menu-item{display:flex;align-items:center;gap:10px;width:100%;padding:9px 12px;border:none;background:none;border-radius:8px;cursor:pointer;font:600 13px ${SANS};color:${tokens.color.text.primary};text-align:left;text-decoration:none;box-sizing:border-box}
.hub-menu-item:hover{background:rgba(0,0,0,0.06)}
`

// Bouton d'action avec libellé visible (+ icône) et tooltip explicatif.
function Action({ icon, label, tip, onClick, href, primary, tipEnd }: { icon: string; label: string; tip: string; onClick?: () => void; href?: string; primary?: boolean; tipEnd?: boolean }) {
  const style: React.CSSProperties = {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 10px', borderRadius: 9, textDecoration: 'none', cursor: 'pointer',
    fontFamily: SANS, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
    background: primary ? tokens.color.text.primary : 'transparent', color: primary ? tokens.color.surface.base : tokens.color.text.primary,
    border: primary ? 'none' : `1px solid ${tokens.color.surface.line}`,
  }
  const props = { 'data-tip': tip, ...(tipEnd ? { 'data-tip-end': '' } : {}), 'aria-label': `${label} — ${tip}`, className: primary ? undefined : 'hub-ic', style }
  const inner = <><Icon name={icon} size={14} /> {label}</>
  return href ? <a href={href} {...props}>{inner}</a> : <button onClick={onClick} {...props}>{inner}</button>
}

function IconBtn({ icon, title, onClick, href, danger }: { icon: string; title: string; onClick?: () => void; href?: string; danger?: boolean }) {
  const style = { ...iconBox, color: danger ? tokens.color.semantic.critical : tokens.color.text.muted }
  return href
    ? <a className="hub-ic" href={href} target="_blank" rel="noreferrer" data-tip={title} aria-label={title} style={style}><Icon name={icon} size={16} /></a>
    : <button className="hub-ic" onClick={onClick} data-tip={title} aria-label={title} style={style}><Icon name={icon} size={16} /></button>
}

// Copie dans le presse-papiers avec retour visuel (« Copié ! »).
function CopyBtn({ text, label, tip, icon = 'link' }: { text: string; label: string; tip: string; icon?: string }) {
  const [done, setDone] = useState(false)
  const copy = async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1400) } catch { /* ignore */ } }
  return (
    <button className="hub-ic" onClick={copy} data-tip={tip} aria-label={`${label} — ${tip}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 9px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: SANS, fontSize: 12, fontWeight: 600, color: done ? tokens.color.semantic.success : tokens.color.text.secondary }}>
      <Icon name={done ? 'check' : icon} size={14} /> {done ? 'Copié !' : label}
    </button>
  )
}

// Menu « Gérer » : toutes les actions d'édition regroupées, avec libellés.
function ManageMenu({ items }: { items: { icon: string; label: string; onClick: () => void; danger?: boolean }[] }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('click', close); window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('click', close); window.removeEventListener('keydown', onKey) }
  }, [open])
  return (
    <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
      <button className="hub-ic" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}
        data-tip={open ? undefined : 'Réglages, renommer, dupliquer, supprimer…'} data-tip-end=""
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, border: 'none', background: open ? 'rgba(0,0,0,0.07)' : 'transparent', cursor: 'pointer', fontFamily: SANS, fontSize: 12, fontWeight: 600, color: tokens.color.text.secondary }}>
        <Icon name="more" size={15} /> Gérer
      </button>
      {open && (
        <div role="menu" style={{ position: 'absolute', right: 0, bottom: 'calc(100% + 6px)', width: 270, padding: 6, borderRadius: 12, background: tokens.color.surface.base, border: `1px solid ${tokens.color.surface.line}`, boxShadow: '0 10px 30px rgba(0,0,0,0.18)', zIndex: 60 }}>
          {items.map((it, i) => (
            <button key={it.label} role="menuitem" className="hub-menu-item" onClick={() => { setOpen(false); it.onClick() }}
              style={{ color: it.danger ? tokens.color.semantic.critical : undefined, ...(it.danger && i > 0 ? { marginTop: 4, borderTop: `1px solid ${tokens.color.surface.line}`, borderRadius: '0 0 8px 8px' } : {}) }}>
              <Icon name={it.icon} size={15} /> {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Fenêtre modale générique (clic sur le fond ou Échap = fermer).
function Overlay({ onClose, children, width = 440 }: { onClose: () => void; children: React.ReactNode; width?: number }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div onClick={onClose} role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.45)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: width, maxHeight: '90vh', overflow: 'auto', background: tokens.color.surface.base, borderRadius: 16, padding: '24px 24px 20px', boxShadow: '0 24px 64px rgba(0,0,0,0.22)' }}>{children}</div>
    </div>
  )
}
const ghostBtn: React.CSSProperties = { padding: '10px 16px', borderRadius: 10, border: `1px solid ${tokens.color.surface.line}`, background: 'transparent', color: tokens.color.text.secondary, fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: 'pointer' }
const solidBtn = (enabled = true): React.CSSProperties => ({ padding: '10px 18px', borderRadius: 10, border: 'none', cursor: enabled ? 'pointer' : 'default', fontFamily: SANS, fontSize: 14, fontWeight: 700, color: tokens.color.surface.base, background: enabled ? tokens.color.text.primary : tokens.color.surface.line })

// Confirmation avant d'ouvrir le hub sur internet : dit clairement ce qui devient accessible.
function TunnelConfirm({ decks, customPassword, busy, onCancel, onConfirm }: { decks: { name: string; label: string; pub: boolean }[]; customPassword: boolean; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  const pubs = decks.filter((d) => d.pub), privs = decks.filter((d) => !d.pub)
  const row = (label: string, list: typeof decks, color: string) => list.length > 0 && (
    <div style={{ fontSize: 13, color: tokens.color.text.secondary, lineHeight: 1.5 }}>
      <b style={{ color }}>{label}</b> {list.map((d) => d.label).join(', ')}
    </div>
  )
  return (
    <Overlay onClose={onCancel}>
      <div style={{ fontSize: 18, fontWeight: 800, color: tokens.color.text.primary }}>Partager sur internet ?</div>
      <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.5, color: tokens.color.text.secondary }}>
        Un lien public <code>https://….trycloudflare.com</code> va être créé : toute personne qui le possède pourra ouvrir ce hub, même hors de ton réseau.
      </div>
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 14px', borderRadius: 10, background: tokens.color.surface.subtle }}>
        {row('Visibles par tous :', pubs, tokens.color.semantic.success)}
        {row('Protégés par mot de passe :', privs, tokens.color.text.primary)}
        {decks.length === 0 && <span style={{ fontSize: 13, color: tokens.color.text.muted }}>Aucun deck pour le moment.</span>}
      </div>
      <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.5, color: tokens.color.text.muted }}>
        Le lien se coupe tout seul après 4 h (réglable : <code>TUNNEL_TTL_HOURS</code>) ou quand tu arrêtes le serveur. Tu peux aussi l'arrêter à la main.
      </div>
      {!customPassword && (
        <div style={{ marginTop: 14, display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 10, background: `${tokens.color.semantic.critical}12`, border: `1px solid ${tokens.color.semantic.critical}55`, color: tokens.color.semantic.critical, fontSize: 13, lineHeight: 1.5 }}>
          <span style={{ flexShrink: 0, marginTop: 1 }}><Icon name="alert" size={16} /></span>
          <span>Le mot de passe est celui par défaut (« demo ») : n'importe qui avec le lien pourrait se déverrouiller et gérer tes decks. Définis-en un puis relance : <code>npm run password -- "monsecret"</code></span>
        </div>
      )}
      <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={ghostBtn}>Annuler</button>
        <button onClick={onConfirm} disabled={!customPassword || busy} style={solidBtn(customPassword && !busy)}>Créer le lien public</button>
      </div>
    </Overlay>
  )
}

// Corbeille : decks supprimés (decks/.trash) → restaurer.
function TrashModal({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<{ id: string; name: string; deletedAt: number }[] | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState('')
  useEffect(() => { fetch('/authoring/trash').then((r) => r.json()).then((d) => setEntries(d.entries ?? [])).catch(() => setErr('Chargement impossible')) }, [])
  const restore = async (id: string) => {
    setBusy(id); setErr('')
    const r = await api('POST', `/trash/${id}/restore`)
    if (r.ok) location.reload(); else { setErr(r.error || 'Échec'); setBusy('') }
  }
  return (
    <Overlay onClose={onClose}>
      <div style={{ fontSize: 18, fontWeight: 800, color: tokens.color.text.primary }}>Corbeille</div>
      <div style={{ marginTop: 6, fontSize: 13, color: tokens.color.text.muted }}>Les decks supprimés sont gardés dans <code>decks/.trash</code>.</div>
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {entries === null && !err && <span style={{ fontSize: 13, color: tokens.color.text.muted }}>Chargement…</span>}
        {entries?.length === 0 && <span style={{ fontSize: 13, color: tokens.color.text.muted }}>La corbeille est vide.</span>}
        {entries?.map((e) => (
          <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: `1px solid ${tokens.color.surface.line}` }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: tokens.color.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</div>
              <div style={{ fontSize: 12, color: tokens.color.text.muted }}>supprimé le {new Date(e.deletedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</div>
            </div>
            <button onClick={() => restore(e.id)} disabled={!!busy} style={{ ...ghostBtn, padding: '7px 12px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="restore" size={14} /> {busy === e.id ? '…' : 'Restaurer'}</button>
          </div>
        ))}
      </div>
      {err && <div style={{ marginTop: 10, fontFamily: MONO, fontSize: 12, color: tokens.color.semantic.critical }}>{err}</div>}
      <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}><button onClick={onClose} style={ghostBtn}>Fermer</button></div>
    </Overlay>
  )
}

// Bandeau « Comment ça marche » : explique le parcours scène → régie → téléphone.
const STEPS = [
  { icon: 'play', title: 'Présenter', text: 'Ouvre la scène en plein écran : c\'est ce que voit le public (projecteur).' },
  { icon: 'monitor', title: 'Régie', text: 'Sur ton ordi : aperçus, notes, chrono, timeline et un QR code pour piloter.' },
  { icon: 'smartphone', title: 'Téléphone', text: 'Chaque orateur scanne le QR de la régie et pilote ; le relais est automatique.' },
]
function HowItWorks({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ position: 'relative', marginBottom: 24, padding: '16px 44px 16px 18px', borderRadius: 14, background: tokens.color.surface.base, border: `1px solid ${tokens.color.surface.line}` }}>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: tokens.color.text.muted, marginBottom: 12 }}>Comment ça marche</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 16 }}>
        {STEPS.map((s, i) => (
          <div key={s.title} style={{ display: 'flex', gap: 12 }}>
            <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 9, background: tokens.color.surface.subtle, display: 'flex', alignItems: 'center', justifyContent: 'center', color: tokens.color.text.primary }}><Icon name={s.icon} size={16} /></div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: tokens.color.text.primary }}>{i + 1}. {s.title}</div>
              <div style={{ fontSize: 13, lineHeight: 1.45, color: tokens.color.text.secondary, marginTop: 2 }}>{s.text}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14, fontSize: 13, color: tokens.color.text.secondary }}>
        Créer un deck : <b>+ Nouveau deck</b>, puis édite <code>decks/&lt;nom&gt;/slides/</code> (une slide = un fichier .tsx). <a href="https://github.com/DrEggdwarf/slide-hub#readme" target="_blank" rel="noreferrer" style={{ color: tokens.color.text.primary, fontWeight: 600 }}>Documentation ↗</a>
      </div>
      <button className="hub-ic" onClick={onClose} aria-label="Masquer l'aide" data-tip="Masquer (réaffichable via « Aide »)" data-tip-end=""
        style={{ ...iconBox, position: 'absolute', top: 10, right: 10, color: tokens.color.text.muted }}><Icon name="x" size={15} /></button>
    </div>
  )
}
