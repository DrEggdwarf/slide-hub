import type { DeckConfig } from '@engine/decks'

// Deck « aegyl » — soutenance keystroke dynamics (4 orateurs).
const config: DeckConfig = {
  brand: 'Aegyl',
  title: 'Aegyl — soutenance',
  visibility: 'private',
  // Couleurs des orateurs (reprises de la palette accent d'Aegyl)
  speakers: { robin: '#1d4ed8', thomas: '#7c3aed', illias: '#b91c1c', arnaud: '#059669' },
  // Ordre = ordre alphabétique des fichiers (01-…, 02-…, …) — pas besoin de `order`.
}
export default config
