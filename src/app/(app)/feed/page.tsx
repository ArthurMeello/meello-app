// @ts-nocheck
'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Post } from '@/types'

const EMOJIS = ['👍', '🔥', '❤️']

export default function FeedPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [showModal, setShowModal] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [userProfile, setUserProfile] = useState<{ first_name: string; avatar_url: string | null } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      setUserId(data.user.id)
      const { data: prof } = await supabase.from('profiles').select('first_name, avatar_url').eq('id', data.user.id).single()
      if (prof) setUserProfile(prof)
    })
    fetchPosts()
  }, [])

  const fetchPosts = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('posts')
      .select('*, profiles(first_name, last_name, avatar_url, activity, badges, member_since)')
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) setPosts(data as Post[])
  }

  const initials = userProfile?.first_name?.[0]?.toUpperCase() || '?'

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto' }}>
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

      {/* Posts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {posts.map(post => (
          <PostCard key={post.id} post={post} currentUserId={userId} onRefresh={fetchPosts} />
        ))}
        {posts.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#2D2D2D', opacity: 0.4 }}>
            Sois le premier à publier quelque chose !
          </div>
        )}
      </div>
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
      if (data) setAllMembers(data.filter(m => m.id !== userId))
    }
    load()
  }, [userId])

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setMediaFile(file)
    setMediaPreview(URL.createObjectURL(file))
    setMediaType(file.type.startsWith('video') ? 'video' : 'image')
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
    const match = textBefore.match(/@(\w*)$/)
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
        const notifs = allProfiles
          .filter(p => p.id !== userId)
          .map(p => ({
            user_id: p.id,
            type: 'mention',
            content: `${authorName} a publié un message pour toute la communauté`,
            link: `/feed`,
          }))
        if (notifs.length > 0) await supabase.from('notifications').insert(notifs)
      }
      return
    }

    // Mentions individuelles @PrénomNom
    const mentionRegex = /@(\w+)/g
    const matches = [...postContent.matchAll(mentionRegex)]
    const mentionedNames = [...new Set(matches.map(m => m[1].toLowerCase()))]

    for (const tag of mentionedNames) {
      const member = allMembers.find(m =>
        `${m.first_name}${m.last_name}`.toLowerCase() === tag ||
        m.first_name.toLowerCase() === tag
      )
      if (member && member.id !== userId) {
        const { error: notifError } = await supabase.from('notifications').insert({
          user_id: member.id,
          type: 'mention',
          content: `${authorName} t'a mentionné dans une publication`,
          link: `/membre/${member.id}`,
        })
        if (notifError) console.error('Notif mention error:', notifError)
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
    }} onClick={onClose}>
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

function PostCard({ post, currentUserId, onRefresh }: { post: Post, currentUserId: string | null, onRefresh: () => void }) {
  const [comment, setComment] = useState('')
  const [comments, setComments] = useState<{ id: string; content: string; author_id: string; profiles: { first_name: string; last_name: string } }[]>([])
  const [commentCount, setCommentCount] = useState(0)
  const [showComments, setShowComments] = useState(false)
  const [reactions, setReactions] = useState<{ emoji: string; author_id: string }[]>([])
  const [deleting, setDeleting] = useState(false)
  const [editingPost, setEditingPost] = useState(false)
  const [editPostContent, setEditPostContent] = useState(post.content || '')
  const [editImageUrl, setEditImageUrl] = useState<string | null>(post.image_url || null)
  const [editImageFile, setEditImageFile] = useState<File | null>(null)
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null)
  const editFileRef = useRef<HTMLInputElement>(null)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editCommentContent, setEditCommentContent] = useState('')

  const ADMIN_ID = '13cdb485-42e0-48df-b2f8-14dc77dd895a'
  const EQUIPE_ID = '00000000-0000-0000-0000-000000000001'
  const profile = post.profiles
  const initials = profile ? `${(profile.first_name || '?')[0]}${(profile.last_name || '')[0] || ''}` : '?'
  const formattedDate = new Date(post.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  const isOwner = currentUserId === post.author_id
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
      .select('emoji, author_id')
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
          await supabase.from('notifications').insert({
            user_id: post.author_id,
            type: 'reaction',
            content: `${post.profiles?.first_name || 'Quelqu\'un'} a réagi à ton post avec ${emoji}`,
            link: `/feed`,
            from_user_id: currentUserId,
          })
        }
      }
    } else {
      await supabase.from('reactions').insert({ post_id: post.id, author_id: currentUserId, emoji })
      // Notifier l'auteur du post (sauf si c'est soi-même)
      if (post.author_id && post.author_id !== currentUserId) {
        const { data: reactor } = await supabase.from('profiles').select('first_name').eq('id', currentUserId).single()
        await supabase.from('notifications').insert({
          user_id: post.author_id,
          type: 'reaction',
          content: `${reactor?.first_name || 'Quelqu\'un'} a réagi à ton post avec ${emoji}`,
          link: `/feed`,
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
      .select('id, content, author_id, profiles(first_name, last_name)')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true })
    if (data) setComments(data as unknown as typeof comments)
  }

  const toggleComments = () => {
    if (!showComments) loadComments()
    setShowComments(v => !v)
  }

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!comment.trim()) return
    const supabase = createClient()
    await supabase.from('comments').insert({ post_id: post.id, content: comment.trim(), author_id: currentUserId })
    // Notifier l'auteur du post (sauf si c'est soi-même)
    if (post.author_id && post.author_id !== currentUserId) {
      const { data: commenter } = await supabase.from('profiles').select('first_name').eq('id', currentUserId).single()
      await supabase.from('notifications').insert({
        user_id: post.author_id,
        type: 'comment',
        content: `${commenter?.first_name || 'Quelqu\'un'} a commenté ton post`,
        link: `/feed`,
      })
    }
    setComment('')
    setCommentCount(c => c + 1)
    loadComments()
  }

  const reactionCounts = EMOJIS.map(emoji => ({
    emoji,
    count: reactions.filter(r => r.emoji === emoji).length,
    active: reactions.some(r => r.emoji === emoji && r.author_id === currentUserId),
  }))

  const totalReactions = reactions.length

  // Rendu du contenu avec titre en gras et liens cliquables
  const renderContent = (text: string) => {
    return text.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
      /^https?:\/\//.test(part)
        ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: '#E8501A', textDecoration: 'underline' }}>{part}</a>
        : part.startsWith('**') && part.endsWith('**')
          ? <strong key={i}>{part.slice(2, -2)}</strong>
          : part
    )
  }

  // Séparer titre et contenu si le post a un titre
  const lines = post.content?.split('\n') || []
  const hasTitle = lines[0]?.startsWith('**') && lines[0]?.endsWith('**')
  const postTitle = hasTitle ? lines[0].slice(2, -2) : null
  const postBody = hasTitle ? lines.slice(1).join('\n') : post.content

  return (
    <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', opacity: deleting ? 0.5 : 1 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.85rem' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '50%',
          backgroundColor: '#E8501A', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: '0.85rem', flexShrink: 0, overflow: 'hidden',
        }}>
          {profile?.avatar_url
            ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            : initials}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, color: '#2D2D2D', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            {profile ? `${profile.first_name} ${profile.last_name}` : 'Membre'}
            {isAdmin && (
              <img src="/icons/badge-check.svg" alt="Admin" title="Fondateur Meello" style={{ width: '16px', height: '16px', flexShrink: 0 }} />
            )}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#2D2D2D', opacity: 0.5 }}>
            {profile?.activity} · {formattedDate}
          </div>
          {(() => {
            const isNew = profile?.member_since
              ? (Date.now() - new Date(profile.member_since).getTime()) < 30 * 24 * 60 * 60 * 1000
              : false
            const badges = (profile?.badges || []).filter((b: string) => b !== 'nouveau')
            const allBadges = isNew ? ['nouveau', ...badges] : badges
            return allBadges.length > 0 ? (
              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                {allBadges.map((b: string) => (
                  <span key={b} style={{
                    backgroundColor: b === 'nouveau' ? '#F5A623' : '#E8501A',
                    color: 'white', fontSize: '0.65rem', fontWeight: 600,
                    padding: '0.1rem 0.45rem', borderRadius: '20px',
                  }}>
                    {b === 'fondateur' ? 'Fondateur' : b === 'partenaire' ? 'Partenaire' : b === 'nouveau' ? 'Nouveau membre' : 'Profil complet'}
                  </span>
                ))}
              </div>
            ) : null
          })()}
        </div>
        {isOwner && (
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <button
              onClick={() => { setEditingPost(true); setEditPostContent(post.content || '') }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center' }}
              title="Modifier ce post"
            >
              <img src="/icons/edit.svg" alt="Modifier" style={{ width: '16px', height: '16px', filter: 'brightness(0) opacity(0.3)' }} />
            </button>
            <button
              onClick={handleDelete}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center' }}
              title="Supprimer ce post"
            >
              <img src="/icons/trash.svg" alt="Supprimer" style={{ width: '16px', height: '16px', filter: 'brightness(0) opacity(0.3)' }} />
            </button>
          </div>
        )}
      </div>

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
              onChange={e => {
                const f = e.target.files?.[0]
                if (!f) return
                setEditImageFile(f)
                setEditImagePreview(URL.createObjectURL(f))
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
              {postBody.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
                /^https?:\/\//.test(part)
                  ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: '#E8501A', textDecoration: 'underline' }}>{part}</a>
                  : part
              )}
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
            {emoji} {count > 0 && <span style={{ fontSize: '0.8rem' }}>{count}</span>}
          </button>
        ))}

        {totalReactions > 0 && (
          <span style={{ fontSize: '0.8rem', color: '#2D2D2D', opacity: 0.4 }}>
            {totalReactions} réaction{totalReactions > 1 ? 's' : ''}
          </span>
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
          {comments.map(c => (
            <div key={c.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid #F5F0E8', fontSize: '0.9rem', color: '#2D2D2D' }}>
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
                  <span>
                    <span style={{ fontWeight: 600 }}>{c.profiles?.first_name} {c.profiles?.last_name} </span>
                    {c.content}
                  </span>
                  {c.author_id === currentUserId && (
                    <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                      <button onClick={() => { setEditingCommentId(c.id); setEditCommentContent(c.content) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0.1rem', display: 'flex', alignItems: 'center' }}>
                        <img src="/icons/edit.svg" alt="Modifier" style={{ width: '14px', height: '14px', filter: 'brightness(0) opacity(0.35)' }} />
                      </button>
                      <button onClick={() => handleDeleteComment(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0.1rem', display: 'flex', alignItems: 'center' }}>
                        <img src="/icons/trash.svg" alt="Supprimer" style={{ width: '14px', height: '14px', filter: 'brightness(0) opacity(0.35)' }} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          <form onSubmit={handleComment} style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ton commentaire…"
              style={{ flex: 1, border: '1px solid #E8E3D9', borderRadius: '8px', padding: '0.5rem 0.75rem', fontSize: '0.9rem', outline: 'none', fontFamily: 'inherit' }}
            />
            <button
              type="submit"
              disabled={!comment.trim()}
              style={{ backgroundColor: '#E8501A', color: 'white', border: 'none', borderRadius: '8px', padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: 600 }}
            >
              OK
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
