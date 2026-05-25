// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const socialLinkStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '28px',
  height: '28px',
  textDecoration: 'none',
}

export default function MembrePublicPage() {
  const { id } = useParams()
  const [profile, setProfile] = useState(null)
  const [portfolio, setPortfolio] = useState([])
  const [services, setServices] = useState([])
  const [recos, setRecos] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'none' | 'pending_sent' | 'pending_received' | 'accepted'>('none')
  const [connectionId, setConnectionId] = useState<string | null>(null)
  const [recoModal, setRecoModal] = useState(false)
  const [recoText, setRecoText] = useState('')
  const [recoLoading, setRecoLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()
      if (user) setCurrentUserId(user.id)

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single()
      if (prof) setProfile(prof)

      const { data: portfolioData } = await supabase
        .from('portfolio_items')
        .select('id, title, description, media_url, link')
        .eq('profile_id', id)
        .order('created_at', { ascending: false })
      if (portfolioData) setPortfolio(portfolioData)

      const { data: servicesData } = await supabase
        .from('service_items')
        .select('id, title, description, image_url, price, link, link_label')
        .eq('profile_id', id)
        .order('created_at', { ascending: false })
      if (servicesData) setServices(servicesData)

      const { data: recoData } = await supabase
        .from('recommendations')
        .select('id, content, profiles!recommendations_author_id_fkey(first_name, last_name)')
        .eq('recommended_id', id)
        .order('created_at', { ascending: false })
      if (recoData) setRecos(recoData)

      // Vérifier la connexion
      if (user && user.id !== id) {
        const { data: conn } = await supabase
          .from('connections')
          .select('id, status, requester_id')
          .or(`and(requester_id.eq.${user.id},receiver_id.eq.${id}),and(requester_id.eq.${id},receiver_id.eq.${user.id})`)
          .single()
        if (conn) {
          setConnectionId(conn.id)
          if (conn.status === 'accepted') setConnectionStatus('accepted')
          else if (conn.requester_id === user.id) setConnectionStatus('pending_sent')
          else setConnectionStatus('pending_received')
        }
      }

      setLoading(false)
    }
    load()
  }, [id])

  const sendConnectionRequest = async () => {
    const supabase = createClient()
    const { data } = await supabase.from('connections').insert({
      requester_id: currentUserId,
      receiver_id: id,
      status: 'pending',
    }).select('id').single()
    if (data) { setConnectionId(data.id); setConnectionStatus('pending_sent') }
  }

  const acceptConnection = async () => {
    const supabase = createClient()
    await supabase.from('connections').update({ status: 'accepted' }).eq('id', connectionId)
    // Créer la conversation
    const { data: existing } = await supabase.from('conversations').select('id')
      .or(`and(participant1_id.eq.${currentUserId},participant2_id.eq.${id}),and(participant1_id.eq.${id},participant2_id.eq.${currentUserId})`)
      .single()
    if (!existing) await supabase.from('conversations').insert({ participant1_id: currentUserId, participant2_id: id })
    setConnectionStatus('accepted')
  }

  const openMessage = async () => {
    const supabase = createClient()
    const { data } = await supabase.from('conversations').select('id')
      .or(`and(participant1_id.eq.${currentUserId},participant2_id.eq.${id}),and(participant1_id.eq.${id},participant2_id.eq.${currentUserId})`)
      .single()
    if (data) router.push(`/messages?conv=${data.id}`)
    else router.push('/messages')
  }

  const sendReco = async () => {
    if (!recoText.trim()) return
    setRecoLoading(true)
    const supabase = createClient()
    await supabase.from('recommendations').insert({ recommended_id: id, author_id: currentUserId, content: recoText.trim() })
    await supabase.from('notifications').insert({
      user_id: id, type: 'recommendation', content: `t'a laissé une recommandation`,
      link: `/membre/${id}`, from_user_id: currentUserId,
    })
    // Recharger les recos
    const { data: recoData } = await supabase.from('recommendations')
      .select('id, content, profiles!recommendations_author_id_fkey(first_name, last_name)')
      .eq('recommended_id', id).order('created_at', { ascending: false })
    if (recoData) setRecos(recoData)
    setRecoText(''); setRecoModal(false); setRecoLoading(false)
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '3rem', color: '#2D2D2D', opacity: 0.4 }}>Chargement...</div>
  )

  if (!profile) return (
    <div style={{ textAlign: 'center', padding: '3rem', color: '#2D2D2D', opacity: 0.4 }}>Membre introuvable.</div>
  )

  const initials = `${(profile.first_name || '?')[0]}${(profile.last_name || '')[0] || ''}`.toUpperCase()
  const SOCIAL_LINKS = [
    { key: 'website', icon: null, label: 'Site web', svg: '/icons/website.svg' },
    { key: 'linkedin', icon: null, label: 'LinkedIn', svg: '/icons/linkedin.svg' },
    { key: 'instagram', icon: null, label: 'Instagram', svg: '/icons/instagram.svg' },
    { key: 'facebook', icon: null, label: 'Facebook', svg: '/icons/facebook.svg' },
    { key: 'pinterest', icon: null, label: 'Pinterest', svg: '/icons/pinterest.svg' },
    { key: 'tiktok', icon: null, label: 'TikTok', svg: '/icons/tiktok.svg' },
    { key: 'x', icon: null, label: 'X', svg: '/icons/x.svg' },
    { key: 'youtube', icon: null, label: 'YouTube', svg: '/icons/youtube.svg' },
    { key: 'whatsapp', icon: null, label: 'WhatsApp', svg: '/icons/whatsapp.svg' },
  ]

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto' }}>
      <style>{`
        .social-icon img { filter: brightness(0); transition: filter 0.15s; }
        .social-icon:hover img { filter: brightness(0) saturate(100%) invert(35%) sepia(90%) saturate(700%) hue-rotate(350deg); }
      `}</style>

      {/* Carte profil */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '2rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.25rem' }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '50%',
            backgroundColor: '#E8501A', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: '1.4rem', flexShrink: 0, overflow: 'hidden',
          }}>
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initials}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-clash)', fontSize: '1.4rem', color: '#2D2D2D', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              {profile.first_name} {profile.last_name}
              {id === '13cdb485-42e0-48df-b2f8-14dc77dd895a' && (
                <img src="/icons/badge-check.svg" alt="Admin" title="Fondateur Meello" style={{ width: '20px', height: '20px', flexShrink: 0 }} />
              )}
            </div>
            <div style={{ color: '#2D2D2D', opacity: 0.6, fontSize: '0.9rem' }}>{profile.activity}</div>
            {profile.city && <div style={{ color: '#2D2D2D', opacity: 0.45, fontSize: '0.82rem' }}>📍 {profile.city}</div>}
          </div>
        </div>

        {/* Actions connexion/message — masquées sur son propre profil */}
        {currentUserId && currentUserId !== id && (
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            {connectionStatus === 'none' && (
              <button onClick={sendConnectionRequest} style={{ backgroundColor: '#E8501A', color: 'white', border: 'none', borderRadius: '8px', padding: '0.5rem 1.1rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem' }}>
                + Se connecter
              </button>
            )}
            {connectionStatus === 'pending_sent' && (
              <span style={{ fontSize: '0.85rem', color: '#2D2D2D', opacity: 0.5, padding: '0.5rem 0' }}>Demande envoyée…</span>
            )}
            {connectionStatus === 'pending_received' && (
              <button onClick={acceptConnection} style={{ backgroundColor: '#E8501A', color: 'white', border: 'none', borderRadius: '8px', padding: '0.5rem 1.1rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem' }}>
                Accepter la demande
              </button>
            )}
            {connectionStatus === 'accepted' && (
              <>
                <button onClick={openMessage} style={{ background: 'none', border: '1.5px solid #E8E3D9', borderRadius: '8px', padding: '0.5rem 1rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem', color: '#2D2D2D' }}>
                  ✉️ Message
                </button>
                <button onClick={() => setRecoModal(true)} style={{ background: 'none', border: '1.5px solid #E8501A', borderRadius: '8px', padding: '0.5rem 1rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem', color: '#E8501A' }}>
                  ⭐️ Recommander
                </button>
              </>
            )}
          </div>
        )}

        {/* Badges */}
        {(() => {
          const isNew = profile.member_since && !profile.hide_new_badge
            ? (Date.now() - new Date(profile.member_since).getTime()) < 30 * 24 * 60 * 60 * 1000
            : false
          const badges = (profile.badges || []).filter((b: string) => b !== 'nouveau' && b !== 'profil_complet')
          const allBadges = isNew ? ['nouveau', ...badges] : badges
          return allBadges.length > 0 && (
            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              {allBadges.map((b: string) => (
                <span key={b} style={{
                  backgroundColor: b === 'nouveau' ? '#F5A623' : b === 'membre_fondateur' ? '#6B4FA0' : '#E8501A',
                  color: 'white', fontSize: '0.72rem', fontWeight: 600,
                  padding: '0.2rem 0.6rem', borderRadius: '20px',
                }}>
                  {b === 'fondateur' ? 'Fondateur' : b === 'partenaire' ? 'Partenaire' : b === 'membre_fondateur' ? 'Membre fondateur' : 'Nouveau membre'}
                </span>
              ))}
            </div>
          )
        })()}

        {profile.bio && <p style={{ color: '#2D2D2D', lineHeight: 1.65, margin: '0 0 1rem' }}>{profile.bio}</p>}

        {/* Réseaux sociaux */}
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {SOCIAL_LINKS.map(s => profile[s.key] && (
            <a
              key={s.key}
              href={s.key === 'whatsapp' ? `https://wa.me/${profile[s.key].replace(/\D/g, '')}` : profile[s.key]}
              target="_blank"
              rel="noopener noreferrer"
              title={s.label}
              className="social-icon"
              style={socialLinkStyle}
            >
              {s.svg
                ? <img src={s.svg} alt={s.label} style={{ width: '20px', height: '20px' }} />
                : s.icon}
            </a>
          ))}
        </div>
      </div>

      {/* Portfolio */}
      {portfolio.length > 0 && (
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}>
          <h2 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.2rem', color: '#2D2D2D', marginBottom: '1rem' }}>Portfolio</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
            {portfolio.map(item => (
              <div key={item.id} style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #E8E3D9', backgroundColor: '#FAFAFA' }}>
                {item.media_url.match(/\.(mp4|mov|webm)$/i)
                  ? <video src={item.media_url} controls style={{ width: '100%', height: '140px', objectFit: 'cover', display: 'block' }} />
                  : <img src={item.media_url} alt={item.title} style={{ width: '100%', height: '140px', objectFit: 'cover', display: 'block' }} />
                }
                <div style={{ padding: '0.75rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#2D2D2D', marginBottom: '0.25rem' }}>{item.title}</div>
                  {item.description && <p style={{ fontSize: '0.8rem', color: '#2D2D2D', opacity: 0.6, margin: '0 0 0.5rem', lineHeight: 1.5 }}>{item.description}</p>}
                  {item.link && (
                    <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.78rem', color: '#E8501A', fontWeight: 600, textDecoration: 'none' }}>
                      Voir le projet →
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Produits & Services */}
      {services.length > 0 && (
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}>
          <h2 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.2rem', color: '#2D2D2D', marginBottom: '1rem' }}>Produits & Services</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
            {services.map(item => (
              <div key={item.id} style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #E8E3D9', backgroundColor: '#FAFAFA', display: 'flex', flexDirection: 'column' }}>
                {item.image_url && (
                  <img src={item.image_url} alt={item.title} style={{ width: '100%', height: '140px', objectFit: 'cover', display: 'block' }} />
                )}
                <div style={{ padding: '0.75rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#2D2D2D' }}>{item.title}</div>
                  {item.price && <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#E8501A' }}>{item.price}</div>}
                  {item.description && <p style={{ fontSize: '0.8rem', color: '#2D2D2D', opacity: 0.6, margin: 0, lineHeight: 1.5 }}>{item.description}</p>}
                  {item.link && (
                    <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ marginTop: 'auto', paddingTop: '0.5rem', display: 'inline-block', fontSize: '0.78rem', color: 'white', backgroundColor: '#E8501A', fontWeight: 600, textDecoration: 'none', padding: '0.3rem 0.7rem', borderRadius: '6px' }}>
                      {item.link_label || 'En savoir plus'}
                    </a>
                  )}
                </div>
              </div>
            ))}
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
                <p style={{ margin: '0 0 0.35rem', color: '#2D2D2D', lineHeight: 1.6, fontSize: '0.95rem' }}>{r.content}</p>
                <span style={{ fontSize: '0.8rem', color: '#2D2D2D', opacity: 0.5, fontWeight: 600 }}>
                  {r.profiles?.first_name} {r.profiles?.last_name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal recommandation */}
      {recoModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={() => setRecoModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '480px' }}>
            <h3 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.1rem', color: '#2D2D2D', marginBottom: '0.5rem' }}>
              Recommander {profile?.first_name}
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#2D2D2D', opacity: 0.5, marginBottom: '1rem' }}>
              Ta recommandation apparaîtra sur son profil.
            </p>
            <textarea
              value={recoText}
              onChange={e => setRecoText(e.target.value)}
              placeholder={`Décris ton expérience avec ${profile?.first_name}…`}
              rows={4}
              style={{ width: '100%', border: '1.5px solid #E8E3D9', borderRadius: '10px', padding: '0.75rem', fontSize: '0.95rem', fontFamily: 'inherit', outline: 'none', resize: 'none', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setRecoModal(false)} style={{ background: 'none', border: '1px solid #E8E3D9', borderRadius: '8px', padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.9rem' }}>Annuler</button>
              <button onClick={sendReco} disabled={!recoText.trim() || recoLoading} style={{ backgroundColor: '#E8501A', color: 'white', border: 'none', borderRadius: '8px', padding: '0.5rem 1.25rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}>
                {recoLoading ? '...' : 'Envoyer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
