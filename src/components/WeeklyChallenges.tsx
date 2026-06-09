// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'

interface Challenge {
  id: string
  label: string
  description: string
  boost: number
  target: number
  progress: number
  completed: boolean
}

export default function WeeklyChallenges({ userId }: { userId: string | null }) {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    fetch(`/api/challenges?userId=${userId}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setChallenges(d.challenges || []) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [userId])

  if (!userId || (!loading && challenges.length === 0)) return null

  return (
    <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#E8501A" aria-hidden="true">
          <path d="M13 2L4.5 12.5h6L9 22l9-11.5h-6L13 2z" />
        </svg>
        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#2D2D2D' }}>Défis de la semaine</span>
      </div>

      {loading ? (
        <div style={{ fontSize: '0.82rem', color: '#2D2D2D', opacity: 0.4 }}>Chargement...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {challenges.map(c => {
            const pct = Math.round((c.progress / c.target) * 100)
            return (
              <div key={c.id} style={{ padding: '0.75rem', backgroundColor: c.completed ? '#F1F8F2' : '#F9F9F9', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#2D2D2D' }}>{c.label}</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: c.completed ? '#7A9E7E' : '#E8501A', backgroundColor: c.completed ? '#DEEFE0' : '#FFF0ED', padding: '0.15rem 0.5rem', borderRadius: '999px', whiteSpace: 'nowrap' }}>
                    {c.completed ? '✓ Réussi' : `+${c.boost}`}
                  </span>
                </div>
                <div style={{ fontSize: '0.76rem', color: '#2D2D2D', opacity: 0.55, marginBottom: '0.5rem' }}>{c.description}</div>
                {!c.completed && (
                  <>
                    <div style={{ height: '5px', backgroundColor: '#E8E8E8', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, backgroundColor: '#E8501A', borderRadius: '3px', transition: 'width 0.4s ease' }} />
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#2D2D2D', opacity: 0.4, marginTop: '0.25rem' }}>{c.progress} / {c.target}</div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
