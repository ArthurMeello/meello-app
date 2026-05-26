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
  { key: 'company_number', label: "Numéro d'entreprise", points: 5 },
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
  if (!profile.bio) return 'Rédige ta bio pour gagner 20% : c\'est ce que les membres lisent en premier.'
  if (!hasPortfolio) return 'Ajoute un projet à ton portfolio pour gagner 15% et montrer concrètement ce que tu fais.'
  if (!hasServices) return 'Présente tes services pour gagner 15% : c\'est ta vitrine commerciale dans l\'annuaire.'
  if (!profile.website) return 'Ajoute ton site web pour gagner 10% et renvoyer du trafic vers toi.'
  if (!profile.activity) return 'Précise ton activité pour gagner 10% : les membres cherchent des prestataires par métier.'
  if (!hasReco) return 'Demande une recommandation à un membre pour gagner 10% : rien ne vaut la preuve sociale.'
  if (!SOCIAL_KEYS.some(k => profile[k as keyof Profile])) return 'Ajoute au moins un réseau social pour gagner 5% et faciliter les prises de contact.'
  if (!profile.city) return 'Indique ta ville pour gagner 5% : les membres aiment collaborer en local.'
  if (!profile.avatar_url) return 'Ajoute une photo de profil pour gagner 5% : un visage inspire confiance.'
  if (!profile.company_number) return 'Renseigne ton numéro d\'entreprise pour gagner 5% et rassurer tes futurs clients.'
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
  const [portfolioModal, setPortfolioModal] = useState<{ open: boolean; editId: string | null }>({ open: false, editId: null })
  const [portfolioForm, setPortfolioForm] = useState({ title: '', description: '', link: '' })
  const [portfolioFile, setPortfolioFile] = useState<File | null>(null)
  const [portfolioPreview, setPortfolioPreview] = useState<string | null>(null)
  const [savingPortfolio, setSavingPortfolio] = useState(false)
  const [services, setServices] = useState<{ id: string; title: string; description: string | null; image_url: string | null; price: string | null; link: string | null; link_label: string | null }[]>([])
  const [serviceModal, setServiceModal] = useState<{ open: boolean; editId: string | null }>({ open: false, editId: null })
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
      x: form.x || null,
      youtube: form.youtube || null,
      whatsapp: form.whatsapp || null,
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

  const openPortfolioModal = (item?: { id: string; title: string; description: string | null; link: string | null }) => {
    if (item) {
      setPortfolioForm({ title: item.title, description: item.description || '', link: item.link || '' })
      setPortfolioFile(null)
      setPortfolioPreview(null)
      setPortfolioModal({ open: true, editId: item.id })
    } else {
      setPortfolioForm({ title: '', description: '', link: '' })
      setPortfolioFile(null)
      setPortfolioPreview(null)
      setPortfolioModal({ open: true, editId: null })
    }
  }

  const closePortfolioModal = () => {
    setPortfolioModal({ open: false, editId: null })
    setPortfolioForm({ title: '', description: '', link: '' })
    setPortfolioFile(null)
    setPortfolioPreview(null)
  }

  const openServiceModal = (item?: { id: string; title: string; description: string | null; price: string | null; link: string | null; link_label: string | null }) => {
    if (item) {
      setServiceForm({ title: item.title, description: item.description || '', price: item.price || '', link: item.link || '', link_label: item.link_label || 'En savoir plus' })
      setServiceFile(null)
      setServicePreview(null)
      setServiceModal({ open: true, editId: item.id })
    } else {
      setServiceForm({ title: '', description: '', price: '', link: '', link_label: 'En savoir plus' })
      setServiceFile(null)
      setServicePreview(null)
      setServiceModal({ open: true, editId: null })
    }
  }

  const closeServiceModal = () => {
    setServiceModal({ open: false, editId: null })
    setServiceForm({ title: '', description: '', price: '', link: '', link_label: 'En savoir plus' })
    setServiceFile(null)
    setServicePreview(null)
  }

  const handleSavePortfolio = async () => {
    if (!portfolioForm.title || !profile) return
    if (!portfolioModal.editId && !portfolioFile) return
    setSavingPortfolio(true)
    const supabase = createClient()

    if (portfolioModal.editId) {
      await supabase.from('portfolio_items').update({
        title: portfolioForm.title,
        description: portfolioForm.description || null,
        link: portfolioForm.link || null,
      }).eq('id', portfolioModal.editId)
    } else {
      const ext = portfolioFile!.name.split('.').pop()
      const path = `${profile.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('portfolio').upload(path, portfolioFile!, { upsert: true })
      if (uploadError) { setSavingPortfolio(false); return }
      const { data: urlData } = supabase.storage.from('portfolio').getPublicUrl(path)
      await supabase.from('portfolio_items').insert({
        profile_id: profile.id,
        title: portfolioForm.title,
        description: portfolioForm.description || null,
        media_url: urlData.publicUrl,
        link: portfolioForm.link || null,
      })
    }

    setSavingPortfolio(false)
    closePortfolioModal()
    await loadProfile()
  }

  const handleDeletePortfolio = async (id: string, mediaUrl: string) => {
    const supabase = createClient()
    const urlParts = mediaUrl.split('/portfolio/')
    if (urlParts[1]) await supabase.storage.from('portfolio').remove([urlParts[1]])
    await supabase.from('portfolio_items').delete().eq('id', id)
    await loadProfile()
  }

  const handleSaveService = async () => {
    if (!serviceForm.title || !profile) return
    setSavingService(true)
    const supabase = createClient()

    if (serviceModal.editId) {
      await supabase.from('service_items').update({
        title: serviceForm.title,
        description: serviceForm.description || null,
        price: serviceForm.price || null,
        link: serviceForm.link || null,
        link_label: serviceForm.link ? (serviceForm.link_label || 'En savoir plus') : null,
      }).eq('id', serviceModal.editId)
    } else {
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
    }

    setSavingService(false)
    closeServiceModal()
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
    const { error } = await supabase.storage.from('Avatar').upload(path, file, { upsert: true })
    if (error) {
      console.error('Upload error:', error.message)
      setUploadingAvatar(false)
      return
    }
    const { data } = supabase.storage.from('Avatar').getPublicUrl(path)
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
  const completionTip = completion < 100 ? getCompletionTip(profile, hasReco, portfolio.length > 0, services.length > 0) : null

  // Badge "nouveau" dynamique : affiché pendant 30 jours après l'inscription
  const isNew = profile.member_since && !profile.hide_new_badge
    ? (Date.now() - new Date(profile.member_since).getTime()) < 30 * 24 * 60 * 60 * 1000
    : false
  const badges = (profile.badges || []).filter((b: string) => b !== 'nouveau' && b !== 'profil_complet')
  const allBadges = isNew ? ['nouveau', ...badges] : badges

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto' }}>
      <style>{`
        .social-icon img { filter: brightness(0); transition: filter 0.15s; }
        .social-icon:hover img { filter: brightness(0) saturate(100%) invert(35%) sepia(90%) saturate(700%) hue-rotate(350deg); }
      `}</style>
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
            {profile.city && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.1rem' }}>
                <img src="/icons/pin.svg" alt="" style={{ width: '13px', height: '13px', filter: 'brightness(0) saturate(100%) invert(35%) sepia(90%) saturate(700%) hue-rotate(350deg)', flexShrink: 0 }} />
                <span style={{ color: '#E8501A', fontSize: '0.82rem', fontWeight: 500 }}>{profile.city}</span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <a
              href={`/membre/${profile.id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                backgroundColor: '#1A1A2E',
                color: 'white',
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
              Voir
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
        {allBadges.length > 0 && (
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            {allBadges.map((b: string) => (
              <span key={b} style={{
                backgroundColor: b === 'nouveau' ? '#F5A623' : b === 'membre_fondateur' ? '#6B4FA0' : '#E8501A',
                color: 'white',
                fontSize: '0.72rem', fontWeight: 600,
                padding: '0.2rem 0.6rem', borderRadius: '20px',
              }}>
                {b === 'fondateur' ? 'Fondateur' : b === 'partenaire' ? 'Partenaire' : b === 'membre_fondateur' ? 'Membre fondateur' : 'Nouveau membre'}
              </span>
            ))}
          </div>
        )}

        {/* Completion */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.85rem', color: '#2D2D2D', opacity: 0.6 }}>
              {completion === 100 ? 'Badge Profil complet' : 'Complétion du profil'}
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
              <label style={labelStyle}>Numéro d'entreprise (SIRET, BCE...)</label>
              <input value={form.company_number || ''} onChange={e => setForm(p => ({ ...p, company_number: e.target.value }))} style={inputStyle} />
            </div>

            {/* Réseaux sociaux */}
            <div style={{ borderTop: '1px solid #F5F0E8', paddingTop: '1rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#2D2D2D', opacity: 0.5, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Réseaux sociaux
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <img src="/icons/linkedin.svg" alt="LinkedIn" style={{ width: '22px', height: '22px', flexShrink: 0 }} />
                  <input value={form.linkedin || ''} onChange={e => setForm(p => ({ ...p, linkedin: e.target.value }))} placeholder="https://linkedin.com/in/..." style={{ ...inputStyle, flex: 1 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <img src="/icons/instagram.svg" alt="Instagram" style={{ width: '22px', height: '22px', flexShrink: 0 }} />
                  <input value={form.instagram || ''} onChange={e => setForm(p => ({ ...p, instagram: e.target.value }))} placeholder="https://instagram.com/..." style={{ ...inputStyle, flex: 1 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <img src="/icons/facebook.svg" alt="Facebook" style={{ width: '22px', height: '22px', flexShrink: 0 }} />
                  <input value={form.facebook || ''} onChange={e => setForm(p => ({ ...p, facebook: e.target.value }))} placeholder="https://facebook.com/..." style={{ ...inputStyle, flex: 1 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <img src="/icons/pinterest.svg" alt="Pinterest" style={{ width: '22px', height: '22px', flexShrink: 0 }} />
                  <input value={form.pinterest || ''} onChange={e => setForm(p => ({ ...p, pinterest: e.target.value }))} placeholder="https://pinterest.com/..." style={{ ...inputStyle, flex: 1 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <img src="/icons/tiktok.svg" alt="TikTok" style={{ width: '22px', height: '22px', flexShrink: 0 }} />
                  <input value={form.tiktok || ''} onChange={e => setForm(p => ({ ...p, tiktok: e.target.value }))} placeholder="https://tiktok.com/@..." style={{ ...inputStyle, flex: 1 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <img src="/icons/x.svg" alt="X" style={{ width: '22px', height: '22px', flexShrink: 0 }} />
                  <input value={form.x || ''} onChange={e => setForm(p => ({ ...p, x: e.target.value }))} placeholder="https://x.com/..." style={{ ...inputStyle, flex: 1 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <img src="/icons/youtube.svg" alt="YouTube" style={{ width: '22px', height: '22px', flexShrink: 0 }} />
                  <input value={form.youtube || ''} onChange={e => setForm(p => ({ ...p, youtube: e.target.value }))} placeholder="https://youtube.com/@..." style={{ ...inputStyle, flex: 1 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <img src="/icons/whatsapp.svg" alt="WhatsApp" style={{ width: '22px', height: '22px', flexShrink: 0 }} />
                  <input value={form.whatsapp || ''} onChange={e => setForm(p => ({ ...p, whatsapp: e.target.value }))} placeholder="Numéro WhatsApp (ex: +33612345678)" style={{ ...inputStyle, flex: 1 }} />
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
              {profile.website && <a href={profile.website} target="_blank" rel="noopener noreferrer" title="Site web" className="social-icon" style={socialLinkStyle}><img src="/icons/website.svg" alt="Site web" style={{ width: '20px', height: '20px' }} /></a>}
              {profile.linkedin && <a href={profile.linkedin} target="_blank" rel="noopener noreferrer" title="LinkedIn" className="social-icon" style={socialLinkStyle}><img src="/icons/linkedin.svg" alt="LinkedIn" style={{ width: '20px', height: '20px' }} /></a>}
              {profile.instagram && <a href={profile.instagram} target="_blank" rel="noopener noreferrer" title="Instagram" className="social-icon" style={socialLinkStyle}><img src="/icons/instagram.svg" alt="Instagram" style={{ width: '20px', height: '20px' }} /></a>}
              {profile.facebook && <a href={profile.facebook} target="_blank" rel="noopener noreferrer" title="Facebook" className="social-icon" style={socialLinkStyle}><img src="/icons/facebook.svg" alt="Facebook" style={{ width: '20px', height: '20px' }} /></a>}
              {profile.pinterest && <a href={profile.pinterest} target="_blank" rel="noopener noreferrer" title="Pinterest" className="social-icon" style={socialLinkStyle}><img src="/icons/pinterest.svg" alt="Pinterest" style={{ width: '20px', height: '20px' }} /></a>}
              {profile.tiktok && <a href={profile.tiktok} target="_blank" rel="noopener noreferrer" title="TikTok" className="social-icon" style={socialLinkStyle}><img src="/icons/tiktok.svg" alt="TikTok" style={{ width: '20px', height: '20px' }} /></a>}
              {profile.x && <a href={profile.x} target="_blank" rel="noopener noreferrer" title="X" className="social-icon" style={socialLinkStyle}><img src="/icons/x.svg" alt="X" style={{ width: '20px', height: '20px' }} /></a>}
              {profile.youtube && <a href={profile.youtube} target="_blank" rel="noopener noreferrer" title="YouTube" className="social-icon" style={socialLinkStyle}><img src="/icons/youtube.svg" alt="YouTube" style={{ width: '20px', height: '20px' }} /></a>}
              {profile.whatsapp && <a href={`https://wa.me/${profile.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" title="WhatsApp" className="social-icon" style={socialLinkStyle}><img src="/icons/whatsapp.svg" alt="WhatsApp" style={{ width: '20px', height: '20px' }} /></a>}
            </div>
          </div>
        )}
      </div>

      {/* Portfolio */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h2 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.2rem', color: '#2D2D2D', margin: 0 }}>Portfolio</h2>
          <button onClick={() => openPortfolioModal()} style={{ backgroundColor: '#E8501A', color: 'white', border: 'none', borderRadius: '10px', padding: '0.45rem 1rem', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>
            + Ajouter un projet
          </button>
        </div>
        {portfolio.length === 0 && (
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
                  {item.link ? <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.78rem', color: '#E8501A', fontWeight: 600, textDecoration: 'none' }}>Voir le projet →</a> : <span />}
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button onClick={() => openPortfolioModal(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', opacity: 0.5 }} title="Modifier">
                      <img src="/icons/pen-edit.svg" alt="Modifier" style={{ width: '15px', height: '15px' }} />
                    </button>
                    <button onClick={() => handleDeletePortfolio(item.id, item.media_url)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', opacity: 0.35 }} title="Supprimer">
                      <img src="/icons/trash.svg" alt="Supprimer" style={{ width: '15px', height: '15px' }} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Produits & Services */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h2 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.2rem', color: '#2D2D2D', margin: 0 }}>Produits & Services</h2>
          <button onClick={() => openServiceModal()} style={{ backgroundColor: '#E8501A', color: 'white', border: 'none', borderRadius: '10px', padding: '0.45rem 1rem', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>
            + Ajouter
          </button>
        </div>
        {services.length === 0 && (
          <p style={{ color: '#2D2D2D', opacity: 0.4, fontSize: '0.9rem', textAlign: 'center', margin: '1rem 0' }}>
            Aucun produit ou service pour l'instant.
          </p>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
          {services.map(item => (
            <div key={item.id} style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #E8E3D9', backgroundColor: '#FAFAFA', display: 'flex', flexDirection: 'column' }}>
              {item.image_url && <img src={item.image_url} alt={item.title} style={{ width: '100%', height: '140px', objectFit: 'cover', display: 'block' }} />}
              <div style={{ padding: '0.75rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#2D2D2D' }}>{item.title}</div>
                {item.price && <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#E8501A' }}>{item.price}</div>}
                {item.description && <p style={{ fontSize: '0.8rem', color: '#2D2D2D', opacity: 0.6, margin: 0, lineHeight: 1.5 }}>{item.description}</p>}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '0.5rem' }}>
                  {item.link
                    ? <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.78rem', color: 'white', backgroundColor: '#E8501A', fontWeight: 600, textDecoration: 'none', padding: '0.3rem 0.7rem', borderRadius: '6px' }}>{item.link_label || 'En savoir plus'}</a>
                    : <span />
                  }
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button onClick={() => openServiceModal(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', opacity: 0.5 }} title="Modifier">
                      <img src="/icons/pen-edit.svg" alt="Modifier" style={{ width: '15px', height: '15px' }} />
                    </button>
                    <button onClick={() => handleDeleteService(item.id, item.image_url)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', opacity: 0.35 }} title="Supprimer">
                      <img src="/icons/trash.svg" alt="Supprimer" style={{ width: '15px', height: '15px' }} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modale Portfolio */}
      {portfolioModal.open && (
        <div onClick={closePortfolioModal} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: 'white', borderRadius: '20px', padding: '2rem', width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.2rem', color: '#2D2D2D', margin: 0 }}>
                {portfolioModal.editId ? 'Modifier le projet' : 'Ajouter un projet'}
              </h3>
              <button onClick={closePortfolioModal} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#2D2D2D', opacity: 0.4, lineHeight: 1 }}>×</button>
            </div>
            {!portfolioModal.editId && (
              <div onClick={() => portfolioFileRef.current?.click()} style={{ border: '2px dashed #E8E3D9', borderRadius: '12px', height: portfolioPreview ? 'auto' : '130px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', backgroundColor: '#FAFAFA' }}>
                {portfolioPreview ? (
                  portfolioFile?.type.startsWith('video/')
                    ? <video src={portfolioPreview} controls style={{ width: '100%', maxHeight: '220px', objectFit: 'cover' }} />
                    : <img src={portfolioPreview} alt="" style={{ width: '100%', maxHeight: '220px', objectFit: 'cover' }} />
                ) : (
                  <span style={{ color: '#2D2D2D', opacity: 0.4, fontSize: '0.9rem' }}>Cliquer pour ajouter une image ou vidéo</span>
                )}
              </div>
            )}
            <input ref={portfolioFileRef} type="file" accept="image/*,video/*" onChange={handlePortfolioFileChange} style={{ display: 'none' }} />
            <input value={portfolioForm.title} onChange={e => setPortfolioForm(p => ({ ...p, title: e.target.value }))} placeholder="Titre du projet *" style={inputStyle} />
            <textarea value={portfolioForm.description} onChange={e => setPortfolioForm(p => ({ ...p, description: e.target.value }))} placeholder="Description (facultatif)" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
            <input value={portfolioForm.link} onChange={e => setPortfolioForm(p => ({ ...p, link: e.target.value }))} placeholder="Lien externe (facultatif)" style={inputStyle} />
            <button
              onClick={handleSavePortfolio}
              disabled={savingPortfolio || !portfolioForm.title || (!portfolioModal.editId && !portfolioFile)}
              style={{ backgroundColor: savingPortfolio || !portfolioForm.title || (!portfolioModal.editId && !portfolioFile) ? '#ccc' : '#E8501A', color: 'white', border: 'none', borderRadius: '12px', padding: '0.85rem', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}
            >
              {savingPortfolio ? 'Enregistrement...' : portfolioModal.editId ? 'Enregistrer les modifications' : 'Ajouter au portfolio'}
            </button>
          </div>
        </div>
      )}

      {/* Modale Services */}
      {serviceModal.open && (
        <div onClick={closeServiceModal} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: 'white', borderRadius: '20px', padding: '2rem', width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.2rem', color: '#2D2D2D', margin: 0 }}>
                {serviceModal.editId ? 'Modifier le service' : 'Ajouter un produit / service'}
              </h3>
              <button onClick={closeServiceModal} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#2D2D2D', opacity: 0.4, lineHeight: 1 }}>×</button>
            </div>
            {!serviceModal.editId && (
              <div onClick={() => serviceFileRef.current?.click()} style={{ border: '2px dashed #E8E3D9', borderRadius: '12px', height: servicePreview ? 'auto' : '110px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', backgroundColor: '#FAFAFA' }}>
                {servicePreview
                  ? <img src={servicePreview} alt="" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover' }} />
                  : <span style={{ color: '#2D2D2D', opacity: 0.4, fontSize: '0.9rem' }}>Image du produit/service (facultatif)</span>
                }
              </div>
            )}
            <input ref={serviceFileRef} type="file" accept="image/*" onChange={handleServiceFileChange} style={{ display: 'none' }} />
            <input value={serviceForm.title} onChange={e => setServiceForm(p => ({ ...p, title: e.target.value }))} placeholder="Titre du produit / service *" style={inputStyle} />
            <textarea value={serviceForm.description} onChange={e => setServiceForm(p => ({ ...p, description: e.target.value }))} placeholder="Description (facultatif)" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
            <input value={serviceForm.price} onChange={e => setServiceForm(p => ({ ...p, price: e.target.value }))} placeholder="Prix (ex: 150€, À partir de 500€, Sur devis...)" style={inputStyle} />
            <input value={serviceForm.link} onChange={e => setServiceForm(p => ({ ...p, link: e.target.value }))} placeholder="Lien (facultatif)" style={inputStyle} />
            {serviceForm.link && (
              <input value={serviceForm.link_label} onChange={e => setServiceForm(p => ({ ...p, link_label: e.target.value }))} placeholder="Texte du bouton (ex: En savoir plus, Commander...)" style={inputStyle} />
            )}
            <button
              onClick={handleSaveService}
              disabled={savingService || !serviceForm.title}
              style={{ backgroundColor: savingService || !serviceForm.title ? '#ccc' : '#E8501A', color: 'white', border: 'none', borderRadius: '12px', padding: '0.85rem', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}
            >
              {savingService ? 'Enregistrement...' : serviceModal.editId ? 'Enregistrer les modifications' : 'Ajouter'}
            </button>
          </div>
        </div>
      )}

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
  width: '28px',
  height: '28px',
  textDecoration: 'none',
  opacity: 1,
}
