// @ts-nocheck
'use client'

import { useRef } from 'react'

/**
 * Aperçu d'image recadrable verticalement par glisser (souris + tactile).
 * On attrape l'image et on la monte/descend ; `position` (0 = haut, 100 = bas)
 * est mis à jour en direct via `onChange`.
 */
export default function ImageCropPosition({
  src, position, onChange, height = 180, borderRadius = '12px',
}: {
  src: string
  position: number
  onChange: (pos: number) => void
  height?: number
  borderRadius?: string
}) {
  const dragging = useRef(false)
  const startY = useRef(0)
  const startPos = useRef(50)

  const clientY = (e: any) => (e.touches ? e.touches[0].clientY : e.clientY)

  const onDown = (e: any) => {
    dragging.current = true
    startY.current = clientY(e)
    startPos.current = position
  }

  const onMove = (e: any) => {
    if (!dragging.current) return
    // Déplacer vers le bas révèle le haut de l'image (position diminue) et vice versa.
    const delta = clientY(e) - startY.current
    // Sensibilité : la hauteur du cadre correspond à ~100% de course.
    const next = Math.max(0, Math.min(100, startPos.current - (delta / height) * 100))
    onChange(Math.round(next))
  }

  const onUp = () => { dragging.current = false }

  return (
    <div style={{ userSelect: 'none' }}>
      <div
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
        onMouseLeave={onUp}
        onTouchStart={onDown}
        onTouchMove={onMove}
        onTouchEnd={onUp}
        style={{
          position: 'relative', height: `${height}px`, borderRadius, overflow: 'hidden',
          cursor: 'grab', touchAction: 'none', backgroundColor: '#FAFAFA',
        }}
      >
        <img
          src={src}
          alt=""
          draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `center ${position}%`, display: 'block', pointerEvents: 'none' }}
        />
        {/* Indice visuel */}
        <div style={{ position: 'absolute', top: '0.5rem', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(0,0,0,0.55)', color: 'white', borderRadius: '20px', padding: '0.25rem 0.7rem', fontSize: '0.72rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem', pointerEvents: 'none' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/><polyline points="6 9 12 15 18 9" opacity="0"/></svg>
          Glisse pour recadrer
        </div>
      </div>
    </div>
  )
}
