// @ts-nocheck
'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Reply {
  id: string
  content: string
  created_at: string
  author_id: string
  profiles: { first_name: string; last_name: string; avatar_url: string | null; activity: string | null } | null
}

interface Topic {
  id: string
  title: string
  content: string
  created_at: string
  author_id: string
  profiles: { first_name: string; last_name: string; avatar_url: string | null; activity: string | null } | null
}

export default function ForumTopicPage() {
  const { id: categoryId, topicId } = useParams()
  const [category, setCategory] = useState<{ id: string; name: string } | null>(null)
  const [topic, setTopic] = useState<Topic | null>(null)
  const [replies, setReplies] = useState<Reply[]>([])
  const [loading, setLoading] = useState(true)
  const [replyContent, setReplyContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentProfile, setCurrentProfile] = useState<any>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
        .select('id, title, content, created_at, author_id, profiles!forum_topics_author_id_fkey(first_name, last_name, avatar_url, activity)')
        .eq('id', topicId)
        .single()
      if (topicData) setTopic(topicData)

      const { data: repliesData } = await supabase
        .from('forum_replies')
        .select('id, content, created_at, author_id, profiles!forum_replies_author_id_fkey(first_name, last_name, avatar_url, activity)')
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
    const { data, error } = await supabase
      .from('forum_replies')
      .insert({ topic_id: topicId, author_id: currentUserId, content: replyContent.trim() })
      .select('id, content, created_at, author_id, profiles!forum_replies_author_id_fkey(first_name, last_name, avatar_url, activity)')
      .single()

    if (data) {
      setReplies(prev => [...prev, data])
      setReplyContent('')
      // Scroll vers la nouvelle réponse
      setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 100)
    }
    setSubmitting(false)
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

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem', color: '#2D2D2D', opacity: 0.4 }}>Chargement...</div>
  if (!topic) return <div style={{ textAlign: 'center', padding: '3rem', color: '#2D2D2D', opacity: 0.4 }}>Sujet introuvable.</div>

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
        <h1 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.4rem', color: '#2D2D2D', margin: '0 0 1.25rem' }}>{topic.title}</h1>

        <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
          <Link href={`/membre/${topic.author_id}`}>
            <Avatar profile={topic.profiles} size={42} />
          </Link>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
              <Link href={`/membre/${topic.author_id}`} style={{ textDecoration: 'none' }}>
                <span style={{ fontWeight: 700, color: '#2D2D2D', fontSize: '0.92rem' }}>{topic.profiles?.first_name} {topic.profiles?.last_name}</span>
              </Link>
              {topic.profiles?.activity && <span style={{ fontSize: '0.78rem', color: '#2D2D2D', opacity: 0.45 }}>{topic.profiles.activity}</span>}
              <span style={{ fontSize: '0.75rem', color: '#2D2D2D', opacity: 0.35 }}>· {formatDate(topic.created_at)}</span>
            </div>
            <p style={{ color: '#2D2D2D', lineHeight: 1.7, margin: 0, fontSize: '0.95rem', whiteSpace: 'pre-wrap' }}>{topic.content}</p>
          </div>
        </div>
      </div>

      {/* Réponses */}
      {replies.length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#2D2D2D', opacity: 0.4, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
            {replies.length} réponse{replies.length > 1 ? 's' : ''}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {replies.map((reply, i) => (
              <div key={reply.id} style={{ backgroundColor: 'white', borderRadius: '14px', padding: '1.25rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <Link href={`/membre/${reply.author_id}`}>
                    <Avatar profile={reply.profiles} size={36} />
                  </Link>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                      <Link href={`/membre/${reply.author_id}`} style={{ textDecoration: 'none' }}>
                        <span style={{ fontWeight: 700, color: '#2D2D2D', fontSize: '0.88rem' }}>{reply.profiles?.first_name} {reply.profiles?.last_name}</span>
                      </Link>
                      {reply.profiles?.activity && <span style={{ fontSize: '0.75rem', color: '#2D2D2D', opacity: 0.45 }}>{reply.profiles.activity}</span>}
                      <span style={{ fontSize: '0.73rem', color: '#2D2D2D', opacity: 0.35 }}>· {formatDate(reply.created_at)}</span>
                    </div>
                    <p style={{ color: '#2D2D2D', lineHeight: 1.65, margin: 0, fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{reply.content}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Zone de réponse */}
      {currentUserId ? (
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <Avatar profile={currentProfile} size={36} />
            <div style={{ flex: 1 }}>
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
                <button
                  onClick={submitReply}
                  disabled={!replyContent.trim() || submitting}
                  style={{ backgroundColor: '#E8501A', color: 'white', border: 'none', borderRadius: '8px', padding: '0.5rem 1.25rem', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', opacity: !replyContent.trim() ? 0.5 : 1 }}
                >
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
