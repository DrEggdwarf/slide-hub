import { useEffect, useState } from 'react'
import type { SlideModule } from './types'
import { brand } from '@engine/decks'
import { tokens } from '../design/tokens'

const MONO = tokens.type.family.mono
const SANS = tokens.type.family.sans
const W = 1280
const H = 800

// `contain: layout` : les éléments `position: fixed` d'une slide (ex. boutons de démo) restent sur SA page
// au lieu d'être répétés sur toutes les pages à l'impression.
// Vue d'impression : toutes les slides empilées (une page 1280×800 chacune), dans leur état final
// (toutes les révélations affichées). « Imprimer → Enregistrer au format PDF » = export PDF.
const CSS = `
html, body, #root { overflow: auto !important; height: auto !important; }
.print-page { position: relative; contain: layout paint; width: ${W}px; height: ${H}px; margin: 0 auto 20px; overflow: hidden; background: var(--app-bg, #fff); box-shadow: 0 2px 14px rgba(0,0,0,.18); zoom: var(--print-zoom, 1); }
.print-page .slide-canvas { --safe-bottom: 52px; }
@page { size: ${W}px ${H}px; margin: 0; }
@media print {
  html, body { background: none !important; }
  .print-root { min-height: 0 !important; padding: 0 !important; background: none !important; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .no-print { display: none !important; }
  .print-page { zoom: 1 !important; margin: 0; box-shadow: none; break-after: page; page-break-after: always; }
  .print-page:last-child { break-after: auto; page-break-after: auto; }
}
`

export function PrintView({ slides, deckName }: { slides: SlideModule[]; deckName: string }) {
  const [ready, setReady] = useState(false)
  const [zoom, setZoom] = useState(() => Math.min(1, (window.innerWidth - 48) / W))

  // Laisse les animations d'entrée se terminer avant d'autoriser l'impression.
  useEffect(() => { const t = window.setTimeout(() => setReady(true), 1800); return () => window.clearTimeout(t) }, [])
  useEffect(() => {
    const onResize = () => setZoom(Math.min(1, (window.innerWidth - 48) / W))
    window.addEventListener('resize', onResize); return () => window.removeEventListener('resize', onResize)
  }, [])

  const mainTotal = slides.filter((s) => !s.meta.annexe).length
  let main = 0
  return (
    <div className="print-root" style={{ minHeight: '100vh', background: '#e5e7eb', padding: '0 0 24px', ['--print-zoom' as never]: zoom }}>
      <style>{CSS}</style>
      <div className="no-print" style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '12px 24px', marginBottom: 20, background: '#fff', borderBottom: '1px solid #d4d4d8', fontFamily: SANS }}>
        <a href="/" style={{ fontFamily: MONO, fontSize: 12, color: '#52525b', textDecoration: 'none' }}>← Hub</a>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#0a0a0a' }}>Export PDF · {deckName} · {slides.length} pages</span>
        <button onClick={() => window.print()} disabled={!ready}
          style={{ padding: '9px 16px', borderRadius: 10, border: 'none', cursor: ready ? 'pointer' : 'default', fontFamily: SANS, fontSize: 14, fontWeight: 700, color: '#fff', background: ready ? '#0a0a0a' : '#a1a1aa' }}>
          {ready ? 'Imprimer / Enregistrer en PDF' : 'Préparation…'}
        </button>
        <span style={{ fontSize: 12, color: '#71717a', flex: '1 1 300px' }}>
          Dans la fenêtre d'impression : destination « Enregistrer au format PDF », marges « Aucune », cocher « Graphiques d'arrière-plan ».
        </span>
      </div>

      {slides.map((m, i) => {
        const Component = m.Component
        const steps = m.meta.steps ?? 0
        if (!m.meta.annexe) main += 1
        const counter = m.meta.annexe ? 'Annexe' : `${String(main).padStart(2, '0')} / ${String(mainTotal).padStart(2, '0')}`
        return (
          <section key={m.id} className="print-page" aria-label={`Slide ${i + 1}`}>
            <div className="slide-canvas">
              <Component step={steps} totalSteps={steps} isActive next={() => {}} prev={() => {}} />
            </div>
            <span style={{ position: 'absolute', left: 32, bottom: 14, fontFamily: MONO, fontSize: 11, letterSpacing: tokens.type.tracking.wide, color: tokens.color.text.muted }}>{brand()}</span>
            <span style={{ position: 'absolute', right: 32, bottom: 14, fontFamily: MONO, fontSize: 11, letterSpacing: tokens.type.tracking.wide, color: tokens.color.text.muted }}>{counter}</span>
          </section>
        )
      })}
    </div>
  )
}
