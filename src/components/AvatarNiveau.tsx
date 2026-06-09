// @ts-nocheck
'use client'

import { getLevelFromXP, getPalier } from '@/lib/gamification'
import EmblemeNiveau from '@/components/EmblemeNiveau'

// Compte officiel "L'Équipe Meello" : pas de niveau affiché.
const TEAM_ID = '00000000-0000-0000-0000-000000000001'

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

  // Taille de l'emblème proportionnelle à l'avatar (≈ 48%, borné).
  const badgeSize = Math.max(18, Math.min(36, Math.round(size * 0.48)))
  // Épaisseur de l'anneau coloré, proportionnelle (borné 2-4px).
  const ringW = Math.max(2, Math.min(4, Math.round(size * 0.06)))

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          // Anneau coloré de la couleur du palier (sauf Équipe Meello).
          border: displayLevel ? `${ringW}px solid ${palier.color}` : 'none',
          backgroundColor: '#E8501A',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: Math.round(size * 0.34),
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        {avatarUrl
          ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
          : initials}
      </div>

      {displayLevel && (
        <div
          title={`Niveau ${level} · ${palier.name}`}
          style={{ position: 'absolute', bottom: -4, right: -4, lineHeight: 0 }}
        >
          <EmblemeNiveau xp={xp} size={badgeSize} />
        </div>
      )}
    </div>
  )
}
