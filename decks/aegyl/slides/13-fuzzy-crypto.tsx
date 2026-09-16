import { motion } from 'framer-motion'
import { SlideContext, SlideMeta } from '@engine/types'
import { tokens } from '@design/tokens'
import { Eyebrow } from '@ui/Eyebrow'
import { PipelineBar } from './_pipeline'

export const meta: SlideMeta = {
  title: 'Cryptographie floue',
  speaker: ['arnaud'],
  duration: 120,
  steps: 10, // 6 étapes Enrôlement + 5 étapes Authentification
  notes: `═══ PARTIE 1 · ENRÔLEMENT ═══

[1 · Mesures brutes] Pour démarrer le processus d'enrôlement, nous demandons à l'utilisateur de saisir quelques phrases de test. Nous mesurons alors des données physiques brutes, comme le temps d'appui moyen V1 de 162 millisecondes, ou le temps de vol V2 de 410 millisecondes. À ce stade, ces mesures ont des échelles et des unités physiques très différentes, ce qui empêche de les comparer directement. Elles sont encore trop instables pour créer une clé cryptographique.

[2 · Stabilisation] Pour pouvoir comparer ces variables, notre système va d'abord les normaliser. Regardez l'écran : les graduations physiques en millisecondes s'effacent pour laisser place à un espace latent commun gradué de 0 à 100. Le stabilisateur convertit vos temps de frappe en valeurs sans unité. C'est grâce à cette étape que toutes les variables se retrouvent sur un pied d'égalité, prêtes à être découpées de la même manière.

[3 · Grille commune] Puisque toutes les variables partagent désormais la même échelle de 0 à 100, nous appliquons une seule et unique grille globale de boîtes sur tous les canaux. Avec cette grille partagée unique, nos variables se répartissent naturellement : V1 tombe dans la Boîte 2, V2 dans la Boîte 5, et V3 dans la Boîte 0. La combinaison visée est donc [2, 5, 0].

[4 · Centre des boîtes] Le système identifie maintenant le centre parfait de chaque boîte visée : par exemple, 160 ms (soit 41.6 %) pour la Boîte 2.

[5 · Le Sketch] Le système va mesurer précisément cet écart pour chaque variable. Ces écarts (par exemple +2 ms pour V1, −10 ms pour V2) constituent le Sketch. Il est sauvegardé publiquement sur le disque de l'ordinateur. C'est l'entonnoir de guidage qui permettra de compenser la variabilité physique de l'utilisateur lors de ses prochaines connexions.

[6 · Hachage & sauvegarde] Enfin, le système prend la suite des numéros de boîtes [2, 5, 0] et la passe dans une fonction de hachage SHA-256 pour générer le KeyHash. Les temps de frappe d'enrôlement réels de l'utilisateur sont définitivement supprimés. Si un pirate vole notre base de données, il n'y trouvera aucune information biométrique exploitable.

═══ PARTIE 2 · AUTHENTIFICATION ═══

[1 · Nouvelle tentative] Voyons maintenant ce qui se passe quand l'utilisateur revient s'authentifier. Ses mains tremblent légèrement, sa frappe a bougé : V1 vaut 161 ms au lieu de 162, et V2 vaut 405 ms au lieu de 410. Si on n'appliquait aucune correction, le point V2 (405 ms) serait considéré comme trop éloigné et tomberait dans la Boîte 4 au lieu de la Boîte 5. La clé lue serait [2, 4, 0] au lieu de [2, 5, 0]. La connexion échouerait. Voyons comment le système corrige cela.

[2 · Stabilisation] On convertit également sur la même échelle.

[3 · Application du Sketch] Le système récupère le fichier sketch.json stocké publiquement lors de l'enrôlement et applique les décalages : Valeur corrigée = Valeur stabilisée − Écart. Pour la variable V1, le point est translaté. Pour V2, le point à 405 ms est décalé par rapport à l'écart historique de −10 ms, ce qui le ramène vers la droite. Cet entonnoir de guidage ramène tous vos points du jour vers les centres de référence.

[4 · Quantification corrigée] Une fois corrigés par le Sketch, le système regarde dans quelles boîtes retombent les points verts. Comme vous pouvez le constater, bien que l'utilisateur ait tapé différemment du premier jour, les points corrigés retombent précisément dans les boîtes [2, 5, 0]. Le Sketch a effacé les tremblements du jour.

[5 · Validation] Pour finir, le système prend les indices reconstruits [2, 5, 0], calcule leur hash SHA-256, et tente de déchiffrer le coffre avec. Le hash correspond : accès autorisé.`,
}

const SANS = tokens.type.family.sans
const MONO = tokens.type.family.mono
const AEGYL = tokens.color.accent.aegyl
const REF = '#a78bfa'   // enrôlement
const AUTH = '#3b82f6'  // frappe du jour
const amber = tokens.color.semantic.warning

const VARS = [
  { label: 'V1 · Dwell', min: 110, max: 230 },
  { label: 'V2 · Flight', min: 200, max: 440 },
  { label: 'V3 · Seek', min: 80, max: 200 },
]
const CENTER = [41.6, 91.6, 8.3] // centres des boîtes de référence (espace commun)
const COMBO = [2, 5, 0]
const valToPct = (raw: number, v: { min: number; max: number }) => ((raw - v.min) / (v.max - v.min)) * 100

interface Step {
  phase: 0 | 1; title: string; desc: string; highlight: string
  raw: number[]; common: number[]; norm: boolean
  grid: boolean; centers: boolean; sketch: boolean; corrected: boolean
  disk?: { sketch: string; hash: string }
}

const STEPS: Step[] = [
  // ── Enrôlement ──
  { phase: 0, title: '1 · Mesures brutes', desc: "L'utilisateur tape des phrases test. Chaque variable a ses propres valeurs et unités (V1≈162 ms, V2≈410 ms, V3≈90 ms). Les échelles sont totalement différentes.", highlight: 'Pour l’instant : des valeurs physiques brutes (points violets). Aucune grille de sécurité.', raw: [162, 410, 90], common: [43.3, 87.5, 8.3], norm: false, grid: false, centers: false, sketch: false, corrected: false },
  { phase: 0, title: '2 · Standardisation', desc: "Pour comparer les variables entre elles,on les ramene à la même échelle 0→100.", highlight: 'Les graduations en ms disparaissent → une échelle commune 0-100. Les 3 canaux partagent le même espace.', raw: [162, 410, 90], common: [38, 85, 12], norm: true, grid: false, centers: false, sketch: false, corrected: false },
  { phase: 0, title: '3 · Grille commune', desc: 'Même échelle pour tous → UNE seule grille de 6 boîtes égales appliquée aux 3 canaux.', highlight: 'V1 → Boîte 2, V2 → Boîte 5, V3 → Boîte 0. La combinaison secrète est [2, 5, 0].', raw: [162, 410, 90], common: [38, 85, 12], norm: true, grid: true, centers: false, sketch: false, corrected: false },
  { phase: 0, title: '4 · Centre des boîtes', desc: 'Le système calcule le centre théorique de chaque boîte visée sur l’échelle commune.', highlight: 'Points jaunes = centres parfaits. On voit le décalage entre le point de l’utilisateur (violet) et le centre.', raw: [162, 410, 90], common: [38, 85, 12], norm: true, grid: true, centers: true, sketch: false, corrected: false },
  { phase: 0, title: '5 · Le Sketch (écarts)', desc: 'Écart = valeur stabilisée − centre de la boîte. Ex. V1 : 38 − 41,6 = −3,6.', highlight: 'Ces écarts (flèches jaunes) forment le Sketch. Sauvegardé en clair pour corriger les futures frappes.', raw: [162, 410, 90], common: [38, 85, 12], norm: true, grid: true, centers: true, sketch: true, corrected: false, disk: { sketch: 'D1 −3.6 · D2 −6.6 · D3 +3.7', hash: 'génération…' } },
  { phase: 0, title: '6 · Hachage & sauvegarde', desc: 'La suite des boîtes [2, 5, 0] passe dans SHA-256 → le KeyHash.', highlight: 'Seuls le Sketch (public) et le KeyHash sont gardés. Les mesures brutes sont effacées → vie privée préservée.', raw: [162, 410, 90], common: [38, 85, 12], norm: true, grid: true, centers: true, sketch: true, corrected: false, disk: { sketch: 'D1 −3.6 · D2 −6.6 · D3 +3.7', hash: 'SHA256([2,5,0]) → a7e89c6f2a…' } },
  // ── Authentification ──
  { phase: 1, title: '1 · Nouvelle tentative', desc: 'Vous revenez taper. Vos temps du jour diffèrent : V1=161, V2=405, V3=92 ms.', highlight: 'Brut, V2 (405 ms) tomberait dans la Boîte 4 au lieu de 5 → combinaison erronée [2, 4, 0], connexion refusée.', raw: [161, 405, 92], common: [41.2, 85.2, 10], norm: false, grid: false, centers: false, sketch: false, corrected: false, disk: { sketch: 'D1 −3.6 · D2 −6.6 · D3 +3.7', hash: 'SHA256([2,5,0]) → a7e89c6f2a…' } },
  { phase: 1, title: '2 · Standardisation', desc: 'Mêmes frappes projetées dans l’espace commun 0-100.', highlight: 'À cause du tremblement, V2 (stabilisé à 81,6) est trop loin du centre de la boîte d’enrôlement.', raw: [161, 405, 92], common: [36, 81.6, 15], norm: true, grid: true, centers: true, sketch: false, corrected: false, disk: { sketch: 'D1 −3.6 · D2 −6.6 · D3 +3.7', hash: 'SHA256([2,5,0]) → a7e89c6f2a…' } },
  { phase: 1, title: '3 · Application du Sketch', desc: 'Corrigée = stabilisée − écart. Ex. V2 : 81,6 − (−6,6) = 88,2.', highlight: 'Les flèches repoussent les points vers les centres des boîtes de référence.', raw: [161, 405, 92], common: [39.6, 88.2, 11.3], norm: true, grid: true, centers: true, sketch: true, corrected: false, disk: { sketch: 'D1 −3.6 · D2 −6.6 · D3 +3.7', hash: 'SHA256([2,5,0]) → a7e89c6f2a…' } },
  { phase: 1, title: '4 · Quantification corrigée', desc: 'On regarde les boîtes des points corrigés (verts). Ils retombent dans [2, 5, 0].', highlight: 'Frappe physique différente (161 vs 162 ms), mais le Sketch reconstruit exactement la même combinaison.', raw: [161, 405, 92], common: [39.6, 88.2, 11.3], norm: true, grid: true, centers: true, sketch: false, corrected: true, disk: { sketch: 'D1 −3.6 · D2 −6.6 · D3 +3.7', hash: 'SHA256([2,5,0]) → a7e89c6f2a…' } },
  { phase: 1, title: '5 · Validation', desc: '[2, 5, 0] est hachée en SHA-256. Le hash correspond, il va pouvoir déchiffrer son coffre', highlight: 'Accès autorisé. La crypto floue a sécurisé le compte en acceptant les variations du corps.', raw: [161, 405, 92], common: [39.6, 88.2, 11.3], norm: true, grid: true, centers: true, sketch: false, corrected: true, disk: { sketch: 'D1 −3.6 · D2 −6.6 · D3 +3.7', hash: 'SHA256([2,5,0]) ✓ MATCH' } },
]
const PHASE_LEN = [6, 5]

function Track({ v, i, s }: { v: typeof VARS[number]; i: number; s: Step }) {
  const pos = s.norm ? s.common[i] : valToPct(s.raw[i], v)
  const dotColor = s.phase === 0 ? REF : s.corrected ? tokens.color.semantic.success : AUTH
  const dotLabel = s.norm ? s.common[i].toFixed(1) : `${s.raw[i]} ms`
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '78px 1fr', alignItems: 'center', gap: 12, height: 50 }}>
      <span style={{ fontFamily: MONO, fontSize: 11, color: tokens.color.text.muted }}>{v.label}</span>
      <div style={{ position: 'relative', height: 34, borderRadius: 7, border: `1px solid ${s.grid ? tokens.color.surface.line : 'transparent'}`, background: s.grid ? `${AEGYL}08` : 'transparent', display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', transition: 'all .4s' }}>
        {Array.from({ length: 6 }).map((_, b) => (
          <div key={b} style={{ borderRight: b < 5 ? `1px dashed ${s.grid ? tokens.color.surface.line : 'transparent'}` : 'none', background: s.grid && b === COMBO[i] ? `${AEGYL}1e` : 'transparent', transition: 'all .4s' }} />
        ))}
        <div style={{ position: 'absolute', left: `${CENTER[i]}%`, top: '50%', width: 7, height: 7, borderRadius: '50%', background: amber, transform: 'translate(-50%,-50%)', opacity: s.centers ? 1 : 0, transition: 'opacity .4s', zIndex: 3 }} />
        {s.sketch && (
          <div style={{ position: 'absolute', top: '50%', height: 2, transform: 'translateY(-50%)', zIndex: 2, left: `${Math.min(pos, CENTER[i])}%`, width: `${Math.abs(pos - CENTER[i])}%`, background: `repeating-linear-gradient(90deg, ${amber}, ${amber} 3px, transparent 3px, transparent 6px)` }} />
        )}
        <motion.div animate={{ left: `${pos}%` }} transition={{ type: 'spring', stiffness: 200, damping: 24 }}
          style={{ position: 'absolute', top: '50%', width: 14, height: 14, borderRadius: '50%', background: dotColor, boxShadow: `0 0 9px ${dotColor}88`, transform: 'translate(-50%,-50%)', zIndex: 5 }}>
          <span style={{ position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)', fontFamily: MONO, fontSize: 8.5, fontWeight: 700, color: dotColor, whiteSpace: 'nowrap' }}>{dotLabel}</span>
        </motion.div>
      </div>
    </div>
  )
}

export function Component({ step }: SlideContext) {
  const idx = Math.min(Math.max(step, 0), STEPS.length - 1)
  const s = STEPS[idx]
  const sub = s.phase === 0 ? idx : idx - 6
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%', maxWidth: 1140, gap: 16, paddingTop: 72 }}>
      <PipelineBar active={3} />
      <Eyebrow color={AEGYL}>Crypto · Cryptographie floue</Eyebrow>

      {/* indicateur de phase */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {['Enrôlement', 'Authentification'].map((ph, p) => (
          <div key={ph} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 20, background: s.phase === p ? AEGYL : 'transparent', border: `1px solid ${s.phase === p ? AEGYL : tokens.color.surface.line}` }}>
            <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: s.phase === p ? '#fff' : tokens.color.text.muted }}>{ph}</span>
            <span style={{ display: 'flex', gap: 3 }}>
              {Array.from({ length: PHASE_LEN[p] }).map((_, k) => (
                <span key={k} style={{ width: 6, height: 6, borderRadius: '50%', background: s.phase === p && k <= sub ? '#fff' : s.phase === p ? 'rgba(255,255,255,.35)' : tokens.color.surface.line }} />
              ))}
            </span>
          </div>
        ))}
      </div>

      {/* carte : visuel (gauche) + texte (droite) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 28, width: '100%', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '16px 18px', borderRadius: 14, border: `1px solid ${tokens.color.surface.line}`, background: tokens.color.surface.subtle }}>
          {VARS.map((v, i) => <Track key={v.label} v={v} i={i} s={s} />)}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, justifyContent: 'center', opacity: s.grid ? 1 : 0.25, transition: 'opacity .4s' }}>
            <span style={{ display: 'flex', gap: 5 }}>{COMBO.map((b, i) => <span key={i} style={{ width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: 12, fontWeight: 700, color: '#fff', background: AEGYL }}>{b}</span>)}</span>
            <span style={{ fontFamily: MONO, fontSize: 12, color: tokens.color.text.muted }}>→ SHA-256</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <motion.div key={idx} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <div style={{ fontFamily: SANS, fontSize: 19, fontWeight: 800, color: AEGYL }}>{s.title}</div>
            <div style={{ fontFamily: SANS, fontSize: 14, color: tokens.color.text.secondary, lineHeight: 1.5, marginTop: 6 }}>{s.desc}</div>
          </motion.div>
          <div style={{ fontFamily: SANS, fontSize: 13, lineHeight: 1.45, padding: '10px 12px', borderRadius: 8, background: `${AEGYL}0e`, border: `1px solid ${AEGYL}33`, color: tokens.color.text.secondary }}>{s.highlight}</div>
          {s.disk && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${tokens.color.surface.line}` }}>
              <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: tokens.color.text.muted, marginBottom: 6 }}>Sauvegardé sur le disque</div>
              <div style={{ fontFamily: MONO, fontSize: 11, color: tokens.color.text.secondary }}>sketch.json — <b style={{ color: amber }}>{s.disk.sketch}</b></div>
              <div style={{ fontFamily: MONO, fontSize: 11, color: tokens.color.text.secondary, marginTop: 3 }}>keyhash — <b style={{ color: s.disk.hash.includes('MATCH') ? tokens.color.semantic.success : amber }}>{s.disk.hash}</b></div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
