// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Topic {
  id: string
  title: string
  content: string
  created_at: string
  author_id: string
  profiles: { first_name: string; last_name: string; avatar_url: string | null; activity: string | null } | null
  reply_count?: number
}

export default function ForumCategoryPage() {
  const { id } = useParams()
  const router = useRouter()
  const [category, setCategory] = useState<{ id: string; name: string; description: string | null } | null>(null)
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const [newTopicModal, setNewTopicModal] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setCurrentUserId(user.id)

      const { data: cat } = await supabase.from('forum_categories').select('*').eq('id', id).single()
      if (cat) setCategory(cat)

      const { data: topicsData } = await supabase
        .from('forum_topics')
        .select('id, title, content, created_at, author_id, profiles!forum_topics_author_id_fkey(first_name, last_name, avatar_url, activity)')
        .eq('category_id', id)
        .order('created_at', { ascending: false })

      if (topicsData) {
        setTopics(topicsData)
      }
      setLoading(false)
    }
    load()
  }, [id])

  const submitTopic = async () => {
    if (!title.trim() || !content.trim() || !currentUserId) return
    setSubmitting(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('forum_topics')
      .insert({ category_id: id, author_id: currentUserId, title: title.trim(), content: content.trim() })
      .select('id, title, content, created_at, author_id, profiles!forum_topics_author_id_fkey(first_name, last_name, avatar_url, activity)')
      .single()
    if (data) setTopics(prev => [data, ...prev])
    setTitle(''); setContent(''); setNewTopicModal(false); setSubmitting(false)
  }

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

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#2D2D2D', opacity: 0.45, marginBottom: '1.25rem' }}>
        <Link href="/forum" style={{ color: '#E8501A', textDecoration: 'none', fontWeight: 600, opacity: 1 }}>La Communauté</Link>
        <span>→</span>
        <span>{category?.name || '...'}</span>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.5rem', color: '#2D2D2D', margin: 0 }}>
            {category?.name}
          </h1>
          {category?.description && (
            <p style={{ color: '#2D2D2D', opacity: 0.45, fontSize: '0.88rem', margin: '0.3rem 0 0' }}>{category.description}</p>
          )}
        </div>
        {currentUserId && (
          <button
            onClick={() => setNewTopicModal(true)}
            style={{ backgroundColor: '#E8501A', color: 'white', border: 'none', borderRadius: '10px', padding: '0.6rem 1.25rem', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', flexShrink: 0 }}
          >
            + Nouveau sujet
          </button>
        )}
      </div>

      {/* Liste des sujets */}
      {loading && <div style={{ textAlign: 'center', padding: '3rem', color: '#2D2D2D', opacity: 0.4 }}>Chargement...</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {topics.map(topic => {
          const initials = `${(topic.profiles?.first_name || '?')[0]}${(topic.profiles?.last_name || '')[0] || ''}`.toUpperCase()
          return (
            <Link key={topic.id} href={`/forum/${id}/${topic.id}`} style={{ textDecoration: 'none' }}>
              <div
                style={{ backgroundColor: 'white', borderRadius: '14px', padding: '1.25rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', transition: 'transform 0.15s, box-shadow 0.15s', cursor: 'pointer' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateX(4px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)' }}
              >
                <div style={{ fontWeight: 700, color: '#2D2D2D', fontSize: '0.95rem', marginBottom: '0.4rem' }}>{topic.title}</div>
                <p style={{ fontSize: '0.83rem', color: '#2D2D2D', opacity: 0.5, margin: '0 0 0.75rem', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {topic.content}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#E8501A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, overflow: 'hidden', flexShrink: 0 }}>
                    {topic.profiles?.avatar_url
                      ? <img src={topic.profiles.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : initials}
                  </div>
                  <span style={{ fontSize: '0.78rem', color: '#2D2D2D', opacity: 0.5 }}>
                    {topic.profiles?.first_name} {topic.profiles?.last_name}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#2D2D2D', opacity: 0.3 }}>·</span>
                  <span style={{ fontSize: '0.78rem', color: '#2D2D2D', opacity: 0.4 }}>{formatDate(topic.created_at)}</span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {!loading && topics.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#2D2D2D', opacity: 0.4, backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>💬</div>
          <div style={{ fontWeight: 600, marginBottom: '0.4rem' }}>Aucun sujet pour l'instant</div>
          <div style={{ fontSize: '0.85rem' }}>Sois le premier à lancer une discussion !</div>
        </div>
      )}

      {/* Modal nouveau sujet */}
      {newTopicModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setNewTopicModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.75rem', width: '100%', maxWidth: '540px' }}>
            <h3 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.2rem', color: '#2D2D2D', margin: '0 0 1.25rem' }}>Nouveau sujet</h3>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Titre du sujet"
              style={{ width: '100%', border: '1.5px solid #E8E3D9', borderRadius: '10px', padding: '0.75rem 1rem', fontSize: '0.95rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: '0.75rem' }}
            />
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Décris ton sujet en détail..."
              rows={6}
              style={{ width: '100%', border: '1.5px solid #E8E3D9', borderRadius: '10px', padding: '0.75rem 1rem', fontSize: '0.95rem', fontFamily: 'inherit', outline: 'none', resize: 'none', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setNewTopicModal(false)} style={{ background: 'none', border: '1px solid #E8E3D9', borderRadius: '8px', padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.9rem' }}>Annuler</button>
              <button onClick={submitTopic} disabled={!title.trim() || !content.trim() || submitting} style={{ backgroundColor: '#E8501A', color: 'white', border: 'none', borderRadius: '8px', padding: '0.5rem 1.25rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem', opacity: (!title.trim() || !content.trim()) ? 0.5 : 1 }}>
                {submitting ? '...' : 'Publier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
