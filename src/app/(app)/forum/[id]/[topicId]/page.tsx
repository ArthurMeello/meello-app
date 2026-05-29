// @ts-nocheck
'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Reply {
  id: string
  content: string
  created_at: string
  author_id: string
  profiles: { first_name: string; last_name: string; avatar_url: string | null; activity: string | null; city: string | null } | null
}

interface Topic {
  id: string
  title: string
  content: string
  created_at: string
  author_id: string
  profiles: { first_name: string; last_name: string; avatar_url: string | null; activity: string | null; city: string | null } | null
}

const ADMIN_ID = '13cdb485-42e0-48df-b2f8-14dc77dd895a'

// ─── Toolbar gras / italique ──────────────────────────────────────────────────
function applyFormat(
  textarea: HTMLTextAreaElement,
  tag: 'strong' | 'em',
  value: string,
  setValue: (v: string) => void
) {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selected = value.slice(start, end)
  if (!selected) return
  const open = `<${tag}>`
  const close = `</${tag}>`
  const newValue = value.slice(0, start) + open + selected + close + value.slice(end)
  setValue(newValue)
  setTimeout(() => {
    textarea.focus()
    textarea.setSelectionRange(start + open.length, end + open.length)
  }, 0)
}

function FormatToolbar({ textareaRef, value, setValue }: { textareaRef: React.RefObject<HTMLTextAreaElement>; value: string; setValue: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.35rem' }}>
      {[
        { tag: 'strong' as const, label: 'G', title: 'Gras', style: { fontWeight: 700 } },
        { tag: 'em' as const, label: 'I', title: 'Italique', style: { fontStyle: 'italic' } },
      ].map(({ tag, label, title, style }) => (
        <button
          key={tag}
          type="button"
          title={title}
          onMouseDown={e => {
            e.preventDefault()
            if (textareaRef.current) applyFormat(textareaRef.current, tag, value, setValue)
          }}
          style={{ ...style, background: 'none', border: '1px solid #E8E3D9', borderRadius: '5px', width: '28px', height: '26px', cursor: 'pointer', fontSize: '0.85rem', color: '#2D2D2D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export default function ForumTopicPage() {
  const { id: categoryId, topicId } = useParams()
  const router = useRouter()
  const [category, setCategory] = useState<{ id: string; name: string } | null>(null)
  const [topic, setTopic] = useState<Topic | null>(null)
  const [replies, setReplies] = useState<Reply[]>([])
  const [loading, setLoading] = useState(true)
  const [replyContent, setReplyContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentProfile, setCurrentProfile] = useState<any>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const editTopicRef = useRef<HTMLTextAreaElement>(null)
  const editReplyRef = useRef<HTMLTextAreaElement>(null)

  // Edition topic
  const [editingTopic, setEditingTopic] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [savingTopic, setSavingTopic] = useState(false)

  // Edition réponse
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null)
  const [editReplyContent, setEditReplyContent] = useState('')
  const [savingReply, setSavingReply] = useState(false)

  const isAdmin = currentUserId === ADMIN_ID

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
        const { data: prof } = await supabase.from('profiles').select('first_name, last_name, avatar_url').eq('id', user.id).single()
        if (prof) setCurrentProfile(prof)
      }

      const { data: cat } = await supabase.from('forum_categories').select('id, name').eq('id', categoryId).single()
      if (cat) setCategory(cat)

      const { data: topicData } = await supabase
        .from('forum_topics')
        .select('id, title, content, created_at, author_id, profiles!forum_topics_author_id_fkey(first_name, last_name, avatar_url, activity, city)')
        .eq('id', topicId)
        .single()
      if (topicData) setTopic(topicData)

      const { data: repliesData } = await supabase
        .from('forum_replies')
        .select('id, content, created_at, author_id, profiles!forum_replies_author_id_fkey(first_name, last_name, avatar_url, activity, city)')
        .eq('topic_id', topicId)
        .order('created_at', { ascending: true })
      if (repliesData) setReplies(repliesData)

      setLoading(false)
    }
    load()
  }, [categoryId, topicId])

  const submitReply = async () => {
    if (!replyContent.trim() || !currentUserId) return
    setSubmitting(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('forum_replies')
      .insert({ topic_id: topicId, author_id: currentUserId, content: replyContent.trim() })
      .select('id, content, created_at, author_id, profiles!forum_replies_author_id_fkey(first_name, last_name, avatar_url, activity, city)')
      .single()
    if (data) {
      setReplies(prev => [...prev, data])
      setReplyContent('')
      setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 100)
    }
    setSubmitting(false)
  }

  const saveTopic = async () => {
    if (!editTitle.trim() || !editContent.trim()) return
    setSavingTopic(true)
    const supabase = createClient()
    await supabase.from('forum_topics').update({ title: editTitle.trim(), content: editContent.trim() }).eq('id', topicId)
    setTopic(prev => prev ? { ...prev, title: editTitle.trim(), content: editContent.trim() } : prev)
    setEditingTopic(false)
    setSavingTopic(false)
  }

  const deleteTopic = async () => {
    if (!confirm('Supprimer ce sujet ? Cette action est irréversible.')) return
    const supabase = createClient()
    await supabase.from('forum_replies').delete().eq('topic_id', topicId)
    await supabase.from('forum_topics').delete().eq('id', topicId)
    router.push(`/forum/${categoryId}`)
  }

  const saveReply = async (replyId: string) => {
    if (!editReplyContent.trim()) return
    setSavingReply(true)
    const supabase = createClient()
    await supabase.from('forum_replies').update({ content: editReplyContent.trim() }).eq('id', replyId)
    setReplies(prev => prev.map(r => r.id === replyId ? { ...r, content: editReplyContent.trim() } : r))
    setEditingReplyId(null)
    setSavingReply(false)
  }

  const deleteReply = async (replyId: string) => {
    if (!confirm('Supprimer cette réponse ?')) return
    const supabase = createClient()
    await supabase.from('forum_replies').delete().eq('id', replyId)
    setReplies(prev => prev.filter(r => r.id !== replyId))
  }

  const formatDate = (d: string) => {
    const date = new Date(d)
    const now = new Date()
    const diff = (now.getTime() - date.getTime()) / 1000
    if (diff < 60) return 'à l\'instant'
    if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`
    if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`
    if (diff < 7 * 86400) return `il y a ${Math.floor(diff / 86400)} j`
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const Avatar = ({ profile, size = 40 }: { profile: any; size?: number }) => {
    const initials = `${(profile?.first_name || '?')[0]}${(profile?.last_name || '')[0] || ''}`.toUpperCase()
    return (
      <div style={{ width: `${size}px`, height: `${size}px`, borderRadius: '50%', backgroundColor: '#E8501A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: `${size * 0.35}px`, overflow: 'hidden', flexShrink: 0 }}>
        {profile?.avatar_url ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
      </div>
    )
  }

  const ActionButtons = ({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) => (
    <div style={{ display: 'flex', gap: '0.25rem', marginLeft: 'auto', flexShrink: 0 }}>
      <button onClick={onEdit} title="Modifier" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', borderRadius: '6px', display: 'flex', alignItems: 'center', opacity: 0.45 }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '0.45'}
      >
        <img src="/icons/pen-edit.svg" alt="Modifier" style={{ width: '14px', height: '14px', filter: 'brightness(0)' }} />
      </button>
      <button onClick={onDelete} title="Supprimer" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', borderRadius: '6px', display: 'flex', alignItems: 'center', opacity: 0.45 }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '0.45'}
      >
        <img src="/icons/trash.svg" alt="Supprimer" style={{ width: '14px', height: '14px', filter: 'brightness(0)' }} />
      </button>
    </div>
  )

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem', color: '#2D2D2D', opacity: 0.4 }}>Chargement...</div>
  if (!topic) return <div style={{ textAlign: 'center', padding: '3rem', color: '#2D2D2D', opacity: 0.4 }}>Sujet introuvable.</div>

  const canEditTopic = currentUserId === topic.author_id || isAdmin

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto' }}>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <Link href="/forum" style={{ color: '#E8501A', textDecoration: 'none', fontWeight: 600 }}>La Communauté</Link>
        <span style={{ color: '#2D2D2D', opacity: 0.4 }}>→</span>
        <Link href={`/forum/${categoryId}`} style={{ color: '#E8501A', textDecoration: 'none', fontWeight: 600 }}>{category?.name}</Link>
        <span style={{ color: '#2D2D2D', opacity: 0.4 }}>→</span>
        <span style={{ color: '#2D2D2D', opacity: 0.5, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{topic.title}</span>
      </div>

      {/* Sujet principal */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.75rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '1.25rem' }}>
        {editingTopic ? (
          <div>
            <input
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              style={{ width: '100%', border: '1.5px solid #E8501A', borderRadius: '10px', padding: '0.75rem 1rem', fontSize: '1rem', fontFamily: 'var(--font-clash)', fontWeight: 700, outline: 'none', boxSizing: 'border-box', marginBottom: '0.75rem' }}
            />
            <FormatToolbar textareaRef={editTopicRef} value={editContent} setValue={setEditContent} />
            <textarea
              ref={editTopicRef}
              value={editContent}
              onChange={e => {
                setEditContent(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = e.target.scrollHeight + 'px'
              }}
              onFocus={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
              rows={1}
              style={{ width: '100%', border: '1.5px solid #E8501A', borderRadius: '10px', padding: '0.75rem 1rem', fontSize: '0.95rem', fontFamily: 'inherit', outline: 'none', resize: 'none', boxSizing: 'border-box', overflow: 'hidden', minHeight: '120px' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setEditingTopic(false)} style={{ background: 'none', border: '1px solid #E8E3D9', borderRadius: '8px', padding: '0.4rem 0.9rem', cursor: 'pointer', fontSize: '0.88rem' }}>Annuler</button>
              <button onClick={saveTopic} disabled={savingTopic} style={{ backgroundColor: '#E8501A', color: 'white', border: 'none', borderRadius: '8px', padding: '0.4rem 1rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem' }}>
                {savingTopic ? '...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <h1 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.4rem', color: '#2D2D2D', margin: 0, flex: 1, fontWeight: 700 }}>{topic.title}</h1>
              {canEditTopic && (
                <ActionButtons
                  onEdit={() => { setEditTitle(topic.title); setEditContent(topic.content); setEditingTopic(true) }}
                  onDelete={deleteTopic}
                />
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
              <Link href={`/membre/${topic.author_id}`}><Avatar profile={topic.profiles} size={42} /></Link>
              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: '0.6rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Link href={`/membre/${topic.author_id}`} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span style={{ fontWeight: 700, color: '#2D2D2D', fontSize: '0.92rem' }}>{topic.profiles?.first_name} {topic.profiles?.last_name}</span>
                      {topic.author_id === ADMIN_ID && <img src="/icons/badge-check.svg" alt="Fondateur" style={{ width: '16px', height: '16px' }} />}
                    </Link>
                    <span style={{ fontSize: '0.75rem', color: '#2D2D2D', opacity: 0.35 }}>· {formatDate(topic.created_at)}</span>
                  </div>
                  {(topic.profiles?.activity || topic.profiles?.city) && (
                    <div style={{ fontSize: '0.78rem', color: '#2D2D2D', opacity: 0.45, marginTop: '0.1rem' }}>
                      {topic.profiles.activity}{topic.profiles.activity && topic.profiles.city ? ` à ${topic.profiles.city}` : topic.profiles.city ? `à ${topic.profiles.city}` : ''}
                    </div>
                  )}
                </div>
                <p style={{ color: '#2D2D2D', lineHeight: 1.7, margin: 0, fontSize: '0.95rem', whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: topic.content }} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Réponses */}
      {replies.length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#2D2D2D', opacity: 0.4, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
            {replies.length} réponse{replies.length > 1 ? 's' : ''}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {replies.map(reply => {
              const canEditReply = currentUserId === reply.author_id || isAdmin
              const isEditingThis = editingReplyId === reply.id
              return (
                <div key={reply.id} style={{ backgroundColor: 'white', borderRadius: '14px', padding: '1.25rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <Link href={`/membre/${reply.author_id}`}><Avatar profile={reply.profiles} size={36} /></Link>
                    <div style={{ flex: 1 }}>
                      <div style={{ marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Link href={`/membre/${reply.author_id}`} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span style={{ fontWeight: 700, color: '#2D2D2D', fontSize: '0.88rem' }}>{reply.profiles?.first_name} {reply.profiles?.last_name}</span>
                            {reply.author_id === ADMIN_ID && <img src="/icons/badge-check.svg" alt="Fondateur" style={{ width: '15px', height: '15px' }} />}
                          </Link>
                          <span style={{ fontSize: '0.73rem', color: '#2D2D2D', opacity: 0.35 }}>· {formatDate(reply.created_at)}</span>
                          {canEditReply && !isEditingThis && (
                            <ActionButtons
                              onEdit={() => { setEditingReplyId(reply.id); setEditReplyContent(reply.content) }}
                              onDelete={() => deleteReply(reply.id)}
                            />
                          )}
                        </div>
                        {(reply.profiles?.activity || reply.profiles?.city) && (
                          <div style={{ fontSize: '0.75rem', color: '#2D2D2D', opacity: 0.45, marginTop: '0.1rem' }}>
                            {reply.profiles.activity}{reply.profiles.activity && reply.profiles.city ? ` à ${reply.profiles.city}` : reply.profiles.city ? `à ${reply.profiles.city}` : ''}
                          </div>
                        )}
                      </div>
                      {isEditingThis ? (
                        <div>
                          <FormatToolbar textareaRef={editReplyRef} value={editReplyContent} setValue={setEditReplyContent} />
                          <textarea
                            ref={editReplyRef}
                            value={editReplyContent}
                            onChange={e => {
                              setEditReplyContent(e.target.value)
                              e.target.style.height = 'auto'
                              e.target.style.height = e.target.scrollHeight + 'px'
                            }}
                            onFocus={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
                            rows={1}
                            style={{ width: '100%', border: '1.5px solid #E8501A', borderRadius: '10px', padding: '0.65rem 0.9rem', fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none', resize: 'none', boxSizing: 'border-box', overflow: 'hidden', minHeight: '80px' }}
                          />
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', justifyContent: 'flex-end' }}>
                            <button onClick={() => setEditingReplyId(null)} style={{ background: 'none', border: '1px solid #E8E3D9', borderRadius: '8px', padding: '0.35rem 0.8rem', cursor: 'pointer', fontSize: '0.85rem' }}>Annuler</button>
                            <button onClick={() => saveReply(reply.id)} disabled={savingReply} style={{ backgroundColor: '#E8501A', color: 'white', border: 'none', borderRadius: '8px', padding: '0.35rem 0.9rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
                              {savingReply ? '...' : 'Enregistrer'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p style={{ color: '#2D2D2D', lineHeight: 1.65, margin: 0, fontSize: '0.9rem', whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: reply.content }} />
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Zone de réponse */}
      {currentUserId ? (
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <Avatar profile={currentProfile} size={36} />
            <div style={{ flex: 1 }}>
              <FormatToolbar textareaRef={textareaRef} value={replyContent} setValue={setReplyContent} />
              <textarea
                ref={textareaRef}
                value={replyContent}
                onChange={e => setReplyContent(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitReply() }}
                placeholder="Écris ta réponse… (Cmd+Entrée pour envoyer)"
                rows={3}
                style={{ width: '100%', border: '1.5px solid #E8E3D9', borderRadius: '10px', padding: '0.75rem 1rem', fontSize: '0.92rem', fontFamily: 'inherit', outline: 'none', resize: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
                onFocus={e => e.target.style.borderColor = '#E8501A'}
                onBlur={e => e.target.style.borderColor = '#E8E3D9'}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.6rem' }}>
                <button onClick={submitReply} disabled={!replyContent.trim() || submitting} style={{ backgroundColor: '#E8501A', color: 'white', border: 'none', borderRadius: '8px', padding: '0.5rem 1.25rem', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', opacity: !replyContent.trim() ? 0.5 : 1 }}>
                  {submitting ? 'Envoi...' : 'Répondre'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '1.5rem', color: '#2D2D2D', opacity: 0.4, fontSize: '0.88rem' }}>
          Connecte-toi pour répondre à ce sujet.
        </div>
      )}
    </div>
  )
}
