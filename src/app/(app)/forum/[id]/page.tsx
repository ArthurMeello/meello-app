// @ts-nocheck
'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const ADMIN_ID = '13cdb485-42e0-48df-b2f8-14dc77dd895a'

function applyFormat(textarea: HTMLTextAreaElement, tag: 'strong' | 'em', value: string, setValue: (v: string) => void) {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selected = value.slice(start, end)
  if (!selected) return
  const open = `<${tag}>`
  const close = `</${tag}>`
  const newValue = value.slice(0, start) + open + selected + close + value.slice(end)
  setValue(newValue)
  setTimeout(() => { textarea.focus(); textarea.setSelectionRange(start + open.length, end + open.length) }, 0)
}

function FormatToolbar({ textareaRef, value, setValue }: { textareaRef: React.RefObject<HTMLTextAreaElement>; value: string; setValue: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.35rem' }}>
      {[
        { tag: 'strong' as const, label: 'G', style: { fontWeight: 700 } },
        { tag: 'em' as const, label: 'I', style: { fontStyle: 'italic' } },
      ].map(({ tag, label, style }) => (
        <button key={tag} type="button" onMouseDown={e => { e.preventDefault(); if (textareaRef.current) applyFormat(textareaRef.current, tag, value, setValue) }}
          style={{ ...style, background: 'none', border: '1px solid #E8E3D9', borderRadius: '5px', width: '28px', height: '26px', cursor: 'pointer', fontSize: '0.85rem', color: '#2D2D2D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {label}
        </button>
      ))}
    </div>
  )
}

interface Topic {
  id: string
  title: string
  content: string
  created_at: string
  author_id: string
  profiles: { first_name: string; last_name: string; avatar_url: string | null; activity: string | null } | null
  reply_count?: number
  last_reply_at?: string
}

type SortMode = 'recent' | 'actif'

export default function ForumCategoryPage() {
  const { id } = useParams()
  const [category, setCategory] = useState<{ id: string; name: string; description: string | null } | null>(null)
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<SortMode>('recent')
  const [newTopicModal, setNewTopicModal] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const newTopicTextareaRef = useRef<HTMLTextAreaElement>(null)

  const loadTopics = async (supabase: any) => {
    const { data: topicsData, error: err } = await supabase
      .from('forum_topics')
      .select('id, title, content, created_at, author_id, profiles!forum_topics_author_id_fkey(first_name, last_name, avatar_url, activity)')
      .eq('category_id', id)
      .order('created_at', { ascending: false })

    if (err) { console.error('topics error', err); return }

    if (topicsData) {
      // Enrichir avec le nombre de réponses et la date de la dernière réponse
      const enriched = await Promise.all(topicsData.map(async (topic: any) => {
        const { count, data: replies } = await supabase
          .from('forum_replies')
          .select('created_at', { count: 'exact' })
          .eq('topic_id', topic.id)
          .order('created_at', { ascending: false })
          .limit(1)
        const last_reply_at = replies?.[0]?.created_at || topic.created_at
        return { ...topic, reply_count: count || 0, last_reply_at }
      }))
      setTopics(enriched)
    }
  }

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setCurrentUserId(user.id)

      const { data: cat } = await supabase.from('forum_categories').select('*').eq('id', id).single()
      if (cat) setCategory(cat)

      await loadTopics(supabase)
      setLoading(false)
    }
    load()
  }, [id])

  const sortedTopics = [...topics].sort((a, b) => {
    if (sort === 'actif') return new Date(b.last_reply_at).getTime() - new Date(a.last_reply_at).getTime()
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const submitTopic = async () => {
    if (!title.trim() || !content.trim() || !currentUserId) return
    setSubmitting(true)
    setError(null)
    const supabase = createClient()
    const { data, error: insertError } = await supabase
      .from('forum_topics')
      .insert({ category_id: id, author_id: currentUserId, title: title.trim(), content: content.trim() })
      .select('id, title, content, created_at, author_id, profiles!forum_topics_author_id_fkey(first_name, last_name, avatar_url, activity)')
      .single()

    if (insertError) {
      setError('Erreur lors de la publication. Vérifie les permissions Supabase.')
      setSubmitting(false)
      return
    }
    if (data) setTopics(prev => [{ ...data, reply_count: 0, last_reply_at: data.created_at }, ...prev])
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
        <Link href="/forum" style={{ color: '#E8501A', textDecoration: 'none', fontWeight: 600 }}>La Communauté</Link>
        <span style={{ color: '#2D2D2D', opacity: 0.4 }}>→</span>
        <span style={{ color: '#2D2D2D', opacity: 0.5 }}>{category?.name || '...'}</span>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.5rem', color: '#2D2D2D', margin: 0 }}>{category?.name}</h1>
          {category?.description && <p style={{ color: '#2D2D2D', opacity: 0.45, fontSize: '0.88rem', margin: '0.3rem 0 0' }}>{category.description}</p>}
        </div>
        {currentUserId && (
          <button onClick={() => setNewTopicModal(true)} style={{ backgroundColor: '#E8501A', color: 'white', border: 'none', borderRadius: '10px', padding: '0.6rem 1.25rem', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>
            + Nouveau sujet
          </button>
        )}
      </div>

      {/* Tri */}
      {topics.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          {(['recent', 'actif'] as SortMode[]).map(s => (
            <button key={s} onClick={() => setSort(s)} style={{ padding: '0.35rem 0.9rem', borderRadius: '20px', border: `1.5px solid ${sort === s ? '#E8501A' : '#E8E3D9'}`, backgroundColor: sort === s ? '#FFF0ED' : 'white', color: sort === s ? '#E8501A' : '#2D2D2D', fontWeight: sort === s ? 700 : 400, fontSize: '0.82rem', cursor: 'pointer', opacity: sort !== s ? 0.6 : 1 }}>
              {s === 'recent' ? 'Les plus récentes' : 'Les plus actives'}
            </button>
          ))}
        </div>
      )}

      {/* Liste */}
      {loading && <div style={{ textAlign: 'center', padding: '3rem', color: '#2D2D2D', opacity: 0.4 }}>Chargement...</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {sortedTopics.map(topic => {
          const initials = `${(topic.profiles?.first_name || '?')[0]}${(topic.profiles?.last_name || '')[0] || ''}`.toUpperCase()
          return (
            <div key={topic.id} style={{ position: 'relative' }}>
              {currentUserId === ADMIN_ID && (
                <button
                  onClick={async (e) => {
                    e.preventDefault()
                    if (!confirm('Supprimer ce topic ?')) return
                    const supabase = createClient()
                    await supabase.from('forum_replies').delete().eq('topic_id', topic.id)
                    await supabase.from('forum_topics').delete().eq('id', topic.id)
                    setTopics(prev => prev.filter(t => t.id !== topic.id))
                  }}
                  style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', zIndex: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: '1rem', lineHeight: 1, padding: '0.25rem' }}
                  title="Supprimer"
                >✕</button>
              )}
            <Link href={`/forum/${id}/${topic.id}`} style={{ textDecoration: 'none' }}>
              <div
                style={{ backgroundColor: 'white', borderRadius: '14px', padding: '1.25rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', transition: 'transform 0.15s, box-shadow 0.15s', cursor: 'pointer' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateX(4px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)' }}
              >
                <div style={{ fontWeight: 700, color: '#2D2D2D', fontSize: '0.97rem', marginBottom: '0.35rem' }}>{topic.title}</div>
                <p style={{ fontSize: '0.83rem', color: '#2D2D2D', opacity: 0.5, margin: '0 0 0.75rem', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {topic.content}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#E8501A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: 700, overflow: 'hidden', flexShrink: 0 }}>
                      {topic.profiles?.avatar_url ? <img src={topic.profiles.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
                    </div>
                    <span style={{ fontSize: '0.78rem', color: '#2D2D2D', fontWeight: 600 }}>
                      {topic.profiles?.first_name} {topic.profiles?.last_name}
                    </span>
                    {topic.author_id === ADMIN_ID && (
                      <img src="/icons/badge-check.svg" alt="Vérifié" title="Fondateur Meello" style={{ width: '14px', height: '14px', flexShrink: 0 }} />
                    )}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#2D2D2D', opacity: 0.3 }}>·</span>
                  <span style={{ fontSize: '0.78rem', color: '#2D2D2D', opacity: 0.4 }}>{formatDate(topic.created_at)}</span>
                  <span style={{ fontSize: '0.75rem', color: '#2D2D2D', opacity: 0.3 }}>·</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.78rem', color: '#E8501A', fontWeight: 600 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    {topic.reply_count} réponse{topic.reply_count !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </Link>
            </div>
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
            {error && <div style={{ backgroundColor: '#FFF0ED', color: '#E8501A', padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</div>}
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Titre du sujet"
              style={{ width: '100%', border: '1.5px solid #E8E3D9', borderRadius: '10px', padding: '0.75rem 1rem', fontSize: '0.95rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: '0.75rem' }}
            />
            <FormatToolbar textareaRef={newTopicTextareaRef} value={content} setValue={setContent} />
            <textarea
              ref={newTopicTextareaRef}
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Décris ton sujet en détail..."
              rows={6}
              style={{ width: '100%', border: '1.5px solid #E8E3D9', borderRadius: '10px', padding: '0.75rem 1rem', fontSize: '0.95rem', fontFamily: 'inherit', outline: 'none', resize: 'none', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
              <button onClick={() => { setNewTopicModal(false); setError(null) }} style={{ background: 'none', border: '1px solid #E8E3D9', borderRadius: '8px', padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.9rem' }}>Annuler</button>
              <button onClick={submitTopic} disabled={!title.trim() || !content.trim() || submitting} style={{ backgroundColor: '#E8501A', color: 'white', border: 'none', borderRadius: '8px', padding: '0.5rem 1.25rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem', opacity: (!title.trim() || !content.trim()) ? 0.5 : 1 }}>
                {submitting ? 'Publication...' : 'Publier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
