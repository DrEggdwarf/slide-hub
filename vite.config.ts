import './server/env.js' // charge .env AVANT auth.js (mot de passe régie)
import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { attachHub } from './server/hub.js'
import { handleUnlock, isAdmin, isLocalReq, reachableOrigin, signToken, COOKIE, TTL_MS } from './server/auth.js'
import { handleAuthoring } from './server/authoring.js'

const root = fileURLToPath(new URL('.', import.meta.url))

// En dev, on branche EXACTEMENT le même hub/serveur qu'en prod, plus :
//  - POST /unlock (déverrouillage par mot de passe)
//  - auto-admin localhost : ta machine est admin sans rien taper (zéro config).
//    Un téléphone du LAN, lui, reste viewer → il devra passer par le token du QR.
function controlPlugin(): PluginOption {
  return {
    name: 'slide-engine-control',
    configureServer(server) {
      process.env.HUB_PORT = String(server.config.server.port ?? 5173)
      server.middlewares.use((req, res, next) => {
        const path = (req.url || '/').split('?')[0]
        if (path === '/unlock' && req.method === 'POST') { handleUnlock(req, res); return }
        if (path === '/whoami') { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ admin: isAdmin(req), origin: reachableOrigin(req) })); return }
        if (path.startsWith('/authoring/')) { void handleAuthoring(req, res); return }
        const wantsHtml = (req.headers.accept || '').includes('text/html')
        const hasCookie = (req.headers.cookie || '').includes(`${COOKIE}=`)
        if (isLocalReq(req) && wantsHtml && !hasCookie) {
          res.setHeader('set-cookie', `${COOKIE}=${signToken('admin')}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(TTL_MS / 1000)}`)
        }
        next()
      })
      if (server.httpServer) attachHub(server.httpServer)
    },
  }
}

export default defineConfig({
  plugins: [react(), controlPlugin()],
  // Alias pour que les slides de deck importent proprement le moteur partagé.
  resolve: {
    alias: {
      '@engine': resolve(root, 'src/engine'),
      '@ui': resolve(root, 'src/ui'),
      '@design': resolve(root, 'src/design'),
    },
  },
  server: {
    host: true, // accessible sur le réseau local (téléphones via IP:5173)
    port: 5173,
    open: false,
    // Autorise n'importe quel Host (IP LAN, tunnel trycloudflare, domaine) —
    // sinon Vite bloque « this host is not allowed » dès qu'on sort de localhost.
    allowedHosts: true,
    // Proxy /api → backend du deck (ex. l'API live d'Aegyl pour la démo pachinko).
    // Surcharge : API_PROXY_TARGET=http://localhost:8787 npm run dev (API en local).
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET || 'https://aegyl.fr',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
