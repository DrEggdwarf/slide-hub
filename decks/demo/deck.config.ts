import type { DeckConfig } from '@engine/decks'

// Configuration du deck « demo » — duplique ce dossier pour créer un nouveau deck.
const config: DeckConfig = {
  brand: 'React Slide Engine',
  speakers: {
    Alice: '#1d4ed8',
    Bob: '#b91c1c',
  },
  visibility: 'public', // 'public' = visible par tous · 'private' = accès gaté
}
export default config
