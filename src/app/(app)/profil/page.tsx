// @ts-nocheck
'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'

const COMPLETION_FIELDS = [
  { key: 'avatar_url', label: 'Photo de profil', points: 5 },
  { key: 'bio', label: 'Bio complète', points: 20 },
  { key: 'activity', label: 'Secteur d activite', points: 10 },
  { key: 'city', label: 'Ville', points: 5 },
  { key: 'website', label: 'Site web', points: 10 },
  { key: 'company_number', label: 'Numéro d entreprise', points: 5 },
]

const SOCIAL_KEYS = ['linkedin', 'instagram', 'facebook', 'pinterest', 'tiktok']

function getCompletion(profile: Profile, hasReco: boolean, hasPortfolio: boolean, hasServices: boolean) {
  let total = 0
  for (const f of COMPLETION_FIELDS) {
    if (profile[f.key as keyof Profile]) total += f.points
  }
  if (SOCIAL_KEYS.some(k => profile[k as keyof Profile])) total += 5
  if (hasReco) total += 10
  if (hasPortfolio) total += 15
  if (hasServices) total += 15
  return Math.min(total, 100)
}

function getCompletionTip(profile: Profile, hasReco: boolean, hasPortfolio: boolean, hasServices: boolean): string | null {
  if (!profile.bio) return '✍️ Rédige ta bio pour booster ton profil de 20 points — c\'est ce que les membres lisent en premier.'
  if (!hasPortfolio) return '🖼 Ajoute un projet à ton portfolio pour gagner 15 points et montrer concrètement ce que tu fais.'
  if (!hasServices) return '💼 Présente tes services pour gagner 15 points — c\'est ton vitrine commerciale dans l\'annuaire.'
  if (!profile.website) return '🔗 Ajoute ton site web ou LinkedIn pour gagner 10 points et renvoyer du trafic vers toi.'
  if (!profile.activity) return '🏷 Précise ton activité pour gagner 10 points — les membres cherchent des prestataires par métier.'
  if (!hasReco) return '⭐️ Demande une recommandation à un membre pour gagner 10 points — rien ne vaut la preuve sociale.'
  if (!SOCIAL_KEYS.some(k => profile[k as keyof Profile])) return '📲 Ajoute au moins un réseau social pour gagner 5 points et faciliter les prises de contact.'
  if (!profile.city) return '📍 Indique ta ville pour gagner 5 points — les membres aiment collaborer en local.'
  if (!profile.avatar_url) return '📸 Ajoute une photo de profil pour gagner 5 points — un visage inspire confiance.'
  if (!profile.company_number) return '🏢 Renseigne ton numéro d\'entreprise pour gagner 5 points et rassurer tes futurs clients.'
  return null
}

export default function ProfilPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<Profile>>({})
  const [saving, setSaving] = useState(false)
  const [hasReco, setHasReco] = useState(false)
  const [recos, setRecos] = useState<{ id: string; content: string; author: { first_name: string; last_name: string } }[]>([])
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [portfolio, setPortfolio] = useState<{ id: string; title: string; description: string | null; media_url: string; link: string | null }[]>([])
  const [showPortfolioForm, setShowPortfolioForm] = useState(false)
  const [portfolioForm, setPortfolioForm] = useState({ title: '', description: '', link: '' })
  const [portfolioFile, setPortfolioFile] = useState<File | null>(null)
  const [portfolioPreview, setPortfolioPreview] = useState<string | null>(null)
  const [savingPortfolio, setSavingPortfolio] = useState(false)
  const [services, setServices] = useState<{ id: string; title: string; description: string | null; image_url: string | null; price: string | null; link: string | null; link_label: string | null }[]>([])
  const [showServiceForm, setShowServiceForm] = useState(false)
  const [serviceForm, setServiceForm] = useState({ title: '', description: '', price: '', link: '', link_label: 'En savoir plus' })
  const [serviceFile, setServiceFile] = useState<File | null>(null)
  const [servicePreview, setServicePreview] = useState<string | null>(null)
  const [savingService, setSavingService] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const portfolioFileRef = useRef<HTMLInputElement>(null)
  const serviceFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()

    // Créer le profil s'il n'existe pas
    if (!prof) {
      await supabase.from('profiles').insert({
        id: user.id,
        email: user.email,
        first_name: user.user_metadata?.first_name || '',
        last_name: user.user_metadata?.last_name || '',
        badges: [],
        is_active: true,
      })
      const { data: newProf } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      prof = newProf
    }

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

    const { data: portfolioData } = await supabase
      .from('portfolio_items')
      .select('id, title, description, media_url, link')
      .eq('profile_id', user.id)
      .order('created_at', { ascending: false })
    if (portfolioData) setPortfolio(portfolioData)

    const { data: servicesData } = await supabase
      .from('service_items')
      .select('id, title, description, image_url, price, link, link_label')
      .eq('profile_id', user.id)
      .order('created_at', { ascending: false })
    if (servicesData) setServices(servicesData)
  }

  const handleSave = async () => {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('profiles').update({
      first_name: form.first_name,
      last_name: form.last_name,
      bio: form.bio,
      activity: form.activity,
      city: form.city,
      country: form.country,
      website: form.website,
      company_number: form.company_number,
      instagram: form.instagram || null,
      linkedin: form.linkedin || null,
      facebook: form.facebook || null,
      pinterest: form.pinterest || null,
      tiktok: form.tiktok || null,
    }).eq('id', user.id)

    await loadProfile()
    setEditing(false)
    setSaving(false)
  }

  const handlePortfolioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPortfolioFile(file)
    setPortfolioPreview(URL.createObjectURL(file))
  }

  const handleAddPortfolio = async () => {
    if (!portfolioForm.title || !portfolioFile || !profile) return
    setSavingPortfolio(true)
    const supabase = createClient()
    const ext = portfolioFile.name.split('.').pop()
    const path = `${profile.id}/${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage.from('portfolio').upload(path, portfolioFile, { upsert: true })
    if (uploadError) {
      console.error('Portfolio upload error:', uploadError.message)
      setSavingPortfolio(false)
      return
    }
    const { data: urlData } = supabase.storage.from('portfolio').getPublicUrl(path)
    await supabase.from('portfolio_items').insert({
      profile_id: profile.id,
      title: portfolioForm.title,
      description: portfolioForm.description || null,
      media_url: urlData.publicUrl,
      link: portfolioForm.link || null,
    })
    setPortfolioForm({ title: '', description: '', link: '' })
    setPortfolioFile(null)
    setPortfolioPreview(null)
    setShowPortfolioForm(false)
    setSavingPortfolio(false)
    await loadProfile()
  }

  const handleDeletePortfolio = async (id: string, mediaUrl: string) => {
    const supabase = createClient()
    // Extraire le path depuis l'URL publique
    const urlParts = mediaUrl.split('/portfolio/')
    if (urlParts[1]) {
      await supabase.storage.from('portfolio').remove([urlParts[1]])
    }
    await supabase.from('portfolio_items').delete().eq('id', id)
    await loadProfile()
  }

  const handleServiceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setServiceFile(file)
    setServicePreview(URL.createObjectURL(file))
  }

  const handleAddService = async () => {
    if (!serviceForm.title || !profile) return
    setSavingService(true)
    const supabase = createClient()
    let image_url = null

    if (serviceFile) {
      const ext = serviceFile.name.split('.').pop()
      const path = `${profile.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('services').upload(path, serviceFile, { upsert: true })
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('services').getPublicUrl(path)
        image_url = urlData.publicUrl
      }
    }

    await supabase.from('service_items').insert({
      profile_id: profile.id,
      title: serviceForm.title,
      description: serviceForm.description || null,
      image_url,
      price: serviceForm.price || null,
      link: serviceForm.link || null,
      link_label: serviceForm.link ? (serviceForm.link_label || 'En savoir plus') : null,
    })

    setServiceForm({ title: '', description: '', price: '', link: '', link_label: 'En savoir plus' })
    setServiceFile(null)
    setServicePreview(null)
    setShowServiceForm(false)
    setSavingService(false)
    await loadProfile()
  }

  const handleDeleteService = async (id: string, imageUrl: string | null) => {
    const supabase = createClient()
    if (imageUrl) {
      const urlParts = imageUrl.split('/services/')
      if (urlParts[1]) await supabase.storage.from('services').remove([urlParts[1]])
    }
    await supabase.from('service_items').delete().eq('id', id)
    await loadProfile()
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile) return
    setUploadingAvatar(true)
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `${profile.id}.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (error) {
      console.error('Upload error:', error.message)
      setUploadingAvatar(false)
      return
    }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', profile.id)
    await loadProfile()
    setUploadingAvatar(false)
  }

  if (!profile) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: '#2D2D2D', opacity: 0.4 }}>
        Chargement...
      </div>
    )
  }

  const completion = getCompletion(profile, hasReco, portfolio.length > 0, services.length > 0)
  const completionMsg = getCompletionMessage(completion)
  const completionTip = completion < 100 ? getCompletionTip(profile, hasReco, portfolio.length > 0, services.length > 0) : null
  const badges = profile.badges || []

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '2rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.5rem' }}>
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              width: '72px', height: '72px', borderRadius: '50%',
              backgroundColor: '#E8501A', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: '1.4rem', flexShrink: 0, overflow: 'hidden',
              cursor: 'pointer', position: 'relative',
            }}
            title="Changer la photo"
          >
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : `${(profile.first_name || '?')[0]}${(profile.last_name || '')[0] || ''}`.toUpperCase()}
            {uploadingAvatar && (
              <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>...</div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-clash)', fontSize: '1.4rem', color: '#2D2D2D', fontWeight: 700 }}>
              {profile.first_name} {profile.last_name}
            </div>
            <div style={{ color: '#2D2D2D', opacity: 0.6, fontSize: '0.9rem' }}>{profile.activity}</div>
            {profile.city && <div style={{ color: '#2D2D2D', opacity: 0.45, fontSize: '0.82rem' }}>📍 {profile.city}</div>}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <a
              href={`/membre/${profile.id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                backgroundColor: '#F5F0E8',
                color: '#2D2D2D',
                border: 'none',
                borderRadius: '10px',
                padding: '0.5rem 1rem',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
              title="Voir mon profil public"
            >
              👁 Voir
            </a>
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
          {completionTip && (
            <div style={{
              marginTop: '0.75rem',
              backgroundColor: '#FFF8F6',
              border: '1px solid rgba(232,80,26,0.15)',
              borderRadius: '10px',
              padding: '0.65rem 0.9rem',
              fontSize: '0.83rem',
              color: '#2D2D2D',
              lineHeight: 1.5,
            }}>
              {completionTip}
            </div>
          )}
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
                <label style={labelStyle}>Prénom</label>
                <input value={form.first_name || ''} onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Nom</label>
                <input value={form.last_name || ''} onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Métier / activité</label>
                <input value={form.activity || ''} onChange={e => setForm(p => ({ ...p, activity: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Ville</label>
                <input value={form.city || ''} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Site web</label>
              <input value={form.website || ''} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} placeholder="https://monsite.fr" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Numéro d entreprise (SIRET, BCE...)</label>
              <input value={form.company_number || ''} onChange={e => setForm(p => ({ ...p, company_number: e.target.value }))} style={inputStyle} />
            </div>

            {/* Réseaux sociaux */}
            <div style={{ borderTop: '1px solid #F5F0E8', paddingTop: '1rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#2D2D2D', opacity: 0.5, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Réseaux sociaux
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.1rem', width: '24px' }}>💼</span>
                  <input value={form.linkedin || ''} onChange={e => setForm(p => ({ ...p, linkedin: e.target.value }))} placeholder="https://linkedin.com/in/..." style={{ ...inputStyle, flex: 1 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.1rem', width: '24px' }}>📸</span>
                  <input value={form.instagram || ''} onChange={e => setForm(p => ({ ...p, instagram: e.target.value }))} placeholder="https://instagram.com/..." style={{ ...inputStyle, flex: 1 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.1rem', width: '24px' }}>👍</span>
                  <input value={form.facebook || ''} onChange={e => setForm(p => ({ ...p, facebook: e.target.value }))} placeholder="https://facebook.com/..." style={{ ...inputStyle, flex: 1 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.1rem', width: '24px' }}>📌</span>
                  <input value={form.pinterest || ''} onChange={e => setForm(p => ({ ...p, pinterest: e.target.value }))} placeholder="https://pinterest.com/..." style={{ ...inputStyle, flex: 1 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.1rem', width: '24px' }}>🎵</span>
                  <input value={form.tiktok || ''} onChange={e => setForm(p => ({ ...p, tiktok: e.target.value }))} placeholder="https://tiktok.com/@..." style={{ ...inputStyle, flex: 1 }} />
                </div>
              </div>
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
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
              {profile.website && <a href={profile.website} target="_blank" rel="noopener noreferrer" title="Site web" style={socialLinkStyle}>🔗</a>}
              {profile.linkedin && <a href={profile.linkedin} target="_blank" rel="noopener noreferrer" title="LinkedIn" style={socialLinkStyle}>💼</a>}
              {profile.instagram && <a href={profile.instagram} target="_blank" rel="noopener noreferrer" title="Instagram" style={socialLinkStyle}>📸</a>}
              {profile.facebook && <a href={profile.facebook} target="_blank" rel="noopener noreferrer" title="Facebook" style={socialLinkStyle}>👍</a>}
              {profile.pinterest && <a href={profile.pinterest} target="_blank" rel="noopener noreferrer" title="Pinterest" style={socialLinkStyle}>📌</a>}
              {profile.tiktok && <a href={profile.tiktok} target="_blank" rel="noopener noreferrer" title="TikTok" style={socialLinkStyle}>🎵</a>}
            </div>
          </div>
        )}
      </div>

      {/* Portfolio */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h2 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.2rem', color: '#2D2D2D', margin: 0 }}>
            Portfolio
          </h2>
          <button
            onClick={() => { setShowPortfolioForm(!showPortfolioForm); setPortfolioPreview(null); setPortfolioForm({ title: '', description: '', link: '' }) }}
            style={{
              backgroundColor: showPortfolioForm ? '#2D2D2D' : '#E8501A',
              color: 'white', border: 'none', borderRadius: '10px',
              padding: '0.45rem 1rem', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
            }}
          >
            {showPortfolioForm ? 'Annuler' : '+ Ajouter un projet'}
          </button>
        </div>

        {/* Formulaire ajout */}
        {showPortfolioForm && (
          <div style={{ backgroundColor: '#F5F0E8', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {/* Upload média */}
            <div
              onClick={() => portfolioFileRef.current?.click()}
              style={{
                border: '2px dashed #E8E3D9', borderRadius: '10px',
                height: portfolioPreview ? 'auto' : '120px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', overflow: 'hidden', backgroundColor: 'white',
              }}
            >
              {portfolioPreview ? (
                portfolioFile?.type.startsWith('video/')
                  ? <video src={portfolioPreview} controls style={{ width: '100%', maxHeight: '200px', objectFit: 'cover' }} />
                  : <img src={portfolioPreview} alt="" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover' }} />
              ) : (
                <span style={{ color: '#2D2D2D', opacity: 0.4, fontSize: '0.9rem' }}>📁 Cliquer pour ajouter une image ou vidéo</span>
              )}
            </div>
            <input ref={portfolioFileRef} type="file" accept="image/*,video/*" onChange={handlePortfolioFileChange} style={{ display: 'none' }} />

            <input
              value={portfolioForm.title}
              onChange={e => setPortfolioForm(p => ({ ...p, title: e.target.value }))}
              placeholder="Titre du projet *"
              style={inputStyle}
            />
            <textarea
              value={portfolioForm.description}
              onChange={e => setPortfolioForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Description (facultatif)"
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
            <input
              value={portfolioForm.link}
              onChange={e => setPortfolioForm(p => ({ ...p, link: e.target.value }))}
              placeholder="Lien externe (facultatif)"
              style={inputStyle}
            />
            <button
              onClick={handleAddPortfolio}
              disabled={savingPortfolio || !portfolioForm.title || !portfolioFile}
              style={{
                backgroundColor: savingPortfolio || !portfolioForm.title || !portfolioFile ? '#ccc' : '#E8501A',
                color: 'white', border: 'none', borderRadius: '10px',
                padding: '0.7rem', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer',
              }}
            >
              {savingPortfolio ? 'Enregistrement...' : 'Ajouter au portfolio'}
            </button>
          </div>
        )}

        {/* Cartes portfolio */}
        {portfolio.length === 0 && !showPortfolioForm && (
          <p style={{ color: '#2D2D2D', opacity: 0.4, fontSize: '0.9rem', textAlign: 'center', margin: '1rem 0' }}>
            Aucun projet pour l'instant — ajoutes-en un !
          </p>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
          {portfolio.map(item => (
            <div key={item.id} style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #E8E3D9', backgroundColor: '#FAFAFA', position: 'relative' }}>
              {item.media_url.match(/\.(mp4|mov|webm)$/i)
                ? <video src={item.media_url} controls style={{ width: '100%', height: '140px', objectFit: 'cover', display: 'block' }} />
                : <img src={item.media_url} alt={item.title} style={{ width: '100%', height: '140px', objectFit: 'cover', display: 'block' }} />
              }
              <div style={{ padding: '0.75rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#2D2D2D', marginBottom: '0.25rem' }}>{item.title}</div>
                {item.description && <p style={{ fontSize: '0.8rem', color: '#2D2D2D', opacity: 0.6, margin: '0 0 0.5rem', lineHeight: 1.5 }}>{item.description}</p>}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {item.link
                    ? <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.78rem', color: '#E8501A', fontWeight: 600, textDecoration: 'none' }}>Voir le projet →</a>
                    : <span />
                  }
                  <button
                    onClick={() => handleDeletePortfolio(item.id, item.media_url)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: '#2D2D2D', opacity: 0.3 }}
                    title="Supprimer"
                  >
                    🗑
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Produits & Services */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h2 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.2rem', color: '#2D2D2D', margin: 0 }}>
            Produits & Services
          </h2>
          <button
            onClick={() => { setShowServiceForm(!showServiceForm); setServicePreview(null); setServiceForm({ title: '', description: '', price: '', link: '', link_label: 'En savoir plus' }) }}
            style={{
              backgroundColor: showServiceForm ? '#2D2D2D' : '#E8501A',
              color: 'white', border: 'none', borderRadius: '10px',
              padding: '0.45rem 1rem', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
            }}
          >
            {showServiceForm ? 'Annuler' : '+ Ajouter'}
          </button>
        </div>

        {/* Formulaire ajout */}
        {showServiceForm && (
          <div style={{ backgroundColor: '#F5F0E8', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {/* Image facultative */}
            <div
              onClick={() => serviceFileRef.current?.click()}
              style={{
                border: '2px dashed #E8E3D9', borderRadius: '10px',
                height: servicePreview ? 'auto' : '100px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', overflow: 'hidden', backgroundColor: 'white',
              }}
            >
              {servicePreview
                ? <img src={servicePreview} alt="" style={{ width: '100%', maxHeight: '180px', objectFit: 'cover' }} />
                : <span style={{ color: '#2D2D2D', opacity: 0.4, fontSize: '0.9rem' }}>🖼 Image du produit/service (facultatif)</span>
              }
            </div>
            <input ref={serviceFileRef} type="file" accept="image/*" onChange={handleServiceFileChange} style={{ display: 'none' }} />

            <input
              value={serviceForm.title}
              onChange={e => setServiceForm(p => ({ ...p, title: e.target.value }))}
              placeholder="Titre du produit / service *"
              style={inputStyle}
            />
            <textarea
              value={serviceForm.description}
              onChange={e => setServiceForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Description (facultatif)"
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
            <input
              value={serviceForm.price}
              onChange={e => setServiceForm(p => ({ ...p, price: e.target.value }))}
              placeholder="Prix (ex: 150€, À partir de 500€, Sur devis...)"
              style={inputStyle}
            />
            <input
              value={serviceForm.link}
              onChange={e => setServiceForm(p => ({ ...p, link: e.target.value }))}
              placeholder="Lien (facultatif)"
              style={inputStyle}
            />
            {serviceForm.link && (
              <input
                value={serviceForm.link_label}
                onChange={e => setServiceForm(p => ({ ...p, link_label: e.target.value }))}
                placeholder="Texte du bouton (ex: En savoir plus, Commander, Réserver...)"
                style={inputStyle}
              />
            )}
            <button
              onClick={handleAddService}
              disabled={savingService || !serviceForm.title}
              style={{
                backgroundColor: savingService || !serviceForm.title ? '#ccc' : '#E8501A',
                color: 'white', border: 'none', borderRadius: '10px',
                padding: '0.7rem', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer',
              }}
            >
              {savingService ? 'Enregistrement...' : 'Ajouter'}
            </button>
          </div>
        )}

        {/* Cartes services */}
        {services.length === 0 && !showServiceForm && (
          <p style={{ color: '#2D2D2D', opacity: 0.4, fontSize: '0.9rem', textAlign: 'center', margin: '1rem 0' }}>
            Aucun produit ou service pour l'instant.
          </p>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
          {services.map(item => (
            <div key={item.id} style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #E8E3D9', backgroundColor: '#FAFAFA', display: 'flex', flexDirection: 'column' }}>
              {item.image_url && (
                <img src={item.image_url} alt={item.title} style={{ width: '100%', height: '140px', objectFit: 'cover', display: 'block' }} />
              )}
              <div style={{ padding: '0.75rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#2D2D2D' }}>{item.title}</div>
                {item.price && (
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#E8501A' }}>{item.price}</div>
                )}
                {item.description && (
                  <p style={{ fontSize: '0.8rem', color: '#2D2D2D', opacity: 0.6, margin: 0, lineHeight: 1.5 }}>{item.description}</p>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '0.5rem' }}>
                  {item.link
                    ? <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.78rem', color: 'white', backgroundColor: '#E8501A', fontWeight: 600, textDecoration: 'none', padding: '0.3rem 0.7rem', borderRadius: '6px' }}>
                        {item.link_label || 'En savoir plus'}
                      </a>
                    : <span />
                  }
                  <button
                    onClick={() => handleDeleteService(item.id, item.image_url)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: '#2D2D2D', opacity: 0.3 }}
                    title="Supprimer"
                  >
                    🗑
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
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

const socialLinkStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '36px',
  height: '36px',
  borderRadius: '10px',
  backgroundColor: '#F5F0E8',
  fontSize: '1.1rem',
  textDecoration: 'none',
  transition: 'background 0.15s',
}
