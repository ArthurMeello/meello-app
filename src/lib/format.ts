// Normalise une URL externe pour un href : ajoute https:// si le schéma manque.
// Évite que "www.linkedin.com/..." soit interprété comme un chemin relatif.
export function externalUrl(url?: string | null): string {
  if (!url) return '#'
  const u = url.trim()
  if (!u) return '#'
  if (/^https?:\/\//i.test(u)) return u
  if (/^mailto:|^tel:/i.test(u)) return u
  return `https://${u.replace(/^\/+/, '')}`
}

// Normalisation de la casse pour l'affichage (prénom, nom, ville).
// Gère les traits d'union, les apostrophes et les particules françaises.

const PARTICLES = new Set(['de', 'des', 'du', 'la', 'le', 'les', 'd', 'l', 'et', 'à', 'sur', 'sous', 'aux', 'en'])

// Met en majuscule la 1re lettre d'un fragment (en respectant les accents)
function capFragment(s: string): string {
  if (!s) return s
  return s.charAt(0).toLocaleUpperCase('fr-FR') + s.slice(1).toLocaleLowerCase('fr-FR')
}

// Applique la casse à un mot, en gérant les sous-séparateurs (- et ')
function capWord(word: string, index: number): string {
  const lower = word.toLocaleLowerCase('fr-FR')
  // Particule (sauf en tout premier mot) → reste en minuscule
  if (index > 0 && PARTICLES.has(lower)) return lower
  // Gérer les traits d'union et apostrophes : chaque fragment est capitalisé
  return lower
    .split('-').map(part =>
      part.split("'").map(sub => capFragment(sub)).join("'")
    ).join('-')
}

/**
 * "VEZERONCE-CURTIN" -> "Vezeronce-Curtin"
 * "jean DUPONT" -> "Jean Dupont"
 * "jean de la fontaine" -> "Jean de la Fontaine"
 */
export function titleCase(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .trim()
    .split(/\s+/)
    .map((w, i) => capWord(w, i))
    .join(' ')
}

// Raccourci pour "Prénom Nom"
export function fullName(first?: string | null, last?: string | null): string {
  return `${titleCase(first)} ${titleCase(last)}`.trim()
}
