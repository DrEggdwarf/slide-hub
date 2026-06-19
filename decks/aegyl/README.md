# Deck « aegyl » — guide d'écriture des slides

Ce dossier est un **deck** du Slide Hub. Ce fichier explique comment créer des slides
(pour un humain **ou** un LLM type Claude Code : ouvre ce dossier, lis ce README, génère les `.tsx`).

## Workflow

1. Une slide = **un fichier `NN-nom.tsx`** dans `slides/` qui exporte `meta` + `Component`.
2. `NN` (01, 02, 03…) définit **l'ordre** (tri alphabétique). Zéro-pad sur 2 chiffres (`01`, …, `12`).
3. **Rien à enregistrer** : le hub auto-découvre les fichiers. En `npm run dev`, le HMR affiche tout de suite.
4. Édite `deck.config.ts` pour la marque, le titre, les orateurs et la visibilité.

## Anatomie d'une slide

```tsx
import type { SlideContext, SlideMeta } from '@engine/types'
import { Eyebrow } from '@ui/Eyebrow'
import { Headline } from '@ui/Headline'
import { Lede } from '@ui/Lede'
import { Stack } from '@ui/Stack'
import { Reveal } from '@ui/Reveal'
import { tokens } from '@design/tokens'

export const meta: SlideMeta = {
  speaker: ['alice'],   // noms définis dans deck.config.ts (couleur auto). [] = tout le monde
  duration: 60,         // secondes (timeline + cadence régie)
  steps: 2,             // nb de révélations internes (→). 0 ou absent = pas d'étapes
  // title: 'Intro',    // titre court (grille « g »). annexe: true = slide de réserve (Q&A)
}

export function Component({ step }: SlideContext) {
  return (
    <Stack gap={28}>
      <Eyebrow>Section</Eyebrow>
      <Headline>Mon titre</Headline>
      <Lede>Une phrase d'accroche en une ligne.</Lede>
      <Reveal show={step >= 1}><p>Apparaît au 1er →</p></Reveal>
      <Reveal show={step >= 2}><p>Apparaît au 2e →</p></Reveal>
    </Stack>
  )
}
```

## `meta` (type `SlideMeta`)

| Champ | Type | Rôle |
|---|---|---|
| `speaker` | `string[]` | qui parle (noms de `deck.config.ts`). `[]`/absent = tout le monde |
| `duration` | `number` | durée cible en **secondes** (jalons timeline + cadence) |
| `steps` | `number` | révélations internes : `→` fait avancer `step` de `0`→`steps` avant de changer de slide |
| `title` | `string` | titre court (vue grille `g`) |
| `annexe` | `true` | slide de réserve : hors numérotation et progression |

> ⚠️ **Pas de champ `id`** : il est dérivé du nom de fichier.

## `Component` (props = `SlideContext`)

`{ step, totalSteps, isActive, next, prev }` — `step` est l'étape courante (`0..steps`). Utilise `step >= N` avec `<Reveal>` pour révéler progressivement.

## Le canvas : **1280×800**, structure header / body / footer

Tu dessines dans un canvas **fixe 1280×800** (mis à l'échelle pour remplir l'écran, sans déformation). Le contenu est **centré dans le body** ; le haut (zone orateur) et le bas (footer + progression) sont **réservés** → ne mets pas de contenu critique tout en haut ni tout en bas. Vise **1 idée par slide**, titre court.

## Composants `@ui` (préfère-les au HTML brut)

| Composant | Props | Usage |
|---|---|---|
| `<Eyebrow color?>` | `children` | petit label en haut de slide |
| `<Headline size? align? color?>` | `children` | titre (`size`: `sm`\|`md`\|`lg`\|`xl`\|`2xl`) |
| `<Lede size? align? color? maxWidth?>` | `children` | paragraphe d'accroche |
| `<Stack gap? align? direction?>` | `children` | layout flex (colonne par défaut) |
| `<Reveal show={step>=N} delay? y?>` | `children` | apparition pas à pas |
| `<Rule width? vertical?>` | — | trait de séparation |
| `<Stat value label? color? size?>` | — | chiffre clé en grand |

Tu peux aussi écrire du **TSX riche** (Framer Motion, SVG, matter-js…) — c'est du vrai React.

## Couleurs & typo : `@design/tokens`

Utilise les tokens (cohérence + futur thème) plutôt que des hex en dur :
- `tokens.color.text.primary` / `.secondary` / `.muted`
- `tokens.color.surface.base` / `.subtle` / `.line`
- `tokens.color.semantic.success` / `.critical`
- `tokens.color.accent.*`
- `tokens.type.size['2xl' | 'xl' | 'lg' | 'md' | 'sm' | 'xs']`, `tokens.type.family.sans` / `.mono`

## `deck.config.ts`

```ts
import type { DeckConfig } from '@engine/decks'
const config: DeckConfig = {
  brand: 'aegyl',
  title: 'aegyl',
  visibility: 'private',                 // 'public' = visible sans mot de passe
  speakers: { alice: '#1d4ed8', bob: '#b91c1c' },  // nom → couleur
  colors: { primary: '#6366f1', highlight: '#059669' }, // couleurs du projet
  // order: ['01-intro', '02-suite'],    // optionnel (sinon ordre alphabétique des fichiers)
}
export default config
```

**Couleurs du projet** : utilise-les dans une slide via `deckColor('primary')` (import `{ deckColor } from '@engine/decks'`). Pour les couleurs de **thème** (texte, fond), passe par `tokens.color.*` → ça suit automatiquement le **mode clair/sombre** (toggle dans le panneau `h`).

## Tester

`npm run dev` puis ouvre `http://localhost:5173/aegyl` (en local tu es admin automatiquement).
`g` = grille, `s` = notes, `l` = timeline, `h` = aide + QR, `f` = plein écran.
