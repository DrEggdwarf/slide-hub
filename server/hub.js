// ─────────────────────────────────────────────────────────────────────────
//  Hub de synchro MULTI-DECK.
//  L'état canonique vit ici, NAMESPACÉ PAR DECK : decks A et B ont chacun
//  leur slideIndex/step/chrono. Un client annonce son deck au `hello` ;
//  il ne reçoit/n'agit que sur l'état de SON deck.
//
//  Rôles (sécurité serveur) : admin (cookie) / pilot (token) / viewer.
// ─────────────────────────────────────────────────────────────────────────
import { WebSocketServer } from 'ws'
import { isAdmin, verifyToken, signToken, reachableOrigin } from './auth.js'

const freshState = () => ({ slideIndex: 0, step: 0, running: true, accumMs: 0, anchor: Date.now() })

export function attachHub(httpServer) {
  const wss = new WebSocketServer({ noServer: true })
  const states = new Map()        // deck -> état
  const deckOf = new WeakMap()    // ws -> deck
  const roleOf = new WeakMap()    // ws -> 'admin' | 'pilot' | 'viewer'
  const speakerOf = new WeakMap() // ws -> nom (pilotes)

  const stateOf = (deck) => { if (!states.has(deck)) states.set(deck, freshState()); return states.get(deck) }
  const stateMsg = (deck) => JSON.stringify({ kind: 'state', state: stateOf(deck), serverNow: Date.now() })

  const broadcast = (deck) => {
    const m = stateMsg(deck)
    for (const c of wss.clients) if (c.readyState === 1 && deckOf.get(c) === deck) c.send(m)
  }
  const roster = (deck) => {
    const speakers = [...wss.clients].filter((c) => deckOf.get(c) === deck && roleOf.get(c) === 'pilot' && speakerOf.get(c)).map((c) => speakerOf.get(c))
    const m = JSON.stringify({ kind: 'roster', speakers })
    for (const c of wss.clients) if (c.readyState === 1 && deckOf.get(c) === deck) c.send(m)
  }
  const canDrive = (ws) => roleOf.get(ws) === 'admin' || roleOf.get(ws) === 'pilot'

  function applyCmd(deck, cmd) {
    const st = stateOf(deck)
    const now = Date.now()
    switch (cmd.cmd) {
      case 'set':
        if (Number.isInteger(cmd.slideIndex) && cmd.slideIndex >= 0) st.slideIndex = cmd.slideIndex
        if (Number.isInteger(cmd.step) && cmd.step >= 0) st.step = cmd.step
        break
      case 'toggleTimer':
        if (st.running) { st.accumMs += now - st.anchor; st.running = false }
        else { st.anchor = now; st.running = true }
        break
      case 'resetTimer':
        st.accumMs = 0; st.anchor = now; st.running = true
        break
      default: return false
    }
    return true
  }

  wss.on('connection', (ws, req) => {
    roleOf.set(ws, isAdmin(req) ? 'admin' : 'viewer')

    ws.on('message', (buf) => {
      let m
      try { m = JSON.parse(buf.toString()) } catch { return }

      if (m.kind === 'hello') {
        const deck = typeof m.deck === 'string' && m.deck ? m.deck : 'default'
        deckOf.set(ws, deck)
        if (m.role === 'pilot') {
          if (verifyToken(m.token, 'pilot')) {
            roleOf.set(ws, 'pilot')
            ws.send(JSON.stringify({ kind: 'granted', role: 'pilot' }))
            roster(deck)
          } else {
            ws.send(JSON.stringify({ kind: 'denied' }))
          }
        } else {
          const role = roleOf.get(ws)
          ws.send(JSON.stringify({ kind: 'granted', role, ...(role === 'admin' ? { pilotToken: signToken('pilot'), origin: reachableOrigin(req) } : {}) }))
        }
        ws.send(stateMsg(deck))
        return
      }

      const deck = deckOf.get(ws)
      if (!deck) return
      if (m.kind === 'iam' && roleOf.get(ws) === 'pilot') { speakerOf.set(ws, m.speaker); roster(deck); return }
      if (m.kind === 'cmd' && canDrive(ws)) { if (applyCmd(deck, m)) broadcast(deck) }
    })

    ws.on('close', () => {
      const deck = deckOf.get(ws)
      roleOf.delete(ws); speakerOf.delete(ws); deckOf.delete(ws)
      if (deck) roster(deck)
    })
  })

  httpServer.on('upgrade', (req, socket, head) => {
    let pathname = '/'
    try { pathname = new URL(req.url ?? '/', 'http://localhost').pathname } catch { /* ignore */ }
    if (pathname === '/sync') wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req))
  })

  return wss
}
