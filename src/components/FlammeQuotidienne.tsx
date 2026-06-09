// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'

// Modale "cheminement de la flamme" : affichée 1x/jour à la 1re ouverture.
// Montre les 5 jours ouvrés, les jours actifs, et la progression vers
// l'objectif (4 jours = semaine validée → la flamme grandit).
//
// Pour l'instant : affichée UNIQUEMENT pour l'admin (prop `enabled`).

export default function FlammeQuotidienne({ userId, enabled }: { userId: string | null; enabled: boolean }) {
  const [data, setData] = useState<any>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!userId || !enabled) return
    // Une seule fois par jour.
    const today = new Date().toISOString().slice(0, 10)
    const key = 'meello:flamme-seen'
    try {
      if (localStorage.getItem(key) === today) return
    } catch {}

    fetch(`/api/week-activity?userId=${userId}`)
      .then(r => r.json())
      .then(d => {
        setData(d)
        setOpen(true)
        try { localStorage.setItem(key, today) } catch {}
      })
      .catch(() => {})
  }, [userId, enabled])

  if (!open || !data) return null

  const pct = Math.min(100, Math.round((data.activeCount / data.target) * 100))

  return (
    <div
      onClick={() => setOpen(false)}
      style={{ position: 'fixed', inset: 0, zIndex: 2000, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ backgroundColor: 'white', borderRadius: '20px', padding: '1.75rem', maxWidth: '380px', width: '100%', boxShadow: '0 12px 40px rgba(0,0,0,0.2)' }}
      >
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '2.5rem', lineHeight: 1, marginBottom: '0.5rem' }}>🔥</div>
          <div style={{ fontFamily: 'var(--font-clash)', fontSize: '1.3rem', fontWeight: 700, color: '#2D2D2D' }}>
            {data.streakWeeks > 0 ? `${data.streakWeeks} semaine${data.streakWeeks > 1 ? 's' : ''} d'affilée` : 'Lance ta série !'}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#2D2D2D', opacity: 0.55, marginTop: '0.25rem' }}>
            {data.validated
              ? 'Semaine validée, ta flamme grandit cette semaine 🎉'
              : `Encore ${data.target - data.activeCount} jour${(data.target - data.activeCount) > 1 ? 's' : ''} actif${(data.target - data.activeCount) > 1 ? 's' : ''} pour valider la semaine`}
          </div>
        </div>

        {/* Jours de la semaine */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.4rem', marginBottom: '1.25rem' }}>
          {data.days.map((d: any) => (
            <div key={d.date} style={{ textAlign: 'center', flex: 1 }}>
              <div
                style={{
                  width: '38px', height: '38px', borderRadius: '50%', margin: '0 auto 0.35rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: d.active ? '#E8501A' : '#F1EFE8',
                  color: d.active ? 'white' : '#B4B2A9',
                  fontSize: '1.1rem',
                }}
              >
                {d.active ? '🔥' : '·'}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#2D2D2D', opacity: 0.5, fontWeight: 600 }}>{d.label}</div>
            </div>
          ))}
        </div>

        {/* Barre de progression vers l'objectif */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#2D2D2D', opacity: 0.5, marginBottom: '0.35rem' }}>
          <span>{data.activeCount} / {data.target} jours actifs</span>
          <span>Objectif semaine</span>
        </div>
        <div style={{ height: '8px', backgroundColor: '#F1EFE8', borderRadius: '999px', overflow: 'hidden', marginBottom: '1.5rem' }}>
          <div style={{ height: '100%', width: `${pct}%`, backgroundColor: '#E8501A', borderRadius: '999px', transition: 'width 0.5s ease' }} />
        </div>

        <button
          onClick={() => setOpen(false)}
          style={{ width: '100%', padding: '0.8rem', backgroundColor: '#E8501A', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}
        >
          C'est parti
        </button>
      </div>
    </div>
  )
}
