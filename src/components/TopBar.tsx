// @ts-nocheck
'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Notification {
  id: string
  type: string
  content: string
  read: boolean
  created_at: string
  link: string | null
  from_user_id: string | null
  from_profile?: { first_name: string; last_name: string; avatar_url: string | null } | null
}

export default function TopBar() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [showNotifs, setShowNotifs] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      setUserId(data.user.id)
      loadNotifications(data.user.id)
      loadUnreadMessages(data.user.id)
    })
  }, [])

  // Fermer le dropdown en cliquant ailleurs
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowNotifs(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const loadNotifications = async (uid: string) => {
    const supabase = createClient()
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(20)
    if (!data) return

    // Charger les profils des auteurs séparément
    const fromIds = [...new Set(data.map(n => n.from_user_id).filter(Boolean))]
    let profilesMap: Record<string, { first_name: string; last_name: string; avatar_url: string | null }> = {}
    if (fromIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url')
        .in('id', fromIds)
      if (profiles) {
        profiles.forEach(p => { profilesMap[p.id] = p })
      }
    }

    setNotifications(data.map(n => ({
      ...n,
      from_profile: n.from_user_id ? profilesMap[n.from_user_id] || null : null,
    })))
  }

  const loadUnreadMessages = async (uid: string) => {
    const supabase = createClient()
    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('receiver_id', uid)
      .eq('read', false)
    setUnreadMessages(count || 0)
  }

  const markAllRead = async () => {
    if (!userId) return
    const supabase = createClient()
    await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false)
    setNotifications(n => n.map(x => ({ ...x, read: true })))
  }

  const handleNotifClick = async (notif: Notification) => {
    const supabase = createClient()
    await supabase.from('notifications').update({ read: true }).eq('id', notif.id)
    setNotifications(n => n.map(x => x.id === notif.id ? { ...x, read: true } : x))
    if (notif.link) router.push(notif.link)
    else if (notif.type === 'recommendation') router.push('/profil')
    setShowNotifs(false)
  }

  const unreadCount = notifications.filter(n => !n.read).length

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  const typeIcon = (type: string) => {
    if (type === 'reaction') return '👍'
    if (type === 'comment') return '💬'
    if (type === 'recommendation') return '⭐️'
    return '🔔'
  }

  return (
    <div style={{
      position: 'fixed', top: '1rem', right: '1.5rem', zIndex: 200,
      display: 'flex', alignItems: 'center',
    }} ref={ref}>
      {/* Pill */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.15rem',
        backgroundColor: 'white',
        borderRadius: '50px',
        padding: '0.4rem 0.5rem',
        boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
      }}>
        {/* Notifications */}
        <button
          onClick={() => setShowNotifs(v => !v)}
          style={{
            position: 'relative', background: 'none', border: 'none',
            cursor: 'pointer', padding: '0.35rem 0.5rem',
            borderRadius: '30px',
            backgroundColor: showNotifs ? '#F5F0E8' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s',
          }}
          title="Notifications"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2D2D2D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute', top: '2px', right: '2px',
              backgroundColor: '#E8501A', color: 'white',
              fontSize: '0.6rem', fontWeight: 700,
              width: '16px', height: '16px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
          )}
        </button>

        {/* Séparateur */}
        <div style={{ width: '1px', height: '20px', backgroundColor: '#E8E3D9' }} />

        {/* Messages */}
        <button
          onClick={() => router.push('/messages')}
          style={{
            position: 'relative', background: 'none', border: 'none',
            cursor: 'pointer', padding: '0.35rem 0.5rem',
            borderRadius: '30px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s',
          }}
          title="Messages"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2D2D2D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          {unreadMessages > 0 && (
            <span style={{
              position: 'absolute', top: '2px', right: '2px',
              backgroundColor: '#E8501A', color: 'white',
              fontSize: '0.6rem', fontWeight: 700,
              width: '16px', height: '16px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{unreadMessages > 9 ? '9+' : unreadMessages}</span>
          )}
        </button>
      </div>

      {/* Dropdown notifications */}
      {showNotifs && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 0.5rem)', right: 0,
          backgroundColor: 'white', borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          width: '340px', maxHeight: '480px',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid #F5F0E8' }}>
            <span style={{ fontFamily: 'var(--font-clash)', fontWeight: 700, fontSize: '1rem', color: '#2D2D2D' }}>Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: '#E8501A', fontWeight: 600 }}>
                Tout marquer comme lu
              </button>
            )}
          </div>

          {/* Liste */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#2D2D2D', opacity: 0.4, fontSize: '0.9rem' }}>
                Aucune notification
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => handleNotifClick(n)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                    padding: '0.85rem 1.25rem',
                    backgroundColor: n.read ? 'transparent' : 'rgba(232,80,26,0.05)',
                    borderBottom: '1px solid #F5F0E8',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                >
                  {/* Avatar de l'auteur */}
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    backgroundColor: '#E8501A', color: 'white', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '0.75rem', overflow: 'hidden',
                  }}>
                    {n.from_profile?.avatar_url
                      ? <img src={n.from_profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : n.from_profile
                        ? `${n.from_profile.first_name[0]}${n.from_profile.last_name[0]}`
                        : '?'
                    }
                  </div>
                  <div style={{ flex: 1 }}>
                    {n.from_profile && (
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#2D2D2D', marginBottom: '0.1rem' }}>
                        {n.from_profile.first_name} {n.from_profile.last_name}
                      </div>
                    )}
                    <div style={{ fontSize: '0.85rem', color: '#2D2D2D', lineHeight: 1.45, opacity: 0.75 }}>{n.content}</div>
                    <div style={{ fontSize: '0.72rem', color: '#2D2D2D', opacity: 0.4, marginTop: '0.2rem' }}>{formatDate(n.created_at)}</div>
                  </div>
                  {!n.read && (
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#E8501A', flexShrink: 0, marginTop: '0.35rem' }} />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
