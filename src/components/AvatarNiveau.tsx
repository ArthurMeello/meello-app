// @ts-nocheck
'use client'

import { getLevelFromXP, getPalier } from '@/lib/gamification'

// Compte officiel "L'Équipe Meello" : pas de niveau affiché.
const TEAM_ID = '13cdb485-42e0-48df-b2f8-14dc77dd895a'

// Avatar rond + médaillon de niveau en bas à droite (numéro, couleur du palier).
// À utiliser partout où l'on affiche la photo d'un membre (sauf réactions).
//
// Props :
//   avatarUrl  : URL de la photo (optionnel ; sinon initiales)
//   xp         : total XP du membre (détermine le niveau affiché)
//   initials   : initiales de secours si pas de photo
//   size       : diamètre de l'avatar en px (défaut 48)
//   showLevel  : afficher le médaillon (défaut true)

export default function AvatarNiveau({
  avatarUrl,
  xp = 0,
  initials = '',
  size = 48,
  showLevel = true,
  userId,
}: {
  avatarUrl?: string | null
  xp?: number
  initials?: string
  size?: number
  showLevel?: boolean
  userId?: string | null
}) {
  const { level } = getLevelFromXP(xp || 0)
  const palier = getPalier(level)
  // Le compte officiel "L'Équipe Meello" n'a pas de niveau.
  const displayLevel = showLevel && userId !== TEAM_ID

  // Taille du médaillon proportionnelle à l'avatar (≈ 42%, borné).
  const badgeSize = Math.max(16, Math.min(30, Math.round(size * 0.42)))
  const fontSize = Math.max(9, Math.round(badgeSize * 0.5))
  const borderW = size >= 56 ? 2.5 : 2

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          backgroundColor: '#E8501A',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: Math.round(size * 0.34),
          overflow: 'hidden',
        }}
      >
        {avatarUrl
          ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : initials}
      </div>

      {displayLevel && (
        <span
          title={`Niveau ${level} · ${palier.name}`}
          style={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            width: badgeSize,
            height: badgeSize,
            borderRadius: '50%',
            backgroundColor: palier.color,
            color: 'white',
            border: `${borderW}px solid white`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize,
            lineHeight: 1,
          }}
        >
          {level}
        </span>
      )}
    </div>
  )
}
