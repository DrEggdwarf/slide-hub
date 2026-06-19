import React from 'react'
import ReactDOM from 'react-dom/client'
import { DeckGate } from './engine/DeckGate'
import { HubIndex } from './ui/HubIndex'
import { ThemeRoot } from './ui/ThemeRoot'
import './design/globals.css'

// Routage :
//   /                       → index du hub (liste des decks)
//   /<deck>                 → scène (projection)        — gatée si deck privé
//   /<deck>/console         → régie présentateur        — gatée si deck privé
//   /<deck>/pilote?t=<tok>  → régie mobile               — gatée par token
const parts = window.location.pathname.split('/').filter(Boolean)
const deckName = parts[0]
const view = parts[1]

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeRoot>
      {deckName ? <DeckGate deckName={deckName} view={view} /> : <HubIndex />}
    </ThemeRoot>
  </React.StrictMode>
)
