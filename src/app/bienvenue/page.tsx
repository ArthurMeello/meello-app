// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function BienvenuePage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    const searchParams = new URLSearchParams(window.location.search)
    const token_hash = searchParams.get('token_hash')
    const type = searchParams.get('type')
    const code = searchParams.get('code')

    // Cas 1 : token_hash (lien email invite/recovery)
    if (token_hash && type) {
      supabase.auth.verifyOtp({ token_hash, type: type as any }).then(({ error }) => {
        if (!error) setReady(true)
        else setError('Lien invalide ou expiré. Contacte-nous pour recevoir un nouveau lien.')
      })
      return
    }

    // Cas 2 : PKCE code
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (!error) setReady(true)
        else setError('Lien invalide ou expiré. Contacte-nous pour recevoir un nouveau lien.')
      })
      return
    }

    // Cas 3 : ancien format hash (fallback)
    const hash = window.location.hash
    if (hash) {
      const params = new URLSearchParams(hash.substring(1))
      const access_token = params.get('access_token')
      const refresh_token = params.get('refresh_token')
      if (access_token && refresh_token) {
        supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
          if (!error) setReady(true)
          else setError('Lien invalide ou expiré. Contacte-nous pour recevoir un nouveau lien.')
        })
        return
      }
    }

    setError('Lien invalide. Utilise le lien reçu par email.')
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    if (password.length < 8) {
      setError('Le mot de passe doit faire au moins 8 caractères.')
      return
    }
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError('Erreur : ' + error.message)
      setLoading(false)
      return
    }

    router.push('/onboarding')
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F5F0E8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ maxWidth: '440px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img src="/logo-meello.webp" alt="Meello" style={{ height: '70px', width: 'auto', display: 'block', margin: '0 auto 1rem' }} />
          <h2 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.6rem', color: '#2D2D2D', marginBottom: '0.5rem' }}>
            Bienvenue dans Meello !
          </h2>
          <p style={{ color: '#2D2D2D', opacity: 0.6, fontSize: '0.95rem' }}>
            Choisis ton mot de passe pour accéder à ton espace.
          </p>
        </div>

        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '2rem', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={labelStyle}>Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="8 caractères minimum"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Confirme ton mot de passe</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                placeholder="Répète ton mot de passe"
                style={inputStyle}
              />
            </div>

            {error && (
              <div style={{ backgroundColor: '#FFF0ED', border: '1px solid #E8501A', borderRadius: '8px', padding: '0.75rem', color: '#E8501A', fontSize: '0.9rem' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !ready}
              style={{
                backgroundColor: (loading || !ready) ? '#ccc' : '#E8501A',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                padding: '0.85rem',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {!ready ? 'Chargement...' : loading ? 'Enregistrement...' : 'Accéder à Meello →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '0.4rem',
  fontWeight: 500,
  color: '#2D2D2D',
  fontSize: '0.9rem',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.75rem 1rem',
  border: '2px solid #E8E3D9',
  borderRadius: '10px',
  fontSize: '1rem',
  outline: 'none',
  boxSizing: 'border-box',
  backgroundColor: 'white',
  fontFamily: 'inherit',
}
