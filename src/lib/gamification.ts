// ============================================================================
// Gamification Meello — source de vérité unique (niveaux, paliers, couleurs).
// Aligné sur GAMIFICATION_MEELLO.md.
//
//  - Échelle 1 à 100, sans plafond réel (au-delà de 100 = bonus).
//  - Coût pour passer du niveau N-1 au niveau N : 40 + 2,66 * (N - 2), N >= 2.
//  - Cumul au niveau 100 ≈ 16 900 XP.
//  - On ne stocke que le total XP ; niveau et palier sont recalculés ici.
// ============================================================================

export const MAX_LEVEL = 100

// Coût (en XP) pour ATTEINDRE le niveau `level` depuis le niveau précédent.
export function levelCost(level: number): number {
  if (level <= 1) return 0
  return Math.round(40 + 2.66 * (level - 2))
}

export interface LevelInfo {
  level: number
  currentXP: number // XP accumulés dans le niveau courant
  xpToNext: number // XP nécessaires pour passer au niveau suivant
  totalXP: number
}

// Calcule le niveau à partir du total d'XP.
export function getLevelFromXP(totalXP: number): LevelInfo {
  const xp = Math.max(0, Math.floor(totalXP || 0))
  let level = 1
  let accumulated = 0

  while (level < MAX_LEVEL) {
    const cost = levelCost(level + 1)
    if (accumulated + cost > xp) {
      return { level, currentXP: xp - accumulated, xpToNext: cost, totalXP: xp }
    }
    accumulated += cost
    level++
  }

  // Niveau 100 atteint : on continue à compter les XP au-delà (bonus),
  // mais le niveau affiché reste 100.
  return { level: MAX_LEVEL, currentXP: xp - accumulated, xpToNext: 0, totalXP: xp }
}

// ─── Paliers nommés (6) ──────────────────────────────────────────────────────
export interface Palier {
  key: string
  name: string
  minLevel: number
  color: string // couleur principale (médaillon, flamme)
}

export const PALIERS: Palier[] = [
  { key: 'nouvelle_pousse', name: 'Nouvelle pousse', minLevel: 1, color: '#D85A30' },
  { key: 'membre_installe', name: 'Membre installé', minLevel: 10, color: '#0F6E56' },
  { key: 'moteur', name: 'Moteur', minLevel: 25, color: '#185FA5' },
  { key: 'pilier', name: 'Pilier', minLevel: 50, color: '#3C3489' },
  { key: 'figure', name: 'Figure', minLevel: 75, color: '#993556' },
  { key: 'legende', name: 'Légende Meello', minLevel: 100, color: '#BA7517' },
]

export function getPalier(level: number): Palier {
  let current = PALIERS[0]
  for (const p of PALIERS) {
    if (level >= p.minLevel) current = p
    else break
  }
  return current
}

export function getLevelColor(level: number): string {
  return getPalier(level).color
}

// ─── Flamme (séries de semaines actives) ─────────────────────────────────────
// Une semaine est "validée" si le membre a été actif >= 4 jours sur 5 ouvrés.
// On compte les semaines consécutives validées. Règle de grâce : 1 semaine
// ratée = la flamme vacille mais survit ; 2 ratées d'affilée = reset.

export const ACTIVE_DAYS_REQUIRED = 4 // sur 5 jours ouvrés

export interface PalierFlamme {
  key: string
  name: string
  minWeeks: number
}

export const PALIERS_FLAMME: PalierFlamme[] = [
  { key: 'etincelle', name: 'Étincelle', minWeeks: 1 },
  { key: 'flamme', name: 'Flamme', minWeeks: 4 },
  { key: 'brasier', name: 'Brasier', minWeeks: 10 },
  { key: 'feu_sacre', name: 'Feu sacré', minWeeks: 25 },
]

export function getPalierFlamme(weeks: number): PalierFlamme | null {
  if (weeks < 1) return null
  let current = PALIERS_FLAMME[0]
  for (const p of PALIERS_FLAMME) {
    if (weeks >= p.minWeeks) current = p
    else break
  }
  return current
}

// Renvoie le lundi (date YYYY-MM-DD) de la semaine contenant `date`.
export function mondayOf(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = d.getUTCDay() // 0 = dimanche, 1 = lundi...
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

// Compte les jours OUVRÉS (lun-ven) actifs parmi une liste de dates ISO (YYYY-MM-DD)
// pour la semaine commençant le lundi `weekStart`.
export function countWeekdayActivity(activeDays: string[], weekStart: string): number {
  const start = new Date(weekStart + 'T00:00:00Z')
  const weekdays = new Set<string>()
  for (let i = 0; i < 5; i++) {
    const d = new Date(start)
    d.setUTCDate(d.getUTCDate() + i)
    weekdays.add(d.toISOString().slice(0, 10))
  }
  return activeDays.filter(d => weekdays.has(d)).length
}

// ─── Défis de la semaine ─────────────────────────────────────────────────────
// Chaque défi se mesure en comptant des lignes xp_logs de la semaine pour une
// action donnée. "target" = nombre à atteindre. Définition de la banque côté
// table `challenges` ; ici on définit comment mesurer la progression.
export interface ChallengeDef {
  id: string
  countAction: string // action xp_logs comptée pour la progression
  target: number
  boost: number
}

export const CHALLENGE_DEFS: Record<string, ChallengeDef> = {
  brise_la_glace:    { id: 'brise_la_glace',    countAction: 'connection_accepted', target: 2, boost: 60 },
  fais_connaissance: { id: 'fais_connaissance', countAction: 'connection_accepted', target: 1, boost: 50 },
  donne_ton_avis:    { id: 'donne_ton_avis',    countAction: 'comment_post',        target: 3, boost: 50 },
  partage_ton_actu:  { id: 'partage_ton_actu',  countAction: 'post_created',        target: 1, boost: 40 },
  complete_profil:   { id: 'complete_profil',   countAction: 'profile_completed',   target: 1, boost: 30 },
}

// Pratique : tout en un appel.
export function getProgression(totalXP: number) {
  const info = getLevelFromXP(totalXP)
  const palier = getPalier(info.level)
  const pct = info.xpToNext > 0 ? Math.round((info.currentXP / info.xpToNext) * 100) : 100
  return { ...info, palier, pct }
}
