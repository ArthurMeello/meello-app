// @ts-nocheck
'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function OnboardingPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    activity: '',
    bio: '',
    website: '',
    avatar_url: '',
  })
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/connexion'); return }
      setUserId(user.id)

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (prof) {
        setForm({
          first_name: prof.first_name || '',
          last_name: prof.last_name || '',
          activity: prof.activity || '',
          bio: prof.bio || '',
          website: prof.website || '',
          avatar_url: prof.avatar_url || '',
        })
        if (prof.avatar_url) setAvatarPreview(prof.avatar_url)
      }
    }
    load()
  }, [])

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    setUploading(true)

    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `avatars/${userId}.${ext}`

    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      setForm(p => ({ ...p, avatar_url: data.publicUrl }))
      setAvatarPreview(data.publicUrl)
    }
    setUploading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.first_name || !form.last_name || !form.activity) return
    setSaving(true)

    const supabase = createClient()
    await supabase.from('profiles').update({
      first_name: form.first_name,
      last_name: form.last_name,
      activity: form.activity,
      bio: form.bio || null,
      website: form.website || null,
      avatar_url: form.avatar_url || null,
    }).eq('id', userId)

    router.push('/feed')
  }

  const initials = `${form.first_name?.[0] || ''}${form.last_name?.[0] || ''}`.toUpperCase()

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F5F0E8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{ width: '100%', maxWidth: '520px' }}>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img src="/logo-meello.webp" alt="Meello" style={{ height: '70px', width: 'auto', display: 'block', margin: '0 auto 1rem' }} />
          <h2 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.6rem', color: '#2D2D2D', marginBottom: '0.4rem' }}>
            Crée ton profil
          </h2>
          <p style={{ color: '#2D2D2D', opacity: 0.6, fontSize: '0.95rem' }}>
            Présente-toi à la communauté en quelques secondes.
          </p>
        </div>

        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '2rem', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Photo de profil */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  width: '90px', height: '90px', borderRadius: '50%',
                  backgroundColor: '#E8501A', color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '1.6rem', cursor: 'pointer',
                  overflow: 'hidden', position: 'relative',
                  border: '3px solid #E8E3D9',
                }}
              >
                {avatarPreview
                  ? <img src={avatarPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : initials || '+'
                }
                {uploading && (
                  <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: 'white', fontSize: '0.7rem' }}>...</span>
                  </div>
                )}
              </div>
              <span style={{ fontSize: '0.82rem', color: '#E8501A', fontWeight: 600, cursor: 'pointer' }} onClick={() => fileRef.current?.click()}>
                Ajouter une photo <span style={{ color: '#2D2D2D', opacity: 0.4, fontWeight: 400 }}>(facultatif)</span>
              </span>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
            </div>

            {/* Nom / Prénom */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Prénom <span style={requiredStyle}>*</span></label>
                <input
                  value={form.first_name}
                  onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))}
                  required
                  placeholder="Camille"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Nom <span style={requiredStyle}>*</span></label>
                <input
                  value={form.last_name}
                  onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))}
                  required
                  placeholder="Dupont"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Activité */}
            <div>
              <label style={labelStyle}>Activité / métier <span style={requiredStyle}>*</span></label>
              <input
                value={form.activity}
                onChange={e => setForm(p => ({ ...p, activity: e.target.value }))}
                required
                placeholder="Photographe freelance, développeur web..."
                style={inputStyle}
              />
            </div>

            {/* Bio */}
            <div>
              <label style={labelStyle}>Description <span style={optionalStyle}>(facultatif)</span></label>
              <textarea
                value={form.bio}
                onChange={e => setForm(p => ({ ...p, bio: e.target.value }))}
                rows={3}
                placeholder="Parle de toi, de ce que tu fais, de ce qui te passionne..."
                style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }}
              />
            </div>

            {/* Site web */}
            <div>
              <label style={labelStyle}>Site web ou LinkedIn <span style={optionalStyle}>(facultatif)</span></label>
              <input
                value={form.website}
                onChange={e => setForm(p => ({ ...p, website: e.target.value }))}
                placeholder="https://..."
                style={inputStyle}
              />
            </div>

            <button
              type="submit"
              disabled={saving || !form.first_name || !form.last_name || !form.activity}
              style={{
                backgroundColor: saving || !form.first_name || !form.last_name || !form.activity ? '#ccc' : '#E8501A',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                padding: '0.85rem',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                marginTop: '0.5rem',
              }}
            >
              {saving ? 'Enregistrement...' : 'Accéder à la communauté →'}
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

const requiredStyle: React.CSSProperties = {
  color: '#E8501A',
}

const optionalStyle: React.CSSProperties = {
  fontWeight: 400,
  opacity: 0.5,
  fontSize: '0.85rem',
}
