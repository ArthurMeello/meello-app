// @ts-nocheck
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { notify } from '@/lib/notify'
import { GHOST_ID } from '@/lib/ghost'

// ─── XP / Niveaux ─────────────────────────────────────────────────────────────
function getLevelFromXP(totalXP: number): { level: number; currentXP: number; xpToNext: number } {
  let level = 1
  let accumulated = 0
  while (level < 50) {
    const xpForNext = Math.floor(50 * Math.pow(1.18, level - 1))
    if (accumulated + xpForNext > totalXP) {
      return { level, currentXP: totalXP - accumulated, xpToNext: xpForNext }
    }
    accumulated += xpForNext
    level++
  }
  return { level: 50, currentXP: 0, xpToNext: 0 }
}
function getLevelColor(level: number): string {
  if (level >= 50) return '#E8501A'
  if (level >= 40) return '#FF9800'
  if (level >= 30) return '#9C27B0'
  if (level >= 20) return '#2196F3'
  if (level >= 10) return '#4CAF50'
  return '#9E9E9E'
}

const socialLinkStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '28px',
  height: '28px',
  textDecoration: 'none',
}

function MiniPostCard({ post, isLast }: { post: any; isLast?: boolean }) {
  const reactionGroups: Record<string, number> = {}
  for (const r of (post.reactions || [])) {
    if (r.emoji) reactionGroups[r.emoji] = (reactionGroups[r.emoji] || 0) + 1
  }
  const reactionEntries = Object.entries(reactionGroups)
  const isForumTopic = post.source === 'forum'

  const formatDate = (d: string) => {
    const date = new Date(d)
    const now = new Date()
    const diff = (now.getTime() - date.getTime()) / 1000
    if (diff < 60) return 'à l\'instant'
    if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`
    if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`
    if (diff < 7 * 86400) return `il y a ${Math.floor(diff / 86400)} j`
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  const inner = (
    <div style={{ borderBottom: isLast ? 'none' : '1px solid #F5F0E8', paddingBottom: isLast ? 0 : '1rem', marginBottom: isLast ? 0 : '1rem' }}>
      {/* Badge forum */}
      {isForumTopic && (
        <div style={{ marginBottom: '0.4rem' }}>
          <span style={{ backgroundColor: '#F5F0E8', color: '#E8501A', borderRadius: '20px', padding: '0.15rem 0.55rem', fontSize: '0.72rem', fontWeight: 600 }}>
            La Communauté {post.category_name ? `· ${post.category_name}` : ''}
          </span>
        </div>
      )}
      {/* Titre pour forum */}
      {isForumTopic && post.title && (
        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#2D2D2D', marginBottom: '0.25rem' }}>{post.title}</div>
      )}
      {post.image_url && (
        <img src={post.image_url} alt="" style={{ width: '100%', maxHeight: '160px', objectFit: 'cover', borderRadius: '10px', marginBottom: '0.6rem', display: 'block' }} />
      )}
      <p style={{ fontSize: '0.88rem', color: '#2D2D2D', lineHeight: 1.6, margin: '0 0 0.5rem', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {(post.content || '').replace(/<[^>]*>/g, '').replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1')}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.72rem', color: '#2D2D2D', opacity: 0.4 }}>{formatDate(post.created_at)}</span>
        {reactionEntries.length > 0 && (
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {reactionEntries.map(([emoji, count]) => (
              <span key={emoji} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem', backgroundColor: '#F5F0E8', borderRadius: '20px', padding: '0.15rem 0.5rem', fontSize: '0.8rem' }}>
                {emoji} <span style={{ fontSize: '0.75rem', color: '#2D2D2D', opacity: 0.7, fontWeight: 600 }}>{count}</span>
              </span>
            ))}
          </div>
        )}
        {(post.commentCount || 0) > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', color: '#2D2D2D', opacity: 0.5 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            {post.commentCount}
          </span>
        )}
      </div>
    </div>
  )

  // Si c'est un topic forum, on wrappe dans un lien
  if (isForumTopic) {
    return (
      <a href={`/forum/${post.category_id}/${post.id}`} style={{ textDecoration: 'none', display: 'block' }}>
        {inner}
      </a>
    )
  }
  return inner
}

export default function MembrePublicPage() {
  const { id } = useParams()
  const router = useRouter()
  const [profile, setProfile] = useState(null)
  const [portfolio, setPortfolio] = useState([])
  const [services, setServices] = useState([])
  const [recos, setRecos] = useState([])
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'none' | 'pending_sent' | 'pending_received' | 'accepted'>('none')
  const [connectionId, setConnectionId] = useState<string | null>(null)
  const [removeModal, setRemoveModal] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [recoModal, setRecoModal] = useState(false)
  const [recoText, setRecoText] = useState('')
  const [recoLoading, setRecoLoading] = useState(false)
  const [alreadyRecommended, setAlreadyRecommended] = useState(false)
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [editingRecoId, setEditingRecoId] = useState<string | null>(null)
  // Modale détail d'un item (produit/service ou portfolio)
  const [itemModal, setItemModal] = useState<any>(null) // { type, item }
  // Relations (connexions acceptées)
  const [connectionCount, setConnectionCount] = useState(0)
  const [connectionsModal, setConnectionsModal] = useState(false)
  const [connectionsList, setConnectionsList] = useState<any[]>([])
  const [connectionsLoading, setConnectionsLoading] = useState(false)
  // Modale publications
  const [postsModal, setPostsModal] = useState(false)
  const [allPosts, setAllPosts] = useState([])
  const [postsPage, setPostsPage] = useState(0)
  const [postsHasMore, setPostsHasMore] = useState(true)
  const [postsLoading, setPostsLoading] = useState(false)
  const postsBottomRef = useRef<HTMLDivElement>(null)

  const ADMIN_ID = '13cdb485-42e0-48df-b2f8-14dc77dd895a'
  const POSTS_PER_PAGE = 10

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()
      if (user) setCurrentUserId(user.id)

      // Compte fantôme : invisible sauf pour l'admin → redirection
      if (id === GHOST_ID && user?.id !== ADMIN_ID) {
        router.push('/feed')
        return
      }

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', id).single()
      if (prof) setProfile(prof)

      // Nombre de relations (connexions acceptées de ce membre)
      const { count: connCount } = await supabase
        .from('connections')
        .select('id', { count: 'exact', head: true })
        .or(`requester_id.eq.${id},receiver_id.eq.${id}`)
        .eq('status', 'accepted')
      setConnectionCount(connCount || 0)

      const { data: portfolioData } = await supabase.from('portfolio_items').select('id, title, description, media_url, link, image_position').eq('profile_id', id).order('created_at', { ascending: false })
      if (portfolioData) setPortfolio(portfolioData)

      const { data: servicesData } = await supabase.from('service_items').select('id, title, description, image_url, price, link, link_label, image_position').eq('profile_id', id).order('created_at', { ascending: false })
      if (servicesData) setServices(servicesData)

      const { data: recoData } = await supabase.from('recommendations').select('id, content, author_id, profiles!recommendations_author_id_fkey(first_name, last_name, avatar_url, activity)').eq('target_id', id).eq('status', 'approved').order('created_at', { ascending: false })
      if (recoData) setRecos(recoData)

      // Posts fil d'actualité
      const { data: postsData } = await supabase.from('posts').select('id, content, image_url, created_at').eq('author_id', id).order('created_at', { ascending: false })
      const feedPosts = postsData ? await Promise.all(postsData.map(async post => {
        const [{ count: commentCount }, { data: reactions }] = await Promise.all([
          supabase.from('comments').select('id', { count: 'exact', head: true }).eq('post_id', post.id),
          supabase.from('reactions').select('emoji, author_id').eq('post_id', post.id),
        ])
        return { ...post, commentCount: commentCount || 0, reactions: reactions || [], source: 'feed' }
      })) : []

      // Topics forum
      const { data: topicsData } = await supabase.from('forum_topics').select('id, title, content, created_at, category_id, forum_categories(name)').eq('author_id', id).order('created_at', { ascending: false })
      const forumTopics = (topicsData || []).map(t => ({
        id: t.id,
        content: t.content,
        image_url: null,
        created_at: t.created_at,
        commentCount: 0,
        reactions: [],
        source: 'forum',
        title: t.title,
        category_id: t.category_id,
        category_name: t.forum_categories?.name,
      }))

      // Fusionner et trier par date, prendre les 2 plus récents pour l'aperçu
      const all = [...feedPosts, ...forumTopics].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setPosts(all.slice(0, 2))

      if (user && user.id !== id) {
        const { data: existingReco } = await supabase.from('recommendations').select('id').eq('target_id', id).eq('author_id', user.id).single()
        if (existingReco) setAlreadyRecommended(true)

        const { data: conn } = await supabase.from('connections').select('id, status, requester_id').or(`and(requester_id.eq.${user.id},receiver_id.eq.${id}),and(requester_id.eq.${id},receiver_id.eq.${user.id})`).single()
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

  const loadMorePosts = useCallback(async () => {
    if (postsLoading || !postsHasMore) return
    setPostsLoading(true)
    const supabase = createClient()
    const from = postsPage * POSTS_PER_PAGE

    const [{ data: feedData }, { data: topicsData }] = await Promise.all([
      supabase.from('posts').select('id, content, image_url, created_at').eq('author_id', id).order('created_at', { ascending: false }),
      supabase.from('forum_topics').select('id, title, content, created_at, category_id, forum_categories(name)').eq('author_id', id).order('created_at', { ascending: false }),
    ])

    const feedPosts = feedData ? await Promise.all(feedData.map(async post => {
      const [{ count: commentCount }, { data: reactions }] = await Promise.all([
        supabase.from('comments').select('id', { count: 'exact', head: true }).eq('post_id', post.id),
        supabase.from('reactions').select('emoji, author_id').eq('post_id', post.id),
      ])
      return { ...post, commentCount: commentCount || 0, reactions: reactions || [], source: 'feed' }
    })) : []

    const forumTopics = (topicsData || []).map(t => ({
      id: t.id, content: t.content, image_url: null, created_at: t.created_at,
      commentCount: 0, reactions: [], source: 'forum',
      title: t.title, category_id: t.category_id, category_name: t.forum_categories?.name,
    }))

    const all = [...feedPosts, ...forumTopics].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    const page = all.slice(from, from + POSTS_PER_PAGE)
    setAllPosts(prev => postsPage === 0 ? page : [...prev, ...page])
    if (page.length < POSTS_PER_PAGE) setPostsHasMore(false)
    setPostsPage(p => p + 1)
    setPostsLoading(false)
  }, [postsPage, postsLoading, postsHasMore, id])

  // Scroll infini dans la modale
  useEffect(() => {
    if (!postsModal) return
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) loadMorePosts()
    }, { threshold: 0.5 })
    if (postsBottomRef.current) observer.observe(postsBottomRef.current)
    return () => observer.disconnect()
  }, [postsModal, loadMorePosts])

  const openPostsModal = () => {
    setAllPosts([])
    setPostsPage(0)
    setPostsHasMore(true)
    setPostsModal(true)
  }

  const sendConnectionRequest = async () => {
    const supabase = createClient()
    const { data } = await supabase.from('connections').insert({ requester_id: currentUserId, receiver_id: id, status: 'pending' }).select('id').single()
    if (data) {
      setConnectionId(data.id)
      setConnectionStatus('pending_sent')
      await notify({ userId: id, type: 'connection', content: `t'a envoyé une demande de connexion`, link: `/reseau`, fromUserId: currentUserId })
    }
  }

  const acceptConnection = async () => {
    const supabase = createClient()
    await supabase.from('connections').update({ status: 'accepted' }).eq('id', connectionId)
    const { data: existing } = await supabase.from('conversations').select('id').or(`and(participant1_id.eq.${currentUserId},participant2_id.eq.${id}),and(participant1_id.eq.${id},participant2_id.eq.${currentUserId})`).single()
    if (!existing) await supabase.from('conversations').insert({ participant1_id: currentUserId, participant2_id: id })
    setConnectionStatus('accepted')
  }

  const removeConnection = async () => {
    if (!connectionId) return
    setRemoving(true)
    const supabase = createClient()
    // `select()` renvoie les lignes réellement supprimées : permet de détecter
    // un blocage RLS silencieux (0 ligne supprimée).
    const { data: deleted, error } = await supabase
      .from('connections')
      .delete()
      .eq('id', connectionId)
      .select('id')
    setRemoving(false)
    if (error || !deleted || deleted.length === 0) {
      alert("La suppression a échoué. Vérifie les permissions (RLS) sur la table connections.")
      return
    }
    setRemoveModal(false)
    setConnectionStatus('none')
    setConnectionId(null)
  }

  const openConnectionsModal = async () => {
    if (currentUserId !== ADMIN_ID) return // réservé à l'admin
    setConnectionsModal(true)
    setConnectionsLoading(true)
    const supabase = createClient()
    const { data: conns } = await supabase
      .from('connections')
      .select('requester_id, receiver_id')
      .or(`requester_id.eq.${id},receiver_id.eq.${id}`)
      .eq('status', 'accepted')
    // L'autre membre de chaque connexion
    const otherIds = (conns || []).map((c: any) => c.requester_id === id ? c.receiver_id : c.requester_id)
    if (otherIds.length === 0) { setConnectionsList([]); setConnectionsLoading(false); return }
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, avatar_url, activity')
      .in('id', otherIds)
    setConnectionsList(profiles || [])
    setConnectionsLoading(false)
  }

  const openMessage = async () => {
    const supabase = createClient()
    const { data: existing } = await supabase.from('conversations').select('id').or(`and(participant1_id.eq.${currentUserId},participant2_id.eq.${id}),and(participant1_id.eq.${id},participant2_id.eq.${currentUserId})`).single()
    let convId = existing?.id
    if (!convId) {
      const { data: created } = await supabase.from('conversations').insert({ participant1_id: currentUserId, participant2_id: id }).select('id').single()
      if (created) convId = created.id
    }
    if (convId) {
      if (window.innerWidth <= 768) {
        router.push(`/messages?conv=${convId}`)
      } else {
        window.dispatchEvent(new CustomEvent('meello:open-conv', { detail: convId }))
      }
    }
  }

  const sendReco = async () => {
    if (!recoText.trim()) return
    setRecoLoading(true)
    const supabase = createClient()
    if (editingRecoId) {
      await supabase.from('recommendations').update({ content: recoText.trim() }).eq('id', editingRecoId)
    } else {
      let proof_url = null
      if (proofFile) {
        const ext = proofFile.name.split('.').pop()
        const path = `${currentUserId}/${Date.now()}.${ext}`
        const { error } = await supabase.storage.from('proofs').upload(path, proofFile, { upsert: true })
        if (!error) { const { data: urlData } = supabase.storage.from('proofs').getPublicUrl(path); proof_url = urlData.publicUrl }
      }
      await supabase.from('recommendations').insert({ target_id: id, author_id: currentUserId, content: recoText.trim(), proof_url, status: 'pending' })
      await notify({ userId: id, type: 'recommendation', content: `t'a laissé une recommandation (en attente de validation)`, link: `/membre/${id}`, fromUserId: currentUserId })
      setAlreadyRecommended(true)
    }
    const { data: recoData } = await supabase.from('recommendations').select('id, content, author_id, profiles!recommendations_author_id_fkey(first_name, last_name, avatar_url, activity)').eq('target_id', id).eq('status', 'approved').order('created_at', { ascending: false })
    if (recoData) setRecos(recoData)
    setRecoText(''); setRecoModal(false); setRecoLoading(false); setEditingRecoId(null); setProofFile(null)
  }

  const formatDate = (d: string) => {
    const date = new Date(d)
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const SOCIAL_LINKS = [
    { key: 'linkedin', label: 'LinkedIn', svg: '/icons/linkedin.svg' },
    { key: 'instagram', label: 'Instagram', svg: '/icons/instagram.svg' },
    { key: 'facebook', label: 'Facebook', svg: '/icons/facebook.svg' },
    { key: 'pinterest', label: 'Pinterest', svg: '/icons/pinterest.svg' },
    { key: 'tiktok', label: 'TikTok', svg: '/icons/tiktok.svg' },
    { key: 'x', label: 'X', svg: '/icons/x.svg' },
    { key: 'youtube', label: 'YouTube', svg: '/icons/youtube.svg' },
    { key: 'whatsapp', label: 'WhatsApp', svg: '/icons/whatsapp.svg' },
  ]

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem', color: '#2D2D2D', opacity: 0.4 }}>Chargement...</div>
  if (!profile) return <div style={{ textAlign: 'center', padding: '3rem', color: '#2D2D2D', opacity: 0.4 }}>Membre introuvable.</div>

  const initials = `${(profile.first_name || '?')[0]}${(profile.last_name || '')[0] || ''}`.toUpperCase()

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <style>{`
        .social-icon img { filter: brightness(0); transition: filter 0.15s; }
        .social-icon:hover img { filter: brightness(0) saturate(100%) invert(35%) sepia(90%) saturate(700%) hue-rotate(350deg); }
        @media (max-width: 768px) {
          /* Une seule colonne : on fait remonter les blocs des deux
             colonnes au niveau de la grille pour pouvoir les entrelacer.
             Ordre : principal → localité/réseaux → produits/services
             → portfolio → publications → recommandations */
          .profil-grid {
            grid-template-columns: 1fr !important;
          }
          .profil-col-left,
          .profil-col-right {
            display: contents !important;
          }
          .profil-block-main      { order: 1 !important; }
          .profil-block-social    { order: 2 !important; }
          .profil-block-services  { order: 3 !important; }
          .profil-block-portfolio { order: 4 !important; }
          .profil-block-posts     { order: 5 !important; }
          .profil-block-recos     { order: 6 !important; }

          /* Sur mobile, le menu se colle aux autres au lieu d'être à droite */
          .act-menu    { margin-left: 0 !important; }
        }

        /* Ordre des actions (desktop + mobile) :
           Recommander, puis icône message, puis le menu "..." */
        .act-reco    { order: 1; }
        .act-message { order: 2; }
        .act-menu    { order: 3; }
      `}</style>

      <div className="profil-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem', alignItems: 'start' }}>

        {/* COLONNE GAUCHE */}
        <div className="profil-col-left" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Carte profil principale */}
          <div className="profil-block-main" style={{ backgroundColor: 'white', borderRadius: '16px', padding: '2rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            {/* Avatar + nom + actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.25rem' }}>
              <div style={{ width: '72px', height: '72px', borderRadius: '50%', backgroundColor: '#E8501A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.4rem', flexShrink: 0, overflow: 'hidden' }}>
                {profile.avatar_url ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-clash)', fontSize: '1.4rem', color: '#2D2D2D', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  {profile.first_name} {profile.last_name}
                  {id === ADMIN_ID && <img src="/icons/badge-check.svg" alt="Admin" title="Fondateur Meello" style={{ width: '20px', height: '20px', flexShrink: 0 }} />}
                </div>
                <div style={{ color: '#2D2D2D', opacity: 0.6, fontSize: '0.9rem' }}>{profile.activity}</div>
                {profile.member_since && (
                  <div style={{ marginTop: '0.2rem', fontSize: '0.78rem', color: '#2D2D2D', opacity: 0.4 }}>
                    Membre depuis {new Date(profile.member_since).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                  </div>
                )}
              </div>
            </div>

            {/* Actions connexion */}
            {currentUserId && currentUserId !== id && (
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                {connectionStatus === 'none' && (
                  <button onClick={sendConnectionRequest} style={{ backgroundColor: '#E8501A', color: 'white', border: 'none', borderRadius: '8px', padding: '0.5rem 1.1rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem' }}>
                    Envoyer une demande de connexion
                  </button>
                )}
                {connectionStatus === 'pending_sent' && <span style={{ fontSize: '0.85rem', color: '#2D2D2D', opacity: 0.5, padding: '0.5rem 0' }}>Demande envoyée…</span>}
                {connectionStatus === 'pending_received' && (
                  <button onClick={acceptConnection} style={{ backgroundColor: '#E8501A', color: 'white', border: 'none', borderRadius: '8px', padding: '0.5rem 1.1rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem' }}>
                    Accepter la demande
                  </button>
                )}
                {connectionStatus === 'accepted' && (
                  <>
                    <button onClick={openMessage} className="act-message" style={{ background: 'none', border: 'none', padding: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Envoyer un message"
                      onMouseEnter={e => e.currentTarget.querySelector('svg')!.style.stroke = '#E8501A'}
                      onMouseLeave={e => e.currentTarget.querySelector('svg')!.style.stroke = '#2D2D2D'}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2D2D2D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6, transition: 'stroke 0.15s' }}>
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                    </button>
                    <button onClick={() => !alreadyRecommended && setRecoModal(true)} disabled={alreadyRecommended} className="act-reco"
                      style={{ background: 'none', border: `1.5px solid ${alreadyRecommended ? '#ccc' : '#E8501A'}`, borderRadius: '8px', padding: '0.5rem 1rem', fontWeight: 600, cursor: alreadyRecommended ? 'default' : 'pointer', fontSize: '0.85rem', color: alreadyRecommended ? '#aaa' : '#E8501A' }}>
                      {alreadyRecommended ? 'Déjà recommandé' : 'Recommander'}
                    </button>
                    <div className="act-menu" style={{ position: 'relative' }}>
                      <button onClick={() => setMenuOpen(o => !o)}
                        style={{ background: 'none', border: 'none', padding: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#999' }}
                        title="Plus d'options"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>
                        </svg>
                      </button>
                      {menuOpen && (
                        <>
                          <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 50 }} />
                          <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '0.25rem', backgroundColor: 'white', border: '1px solid #E8E3D9', borderRadius: '10px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 51, minWidth: '200px', overflow: 'hidden' }}>
                            <button
                              onClick={() => { setMenuOpen(false); setRemoveModal(true) }}
                              style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', width: '100%', background: 'none', border: 'none', padding: '0.7rem 0.9rem', cursor: 'pointer', fontSize: '0.88rem', color: '#2D2D2D', textAlign: 'left' }}
                              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#F5F0E8'}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              <img src="/icons/remove-person.svg" alt="" style={{ width: '17px', height: '17px', filter: 'brightness(0) saturate(100%) invert(35%) sepia(90%) saturate(700%) hue-rotate(350deg)', flexShrink: 0 }} />
                              Supprimer la relation
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Badges */}
            {(() => {
              const isNew = profile.member_since && !profile.hide_new_badge ? (Date.now() - new Date(profile.member_since).getTime()) < 30 * 24 * 60 * 60 * 1000 : false
              const badges = (profile.badges || []).filter((b: string) => b !== 'nouveau' && b !== 'profil_complet')
              const allBadges = isNew ? ['nouveau', ...badges] : badges
              return allBadges.length > 0 && (
                <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  {allBadges.map((b: string) => (
                    <span key={b} style={{ backgroundColor: b === 'nouveau' ? '#F5A623' : b === 'membre_fondateur' ? '#6B4FA0' : '#E8501A', color: 'white', fontSize: '0.72rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: '20px' }}>
                      {b === 'fondateur' ? 'Fondateur' : b === 'partenaire' ? 'Partenaire' : b === 'membre_fondateur' ? 'Membre fondateur' : 'Nouveau membre'}
                    </span>
                  ))}
                </div>
              )
            })()}

            {/* Nombre de relations — cliquable pour l'admin uniquement */}
            <div
              onClick={currentUserId === ADMIN_ID ? openConnectionsModal : undefined}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                marginBottom: '1rem',
                cursor: currentUserId === ADMIN_ID ? 'pointer' : 'default',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E8501A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <span style={{ fontSize: '0.85rem', color: '#2D2D2D', fontWeight: 600 }}>
                {connectionCount} {connectionCount > 1 ? 'relations' : 'relation'}
              </span>
              {currentUserId === ADMIN_ID && (
                <span style={{ fontSize: '0.72rem', color: '#E8501A', fontWeight: 600 }}>(voir)</span>
              )}
            </div>

            {/* Niveau XP */}
            {(() => {
              const totalXP = profile.xp ?? 0
              if (totalXP === 0) return null
              const { level, currentXP, xpToNext } = getLevelFromXP(totalXP)
              const color = getLevelColor(level)
              const isMax = level === 50
              const pct = isMax ? 100 : Math.round((currentXP / xpToNext) * 100)
              return (
                <div style={{ marginBottom: '0.75rem', padding: '0.75rem 1rem', backgroundColor: '#F9F9F9', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: isMax ? 0 : '0.4rem' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>
                      {level}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#2D2D2D' }}>Niveau {level}</div>
                      <div style={{ fontSize: '0.72rem', color: '#2D2D2D', opacity: 0.45 }}>{totalXP} XP</div>
                    </div>
                  </div>
                  {!isMax && (
                    <div style={{ height: '5px', backgroundColor: '#E8E8E8', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, backgroundColor: color, borderRadius: '3px' }} />
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Bio */}
            {profile.bio && <p style={{ color: '#2D2D2D', lineHeight: 1.65, margin: '0 0 0.75rem', whiteSpace: 'pre-wrap' }}>{profile.bio}</p>}

            {/* Compétences */}
            {(profile.skills || []).length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {(profile.skills || []).map((skill: string) => (
                  <span key={skill} style={{ backgroundColor: '#FFF0ED', color: '#E8501A', borderRadius: '20px', padding: '0.3rem 0.75rem', fontSize: '0.82rem', fontWeight: 600 }}>
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Produits & Services */}
          {services.length > 0 && (
            <div className="profil-block-services" style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <h2 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.2rem', color: '#2D2D2D', marginBottom: '1rem' }}>Produits & Services</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
                {services.map(item => (
                  <div key={item.id} onClick={() => setItemModal({ type: 'service', item })} style={{ borderRadius: '18px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.6)', background: 'linear-gradient(160deg, rgba(255,255,255,0.85) 0%, rgba(250,248,244,0.7) 100%)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', display: 'flex', flexDirection: 'column', cursor: 'pointer', transition: 'transform 0.2s ease, box-shadow 0.2s ease', boxShadow: '0 4px 20px rgba(45,45,45,0.06), inset 0 1px 0 rgba(255,255,255,0.7)' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(45,45,45,0.14), inset 0 1px 0 rgba(255,255,255,0.8)' }}
                    onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 20px rgba(45,45,45,0.06), inset 0 1px 0 rgba(255,255,255,0.7)' }}
                  >
                    {item.image_url && <img src={item.image_url} alt={item.title} style={{ width: '100%', height: '130px', objectFit: 'cover', objectPosition: `center ${item.image_position ?? 50}%`, display: 'block' }} />}
                    <div style={{ padding: '0.75rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#2D2D2D' }}>{item.title}</div>
                      {item.price && <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#E8501A' }}>{item.price}</div>}
                      {item.description && (
                        <p style={{ fontSize: '0.78rem', color: '#2D2D2D', opacity: 0.6, margin: 0, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.description}</p>
                      )}
                      <span style={{ fontSize: '0.75rem', color: '#E8501A', fontWeight: 600, marginTop: '0.2rem' }}>… lire plus</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Portfolio */}
          {portfolio.length > 0 && (
            <div className="profil-block-portfolio" style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <h2 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.2rem', color: '#2D2D2D', marginBottom: '1rem' }}>Portfolio</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
                {portfolio.map(item => (
                  <div key={item.id} onClick={() => setItemModal({ type: 'portfolio', item })} style={{ borderRadius: '18px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.6)', background: 'linear-gradient(160deg, rgba(255,255,255,0.85) 0%, rgba(250,248,244,0.7) 100%)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', cursor: 'pointer', transition: 'transform 0.2s ease, box-shadow 0.2s ease', boxShadow: '0 4px 20px rgba(45,45,45,0.06), inset 0 1px 0 rgba(255,255,255,0.7)' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(45,45,45,0.14), inset 0 1px 0 rgba(255,255,255,0.8)' }}
                    onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 20px rgba(45,45,45,0.06), inset 0 1px 0 rgba(255,255,255,0.7)' }}
                  >
                    {item.media_url.match(/\.(mp4|mov|webm)$/i)
                      ? <video src={item.media_url} style={{ width: '100%', height: '130px', objectFit: 'cover', display: 'block' }} />
                      : <img src={item.media_url} alt={item.title} style={{ width: '100%', height: '130px', objectFit: 'cover', objectPosition: `center ${item.image_position ?? 50}%`, display: 'block' }} />}
                    <div style={{ padding: '0.75rem' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#2D2D2D', marginBottom: '0.2rem' }}>{item.title}</div>
                      {item.description && <p style={{ fontSize: '0.78rem', color: '#2D2D2D', opacity: 0.6, margin: '0 0 0.2rem', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.description}</p>}
                      <span style={{ fontSize: '0.75rem', color: '#E8501A', fontWeight: 600 }}>… lire plus</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* COLONNE DROITE */}
        <div className="profil-col-right" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Localisation + Réseaux */}
          <div className="profil-block-social" style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            {profile.city && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#2D2D2D', opacity: 0.5, fontSize: '1rem', marginBottom: '1rem' }}>
                <img src="/icons/pin.svg" alt="" style={{ width: '18px', height: '18px', flexShrink: 0 }} />
                {profile.city}
              </div>
            )}
            {(profile.website || SOCIAL_LINKS.some(s => profile[s.key])) && (
              <>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#2D2D2D', opacity: 0.4, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Retrouvez-moi sur</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {profile.website && (
                    <a href={profile.website} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#E8501A', textDecoration: 'none', fontSize: '0.88rem', fontWeight: 500, minWidth: 0 }}>
                      <img src="/icons/website.svg" alt="Site web" style={{ width: '16px', height: '16px', flexShrink: 0, filter: 'brightness(0) saturate(100%) invert(35%) sepia(90%) saturate(700%) hue-rotate(350deg)' }} />
                      <span style={{ wordBreak: 'break-all', minWidth: 0 }}>{profile.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
                    </a>
                  )}
                  <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                    {SOCIAL_LINKS.map(s => profile[s.key] && (
                      <a key={s.key} href={s.key === 'whatsapp' ? `https://wa.me/${profile[s.key].replace(/\D/g, '')}` : profile[s.key]} target="_blank" rel="noopener noreferrer" title={s.label} className="social-icon" style={socialLinkStyle}>
                        <img src={s.svg} alt={s.label} style={{ width: '20px', height: '20px' }} />
                      </a>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Recommandations */}
          {recos.length > 0 && (
            <div className="profil-block-recos" style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <h2 style={{ fontFamily: 'var(--font-clash)', fontSize: '1rem', color: '#2D2D2D', marginBottom: '0.75rem' }}>
                Recommandations ({recos.length})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {recos.map(r => (
                  <div key={r.id} style={{ borderLeft: '3px solid #E8501A', paddingLeft: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: '0 0 0.5rem', color: '#2D2D2D', lineHeight: 1.5, fontSize: '0.88rem' }}>{r.content}</p>
                      <a href={`/membre/${r.author_id}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#E8501A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: 700, flexShrink: 0, overflow: 'hidden' }}>
                          {r.profiles?.avatar_url ? <img src={r.profiles.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : `${(r.profiles?.first_name || '?')[0]}${(r.profiles?.last_name || '')[0] || ''}`}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.78rem', color: '#E8501A', fontWeight: 600 }}>{r.profiles?.first_name} {r.profiles?.last_name}</div>
                          {r.profiles?.activity && <div style={{ fontSize: '0.7rem', color: '#2D2D2D', opacity: 0.5 }}>{r.profiles.activity}</div>}
                        </div>
                      </a>
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                      {r.author_id === currentUserId && (
                        <button onClick={() => { setEditingRecoId(r.id); setRecoText(r.content); setRecoModal(true) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem' }}>
                          <img src="/icons/pen-edit.svg" alt="Modifier" style={{ width: '13px', height: '13px', filter: 'brightness(0) opacity(0.35)' }} />
                        </button>
                      )}
                      {currentUserId === ADMIN_ID && (
                        <button onClick={async () => { if (!confirm('Supprimer ?')) return; const supabase = createClient(); await supabase.from('recommendations').delete().eq('id', r.id); setRecos(prev => prev.filter(x => x.id !== r.id)) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem' }}>
                          <img src="/icons/trash.svg" alt="Supprimer" style={{ width: '13px', height: '13px', filter: 'brightness(0) opacity(0.35)' }} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Publications */}
          <div className="profil-block-posts" style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontFamily: 'var(--font-clash)', fontSize: '1rem', color: '#2D2D2D', marginBottom: '0.75rem' }}>Publications</h2>
            {posts.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: '#2D2D2D', opacity: 0.4, margin: 0 }}>Aucune publication pour l'instant.</p>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                  {posts.map((post, i) => (
                    <MiniPostCard key={post.id} post={post} isLast={i === posts.length - 1} />
                  ))}
                </div>
                <button onClick={openPostsModal} style={{ marginTop: '0.75rem', background: 'none', border: 'none', color: '#E8501A', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', padding: 0 }}>
                  Voir toutes les publications →
                </button>
              </>
            )}
          </div>

        </div>
      </div>

      {/* Modal détail produit/service ou portfolio */}
      {itemModal && (
        <div onClick={() => setItemModal(null)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '720px', maxHeight: '88vh', overflowY: 'auto' }}>
            {(itemModal.item.image_url || itemModal.item.media_url) && (
              itemModal.type === 'portfolio' && itemModal.item.media_url?.match(/\.(mp4|mov|webm)$/i)
                ? <video src={itemModal.item.media_url} controls style={{ width: '100%', maxHeight: '320px', objectFit: 'cover', display: 'block', borderRadius: '16px 16px 0 0' }} />
                : <img src={itemModal.item.image_url || itemModal.item.media_url} alt={itemModal.item.title} style={{ width: '100%', maxHeight: '320px', objectFit: 'cover', objectPosition: `center ${itemModal.item.image_position ?? 50}%`, display: 'block', borderRadius: '16px 16px 0 0' }} />
            )}
            <div style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                <h3 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.25rem', color: '#2D2D2D', margin: 0 }}>{itemModal.item.title}</h3>
                <button onClick={() => setItemModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', lineHeight: 1, color: '#2D2D2D', opacity: 0.4, padding: 0, flexShrink: 0 }}>×</button>
              </div>
              {itemModal.item.price && <div style={{ fontSize: '1rem', fontWeight: 700, color: '#E8501A', marginTop: '0.4rem' }}>{itemModal.item.price}</div>}
              {itemModal.item.description && (
                <p style={{ fontSize: '0.92rem', color: '#2D2D2D', opacity: 0.8, lineHeight: 1.6, margin: '1rem 0', whiteSpace: 'pre-wrap' }}>{itemModal.item.description}</p>
              )}
              {itemModal.item.link && (
                <a href={itemModal.item.link} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', backgroundColor: '#E8501A', color: 'white', fontWeight: 600, textDecoration: 'none', padding: '0.6rem 1.25rem', borderRadius: '10px', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                  {itemModal.type === 'portfolio' ? 'Voir le projet →' : (itemModal.item.link_label || 'En savoir plus →')}
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal liste des relations — admin uniquement */}
      {connectionsModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setConnectionsModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '420px', maxHeight: '70vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.1rem 1.25rem', borderBottom: '1px solid #F5F0E8' }}>
              <span style={{ fontWeight: 700, fontSize: '1rem', color: '#2D2D2D' }}>
                Relations de {profile.first_name} ({connectionCount})
              </span>
              <button onClick={() => setConnectionsModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.4rem', lineHeight: 1, color: '#2D2D2D', opacity: 0.5, padding: 0 }}>×</button>
            </div>
            <div style={{ overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {connectionsLoading ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: '#2D2D2D', opacity: 0.4, fontSize: '0.9rem' }}>Chargement…</div>
              ) : connectionsList.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: '#2D2D2D', opacity: 0.4, fontSize: '0.9rem' }}>Aucune relation.</div>
              ) : connectionsList.map(m => (
                <a key={m.id} href={`/membre/${m.id}`} style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', textDecoration: 'none', borderRadius: '10px', padding: '0.5rem 0.6rem' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#F5F0E8'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div style={{ width: '38px', height: '38px', borderRadius: '50%', backgroundColor: '#E8501A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.78rem', overflow: 'hidden', flexShrink: 0 }}>
                    {m.avatar_url ? <img src={m.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : `${(m.first_name || '?')[0]}${(m.last_name || '')[0] || ''}`.toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.9rem', color: '#2D2D2D', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.first_name} {m.last_name}</div>
                    {m.activity && <div style={{ fontSize: '0.78rem', color: '#2D2D2D', opacity: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.activity}</div>}
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmation suppression de relation */}
      {removeModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setRemoveModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.75rem', width: '100%', maxWidth: '400px' }}>
            <h3 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.15rem', color: '#2D2D2D', marginBottom: '0.6rem' }}>
              Retirer de ton réseau ?
            </h3>
            <p style={{ fontSize: '0.9rem', color: '#2D2D2D', opacity: 0.65, lineHeight: 1.55, margin: '0 0 1.5rem' }}>
              {profile.first_name} {profile.last_name} sera retiré(e) de ton réseau. Vous devrez renvoyer une demande de connexion pour vous reconnecter.
            </p>
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setRemoveModal(false)} style={{ background: 'none', border: '1px solid #E8E3D9', borderRadius: '8px', padding: '0.55rem 1.1rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, color: '#2D2D2D' }}>
                Annuler
              </button>
              <button onClick={removeConnection} disabled={removing} style={{ backgroundColor: '#E8501A', color: 'white', border: 'none', borderRadius: '8px', padding: '0.55rem 1.1rem', cursor: removing ? 'default' : 'pointer', fontSize: '0.9rem', fontWeight: 600, opacity: removing ? 0.6 : 1 }}>
                {removing ? 'Suppression…' : 'Retirer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal recommandation */}
      {recoModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '480px' }}>
            <h3 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.1rem', color: '#2D2D2D', marginBottom: '0.5rem' }}>
              {editingRecoId ? 'Modifier ma recommandation' : `Recommander ${profile?.first_name}`}
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#2D2D2D', opacity: 0.5, marginBottom: '1rem' }}>Ta recommandation apparaîtra sur son profil.</p>
            <textarea value={recoText} onChange={e => setRecoText(e.target.value)} placeholder={`Décris ton expérience avec ${profile?.first_name}…`} rows={4} style={{ width: '100%', border: '1.5px solid #E8E3D9', borderRadius: '10px', padding: '0.75rem', fontSize: '0.95rem', fontFamily: 'inherit', outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
            {!editingRecoId && (
              <div style={{ marginTop: '0.75rem' }}>
                <label style={{ fontSize: '0.82rem', color: '#2D2D2D', opacity: 0.6, display: 'block', marginBottom: '0.4rem' }}>📎 Justificatif <span style={{ opacity: 0.5 }}>(facultatif)</span></label>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={e => setProofFile(e.target.files?.[0] || null)} style={{ fontSize: '0.85rem', color: '#2D2D2D', width: '100%' }} />
                {proofFile && <div style={{ fontSize: '0.78rem', color: '#7A9E7E', marginTop: '0.3rem' }}>✓ {proofFile.name}</div>}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setRecoModal(false)} style={{ background: 'none', border: '1px solid #E8E3D9', borderRadius: '8px', padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.9rem' }}>Annuler</button>
              <button onClick={sendReco} disabled={!recoText.trim() || recoLoading} style={{ backgroundColor: '#E8501A', color: 'white', border: 'none', borderRadius: '8px', padding: '0.5rem 1.25rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}>
                {recoLoading ? '...' : 'Envoyer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale publications scroll infini */}
      {postsModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setPostsModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '560px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #F5F0E8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.1rem', color: '#2D2D2D', margin: 0 }}>Publications de {profile.first_name}</h3>
              <button onClick={() => setPostsModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#2D2D2D', opacity: 0.4, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0' }}>
              {allPosts.map((post, i) => (
                <MiniPostCard key={post.id} post={post} isLast={i === allPosts.length - 1} />
              ))}
              {postsLoading && <div style={{ textAlign: 'center', color: '#2D2D2D', opacity: 0.4, fontSize: '0.85rem', padding: '0.5rem' }}>Chargement...</div>}
              {!postsHasMore && allPosts.length > 0 && <div style={{ textAlign: 'center', color: '#2D2D2D', opacity: 0.3, fontSize: '0.82rem', padding: '0.5rem' }}>Toutes les publications ont été chargées</div>}
              <div ref={postsBottomRef} style={{ height: '1px' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
