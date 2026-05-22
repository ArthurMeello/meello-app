// @ts-nocheck
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const COUNTRIES = [
  { code: 'FR', label: 'France', field: 'SIRET' },
  { code: 'BE', label: 'Belgique', field: 'Numéro BCE' },
  { code: 'CH', label: 'Suisse', field: 'Numéro IDE' },
  { code: 'CA', label: 'Canada / Québec', field: "Numéro d'entreprise du Québec" },
  { code: 'OTHER', label: 'Autre pays', field: 'Lien LinkedIn ou site web professionnel' },
]

export default function CandidaturePage() {
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    activity: '',
    city: '',
    country: 'FR',
    why_join: '',
    company_number: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedCountry = COUNTRIES.find(c => c.code === form.country) || COUNTRIES[0]

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.from('applications').insert({
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email,
      activity: form.activity,
      city: form.city,
      country: form.country,
      why_join: form.why_join,
      company_number: form.company_number || null,
      status: 'pending',
    })

    if (error) {
      setError("Une erreur est survenue. Vérifie que tu n'as pas déjà candidaté.")
      setLoading(false)
      return
    }

    // Envoyer email de notification à admin@meello.fr
    await fetch('/api/candidature', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#F5F0E8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <div style={{ textAlign: 'center', maxWidth: '480px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
          <h2 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.8rem', color: '#2D2D2D', marginBottom: '1rem' }}>
            Candidature envoyee !
          </h2>
          <p style={{ color: '#2D2D2D', opacity: 0.7, lineHeight: 1.6 }}>
            On revient vers toi sous 48h. En attendant, tu peux retourner sur la page principale.
          </p>
          <Link href="/" style={{ display: 'inline-block', marginTop: '1.5rem', color: '#E8501A', fontWeight: 600 }}>
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F5F0E8', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', justifyContent: 'center' }}>
            <img src="/logo-meello.webp" alt="Meello" style={{ height: '80px', width: 'auto', display: 'block', margin: '0 auto 0.75rem' }} />
          </Link>
          <p style={{ color: '#2D2D2D', fontWeight: 600, fontSize: '1.1rem' }}>
            Dis-nous qui tu es en 2 minutes
          </p>
          <p style={{ color: '#2D2D2D', opacity: 0.6, fontSize: '0.95rem', marginTop: '0.25rem' }}>
            On revient vers toi sous 48h.
          </p>
        </div>

        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '2rem', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Prenom</label>
                <input name="first_name" value={form.first_name} onChange={handleChange} required placeholder="Camille" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Nom</label>
                <input name="last_name" value={form.last_name} onChange={handleChange} required placeholder="Dupont" style={inputStyle} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" name="email" value={form.email} onChange={handleChange} required placeholder="camille@monsite.fr" style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Ton activite / metier</label>
              <input name="activity" value={form.activity} onChange={handleChange} required placeholder="Photographe freelance, developpeur web..." style={inputStyle} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Ville</label>
                <input name="city" value={form.city} onChange={handleChange} required placeholder="Lyon" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Pays</label>
                <select name="country" value={form.country} onChange={handleChange} style={{ ...inputStyle, cursor: 'pointer' }}>
                  {COUNTRIES.map(c => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label style={labelStyle}>
                {selectedCountry.field}{' '}
                <span style={{ fontWeight: 400, opacity: 0.5 }}>(optionnel)</span>
              </label>
              <input
                name="company_number"
                value={form.company_number}
                onChange={handleChange}
                placeholder={selectedCountry.code === 'OTHER' ? 'https://linkedin.com/in/...' : ''}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Pourquoi veux-tu rejoindre Meello ?</label>
              <textarea
                name="why_join"
                value={form.why_join}
                onChange={handleChange}
                required
                rows={4}
                placeholder="Parle-nous de toi, de ce que tu cherches, de ce que tu pourrais apporter..."
                style={{ ...inputStyle, resize: 'vertical', minHeight: '100px' }}
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
                transition: 'opacity 0.2s',
              }}
            >
              {loading ? 'Envoi en cours...' : 'Envoyer ma candidature'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '1.25rem', color: '#2D2D2D', opacity: 0.6, fontSize: '0.9rem' }}>
            Deja membre ?{' '}
            <Link href="/connexion" style={{ color: '#E8501A', fontWeight: 600, textDecoration: 'none' }}>
              Se connecter
            </Link>
          </p>
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
