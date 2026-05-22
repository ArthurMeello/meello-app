// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Category {
  id: string
  name: string
  description: string | null
  slug: string
  topic_count?: number
}

export default function ForumPage() {
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    const supabase = createClient()
    supabase.from('forum_categories').select('*').order('name').then(({ data }) => {
      if (data) setCategories(data)
    })
  }, [])

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.75rem', color: '#2D2D2D', marginBottom: '1.5rem' }}>
        Forum
      </h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {categories.map(cat => (
          <Link key={cat.id} href={`/forum/${cat.slug}`} style={{ textDecoration: 'none' }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '14px',
              padding: '1.25rem',
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'transform 0.15s',
              cursor: 'pointer',
            }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'translateX(4px)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = ''}
            >
              <div>
                <div style={{ fontWeight: 700, color: '#2D2D2D', marginBottom: '0.2rem' }}>{cat.name}</div>
                {cat.description && <div style={{ fontSize: '0.85rem', color: '#2D2D2D', opacity: 0.55 }}>{cat.description}</div>}
              </div>
              <span style={{ color: '#E8501A', fontSize: '1.2rem' }}>→</span>
            </div>
          </Link>
        ))}

        {categories.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#2D2D2D', opacity: 0.4 }}>
            Les categories du forum arrivent bientot !
          </div>
        )}
      </div>
    </div>
  )
}
