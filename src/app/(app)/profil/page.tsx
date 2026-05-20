'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'

const COMPLETION_FIELDS = [
  { key: 'avatar_url', label: 'Photo de profil', points: 15 },
  { key: 'bio', label: 'Bio complète', points: 15 },
  { key: 'activity', label: 'Secteur d activite', points: 10 },
  { key: 'city', label: 'Ville', points: 10 },
  { key: 'website', label: 'Site web ou LinkedIn', points: 15 },
  { key: 'company_number', label: 'Numéro d entreprise', points: 20 },
]

function getCompletion(profile: Profile, hasReco: boolean) {
  let total = 0
  for (const f of COMPLETION_FIELDS) {
    if (profile[f.key as keyof Profile]) total += f.points
  }
  if (hasReco) total += 15
  return Math.min(total, 100)
}

function getCompletionMessage(pct: number) {
  if (pct <= 40) return 'Ton profil est en cours de creation'
  if (pct <= 70) return 'Tu y es presque, complete ton profil'
  if (pct <= 99) return 'Plus qu un effort pour etre au top'
  return null
}

export default function ProfilPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<Profile>>({})
  const [saving, setSaving] = useState(false)
  const [hasReco, setHasReco] = useState(false)
  const [recos, setRecos] = useState<{ id: string; content: string; author: { first_name: string; last_name: string } }[]>([])

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (prof) {
      setProfile(prof)
      setForm(prof)
    }

    const { count } = await supabase.from('recommendations').select('*', { count: 'exact', head: true }).eq('recommended_id', user.id)
    setHasReco((count || 0) > 0)

    const { data: recoData } = await supabase
      .from('recommendations')
      .select('id, content, profiles!recommendations_author_id_fkey(first_name, last_name)')
      .eq('recommended_id', user.id)
      .order('created_at', { ascending: false })
    if (recoData) setRecos(recoData as typeof recos)
  }

  const handleSave = async () => {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('profiles').update({
      bio: form.bio,
      activity: form.activity,
      city: form.city,
      country: form.country,
      website: form.website,
      company_number: form.company_number,
    }).eq('id', user.id)

    await loadProfile()
    setEditing(false)
    setSaving(false)
  }

  if (!profile) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: '#2D2D2D', opacity: 0.4 }}>
        Chargement...
      </div>
    )
  }

  const completion = getCompletion(profile, hasReco)
  const completionMsg = getCompletionMessage(completion)
  const badges = profile.badges || []

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '2rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.5rem' }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '50%',
            backgroundColor: '#E8501A', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: '1.4rem', flexShrink: 0, overflow: 'hidden',
          }}>
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : `${(profile.first_name || '?')[0]}${(profile.last_name || '')[0] || ''}`.toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-clash)', fontSize: '1.4rem', color: '#2D2D2D', fontWeight: 700 }}>
              {profile.first_name} {profile.last_name}
            </div>
            <div style={{ color: '#2D2D2D', opacity: 0.6, fontSize: '0.9rem' }}>{profile.activity}</div>
            {profile.city && <div style={{ color: '#2D2D2D', opacity: 0.45, fontSize: '0.82rem' }}>📍 {profile.city}</div>}
          </div>
          <button
            onClick={() => setEditing(!editing)}
            style={{
              backgroundColor: editing ? '#2D2D2D' : '#F5F0E8',
              color: editing ? 'white' : '#2D2D2D',
              border: 'none',
              borderRadius: '10px',
              padding: '0.5rem 1rem',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            {editing ? 'Annuler' : 'Modifier'}
          </button>
        </div>

        {/* Badges */}
        {badges.length > 0 && (
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            {badges.map((b: string) => (
              <span key={b} style={{
                backgroundColor: '#E8501A', color: 'white',
                fontSize: '0.72rem', fontWeight: 600,
                padding: '0.2rem 0.6rem', borderRadius: '20px',
              }}>
                {b === 'fondateur' ? 'Fondateur' : b === 'partenaire' ? 'Partenaire' : b === 'nouveau' ? 'Nouveau' : 'Profil complet'}
              </span>
            ))}
          </div>
        )}

        {/* Completion */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.85rem', color: '#2D2D2D', opacity: 0.6 }}>
              {completionMsg || 'Badge Profil complet'}
            </span>
            <span style={{ fontWeight: 700, color: '#E8501A', fontSize: '0.9rem' }}>{completion}%</span>
          </div>
          <div style={{ height: '8px', backgroundColor: '#F5F0E8', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${completion}%`,
              backgroundColor: completion === 100 ? '#7A9E7E' : '#E8501A',
              borderRadius: '4px',
              transition: 'width 0.6s ease',
            }} />
          </div>
        </div>

        {/* Form edition */}
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Bio</label>
              <textarea
                value={form.bio || ''}
                onChange={e => setForm(p => ({ ...p, bio: e.target.value }))}
                rows={3}
                placeholder="Decris-toi en quelques mots..."
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Metier / activite</label>
                <input value={form.activity || ''} onChange={e => setForm(p => ({ ...p, activity: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Ville</label>
                <input value={form.city || ''} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Site web ou LinkedIn</label>
              <input value={form.website || ''} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} placeholder="https://" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Numéro d entreprise (SIRET, BCE...)</label>
              <input value={form.company_number || ''} onChange={e => setForm(p => ({ ...p, company_number: e.target.value }))} style={inputStyle} />
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                backgroundColor: '#E8501A',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                padding: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.95rem',
              }}
            >
              {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {profile.bio && <p style={{ color: '#2D2D2D', lineHeight: 1.65, margin: 0 }}>{profile.bio}</p>}
            {profile.website && (
              <a href={profile.website} target="_blank" rel="noopener noreferrer" style={{ color: '#E8501A', fontSize: '0.9rem' }}>
                🔗 {profile.website}
              </a>
            )}
          </div>
        )}
      </div>

      {/* Recommandations */}
      {recos.length > 0 && (
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.2rem', color: '#2D2D2D', marginBottom: '1rem' }}>
            Recommandations ({recos.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {recos.map(r => (
              <div key={r.id} style={{ borderLeft: '3px solid #E8501A', paddingLeft: '1rem' }}>
                <p style={{ margin: '0 0 0.35rem', color: '#2D2D2D', lineHeight: 1.6, fontSize: '0.95rem' }}>
                  {r.content}
                </p>
                <span style={{ fontSize: '0.8rem', color: '#2D2D2D', opacity: 0.5, fontWeight: 600 }}>
                  {r.author?.first_name} {r.author?.last_name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '0.35rem',
  fontWeight: 500,
  color: '#2D2D2D',
  fontSize: '0.88rem',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.7rem 0.9rem',
  border: '2px solid #E8E3D9',
  borderRadius: '10px',
  fontSize: '0.95rem',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}
