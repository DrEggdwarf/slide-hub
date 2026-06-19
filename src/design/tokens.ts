// ── Couleurs ───────────────────────────────────────────────────────────
// `tokens.color` est un getter sur la palette ACTIVE (light/dark). Les hex
// restent des hex → les motifs `${tokens.color.x}14` (opacité) continuent de
// marcher. Bascule via setTheme() + un re-render (ThemeRoot).
export type ThemeName = 'light' | 'dark'

// Accents (orateurs, thèmes de slides) — constants entre light/dark.
const ACCENT = {
  blue: '#1d4ed8', red: '#b91c1c', teal: '#0f766e', violet: '#7c3aed',
  robin: '#1d4ed8', lil: '#b91c1c', aegyl: '#6366f1', zscore: '#2563eb',
  iforest: '#ea580c', snn: '#7c3aed', sketch: '#059669', ecc: '#065f46',
}

interface Palette {
  text: { primary: string; secondary: string; tertiary: string; muted: string }
  surface: { base: string; subtle: string; line: string; lineStrong: string }
  semantic: { critical: string; warning: string; success: string; info: string; neutral: string }
  accent: typeof ACCENT
}

const LIGHT: Palette = {
  text: { primary: '#0a0a0a', secondary: '#262626', tertiary: '#525252', muted: '#a3a3a3' },
  surface: { base: '#ffffff', subtle: '#f5f5f5', line: '#d4d4d4', lineStrong: '#a3a3a3' },
  semantic: { critical: '#b91c1c', warning: '#b45309', success: '#15803d', info: '#1d4ed8', neutral: '#262626' },
  accent: ACCENT,
}

const DARK: Palette = {
  text: { primary: '#f3f4f6', secondary: '#cbd1da', tertiary: '#9aa3b2', muted: '#6b7280' },
  surface: { base: '#0f1115', subtle: '#171a21', line: '#2a2f3a', lineStrong: '#3a4150' },
  semantic: { critical: '#f87171', warning: '#fbbf24', success: '#34d399', info: '#60a5fa', neutral: '#cbd1da' },
  accent: ACCENT,
}

let active: Palette = LIGHT
export function setTheme(name: ThemeName) { active = name === 'dark' ? DARK : LIGHT }
export function getTheme(): ThemeName { return active === DARK ? 'dark' : 'light' }

export const tokens = {
  get color(): Palette { return active },
  type: {
    family: {
      sans: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
      mono: '"JetBrains Mono", "IBM Plex Mono", monospace',
    },
    size: {
      xs: '12px', sm: '14px', base: '16px', md: '18px', lg: '22px', xl: '28px',
      '2xl': '36px', '3xl': '52px', '4xl': '72px', '5xl': '104px', '6xl': '144px',
    },
    weight: { light: 300, regular: 400, medium: 500, semibold: 600, bold: 700 },
    leading: { tight: 1.05, snug: 1.25, normal: 1.5, relaxed: 1.7 },
    tracking: { tighter: '-0.04em', tight: '-0.02em', normal: '0', wide: '0.04em', wider: '0.12em' },
  },
  space: { 1: '4px', 2: '8px', 3: '12px', 4: '16px', 5: '24px', 6: '32px', 7: '48px', 8: '64px', 9: '96px', 10: '128px', 11: '160px' },
  motion: {
    duration: { fast: 0.2, base: 0.45, slow: 0.7, slower: 1.0 },
    ease: {
      out: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
      inOut: [0.4, 0, 0.2, 1] as [number, number, number, number],
      spring: [0.34, 1.2, 0.64, 1] as [number, number, number, number],
    },
  },
}

export type Tokens = typeof tokens
