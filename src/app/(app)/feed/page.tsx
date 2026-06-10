// @ts-nocheck
'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { notify } from '@/lib/notify'
import { awardXp } from '@/lib/awardXp'
import WeeklyChallenges from '@/components/WeeklyChallenges'
import AvatarNiveau from '@/components/AvatarNiveau'
import { GHOST_ID } from '@/lib/ghost'
import { titleCase } from '@/lib/format'
import imageCompression from 'browser-image-compression'
import type { Post } from '@/types'

const EMOJIS = ['👍', '🔥', '❤️']

export default function FeedPage() {
  return (
    <Suspense>
      <FeedPageInner />
    </Suspense>
  )
}

function FeedPageInner() {
  const [posts, setPosts] = useState<Post[]>([])
  const [showModal, setShowModal] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [userProfile, setUserProfile] = useState<{ first_name: string; avatar_url: string | null } | null>(null)
  const [allMembers, setAllMembers] = useState<{ id: string; first_name: string; last_name: string }[]>([])
  const [presentationsCategoryId, setPresentationsCategoryId] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const highlightPostId = searchParams.get('post')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      setUserId(data.user.id)
      const { data: prof } = await supabase.from('profiles').select('first_name, avatar_url').eq('id', data.user.id).single()
      if (prof) setUserProfile(prof)
    })
    fetchPosts()
    // Charger tous les membres pour résoudre les mentions
    createClient().from('profiles').select('id, first_name, last_name').eq('is_active', true).then(({ data }) => {
      if (data) setAllMembers(data.filter(m => m.id !== GHOST_ID).map(m => ({ ...m, first_name: titleCase(m.first_name), last_name: titleCase(m.last_name) })))
    })
    // Récupérer l'ID de la catégorie Présentations
    createClient().from('forum_categories').select('id').eq('name', 'Présentations').single().then(({ data }) => {
      if (data) setPresentationsCategoryId(data.id)
    })
  }, [])

  // Scroller vers le post mentionné après chargement
  useEffect(() => {
    if (!highlightPostId || posts.length === 0) return
    setTimeout(() => {
      const el = document.getElementById(`post-${highlightPostId}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.style.outline = '2px solid #E8501A'
        el.style.borderRadius = '16px'
        setTimeout(() => { el.style.outline = '' }, 2500)
      }
    }, 300)
  }, [highlightPostId, posts])

  const fetchPosts = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('posts')
      .select('*, profiles(first_name, last_name, avatar_url, activity, badges, member_since, hide_new_badge, xp)')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) setPosts(data.map((p: any) => p.profiles ? { ...p, profiles: { ...p.profiles, first_name: titleCase(p.profiles.first_name), last_name: titleCase(p.profiles.last_name) } } : p) as Post[])
  }

  const initials = userProfile?.first_name?.[0]?.toUpperCase() || '?'

  return (
    <div className="feed-layout" style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', alignItems: 'flex-start' }}>
      <style>{`
        .feed-sidebar { display: none; }
        @media (min-width: 1024px) {
          .feed-sidebar { display: block; width: 300px; flex-shrink: 0; position: sticky; top: 1.5rem; }
        }
      `}</style>
      <div style={{ maxWidth: '680px', width: '100%', flexShrink: 1 }}>
      <h1 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.75rem', color: '#2D2D2D', marginBottom: '1.5rem' }}>
        Fil d'actualité
      </h1>

      {/* Barre "Créer une publication" */}
      <div
        onClick={() => setShowModal(true)}
        style={{
          backgroundColor: 'white', borderRadius: '50px', padding: '0.75rem 1rem',
          marginBottom: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer',
        }}
      >
        <div style={{
          width: '36px', height: '36px', borderRadius: '50%',
          backgroundColor: '#E8501A', color: 'white', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: '0.8rem', overflow: 'hidden',
        }}>
          {userProfile?.avatar_url
            ? <img src={userProfile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : initials}
        </div>
        <span style={{ flex: 1, color: '#2D2D2D', opacity: 0.4, fontSize: '0.95rem' }}>Créer une publication</span>
        <div style={{
          width: '32px', height: '32px', borderRadius: '50%',
          backgroundColor: '#F5F0E8', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.2rem', color: '#2D2D2D', fontWeight: 300,
        }}>+</div>
      </div>

      {/* Modale */}
      {showModal && (
        <PostModal
          userId={userId}
          userProfile={userProfile}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetchPosts() }}
        />
      )}

      {/* Post épinglé de bienvenue */}
      <div style={{
        backgroundColor: '#E8501A', borderRadius: '16px', padding: '1.25rem',
        boxShadow: '0 2px 12px rgba(232,80,26,0.25)', marginBottom: '1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="white" style={{ flexShrink: 0 }}>
            <path d="M16 1l-1.5 1.5 1 1-6.5 5H5l-1 1 4 4-4 4 1 1 4-4 4 4 1-1v-4l5-6.5 1 1L21 6l-5-5z"/>
          </svg>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Épinglé</span>
        </div>
        <p style={{ fontSize: '1rem', fontWeight: 700, color: 'white', margin: '0 0 0.6rem', fontFamily: 'var(--font-clash)' }}>Bienvenue dans la communauté Meello ! 👋</p>
        <p style={{ fontSize: '0.92rem', color: 'rgba(255,255,255,0.9)', lineHeight: 1.65, margin: '0 0 1.1rem', whiteSpace: 'pre-wrap' }}>{`Tu viens de rejoindre une communauté d'entrepreneurs qui avancent ensemble. Ici, pas de solitude, pas de jugement, juste des gens qui comprennent ce que c'est de construire quelque chose.

La meilleure façon de commencer ? Te présenter aux autres membres. Dis-leur qui tu es, ce que tu fais, et ce qui t'a poussé à te lancer.`}</p>
        {presentationsCategoryId && (
          <a
            href={`/forum/${presentationsCategoryId}`}
            style={{
              display: 'inline-block', backgroundColor: 'white', color: '#E8501A',
              borderRadius: '50px', padding: '0.5rem 1.1rem', fontSize: '0.85rem',
              fontWeight: 700, textDecoration: 'none',
            }}
          >
            Je me présente →
          </a>
        )}
      </div>

      {/* Posts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {posts.map(post => (
          <div key={post.id} id={`post-${post.id}`}>
            <PostCard post={post} currentUserId={userId} onRefresh={fetchPosts} allMembers={allMembers} />
          </div>
        ))}
        {posts.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#2D2D2D', opacity: 0.4 }}>
            Sois le premier à publier quelque chose !
          </div>
        )}
      </div>
      </div>

      {/* Colonne droite (desktop) : défis de la semaine */}
      <aside className="feed-sidebar">
        <WeeklyChallenges userId={userId} />
      </aside>
    </div>
  )
}

const ADMIN_ID_MODAL = '13cdb485-42e0-48df-b2f8-14dc77dd895a'

function PostModal({ userId, userProfile, onClose, onSuccess }: {
  userId: string | null
  userProfile: { first_name: string; avatar_url: string | null } | null
  onClose: () => void
  onSuccess: () => void
}) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreview, setMediaPreview] = useState<string | null>(null)
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null)
  const [loading, setLoading] = useState(false)
  // Mentions
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionSuggestions, setMentionSuggestions] = useState<{ id: string; first_name: string; last_name: string }[]>([])
  const [allMembers, setAllMembers] = useState<{ id: string; first_name: string; last_name: string }[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const initials = userProfile?.first_name?.[0]?.toUpperCase() || '?'
  const isAdmin = userId === ADMIN_ID_MODAL

  // Charger tous les membres une seule fois
  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase.from('profiles').select('id, first_name, last_name').eq('is_active', true)
      if (data) setAllMembers(data.filter(m => m.id !== userId && m.id !== GHOST_ID).map(m => ({ ...m, first_name: titleCase(m.first_name), last_name: titleCase(m.last_name) })))
    }
    load()
  }, [userId])

  const handleMediaSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type.startsWith('video')) {
      setMediaFile(file)
      setMediaPreview(URL.createObjectURL(file))
      setMediaType('video')
    } else {
      // Compression image avant upload
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.8,
        maxWidthOrHeight: 1400,
        useWebWorker: true,
      })
      setMediaFile(compressed as File)
      setMediaPreview(URL.createObjectURL(compressed))
      setMediaType('image')
    }
  }

  const removeMedia = () => {
    setMediaFile(null)
    setMediaPreview(null)
    setMediaType(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setContent(val)
    e.target.style.height = 'auto'
    e.target.style.height = e.target.scrollHeight + 'px'

    // Détecter @mention en cours de frappe
    const cursor = e.target.selectionStart
    const textBefore = val.slice(0, cursor)
    const match = textBefore.match(/@([^\s]*)$/)
    if (match) {
      const q = match[1].toLowerCase()
      setMentionQuery(q)
      if (isAdmin && q === 'all') {
        setMentionSuggestions([{ id: '__all__', first_name: 'Tous', last_name: 'les membres' }])
      } else {
        const filtered = allMembers.filter(m =>
          `${m.first_name} ${m.last_name}`.toLowerCase().includes(q)
        ).slice(0, 6)
        // Admin voit @all en tête si la query colle
        if (isAdmin && 'all'.startsWith(q)) {
          setMentionSuggestions([{ id: '__all__', first_name: '@all', last_name: '— notifier tous les membres' }, ...filtered])
        } else {
          setMentionSuggestions(filtered)
        }
      }
    } else {
      setMentionQuery(null)
      setMentionSuggestions([])
    }
  }

  const insertMention = (member: { id: string; first_name: string; last_name: string }) => {
    const textarea = textareaRef.current
    if (!textarea) return
    const cursor = textarea.selectionStart
    const textBefore = content.slice(0, cursor)
    const textAfter = content.slice(cursor)
    const atIndex = textBefore.lastIndexOf('@')
    const tag = member.id === '__all__' ? '@all' : `@${member.first_name}${member.last_name}`
    const newContent = textBefore.slice(0, atIndex) + tag + ' ' + textAfter
    setContent(newContent)
    setMentionQuery(null)
    setMentionSuggestions([])
    // Remettre le focus
    setTimeout(() => {
      textarea.focus()
      const pos = atIndex + tag.length + 1
      textarea.setSelectionRange(pos, pos)
    }, 0)
  }

  const sendMentionNotifications = async (postId: string, postContent: string) => {
    const supabase = createClient()
    const authorName = userProfile?.first_name || 'Quelqu\'un'

    // @all — admin seulement
    if (isAdmin && postContent.includes('@all')) {
      const { data: allProfiles } = await supabase.from('profiles').select('id').eq('is_active', true)
      if (allProfiles) {
        await Promise.all(
          allProfiles
            .filter(p => p.id !== userId && p.id !== GHOST_ID)
            .map(p => notify({
              userId: p.id,
              type: 'community',
              dbType: 'mention',
              content: `a publié un message pour toute la communauté`,
              link: `/feed`,
              fromUserId: userId,
            }))
        )
      }
      return
    }

    // Mentions individuelles @PrénomNom
    const mentionRegex = /@([^\s]+)/g
    const matches = [...postContent.matchAll(mentionRegex)]
    const mentionedNames = [...new Set(matches.map(m => m[1].toLowerCase()))]

    for (const tag of mentionedNames) {
      const member = allMembers.find(m =>
        `${m.first_name}${m.last_name}`.toLowerCase() === tag ||
        m.first_name.toLowerCase() === tag
      )
      if (member && member.id !== userId) {
        await notify({
          userId: member.id,
          type: 'community',
          dbType: 'mention',
          content: `t'a mentionné dans une publication`,
          link: `/feed?post=${postId}`,
          fromUserId: userId,
        })
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() && !title.trim() && !mediaFile) return
    setLoading(true)
    const supabase = createClient()

    let image_url = null
    if (mediaFile) {
      const ext = mediaFile.name.split('.').pop()
      const path = `${userId}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('posts').upload(path, mediaFile, { upsert: true })
      if (!error) {
        const { data } = supabase.storage.from('posts').getPublicUrl(path)
        image_url = data.publicUrl
      }
    }

    const fullContent = title.trim() ? `**${title.trim()}**\n${content.trim()}` : content.trim()
    const { data: newPost } = await supabase
      .from('posts')
      .insert({ content: fullContent, author_id: userId, image_url })
      .select('id')
      .single()

    if (newPost?.id) {
      await sendMentionNotifications(newPost.id, fullContent)
      // Tracking défi "Partage ton actu" (0 XP, sert au suivi du défi)
      if (userId) awardXp(userId, 'post_created')
    }

    setLoading(false)
    onSuccess()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: 'white', borderRadius: '16px',
          width: '100%', maxWidth: '620px', maxHeight: '90vh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {/* Header modale */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid #F5F0E8' }}>
          <span style={{ fontFamily: 'var(--font-clash)', fontWeight: 700, fontSize: '1.1rem', color: '#2D2D2D' }}>Créer une publication</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#2D2D2D', opacity: 0.5 }}>✕</button>
        </div>

        {/* Corps */}
        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Auteur */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%',
              backgroundColor: '#E8501A', color: 'white', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: '0.85rem', overflow: 'hidden',
            }}>
              {userProfile?.avatar_url
                ? <img src={userProfile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : initials}
            </div>
            <span style={{ fontWeight: 600, color: '#2D2D2D' }}>{userProfile?.first_name}</span>
          </div>

          {/* Titre facultatif */}
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Titre (facultatif)"
            style={{
              border: 'none', outline: 'none', fontSize: '1.3rem',
              fontWeight: 700, color: '#2D2D2D', fontFamily: 'var(--font-clash)',
              width: '100%', backgroundColor: 'transparent',
            }}
          />

          {/* Contenu + autocomplete mentions */}
          <div style={{ position: 'relative' }}>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              placeholder={isAdmin ? "Rédigez quelque chose… Tapez @ pour mentionner ou @all pour tout le monde" : "Rédigez quelque chose… Tapez @ pour mentionner quelqu'un"}
              rows={3}
              style={{
                border: 'none', outline: 'none', resize: 'none',
                fontSize: '1rem', color: '#2D2D2D', fontFamily: 'inherit',
                backgroundColor: 'transparent', width: '100%', overflow: 'hidden',
                minHeight: '80px',
              }}
            />
            {/* Dropdown suggestions mentions */}
            {mentionSuggestions.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0,
                backgroundColor: 'white', borderRadius: '10px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                zIndex: 10, width: '100%', overflow: 'hidden',
              }}>
                {mentionSuggestions.map(m => (
                  <div
                    key={m.id}
                    onMouseDown={e => { e.preventDefault(); insertMention(m) }}
                    style={{
                      padding: '0.6rem 1rem', cursor: 'pointer',
                      fontSize: '0.9rem', color: '#2D2D2D',
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F5F0E8')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    {m.id === '__all__' ? (
                      <>
                        <span style={{ fontSize: '1rem' }}>📢</span>
                        <span><strong>@all</strong> — notifier tous les membres</span>
                      </>
                    ) : (
                      <>
                        <div style={{
                          width: '26px', height: '26px', borderRadius: '50%',
                          backgroundColor: '#E8501A', color: 'white',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.7rem', fontWeight: 700, flexShrink: 0,
                        }}>
                          {m.first_name[0]}{m.last_name[0]}
                        </div>
                        <span><strong>{m.first_name}</strong> {m.last_name}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Prévisualisation média */}
          {mediaPreview && (
            <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', aspectRatio: '4/5', backgroundColor: '#F5F0E8' }}>
              {mediaType === 'video'
                ? <video src={mediaPreview} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <img src={mediaPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              }
              <button
                type="button"
                onClick={removeMedia}
                style={{
                  position: 'absolute', top: '8px', right: '8px',
                  backgroundColor: 'rgba(0,0,0,0.5)', color: 'white',
                  border: 'none', borderRadius: '50%', width: '28px', height: '28px',
                  cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >✕</button>
            </div>
          )}

          {/* Actions bas */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid #F5F0E8' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => { fileRef.current.accept = 'image/*'; fileRef.current?.click() }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                title="Ajouter une image"
              >
                <img src="/icons/image.svg" alt="Image" style={{ width: '26px', height: '26px', opacity: 0.4, filter: 'brightness(0)' }} />
              </button>
              <button
                type="button"
                onClick={() => { fileRef.current.accept = 'video/*'; fileRef.current?.click() }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                title="Ajouter une vidéo"
              >
                <img src="/icons/video.svg" alt="Vidéo" style={{ width: '26px', height: '26px', opacity: 0.4, filter: 'brightness(0)' }} />
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleMediaSelect}
              style={{ display: 'none' }}
            />

            <button
              type="submit"
              disabled={loading || (!content.trim() && !title.trim() && !mediaFile)}
              style={{
                backgroundColor: (content.trim() || title.trim() || mediaFile) ? '#E8501A' : '#E8E3D9',
                color: (content.trim() || title.trim() || mediaFile) ? 'white' : '#999',
                border: 'none', borderRadius: '8px',
                padding: '0.5rem 1.5rem',
                fontSize: '0.9rem', fontWeight: 600,
                cursor: (content.trim() || title.trim() || mediaFile) ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
              }}
            >
              {loading ? '...' : 'Publier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Vues d'un post (admin uniquement) : icône oeil + compteur + infobulle.
function PostViews({ postId, adminId }: { postId: string; adminId: string }) {
  const [data, setData] = useState<{ count: number; viewers: { id: string; name: string }[] } | null>(null)
  const [hover, setHover] = useState(false)
  const [enabled, setEnabled] = useState(true)
  useEffect(() => {
    const read = () => { try { setEnabled(localStorage.getItem('meello:admin-show-post-views') !== 'false') } catch {} }
    read()
    window.addEventListener('meello:admin-options-changed', read)
    return () => window.removeEventListener('meello:admin-options-changed', read)
  }, [])
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    fetch(`/api/post-views?postId=${postId}&adminId=${adminId}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setData(d) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [postId, adminId, enabled])
  if (!enabled || !data) return null
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#2D2D2D', opacity: 0.5, fontSize: '0.78rem', cursor: 'default' }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
      </svg>
      {data.count}
      {hover && data.count > 0 && (
        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '0.4rem', backgroundColor: '#2D2D2E', color: 'white', borderRadius: '8px', padding: '0.5rem 0.7rem', fontSize: '0.78rem', whiteSpace: 'nowrap', zIndex: 50, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 6px 20px rgba(0,0,0,0.25)' }}>
          {data.viewers.map(v => <div key={v.id} style={{ padding: '0.1rem 0' }}>{v.name}</div>)}
        </div>
      )}
    </div>
  )
}

function PostCard({ post, currentUserId, onRefresh, allMembers = [] }: { post: Post, currentUserId: string | null, onRefresh: () => void, allMembers?: { id: string; first_name: string; last_name: string }[] }) {
  const [comment, setComment] = useState('')
  const [comments, setComments] = useState<{ id: string; content: string; author_id: string; parent_id: string | null; profiles: { first_name: string; last_name: string; avatar_url: string | null; activity: string | null } }[]>([])
  const [commentCount, setCommentCount] = useState(0)
  const [showComments, setShowComments] = useState(false)
  const [reactions, setReactions] = useState<{ emoji: string; author_id: string; profiles?: { first_name: string; last_name: string } | null }[]>([])
  const [reactionPopover, setReactionPopover] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editingPost, setEditingPost] = useState(false)
  const [editPostContent, setEditPostContent] = useState(post.content || '')
  const [editImageUrl, setEditImageUrl] = useState<string | null>(post.image_url || null)
  const [editImageFile, setEditImageFile] = useState<File | null>(null)
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null)
  const editFileRef = useRef<HTMLInputElement>(null)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editCommentContent, setEditCommentContent] = useState('')
  const [commentMentionSuggestions, setCommentMentionSuggestions] = useState<{ id: string; first_name: string; last_name: string }[]>([])
  const commentInputRef = useRef<HTMLTextAreaElement>(null)
  const [replyingTo, setReplyingTo] = useState<{ id: string; first_name: string } | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [replyMentionSuggestions, setReplyMentionSuggestions] = useState<{ id: string; first_name: string; last_name: string }[]>([])
  const replyInputRef = useRef<HTMLTextAreaElement>(null)
  const commentSendingRef = useRef(false)
  const replySendingRef = useRef(false)

  const ADMIN_ID = '13cdb485-42e0-48df-b2f8-14dc77dd895a'
  const EQUIPE_ID = '00000000-0000-0000-0000-000000000001'
  const profile = post.profiles
  const initials = profile ? `${(profile.first_name || '?')[0]}${(profile.last_name || '')[0] || ''}` : '?'
  const formattedDate = new Date(post.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

  // Enregistrer une vue quand le post apparaît à l'écran (une seule fois).
  const cardRef = useRef<HTMLDivElement>(null)
  const viewedRef = useRef(false)
  useEffect(() => {
    if (!currentUserId || !post.id) return
    if (post.author_id === currentUserId) return // pas sa propre vue
    const el = cardRef.current
    if (!el) return
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && !viewedRef.current) {
          viewedRef.current = true
          obs.disconnect()
          const supabase = createClient()
          supabase.from('post_views')
            .upsert({ post_id: post.id, user_id: currentUserId }, { onConflict: 'post_id,user_id', ignoreDuplicates: true })
            .then(() => {})
        }
      }
    }, { threshold: 0.5 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [currentUserId, post.id, post.author_id])
  const isOwner = currentUserId === post.author_id
  const isCurrentUserAdmin = currentUserId === ADMIN_ID
  const isAdmin = post.author_id === ADMIN_ID || post.author_id === EQUIPE_ID

  useEffect(() => {
    loadReactions()
    loadCommentCount()
  }, [post.id])

  const loadCommentCount = async () => {
    const supabase = createClient()
    const { count } = await supabase
      .from('comments')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', post.id)
    setCommentCount(count || 0)
  }

  const loadReactions = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('reactions')
      .select('emoji, author_id, profiles(first_name, last_name, avatar_url)')
      .eq('post_id', post.id)
    if (data) setReactions(data)
  }

  const handleReaction = async (emoji: string) => {
    if (!currentUserId) return
    const supabase = createClient()
    const existing = reactions.find(r => r.author_id === currentUserId)
    if (existing) {
      await supabase.from('reactions').delete().eq('post_id', post.id).eq('author_id', currentUserId)
      if (existing.emoji !== emoji) {
        await supabase.from('reactions').insert({ post_id: post.id, author_id: currentUserId, emoji })
        // Notifier l'auteur du post (sauf si c'est soi-même)
        if (post.author_id && post.author_id !== currentUserId) {
          await notify({
            userId: post.author_id,
            type: 'community',
            dbType: 'reaction',
            content: `a réagi à ton post avec ${emoji}`,
            link: `/feed?post=${post.id}`,
            fromUserId: currentUserId,
          })
        }
      }
    } else {
      await supabase.from('reactions').insert({ post_id: post.id, author_id: currentUserId, emoji })
      // XP : seulement pour l'ajout d'une réaction (pas le changement d'emoji),
      // et pas pour réagir à son propre post.
      if (post.author_id !== currentUserId) {
        awardXp(currentUserId, 'like_post')
      }
      // Notifier l'auteur du post (sauf si c'est soi-même)
      if (post.author_id && post.author_id !== currentUserId) {
        await notify({
          userId: post.author_id,
          type: 'community',
          dbType: 'reaction',
          content: `a réagi à ton post avec ${emoji}`,
          link: `/feed?post=${post.id}`,
          fromUserId: currentUserId,
        })
      }
    }
    loadReactions()
  }

  const handleDelete = async () => {
    if (!confirm('Supprimer ce post ?')) return
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('posts').delete().eq('id', post.id)
    onRefresh()
  }

  const togglePin = async () => {
    const supabase = createClient()
    await supabase.from('posts').update({ pinned: !post.pinned }).eq('id', post.id)
    onRefresh()
  }

  const handleEditPost = async () => {
    if (!editPostContent.trim()) return
    const supabase = createClient()
    let finalImageUrl = editImageUrl

    // Nouveau fichier uploadé
    if (editImageFile) {
      const ext = editImageFile.name.split('.').pop()
      const path = `${post.author_id}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('posts').upload(path, editImageFile, { upsert: true })
      if (!error) {
        const { data } = supabase.storage.from('posts').getPublicUrl(path)
        finalImageUrl = data.publicUrl
      }
    }

    await supabase.from('posts').update({ content: editPostContent.trim(), image_url: finalImageUrl }).eq('id', post.id)
    setEditingPost(false)
    setEditImageFile(null)
    setEditImagePreview(null)
    onRefresh()
  }

  const handleEditComment = async (commentId: string) => {
    if (!editCommentContent.trim()) return
    const supabase = createClient()
    await supabase.from('comments').update({ content: editCommentContent.trim() }).eq('id', commentId)
    setEditingCommentId(null)
    loadComments()
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Supprimer ce commentaire ?')) return
    const supabase = createClient()
    await supabase.from('comments').delete().eq('id', commentId)
    setCommentCount(c => c - 1)
    loadComments()
  }

  const loadComments = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('comments')
      .select('id, content, author_id, parent_id, profiles(first_name, last_name, avatar_url, activity)')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true })
    if (data) setComments(data.map((c: any) => c.profiles ? { ...c, profiles: { ...c.profiles, first_name: titleCase(c.profiles.first_name), last_name: titleCase(c.profiles.last_name) } } : c) as unknown as typeof comments)
  }

  const toggleComments = () => {
    if (!showComments) loadComments()
    setShowComments(v => !v)
  }

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setComment(val)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'

    const cursor = e.target.selectionStart
    const textBefore = val.slice(0, cursor)
    const match = textBefore.match(/@([^\s]*)$/)
    if (match) {
      const q = match[1].toLowerCase()
      const filtered = allMembers.filter(m =>
        `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) && m.id !== currentUserId
      ).slice(0, 6)
      setCommentMentionSuggestions(filtered)
    } else {
      setCommentMentionSuggestions([])
    }
  }

  const slugifyName = (str: string) =>
    str.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]/g, '')

  const insertCommentMention = (member: { id: string; first_name: string; last_name: string }) => {
    const textarea = commentInputRef.current
    if (!textarea) return
    const cursor = textarea.selectionStart
    const textBefore = comment.slice(0, cursor)
    const textAfter = comment.slice(cursor)
    const atIndex = textBefore.lastIndexOf('@')
    const tag = `@${slugifyName(member.first_name)}${slugifyName(member.last_name)}`
    const newContent = textBefore.slice(0, atIndex) + tag + ' ' + textAfter
    setComment(newContent)
    setCommentMentionSuggestions([])
    setTimeout(() => {
      textarea.focus()
      const pos = atIndex + tag.length + 1
      textarea.setSelectionRange(pos, pos)
    }, 0)
  }

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (commentSendingRef.current) return
    if (!comment.trim()) return
    commentSendingRef.current = true
    const supabase = createClient()
    const commentContent = comment.trim()
    setComment('')
    await supabase.from('comments').insert({ post_id: post.id, content: commentContent, author_id: currentUserId })

    // XP : commenter un post (pas son propre post)
    if (post.author_id !== currentUserId) {
      awardXp(currentUserId, 'comment_post')
    }

    // Notifier l'auteur du post (sauf si c'est soi-même)
    if (post.author_id && post.author_id !== currentUserId) {
      await notify({
        userId: post.author_id,
        type: 'community',
        dbType: 'comment',
        content: `a commenté ton post`,
        link: `/feed?post=${post.id}`,
        fromUserId: currentUserId,
      })
    }

    // Notifier les membres mentionnés
    const mentionRegex = /@([^\s]+)/g
    const matches = [...commentContent.matchAll(mentionRegex)]
    const mentionedNames = [...new Set(matches.map(m => m[1].toLowerCase()))]
    for (const tag of mentionedNames) {
      const member = allMembers.find(m =>
        `${m.first_name}${m.last_name}`.toLowerCase() === tag ||
        m.first_name.toLowerCase() === tag
      )
      if (member && member.id !== currentUserId && member.id !== post.author_id) {
        await notify({
          userId: member.id,
          type: 'community',
          dbType: 'mention',
          content: `t'a mentionné dans un commentaire`,
          link: `/feed?post=${post.id}`,
          fromUserId: currentUserId,
        })
      }
    }

    if (commentInputRef.current) commentInputRef.current.style.height = 'auto'
    setCommentCount(c => c + 1)
    loadComments()
    commentSendingRef.current = false
  }

  const handleReplyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setReplyContent(val)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'
    const cursor = e.target.selectionStart
    const textBefore = val.slice(0, cursor)
    const match = textBefore.match(/@([^\s]*)$/)
    if (match) {
      const q = match[1].toLowerCase()
      setReplyMentionSuggestions(allMembers.filter(m =>
        `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) && m.id !== currentUserId
      ).slice(0, 5))
    } else {
      setReplyMentionSuggestions([])
    }
  }

  const insertReplyMention = (member: { id: string; first_name: string; last_name: string }) => {
    const textarea = replyInputRef.current
    if (!textarea) return
    const cursor = textarea.selectionStart
    const textBefore = replyContent.slice(0, cursor)
    const textAfter = replyContent.slice(cursor)
    const atIndex = textBefore.lastIndexOf('@')
    const tag = `@${slugifyName(member.first_name)}${slugifyName(member.last_name)}`
    const newContent = textBefore.slice(0, atIndex) + tag + ' ' + textAfter
    setReplyContent(newContent)
    setReplyMentionSuggestions([])
    setTimeout(() => {
      textarea.focus()
      const pos = atIndex + tag.length + 1
      textarea.setSelectionRange(pos, pos)
    }, 0)
  }

  const handleReply = async (e: React.FormEvent, parentComment: { id: string; author_id: string }) => {
    e.preventDefault()
    if (replySendingRef.current) return
    if (!replyContent.trim()) return
    replySendingRef.current = true
    const supabase = createClient()
    const content = replyContent.trim()
    setReplyContent('')
    await supabase.from('comments').insert({
      post_id: post.id,
      content,
      author_id: currentUserId,
      parent_id: parentComment.id,
    })
    // XP : répondre est aussi un commentaire (plafonné 3/jour côté serveur)
    if (parentComment.author_id !== currentUserId) {
      awardXp(currentUserId, 'comment_post')
    }
    // Notifier l'auteur du commentaire parent
    if (parentComment.author_id !== currentUserId) {
      await notify({
        userId: parentComment.author_id,
        type: 'community',
        dbType: 'comment',
        content: `a répondu à ton commentaire`,
        link: `/feed?post=${post.id}`,
        fromUserId: currentUserId,
      })
    }
    // Notifier les mentions
    const mentionRegex = /@([^\s]+)/g
    const matches = [...content.matchAll(mentionRegex)]
    for (const match of matches) {
      const tag = match[1].toLowerCase()
      const member = allMembers.find(m =>
        `${m.first_name}${m.last_name}`.toLowerCase() === tag || m.first_name.toLowerCase() === tag
      )
      if (member && member.id !== currentUserId && member.id !== parentComment.author_id) {
        await notify({
          userId: member.id,
          type: 'community',
          dbType: 'mention',
          content: `t'a mentionné dans une réponse`,
          link: `/feed?post=${post.id}`,
          fromUserId: currentUserId,
        })
      }
    }
    setReplyingTo(null)
    setCommentCount(c => c + 1)
    loadComments()
    replySendingRef.current = false
  }

  const reactionCounts = EMOJIS.map(emoji => ({
    emoji,
    count: reactions.filter(r => r.emoji === emoji).length,
    active: reactions.some(r => r.emoji === emoji && r.author_id === currentUserId),
  }))

  const totalReactions = reactions.length

  // Rendu du contenu avec titre en gras, liens et @mentions cliquables
  const renderContent = (text: string) => {
    // Gère : URLs, liens enrichis [texte](lien), et **gras**
    return text.split(/(https?:\/\/[^\s]+|\[[^\]]+\]\([^)]+\))/g).map((part, i) => {
      if (/^https?:\/\//.test(part)) {
        return <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: '#E8501A', textDecoration: 'underline' }}>{part}</a>
      }
      // Lien enrichi : [le qg](/qg) → texte orange cliquable, sans URL visible
      const mdLink = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      if (mdLink) {
        const href = mdLink[2]
        const isExternal = /^https?:\/\//.test(href)
        return <a key={i} href={href} {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})} style={{ color: '#E8501A', fontWeight: 700, textDecoration: 'none' }}>{mdLink[1].replace(/\*\*/g, '')}</a>
      }
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>
      }
      return part
    })
  }

  // Rendu d'un texte de commentaire/réponse avec @mentions et liens cliquables
  const renderCommentText = (text: string) => {
    return text.split(/(https?:\/\/[^\s]+|@\[[^\]]+\]\([^)]+\)|\[[^\]]+\]\([^)]+\)|@[^\s]+)/g).map((part, i) => {
      if (/^https?:\/\//.test(part)) {
        return <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: '#E8501A', textDecoration: 'underline', wordBreak: 'break-all' }}>{part}</a>
      }
      const mentionWithId = part.match(/^@\[([^\]]+)\]\(([^)]+)\)$/)
      if (mentionWithId) {
        return <a key={i} href={`/membre/${mentionWithId[2]}`} style={{ color: '#E8501A', fontWeight: 600, textDecoration: 'none' }}>@{mentionWithId[1]}</a>
      }
      const mdLink = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      if (mdLink) {
        return <a key={i} href={mdLink[2]} style={{ color: '#E8501A', fontWeight: 700, textDecoration: 'none' }}>{mdLink[1].replace(/\*\*/g, '')}</a>
      }
      if (/^@/.test(part)) {
        const slugify = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
        const tag = slugify(part.slice(1))
        const member = allMembers.find(m =>
          slugify(`${m.first_name}${m.last_name}`) === tag ||
          slugify(m.first_name) === tag
        )
        if (member) {
          return <a key={i} href={`/membre/${member.id}`} style={{ color: '#E8501A', fontWeight: 600, textDecoration: 'none' }}>{part}</a>
        }
        return <span key={i} style={{ color: '#E8501A', fontWeight: 600 }}>{part}</span>
      }
      return part
    })
  }

  // Séparer titre et contenu si le post a un titre
  const lines = post.content?.split('\n') || []
  const hasTitle = lines[0]?.startsWith('**') && lines[0]?.endsWith('**')
  const postTitle = hasTitle ? lines[0].slice(2, -2) : null
  const postBody = hasTitle ? lines.slice(1).join('\n') : post.content

  return (
    <div ref={cardRef} style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', opacity: deleting ? 0.5 : 1 }} onClick={() => setReactionPopover(null)}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.85rem' }}>
        <AvatarNiveau avatarUrl={profile?.avatar_url} xp={profile?.xp ?? 0} initials={initials} size={40} userId={post.author_id} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, color: '#2D2D2D', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <a href={`/membre/${post.author_id}`} style={{ color: '#2D2D2D', textDecoration: 'none', fontWeight: 600 }}
              onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
            >
              {profile ? `${profile.first_name} ${profile.last_name}` : 'Membre'}
            </a>
            {isAdmin && (
              <img src="/icons/badge-check.svg" alt="Admin" title="Fondateur Meello" style={{ width: '16px', height: '16px', flexShrink: 0 }} />
            )}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#2D2D2D', opacity: 0.5 }}>
            {profile?.activity} · {formattedDate}
          </div>
          {(() => {
            const isNew = profile?.member_since && !profile?.hide_new_badge
              ? (Date.now() - new Date(profile.member_since).getTime()) < 30 * 24 * 60 * 60 * 1000
              : false
            const badges = (profile?.badges || []).filter((b: string) => b !== 'nouveau' && b !== 'profil_complet' && b !== 'nouveau membre')
            const allBadges = isNew ? ['nouveau', ...badges] : badges
            return allBadges.length > 0 ? (
              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                {allBadges.map((b: string) => (
                  <span key={b} style={{
                    backgroundColor: b === 'nouveau' ? '#F5A623' : b === 'membre_fondateur' ? '#6B4FA0' : '#E8501A',
                    color: 'white', fontSize: '0.65rem', fontWeight: 600,
                    padding: '0.1rem 0.45rem', borderRadius: '20px',
                  }}>
                    {b === 'fondateur' ? 'Fondateur' : b === 'partenaire' ? 'Partenaire' : b === 'membre_fondateur' ? 'Membre fondateur' : 'Nouveau membre'}
                  </span>
                ))}
              </div>
            ) : null
          })()}
        </div>
        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
          {isCurrentUserAdmin && post.id && (
            <PostViews postId={post.id} adminId={currentUserId!} />
          )}
          {isCurrentUserAdmin && (
            <button
              onClick={togglePin}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center' }}
              title={post.pinned ? 'Désépingler ce post' : 'Épingler ce post'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill={post.pinned ? '#E8501A' : 'none'} stroke={post.pinned ? '#E8501A' : '#2D2D2D'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: post.pinned ? 1 : 0.3 }}>
                <line x1="12" y1="17" x2="12" y2="22"/>
                <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>
              </svg>
            </button>
          )}
          {(isOwner || isCurrentUserAdmin) && (
            <>
              {isOwner && (
                <button
                  onClick={() => { setEditingPost(true); setEditPostContent(post.content || '') }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center' }}
                  title="Modifier ce post"
                >
                  <img src="/icons/edit.svg" alt="Modifier" style={{ width: '16px', height: '16px', filter: 'brightness(0) opacity(0.3)' }} />
                </button>
              )}
              <button
                onClick={handleDelete}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center' }}
                title="Supprimer ce post"
              >
                <img src="/icons/trash.svg" alt="Supprimer" style={{ width: '16px', height: '16px', filter: 'brightness(0) opacity(0.3)' }} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Badge épinglé */}
      {post.pinned && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.5rem' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="#E8501A" stroke="#E8501A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="17" x2="12" y2="22"/>
            <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>
          </svg>
          <span style={{ fontSize: '0.72rem', color: '#E8501A', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Épinglé</span>
        </div>
      )}

      {/* Contenu ou mode édition */}
      {editingPost ? (
        <div style={{ marginBottom: '0.75rem' }}>
          <textarea
            value={editPostContent}
            onChange={e => setEditPostContent(e.target.value)}
            rows={4}
            style={{ width: '100%', border: '1px solid #E8E3D9', borderRadius: '8px', padding: '0.5rem 0.75rem', fontSize: '0.95rem', outline: 'none', fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box' }}
          />

          {/* Aperçu image en mode édition */}
          {(editImagePreview || editImageUrl) && (
            <div style={{ position: 'relative', marginTop: '0.75rem', borderRadius: '10px', overflow: 'hidden', aspectRatio: '4/5', backgroundColor: '#F5F0E8' }}>
              {(() => {
                const src = editImagePreview || editImageUrl!
                return src.match(/\.(mp4|mov|webm)$/i)
                  ? <video src={src} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              })()}
              <button
                type="button"
                onClick={() => { setEditImageUrl(null); setEditImageFile(null); setEditImagePreview(null) }}
                style={{
                  position: 'absolute', top: '8px', right: '8px',
                  backgroundColor: 'rgba(0,0,0,0.55)', color: 'white',
                  border: 'none', borderRadius: '50%', width: '28px', height: '28px',
                  cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >✕</button>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => editFileRef.current?.click()}
              style={{ background: 'none', border: '1px solid #E8E3D9', borderRadius: '8px', padding: '0.4rem 0.75rem', cursor: 'pointer', fontSize: '0.82rem', color: '#2D2D2D', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <img src="/icons/image.svg" alt="" style={{ width: '14px', height: '14px', filter: 'brightness(0) opacity(0.6)' }} />
              {editImageUrl || editImagePreview ? 'Changer' : 'Ajouter une image'}
            </button>
            <input ref={editFileRef} type="file" accept="image/*,video/*" style={{ display: 'none' }}
              onChange={async e => {
                const f = e.target.files?.[0]
                if (!f) return
                if (f.type.startsWith('video')) {
                  setEditImageFile(f)
                  setEditImagePreview(URL.createObjectURL(f))
                } else {
                  const compressed = await imageCompression(f, {
                    maxSizeMB: 0.8,
                    maxWidthOrHeight: 1400,
                    useWebWorker: true,
                  })
                  setEditImageFile(compressed as File)
                  setEditImagePreview(URL.createObjectURL(compressed))
                }
                setEditImageUrl(null)
              }}
            />
            <button onClick={handleEditPost} style={{ backgroundColor: '#E8501A', color: 'white', border: 'none', borderRadius: '8px', padding: '0.4rem 1rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>Enregistrer</button>
            <button onClick={() => { setEditingPost(false); setEditImageFile(null); setEditImagePreview(null); setEditImageUrl(post.image_url || null) }} style={{ background: 'none', border: '1px solid #E8E3D9', borderRadius: '8px', padding: '0.4rem 1rem', cursor: 'pointer', fontSize: '0.85rem', color: '#2D2D2D' }}>Annuler</button>
          </div>
        </div>
      ) : (
        <>
          {postTitle && (
            <div style={{ fontFamily: 'var(--font-clash)', fontWeight: 700, fontSize: '1.15rem', color: '#2D2D2D', marginBottom: '0.4rem' }}>
              {postTitle}
            </div>
          )}
          {postBody && (
            <p style={{ color: '#2D2D2D', lineHeight: 1.65, margin: '0 0 0.75rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {postBody.split(/(https?:\/\/[^\s]+|@\[[^\]]+\]\([^)]+\)|@[^\s]+|\[[^\]]+\]\([^)]+\))/g).map((part, i) => {
                // Mention avec ID : @[Prénom](userId)
                const mentionWithId = part.match(/^@\[([^\]]+)\]\(([^)]+)\)$/)
                if (mentionWithId) {
                  return <a key={i} href={`/membre/${mentionWithId[2]}`} style={{ color: '#E8501A', fontWeight: 600, textDecoration: 'none' }}>@{mentionWithId[1]}</a>
                }
                // Lien markdown [texte](url)
                const mdLink = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
                if (mdLink) {
                  return (
                    <a key={i} href={mdLink[2]} style={{ color: '#E8501A', fontWeight: 700, textDecoration: 'none' }}>
                      {mdLink[1]}
                    </a>
                  )
                }
                if (/^https?:\/\//.test(part)) {
                  return <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: '#E8501A', textDecoration: 'underline' }}>{part}</a>
                }
                if (/^@/.test(part)) {
                  const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
                  const tag = normalize(part.slice(1))
                  const member = allMembers.find(m =>
                    normalize(`${m.first_name}${m.last_name}`) === tag ||
                    normalize(m.first_name) === tag
                  )
                  if (member) {
                    return <a key={i} href={`/membre/${member.id}`} style={{ color: '#E8501A', fontWeight: 600, textDecoration: 'none' }}>{part}</a>
                  }
                  return <span key={i} style={{ color: '#E8501A', fontWeight: 600 }}>{part}</span>
                }
                return part
              })}
            </p>
          )}
        </>
      )}

      {/* Image ou vidéo (masquée en mode édition, gérée dans le bloc édition) */}
      {!editingPost && post.image_url && (
        <div style={{ borderRadius: '10px', overflow: 'hidden', marginBottom: '0.75rem', backgroundColor: '#F5F0E8', aspectRatio: '4/5' }}>
          {post.image_url.match(/\.(mp4|mov|webm)$/i)
            ? <video src={post.image_url} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <img src={post.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }} />
          }
        </div>
      )}

      {/* Réactions + Commenter */}
      <div style={{ paddingTop: '0.75rem', borderTop: '1px solid #F5F0E8', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        {reactionCounts.map(({ emoji, count, active }) => (
          <button
            key={emoji}
            onClick={() => handleReaction(emoji)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
              padding: '0.3rem 0.65rem', borderRadius: '20px',
              border: active ? '1.5px solid #E8501A' : '1.5px solid #E8E3D9',
              backgroundColor: active ? 'rgba(232,80,26,0.08)' : 'transparent',
              cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600,
              color: active ? '#E8501A' : '#2D2D2D', transition: 'all 0.15s',
            }}
          >
            {emoji}
          </button>
        ))}
        {reactions.length > 0 && (
          <button
            onClick={e => { e.stopPropagation(); setReactionPopover('open') }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.82rem', color: '#2D2D2D', opacity: 0.5, fontWeight: 600, padding: '0.2rem 0.4rem' }}
          >
            {reactions.length} réaction{reactions.length > 1 ? 's' : ''}
          </button>
        )}
        {reactionPopover === 'open' && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setReactionPopover(null)}>
            <div onClick={e => e.stopPropagation()} style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.25rem', width: '100%', maxWidth: '360px', maxHeight: '70vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#2D2D2D' }}>{reactions.length} réaction{reactions.length > 1 ? 's' : ''}</span>
                <button onClick={() => setReactionPopover(null)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#2D2D2D', opacity: 0.4, lineHeight: 1 }}>×</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {reactions.map((r, i) => {
                  const initials = `${(r.profiles?.first_name || '?')[0]}${(r.profiles?.last_name || '')[0] || ''}`.toUpperCase()
                  const isAdmin = r.author_id === ADMIN_ID
                  return (
                    <a key={i} href={`/membre/${r.author_id}`} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none' }} onClick={() => setReactionPopover(null)}>
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <div style={{ width: '38px', height: '38px', borderRadius: '50%', backgroundColor: '#E8501A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem', overflow: 'hidden' }}>
                          {(r as any).profiles?.avatar_url
                            ? <img src={(r as any).profiles.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : initials}
                        </div>
                        <span style={{ position: 'absolute', bottom: -2, right: -4, fontSize: '0.9rem', lineHeight: 1 }}>{r.emoji}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#2D2D2D' }}>{r.profiles?.first_name} {r.profiles?.last_name}</span>
                        {isAdmin && <img src="/icons/badge-check.svg" alt="Vérifié" style={{ width: '14px', height: '14px', flexShrink: 0 }} />}
                      </div>
                    </a>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        <button
          onClick={toggleComments}
          style={{
            marginLeft: 'auto', background: 'none', border: 'none',
            color: showComments ? '#E8501A' : '#2D2D2D',
            fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', padding: 0,
            display: 'flex', alignItems: 'center', gap: '0.35rem',
          }}
        >
          <img
            src="/icons/comment.svg"
            alt="Commenter"
            style={{
              width: '16px', height: '16px',
              filter: showComments
                ? 'brightness(0) saturate(100%) invert(35%) sepia(90%) saturate(700%) hue-rotate(350deg)'
                : 'brightness(0) opacity(0.4)',
            }}
          />
          {commentCount > 0 ? `${commentCount} commentaire${commentCount > 1 ? 's' : ''}` : 'Commenter'}
        </button>
      </div>

      {/* Commentaires */}
      {showComments && (
        <div style={{ marginTop: '0.75rem' }}>
          {comments.filter(c => !c.parent_id).map(c => (
            <div key={c.id}>
              {/* Commentaire principal */}
              <div style={{ padding: '0.5rem 0', borderBottom: '1px solid #F5F0E8', fontSize: '0.9rem', color: '#2D2D2D' }}>
                {editingCommentId === c.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <input
                      value={editCommentContent}
                      onChange={e => setEditCommentContent(e.target.value)}
                      style={{ border: '1px solid #E8E3D9', borderRadius: '8px', padding: '0.4rem 0.75rem', fontSize: '0.9rem', outline: 'none', fontFamily: 'inherit' }}
                    />
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button onClick={() => handleEditComment(c.id)} style={{ backgroundColor: '#E8501A', color: 'white', border: 'none', borderRadius: '6px', padding: '0.3rem 0.75rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>Enregistrer</button>
                      <button onClick={() => setEditingCommentId(null)} style={{ background: 'none', border: '1px solid #E8E3D9', borderRadius: '6px', padding: '0.3rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem' }}>Annuler</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', flex: 1 }}>
                      <a href={`/membre/${c.author_id}`} style={{ textDecoration: 'none', flexShrink: 0 }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#E8501A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, overflow: 'hidden' }}>
                          {c.profiles?.avatar_url ? <img src={c.profiles.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : `${(c.profiles?.first_name || '?')[0]}${(c.profiles?.last_name || '')[0] || ''}`}
                        </div>
                      </a>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <a href={`/membre/${c.author_id}`} style={{ fontWeight: 600, color: '#2D2D2D', textDecoration: 'none', fontSize: '0.9rem' }}
                            onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                            onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                          >{c.profiles?.first_name} {c.profiles?.last_name}</a>
                          {c.author_id === ADMIN_ID && <img src="/icons/badge-check.svg" alt="Vérifié" style={{ width: '14px', height: '14px', flexShrink: 0 }} />}
                        </div>
                        {c.profiles?.activity && <div style={{ fontSize: '0.75rem', color: '#2D2D2D', opacity: 0.5 }}>{c.profiles.activity}</div>}
                        <div style={{ fontSize: '0.9rem', color: '#2D2D2D', marginTop: '0.2rem', lineHeight: 1.5 }}>{renderCommentText(c.content)}</div>
                        <button
                          onClick={() => { setReplyingTo(replyingTo?.id === c.id ? null : { id: c.id, first_name: c.profiles?.first_name || '' }); setReplyContent('') }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: '#2D2D2D', opacity: 0.45, padding: '0.2rem 0', marginTop: '0.15rem', fontWeight: 600 }}
                        >
                          Répondre
                        </button>
                      </div>
                    </div>
                    {(c.author_id === currentUserId || isCurrentUserAdmin) && (
                      <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                        {c.author_id === currentUserId && (
                          <button onClick={() => { setEditingCommentId(c.id); setEditCommentContent(c.content) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0.1rem', display: 'flex', alignItems: 'center' }}>
                            <img src="/icons/edit.svg" alt="Modifier" style={{ width: '14px', height: '14px', filter: 'brightness(0) opacity(0.35)' }} />
                          </button>
                        )}
                        <button onClick={() => handleDeleteComment(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0.1rem', display: 'flex', alignItems: 'center' }}>
                          <img src="/icons/trash.svg" alt="Supprimer" style={{ width: '14px', height: '14px', filter: 'brightness(0) opacity(0.35)' }} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Réponses imbriquées */}
              {comments.filter(r => r.parent_id === c.id).map(r => (
                <div key={r.id} style={{ marginLeft: '2.5rem', padding: '0.4rem 0', borderBottom: '1px solid #F5F0E8', fontSize: '0.88rem', color: '#2D2D2D' }}>
                  {editingCommentId === r.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <input value={editCommentContent} onChange={e => setEditCommentContent(e.target.value)} style={{ border: '1px solid #E8E3D9', borderRadius: '8px', padding: '0.4rem 0.75rem', fontSize: '0.88rem', outline: 'none', fontFamily: 'inherit' }} />
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button onClick={() => handleEditComment(r.id)} style={{ backgroundColor: '#E8501A', color: 'white', border: 'none', borderRadius: '6px', padding: '0.3rem 0.75rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>Enregistrer</button>
                        <button onClick={() => setEditingCommentId(null)} style={{ background: 'none', border: '1px solid #E8E3D9', borderRadius: '6px', padding: '0.3rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem' }}>Annuler</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', flex: 1 }}>
                        <a href={`/membre/${r.author_id}`} style={{ textDecoration: 'none', flexShrink: 0 }}>
                          <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: '#E8501A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, overflow: 'hidden' }}>
                            {r.profiles?.avatar_url ? <img src={r.profiles.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : `${(r.profiles?.first_name || '?')[0]}${(r.profiles?.last_name || '')[0] || ''}`}
                          </div>
                        </a>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <a href={`/membre/${r.author_id}`} style={{ fontWeight: 600, color: '#2D2D2D', textDecoration: 'none', fontSize: '0.85rem' }}
                              onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                              onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                            >{r.profiles?.first_name} {r.profiles?.last_name}</a>
                            {r.author_id === ADMIN_ID && <img src="/icons/badge-check.svg" alt="Vérifié" style={{ width: '13px', height: '13px', flexShrink: 0 }} />}
                          </div>
                          {r.profiles?.activity && <div style={{ fontSize: '0.72rem', color: '#2D2D2D', opacity: 0.5 }}>{r.profiles.activity}</div>}
                          <div style={{ fontSize: '0.88rem', color: '#2D2D2D', marginTop: '0.15rem', lineHeight: 1.5 }}>{renderCommentText(r.content)}</div>
                          {/* Répondre à une réponse → même niveau, parent_id = c.id, pré-rempli @auteur */}
                          <button
                            onClick={() => {
                              const tag = `@${r.profiles?.first_name || ''}${r.profiles?.last_name || ''} `
                              setReplyingTo({ id: c.id, first_name: r.profiles?.first_name || '' })
                              setReplyContent(tag)
                              setTimeout(() => {
                                if (replyInputRef.current) {
                                  replyInputRef.current.focus()
                                  const pos = tag.length
                                  replyInputRef.current.setSelectionRange(pos, pos)
                                }
                              }, 50)
                            }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.72rem', color: '#2D2D2D', opacity: 0.4, padding: '0.15rem 0', marginTop: '0.1rem', fontWeight: 600 }}
                          >
                            Répondre
                          </button>
                        </div>
                      </div>
                      {(r.author_id === currentUserId || isCurrentUserAdmin) && (
                        <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                          {r.author_id === currentUserId && (
                            <button onClick={() => { setEditingCommentId(r.id); setEditCommentContent(r.content) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0.1rem', display: 'flex', alignItems: 'center' }}>
                              <img src="/icons/edit.svg" alt="Modifier" style={{ width: '13px', height: '13px', filter: 'brightness(0) opacity(0.35)' }} />
                            </button>
                          )}
                          <button onClick={() => handleDeleteComment(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0.1rem', display: 'flex', alignItems: 'center' }}>
                            <img src="/icons/trash.svg" alt="Supprimer" style={{ width: '13px', height: '13px', filter: 'brightness(0) opacity(0.35)' }} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Formulaire de réponse (commun à toutes les réponses du thread) */}
              {replyingTo?.id === c.id && (
                <form onSubmit={e => handleReply(e, c)} style={{ marginLeft: '2.5rem', marginTop: '0.4rem', marginBottom: '0.25rem', position: 'relative' }}>
                  {replyMentionSuggestions.length > 0 && (
                    <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, backgroundColor: 'white', borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', zIndex: 10, overflow: 'hidden', marginBottom: '4px' }}>
                      {replyMentionSuggestions.map(m => (
                        <div key={m.id} onMouseDown={e => { e.preventDefault(); insertReplyMention(m) }}
                          style={{ padding: '0.45rem 0.75rem', cursor: 'pointer', fontSize: '0.85rem', color: '#2D2D2D', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F5F0E8')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#E8501A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.58rem', fontWeight: 700 }}>
                            {m.first_name[0]}{m.last_name[0]}
                          </div>
                          <span><strong>{m.first_name}</strong> {m.last_name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-end' }}>
                    <textarea
                      ref={replyInputRef}
                      value={replyContent}
                      onChange={handleReplyChange}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(e as any, c) } }}
                      placeholder={`Répondre à ${replyingTo.first_name}…`}
                      rows={1}
                      autoFocus
                      onFocus={e => { const len = e.target.value.length; e.target.setSelectionRange(len, len); setTimeout(() => { e.target.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, 350) }}
                      style={{ flex: 1, border: '1px solid #E8E3D9', borderRadius: '8px', padding: '0.4rem 0.65rem', fontSize: '0.85rem', outline: 'none', fontFamily: 'inherit', resize: 'none', overflow: 'hidden', minHeight: '34px', lineHeight: '1.4' }}
                    />
                    <button type="submit" disabled={!replyContent.trim()} style={{ backgroundColor: '#E8501A', color: 'white', border: 'none', borderRadius: '8px', padding: '0.4rem 0.85rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', height: '34px', flexShrink: 0 }}>↩</button>
                    <button type="button" onClick={() => setReplyingTo(null)} style={{ background: 'none', border: '1px solid #E8E3D9', borderRadius: '8px', padding: '0.4rem 0.65rem', cursor: 'pointer', fontSize: '0.85rem', height: '34px', flexShrink: 0 }}>✕</button>
                  </div>
                </form>
              )}
            </div>
          ))}
          <form onSubmit={handleComment} style={{ marginTop: '0.75rem', position: 'relative' }}>
            {commentMentionSuggestions.length > 0 && (
              <div style={{
                position: 'absolute', bottom: '100%', left: 0, right: 0,
                backgroundColor: 'white', borderRadius: '10px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                zIndex: 10, overflow: 'hidden', marginBottom: '4px',
              }}>
                {commentMentionSuggestions.map(m => (
                  <div
                    key={m.id}
                    onMouseDown={e => { e.preventDefault(); insertCommentMention(m) }}
                    style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.88rem', color: '#2D2D2D', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F5F0E8')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#E8501A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, flexShrink: 0 }}>
                      {m.first_name[0]}{m.last_name[0]}
                    </div>
                    <span><strong>{m.first_name}</strong> {m.last_name}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
              <textarea
                ref={commentInputRef}
                value={comment}
                onChange={handleCommentChange}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleComment(e as any) } }}
                onFocus={e => { setTimeout(() => { e.target.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, 350) }}
                placeholder="Ton commentaire… (@nom pour mentionner)"
                rows={1}
                style={{ flex: 1, border: '1px solid #E8E3D9', borderRadius: '8px', padding: '0.5rem 0.75rem', fontSize: '0.9rem', outline: 'none', fontFamily: 'inherit', resize: 'none', overflow: 'hidden', minHeight: '38px', lineHeight: '1.4' }}
              />
              <button
                type="submit"
                disabled={!comment.trim()}
                style={{ backgroundColor: '#E8501A', color: 'white', border: 'none', borderRadius: '8px', padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: 600, flexShrink: 0, height: '38px' }}
              >
                OK
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
