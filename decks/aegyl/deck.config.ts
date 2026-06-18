import type { DeckConfig } from '@engine/decks'

// Deck « aegyl » — soutenance keystroke dynamics (4 orateurs).
const config: DeckConfig = {
  brand: 'Aegyl',
  title: 'Aegyl — soutenance',
  visibility: 'public',
  // Couleurs des orateurs (reprises de la palette accent d'Aegyl)
  speakers: { robin: '#1d4ed8', thomas: '#7c3aed', illias: '#b91c1c', arnaud: '#059669' },
  // Ordre du deck (par id = nom de fichier) — repris du registre Aegyl
  order: [
    '00-accroche',
    '01b-problem',
    '01b2-systeme-ideal',
    '01c-comment',
    '01d-sources',
    '01e-team',
    '01f-roadmap',
    '01-mesures',
    '02-features',
    '05-zscore',
    '06-isolation-forest',
    '07-snn',
    '08-secure-sketch',
    '09-summary',
    '13-conclusion',
    '11-limitations',
    '12-demo',
  ],
}
export default config
