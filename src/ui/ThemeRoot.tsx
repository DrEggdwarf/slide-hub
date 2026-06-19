import { createContext, useContext, useState } from 'react'
import { setTheme, type ThemeName } from '@design/tokens'

interface ThemeCtx { theme: ThemeName; toggle: () => void }
const Ctx = createContext<ThemeCtx>({ theme: 'light', toggle: () => {} })
export const useTheme = () => useContext(Ctx)

const KEY = 'slide-hub-theme'
const read = (): ThemeName => {
  try { return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light' } catch { return 'light' }
}
function apply(t: ThemeName) {
  setTheme(t)
  document.documentElement.dataset.theme = t // pour les fonds définis en CSS
}

// Pose le thème actif et re-render tout le sous-arbre quand il change
// (les composants lisent tokens.color via getter → couleurs à jour).
export function ThemeRoot({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(() => { const t = read(); apply(t); return t })
  const toggle = () => {
    const next: ThemeName = theme === 'dark' ? 'light' : 'dark'
    apply(next)
    try { localStorage.setItem(KEY, next) } catch { /* ignore */ }
    setThemeState(next)
  }
  return <Ctx.Provider value={{ theme, toggle }}>{children}</Ctx.Provider>
}
