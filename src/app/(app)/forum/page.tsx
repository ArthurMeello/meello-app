// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const CATEGORY_ICONS: Record<string, string> = {
  'Présentations': '👋',
  'Trouver des clients': '🎯',
  'Outils & Tech': '⚙️',
  'Finances & Compta': '💶',
  'Marketing & Visibilité': '📣',
  'Mindset & Motivation': '🧠',
  'Collab & Entraide': '🤝',
  'Juridique & Administratif': '📋',
}

interface Category {
  id: string
  name: string
  description: string | null
  topic_count?: number
}

export default function ForumPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: cats } = await supabase.from('forum_categories').select('*').order('name')
      if (cats) {
        // Compter les sujets par catégorie
        const withCounts = await Promise.all(cats.map(async cat => {
          const { count } = await supabase
            .from('forum_topics')
            .select('id', { count: 'exact', head: true })
            .eq('category_id', cat.id)
          return { ...cat, topic_count: count || 0 }
        }))
        setCategories(withCounts)
      }
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.75rem', color: '#2D2D2D', margin: 0 }}>
          La Communauté
        </h1>
        <p style={{ color: '#2D2D2D', opacity: 0.45, fontSize: '0.9rem', marginTop: '0.4rem' }}>
          Échange, pose tes questions, partage ton expérience.
        </p>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#2D2D2D', opacity: 0.4 }}>Chargement...</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
        {categories.map(cat => (
          <Link key={cat.id} href={`/forum/${cat.id}`} style={{ textDecoration: 'none' }}>
            <div
              style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', transition: 'transform 0.15s, box-shadow 0.15s', cursor: 'pointer', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.1)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)' }}
            >
              <div style={{ fontSize: '1.75rem' }}>{CATEGORY_ICONS[cat.name] || '📌'}</div>
              <div>
                <div style={{ fontFamily: 'var(--font-clash)', fontWeight: 700, color: '#2D2D2D', fontSize: '1rem', marginBottom: '0.3rem' }}>{cat.name}</div>
                {cat.description && <p style={{ fontSize: '0.82rem', color: '#2D2D2D', opacity: 0.5, margin: 0, lineHeight: 1.5 }}>{cat.description}</p>}
              </div>
              <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E8501A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <span style={{ fontSize: '0.8rem', color: '#E8501A', fontWeight: 600 }}>
                  {cat.topic_count} sujet{cat.topic_count !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {!loading && categories.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#2D2D2D', opacity: 0.4 }}>
          Les catégories arrivent bientôt !
        </div>
      )}
    </div>
  )
}
