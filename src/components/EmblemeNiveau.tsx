// @ts-nocheck
'use client'

import { getLevelFromXP, getPalier } from '@/lib/gamification'

// Emblème de niveau : écusson hexagonal en relief (couleur du palier + numéro).
// Reproduit le design des emblèmes Meello, paramétrable par taille et niveau.
//
// Variantes de couleur par palier : teinte claire (haut) -> foncée (bas),
// base sombre dessous pour le relief, liseré clair pour le biseau.

const PALIER_RAMP: Record<string, { light: string; mid: string; base: string; bevel: string; text: string }> = {
  nouvelle_pousse: { light: '#F0997B', mid: '#D85A30', base: '#7A2E15', bevel: '#F5C4B3', text: '#fff' },
  membre_installe: { light: '#5DCAA5', mid: '#0F6E56', base: '#063D30', bevel: '#9FE1CB', text: '#fff' },
  moteur:          { light: '#85B7EB', mid: '#185FA5', base: '#072E54', bevel: '#B5D4F4', text: '#fff' },
  pilier:          { light: '#7F77DD', mid: '#3C3489', base: '#211B4D', bevel: '#CECBF6', text: '#fff' },
  figure:          { light: '#ED93B1', mid: '#993556', base: '#5C1A30', bevel: '#F4C0D1', text: '#fff' },
  legende:         { light: '#FAC775', mid: '#BA7517', base: '#5C3806', bevel: '#FAC775', text: '#fff' },
}

// Points d'un hexagone "pointu haut/bas" centré, rayon r.
function hexPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = []
  for (const ang of [-90, -30, 30, 90, 150, 210]) {
    const a = (ang * Math.PI) / 180
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`)
  }
  return pts.join(' ')
}

export default function EmblemeNiveau({ xp = 0, size = 28 }: { xp?: number; size?: number }) {
  const { level } = getLevelFromXP(xp || 0)
  const palier = getPalier(level)
  const ramp = PALIER_RAMP[palier.key] || PALIER_RAMP.nouvelle_pousse

  const id = `emb-${palier.key}`
  const cx = 50
  const cy = 48
  const R = 40
  const depth = 6
  const main = hexPoints(cx, cy, R)
  const base = hexPoints(cx, cy + depth, R)
  const inner = hexPoints(cx, cy, R - 11)
  const fontSize = level >= 100 ? 30 : level >= 10 ? 34 : 38

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: 'block', overflow: 'visible' }} aria-label={`Niveau ${level}`}>
      <defs>
        <linearGradient id={`${id}-face`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={ramp.light} />
          <stop offset="1" stopColor={ramp.mid} />
        </linearGradient>
      </defs>
      <polygon points={base} fill={ramp.base} />
      <polygon points={main} fill={`url(#${id}-face)`} />
      <polygon points={inner} fill="none" stroke={ramp.bevel} strokeWidth="3" strokeOpacity="0.55" />
      <text x={cx} y={cy + fontSize * 0.34} textAnchor="middle" fontFamily="Arial, sans-serif" fontSize={fontSize} fontWeight="700" fill={ramp.text}>{level}</text>
    </svg>
  )
}
