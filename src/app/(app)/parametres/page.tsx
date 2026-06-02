// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ParametresPage() {
  const router = useRouter()
  const [email, setEmail] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setEmail(user.email || '')
      setLoading(false)
    }
    load()
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/connexion')
  }

  const sectionStyle: React.CSSProperties = {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '1.5rem',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    marginBottom: '1.5rem',
  }

  const titleStyle: React.CSSProperties = {
    fontFamily: 'var(--font-clash)',
    fontSize: '1.1rem',
    color: '#2D2D2D',
    fontWeight: 700,
    marginBottom: '1rem',
  }

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.6rem', color: '#2D2D2D', fontWeight: 700, marginBottom: '1.5rem' }}>
        Paramètres
      </h1>

      {/* Compte */}
      <div style={sectionStyle}>
        <h2 style={titleStyle}>Compte</h2>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#2D2D2D', opacity: 0.45 }}>Adresse e-mail</div>
            <div style={{ fontSize: '0.95rem', color: '#2D2D2D', fontWeight: 500 }}>{loading ? '…' : email}</div>
          </div>
          <a href="/profil" style={{ backgroundColor: '#F5F0E8', color: '#2D2D2D', borderRadius: '10px', padding: '0.5rem 1rem', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none' }}>
            Modifier mon profil
          </a>
        </div>
      </div>

      {/* Notifications */}
      <div style={sectionStyle}>
        <h2 style={titleStyle}>Notifications</h2>
        <p style={{ fontSize: '0.88rem', color: '#2D2D2D', opacity: 0.55, margin: 0, lineHeight: 1.6 }}>
          Les préférences de notification seront bientôt disponibles ici.
        </p>
      </div>

      {/* Déconnexion */}
      <div style={sectionStyle}>
        <h2 style={titleStyle}>Session</h2>
        <button
          onClick={handleLogout}
          style={{ backgroundColor: '#1A1A2E', color: 'white', border: 'none', borderRadius: '10px', padding: '0.6rem 1.25rem', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <img src="/icons/logout.svg" alt="" style={{ width: '18px', height: '18px', filter: 'brightness(0) invert(1)' }} />
          Se déconnecter
        </button>
      </div>
    </div>
  )
}
