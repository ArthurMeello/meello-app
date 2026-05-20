'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Post } from '@/types'

export default function FeedPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
    fetchPosts()
  }, [])

  const fetchPosts = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('posts')
      .select('*, profiles(first_name, last_name, avatar_url, activity)')
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) setPosts(data as Post[])
  }

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    setLoading(true)

    const supabase = createClient()
    await supabase.from('posts').insert({ content: content.trim(), author_id: userId })
    setContent('')
    await fetchPosts()
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.75rem', color: '#2D2D2D', marginBottom: '1.5rem' }}>
        Feed
      </h1>

      {/* Composer */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.25rem', marginBottom: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <form onSubmit={handlePost}>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Partage quelque chose avec la communaute..."
            rows={3}
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              resize: 'none',
              fontSize: '1rem',
              color: '#2D2D2D',
              fontFamily: 'inherit',
              backgroundColor: 'transparent',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
            <button
              type="submit"
              disabled={loading || !content.trim()}
              style={{
                backgroundColor: content.trim() ? '#E8501A' : '#E8E3D9',
                color: content.trim() ? 'white' : '#999',
                border: 'none',
                borderRadius: '8px',
                padding: '0.5rem 1.25rem',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: content.trim() ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
              }}
            >
              {loading ? '...' : 'Publier'}
            </button>
          </div>
        </form>
      </div>

      {/* Posts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {posts.map(post => (
          <PostCard key={post.id} post={post} currentUserId={userId} onRefresh={fetchPosts} />
        ))}
        {posts.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#2D2D2D', opacity: 0.4 }}>
            Sois le premier a publier quelque chose !
          </div>
        )}
      </div>
    </div>
  )
}

function PostCard({ post, currentUserId, onRefresh }: { post: Post & { profiles?: { first_name: string; last_name: string; avatar_url: string | null; activity: string } }, currentUserId: string | null, onRefresh: () => void }) {
  const [comment, setComment] = useState('')
  const [comments, setComments] = useState<{ id: string; content: string; profiles: { first_name: string; last_name: string } }[]>([])
  const [showComments, setShowComments] = useState(false)

  const profile = post.profiles
  const initials = profile ? `${profile.first_name[0]}${profile.last_name[0]}` : '?'
  const formattedDate = new Date(post.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

  const loadComments = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('comments')
      .select('id, content, profiles(first_name, last_name)')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true })
    if (data) setComments(data as typeof comments)
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
    setComment('')
    loadComments()
  }

  return (
    <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.85rem' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '50%',
          backgroundColor: '#E8501A', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: '0.85rem', flexShrink: 0,
        }}>
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
          ) : initials}
        </div>
        <div>
          <div style={{ fontWeight: 600, color: '#2D2D2D', fontSize: '0.95rem' }}>
            {profile ? `${profile.first_name} ${profile.last_name}` : 'Membre'}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#2D2D2D', opacity: 0.5 }}>
            {profile?.activity} · {formattedDate}
          </div>
        </div>
      </div>

      <p style={{ color: '#2D2D2D', lineHeight: 1.65, margin: 0, whiteSpace: 'pre-wrap' }}>
        {post.content}
      </p>

      <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #F5F0E8' }}>
        <button
          onClick={toggleComments}
          style={{ background: 'none', border: 'none', color: '#E8501A', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', padding: 0 }}
        >
          💬 Commenter
        </button>
      </div>

      {showComments && (
        <div style={{ marginTop: '0.75rem' }}>
          {comments.map(c => (
            <div key={c.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid #F5F0E8', fontSize: '0.9rem', color: '#2D2D2D' }}>
              <span style={{ fontWeight: 600 }}>{c.profiles?.first_name} </span>
              {c.content}
            </div>
          ))}
          <form onSubmit={handleComment} style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ton commentaire..."
              style={{ flex: 1, border: '1px solid #E8E3D9', borderRadius: '8px', padding: '0.5rem 0.75rem', fontSize: '0.9rem', outline: 'none' }}
            />
            <button type="submit" style={{ backgroundColor: '#E8501A', color: 'white', border: 'none', borderRadius: '8px', padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: 600 }}>
              OK
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
