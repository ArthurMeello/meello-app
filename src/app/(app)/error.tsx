'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter()

  useEffect(() => {
    // Log discret pour le debug (visible en console)
    console.error('App error boundary:', error)
  }, [error])

  return (
    <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2rem', gap: '0.75rem' }}>
      <div style={{ fontSize: '2.5rem' }}>😕</div>
      <h2 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.3rem', color: '#2D2D2D', margin: 0 }}>
        Oups, une erreur est survenue
      </h2>
      <p style={{ color: '#2D2D2D', opacity: 0.6, fontSize: '0.95rem', margin: '0 0 1rem', maxWidth: '420px', lineHeight: 1.5 }}>
        Cette page n'a pas pu s'afficher correctement. Tu peux réessayer ou revenir en arrière.
      </p>
      <div style={{ display: 'flex', gap: '0.6rem' }}>
        <button
          onClick={() => reset()}
          style={{ backgroundColor: '#E8501A', color: 'white', border: 'none', borderRadius: '10px', padding: '0.6rem 1.25rem', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}
        >
          Réessayer
        </button>
        <button
          onClick={() => router.push('/feed')}
          style={{ background: 'none', border: '1px solid #E8E3D9', borderRadius: '10px', padding: '0.6rem 1.25rem', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', color: '#2D2D2D' }}
        >
          Retour au fil
        </button>
      </div>
    </div>
  )
}
