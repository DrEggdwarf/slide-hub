/* Avatars partagés entre la page démo (côté utilisateur) et la slide
   (côté projection). Un même pseudo reçoit un avatar déterministe par défaut ;
   l'utilisateur peut ensuite le personnaliser, et son choix voyage via l'API
   jusqu'à la slide pour que sa bille porte exactement le même avatar. */

export type Avatar = { animal: string; bg: string }

/* Large pool d'animaux flat (emoji) — sélectionnables dans le picker. */
export const ANIMALS = [
  '🦊', '🐼', '🐰', '🦁', '🐯', '🐸', '🐵', '🐨', '🐷', '🐮',
  '🐔', '🐧', '🦉', '🦄', '🐙', '🦋', '🐢', '🐝', '🐳', '🦓',
  '🦒', '🦝', '🐺', '🐗', '🐹', '🐭', '🐶', '🐱', '🐻', '🦔',
  '🦦', '🦥', '🦘', '🦡', '🐊', '🦩', '🦚', '🐲', '🦂', '🦅',
  '🦜', '🦢', '🦫', '🦦', '🐅', '🐆', '🦏', '🦛', '🐊', '🦈',
  '🐬', '🦭', '🐠', '🐡', '🦞', '🦀', '🐌', '🦗', '🕷️', '🦟',
]

/* Palette vive, lisible en projection, distincte du vert/rouge des verdicts. */
export const AVATAR_BG = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4', '#f97316',
  '#a855f7', '#0ea5e9', '#d946ef', '#eab308', '#6366f1', '#fb7185',
  '#14b8a6', '#f43f5e', '#22d3ee', '#c026d3', '#2dd4bf', '#fbbf24',
  '#818cf8', '#e879f9', '#34d399', '#facc15', '#fb923c', '#60a5fa',
]

function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Avatar par défaut, déterministe à partir du pseudo. */
export function avatarFor(pseudo: string): Avatar {
  const h = hashStr((pseudo || 'anon').trim().toLowerCase())
  return {
    animal: ANIMALS[h % ANIMALS.length],
    bg: AVATAR_BG[(h >>> 11) % AVATAR_BG.length],
  }
}
