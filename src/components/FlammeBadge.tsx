// @ts-nocheck
'use client'

import { getPalierFlamme } from '@/lib/gamification'

// Badge flamme : nombre de semaines consécutives actives + couleur selon le palier.
// Ne s'affiche pas si weeks < 1.
// size : 'sm' (annuaire) | 'md' (profil)

const FLAMME_COLORS: Record<string, { bg: string; fg: string }> = {
  etincelle: { bg: '#FAECE7', fg: '#D85A30' },
  flamme:    { bg: '#F5C4B3', fg: '#C2410C' },
  brasier:   { bg: '#F0997B', fg: '#7A2E15' },
  feu_sacre: { bg: '#D85A30', fg: '#FFFFFF' },
}

export default function FlammeBadge({ weeks, size = 'md' }: { weeks: number; size?: 'sm' | 'md' }) {
  if (!weeks || weeks < 1) return null
  const palier = getPalierFlamme(weeks)
  if (!palier) return null
  const c = FLAMME_COLORS[palier.key] || FLAMME_COLORS.etincelle

  const iconSize = size === 'sm' ? 13 : 16
  const fontSize = size === 'sm' ? '0.72rem' : '0.82rem'
  const padding = size === 'sm' ? '2px 7px' : '3px 9px'

  return (
    <div
      title={`${weeks} semaine${weeks > 1 ? 's' : ''} d'affilée · ${palier.name}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        backgroundColor: c.bg,
        color: c.fg,
        borderRadius: '999px',
        padding,
        fontSize,
        fontWeight: 700,
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2c.5 3-1.5 4.5-3 6.5C7.5 10.5 7 12 7 13.5 7 17 9.5 19 12 19s5-2 5-5.5c0-2-1-3.5-2.2-5C13.5 7 13 5 13.5 3.5 13 4 12.4 4.5 12 5c-.3-1-.2-2 0-3z" />
      </svg>
      {weeks}
    </div>
  )
}
