// ─────────────────────────────────────────────────────────────────────────
//  Système de decks du hub.
//  - Le moteur est PARTAGÉ ; un deck = un dossier decks/<nom>/{deck.config.ts, slides/}.
//  - Découverte au build via import.meta.glob (les slides restent du vrai TSX,
//    code-splitté par deck → charger /aegyl ne tire que les slides d'Aegyl).
//  - La config du deck « actif » est posée au boot (setActiveDeck) ; les
//    composants lisent brand()/speakerColor()/speakerNames().
// ─────────────────────────────────────────────────────────────────────────
import type { ComponentType } from 'react'
import type { SlideContext, SlideMeta, SlideModule } from './types'

export interface DeckConfig {
  /** Bandeau bas + libellés régie */
  brand: string
  /** Orateurs : nom → couleur (couleur optionnelle, sinon couleur stable auto) */
  speakers: Record<string, string>
  /** 'public' = visible par tous · 'private' = accès gaté (défaut : private) */
  visibility?: 'public' | 'private'
  /** Titre affiché dans l'index du hub (sinon le nom du dossier) */
  title?: string
  /** Ordre explicite des slides (par id = nom de fichier sans .tsx). Sinon ordre alphabétique. */
  order?: string[]
}

// ── Config du deck actif (posée au boot) + accessors ─────────────────────
const FALLBACK = ['#1d4ed8', '#b91c1c', '#0f766e', '#7c3aed', '#b45309', '#0369a1']
let active: DeckConfig = { brand: 'Slides', speakers: {}, visibility: 'public' }

export function setActiveDeck(c: DeckConfig) { active = c }
export function brand(): string { return active.brand }
export function speakerNames(): string[] { return Object.keys(active.speakers) }
export function speakerColor(name: string): string {
  const def = active.speakers[name]
  if (def) return def
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return FALLBACK[h % FALLBACK.length]
}

// ── Découverte des decks ─────────────────────────────────────────────────
// Les configs (minuscules) sont eager ; les slides restent lazy → code-split par deck.
const cfgEager = import.meta.glob('../../decks/*/deck.config.ts', { eager: true }) as Record<string, { default: DeckConfig }>
const slideLazy = import.meta.glob('../../decks/*/slides/*.tsx')

const nameOf = (p: string) => p.match(/decks\/([^/]+)\//)![1]

export function deckNames(): string[] {
  return [...new Set(Object.keys(cfgEager).map(nameOf))].sort()
}

/** Config d'un deck, synchrone (pour l'index du hub). */
export function deckConfig(name: string): DeckConfig | null {
  const entry = Object.entries(cfgEager).find(([p]) => nameOf(p) === name)
  return entry ? entry[1].default : null
}

/** Charge la config + les slides d'un deck (slides code-splittés, chargés à la demande). */
export async function loadDeck(name: string): Promise<{ config: DeckConfig; slides: SlideModule[] } | null> {
  const config = deckConfig(name)
  if (!config) return null
  const slides: SlideModule[] = await Promise.all(
    Object.entries(slideLazy)
      .filter(([p]) => nameOf(p) === name && !p.split('/').pop()!.startsWith('_'))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(async ([p, load]) => {
        const m = (await load()) as { meta?: SlideMeta; Component?: ComponentType<SlideContext> }
        return { id: p.split('/').pop()!.replace(/\.tsx$/, ''), meta: m.meta ?? {}, Component: m.Component as ComponentType<SlideContext> }
      })
  )
  // Ordre explicite si fourni (sinon ordre alphabétique de fichier)
  if (config.order) {
    const rank = (id: string) => { const i = config.order!.indexOf(id); return i === -1 ? Number.MAX_SAFE_INTEGER : i }
    slides.sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id))
  }
  return { config, slides }
}
