// @ts-nocheck
'use client'

import { useState } from 'react'

const ADMIN_ID = '13cdb485-42e0-48df-b2f8-14dc77dd895a'

export default function EvenementsPage() {
  const [tab, setTab] = useState<'a-venir' | 'passes'>('a-venir')

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.75rem', color: '#2D2D2D', margin: 0 }}>Événements</h1>
          <p style={{ color: '#2D2D2D', opacity: 0.45, fontSize: '0.9rem', margin: '0.4rem 0 0' }}>
            Visios, ateliers et rencontres organisées par la communauté Meello.
          </p>
        </div>
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '1.5rem', borderBottom: '2px solid #F0EBE1' }}>
        {([['a-venir', 'À venir'], ['passes', 'Passés']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '0.6rem 1.25rem',
              fontWeight: tab === key ? 700 : 400,
              color: tab === key ? '#E8501A' : '#2D2D2D',
              opacity: tab === key ? 1 : 0.45,
              fontSize: '0.92rem',
              borderBottom: tab === key ? '2px solid #E8501A' : '2px solid transparent',
              marginBottom: '-2px',
              transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Contenu */}
      {tab === 'a-venir' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '5rem 2rem', textAlign: 'center' }}>
          <div style={{ width: '72px', height: '72px', backgroundColor: '#FFF0ED', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
            <img src="/icons/evenements.svg" alt="" style={{ width: '36px', height: '36px', filter: 'brightness(0) saturate(100%) invert(35%) sepia(90%) saturate(700%) hue-rotate(350deg)' }} />
          </div>
          <h2 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.2rem', color: '#2D2D2D', margin: '0 0 0.5rem' }}>
            Aucun événement à venir
          </h2>
          <p style={{ color: '#2D2D2D', opacity: 0.45, fontSize: '0.9rem', margin: '0 0 1.5rem', maxWidth: '360px', lineHeight: 1.6 }}>
            Les prochains événements Meello apparaîtront ici — visios, ateliers, sessions de networking…
          </p>
        </div>
      )}

      {tab === 'passes' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '5rem 2rem', textAlign: 'center' }}>
          <p style={{ color: '#2D2D2D', opacity: 0.35, fontSize: '0.9rem' }}>Aucun événement passé pour l'instant.</p>
        </div>
      )}

    </div>
  )
}
