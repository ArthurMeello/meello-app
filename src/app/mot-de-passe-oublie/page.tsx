// @ts-nocheck
'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function MotDePasseOubliePage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await fetch('/api/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })

    if (!res.ok) {
      setError('Email introuvable. Vérifie ton adresse.')
      setLoading(false)
      return
    }

    setSent(true)
  }

  if (sent) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#F5F0E8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <div style={{ textAlign: 'center', maxWidth: '420px' }}>
          <img src="/logo-meello.webp" alt="Meello" style={{ height: '70px', width: 'auto', display: 'block', margin: '0 auto 1.5rem' }} />
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📬</div>
          <h2 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.5rem', color: '#2D2D2D', marginBottom: '0.75rem' }}>
            Email envoyé !
          </h2>
          <p style={{ color: '#2D2D2D', opacity: 0.7, lineHeight: 1.6 }}>
            Vérifie ta boîte mail — tu as reçu un lien pour réinitialiser ton mot de passe.
          </p>
          <Link href="/connexion" style={{ display: 'inline-block', marginTop: '1.5rem', color: '#E8501A', fontWeight: 600, textDecoration: 'none' }}>
            ← Retour à la connexion
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F5F0E8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img src="/logo-meello.webp" alt="Meello" style={{ height: '70px', width: 'auto', display: 'block', margin: '0 auto 1rem' }} />
          <h2 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.4rem', color: '#2D2D2D', marginBottom: '0.4rem' }}>
            Mot de passe oublié ?
          </h2>
          <p style={{ color: '#2D2D2D', opacity: 0.6, fontSize: '0.95rem' }}>
            On t'envoie un lien pour le réinitialiser.
          </p>
        </div>

        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '2rem', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500, color: '#2D2D2D', fontSize: '0.9rem' }}>
                Ton adresse email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="ton@email.com"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: '2px solid #E8E3D9',
                  borderRadius: '10px',
                  fontSize: '1rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {error && (
              <div style={{ backgroundColor: '#FFF0ED', border: '1px solid #E8501A', borderRadius: '8px', padding: '0.75rem', color: '#E8501A', fontSize: '0.9rem' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                backgroundColor: loading ? '#ccc' : '#E8501A',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                padding: '0.85rem',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Envoi...' : 'Envoyer le lien'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '1.25rem', color: '#2D2D2D', opacity: 0.6, fontSize: '0.9rem' }}>
            <Link href="/connexion" style={{ color: '#E8501A', fontWeight: 600, textDecoration: 'none' }}>
              ← Retour à la connexion
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
