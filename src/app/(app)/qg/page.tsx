// @ts-nocheck
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const ADMIN_ID = '13cdb485-42e0-48df-b2f8-14dc77dd895a'
const PAGE_SIZE = 50

interface QGMessage {
  id: string
  content: string
  created_at: string
  user_id: string
  profile: {
    first_name: string
    last_name: string
    avatar_url: string | null
    badges: string[]
  }
}

interface OnlineMember {
  user_id: string
  last_seen: string
  profile: {
    first_name: string
    last_name: string
    avatar_url: string | null
  }
}

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function formatDateLabel(d: string) {
  const date = new Date(d)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return "Aujourd'hui"
  if (date.toDateString() === yesterday.toDateString()) return 'Hier'
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function renderContent(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = text.split(urlRegex)
  return parts.map((part, i) =>
    urlRegex.test(part)
      ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: '#E8501A', textDecoration: 'underline', wordBreak: 'break-all' }}>{part}</a>
      : <span key={i}>{part}</span>
  )
}

export default function QGPage() {
  const [messages, setMessages] = useState<QGMessage[]>([])
  const [onlineMembers, setOnlineMembers] = useState<OnlineMember[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [sending, setSending] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)
  const oldestCreatedAt = useRef<string | null>(null)
  const isAtBottom = useRef(true)
  const presenceInterval = useRef<any>(null)

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (prof) setProfile(prof)

      // Charger les 50 derniers messages
      await loadMessages(supabase, null)

      // Présence en ligne
      await supabase.from('qg_presence').upsert({ user_id: user.id, last_seen: new Date().toISOString() })
      await loadOnlineMembers(supabase)

      // Mettre à jour la présence toutes les 30s
      presenceInterval.current = setInterval(async () => {
        await supabase.from('qg_presence').upsert({ user_id: user.id, last_seen: new Date().toISOString() })
        await loadOnlineMembers(supabase)
      }, 30000)

      // Realtime nouveaux messages
      const channel = supabase
        .channel('qg-messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'qg_messages' }, async (payload) => {
          const msg = payload.new
          const { data: prof } = await supabase.from('profiles').select('first_name, last_name, avatar_url, badges').eq('id', msg.user_id).single()
          const fullMsg = { ...msg, profile: prof }
          setMessages(prev => [...prev, fullMsg])
          if (isAtBottom.current) {
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
          }
        })
        .subscribe()

      return () => {
        channel.unsubscribe()
        clearInterval(presenceInterval.current)
      }
    }
    init()

    return () => { clearInterval(presenceInterval.current) }
  }, [])

  const loadMessages = async (supabase: any, before: string | null) => {
    let query = supabase
      .from('qg_messages')
      .select('id, content, created_at, user_id')
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)

    if (before) query = query.lt('created_at', before)

    const { data } = await query
    if (!data || data.length === 0) { setHasMore(false); return [] }

    const userIds = [...new Set(data.map((m: any) => m.user_id))]
    const { data: profiles } = await supabase.from('profiles').select('id, first_name, last_name, avatar_url, badges').in('id', userIds)
    const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]))

    const msgs = data.reverse().map((m: any) => ({ ...m, profile: profileMap[m.user_id] || {} }))
    if (data.length < PAGE_SIZE) setHasMore(false)
    oldestCreatedAt.current = msgs[0]?.created_at || null
    return msgs
  }

  const loadOnlineMembers = async (supabase: any) => {
    const since = new Date(Date.now() - 2 * 60 * 1000).toISOString() // 2 minutes
    const { data } = await supabase
      .from('qg_presence')
      .select('user_id, last_seen')
      .gte('last_seen', since)
      .order('last_seen', { ascending: false })

    if (!data || data.length === 0) { setOnlineMembers([]); return }

    const userIds = data.map((p: any) => p.user_id)
    const { data: profiles } = await supabase.from('profiles').select('id, first_name, last_name, avatar_url').in('id', userIds)
    const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]))

    setOnlineMembers(data.map((p: any) => ({ ...p, profile: profileMap[p.user_id] || {} })))
  }

  // Initialisation messages
  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const msgs = await loadMessages(supabase, null)
      setMessages(msgs)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'instant' }), 100)
    }
    init()
  }, [])

  const handleScroll = useCallback(async () => {
    const el = messagesRef.current
    if (!el) return

    isAtBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100
    setShowScrollBtn(!isAtBottom.current)

    // Charger plus si on est tout en haut
    if (el.scrollTop < 80 && hasMore && !loadingMore) {
      setLoadingMore(true)
      const supabase = createClient()
      const older = await loadMessages(supabase, oldestCreatedAt.current)
      if (older.length > 0) {
        const prevScrollHeight = el.scrollHeight
        setMessages(prev => [...older, ...prev])
        setTimeout(() => {
          el.scrollTop = el.scrollHeight - prevScrollHeight
        }, 0)
      }
      setLoadingMore(false)
    }
  }, [hasMore, loadingMore])

  const sendMessage = async () => {
    if (!newMessage.trim() || !userId || sending) return
    setSending(true)
    const supabase = createClient()
    await supabase.from('qg_messages').insert({ user_id: userId, content: newMessage.trim() })
    setNewMessage('')
    setSending(false)
    isAtBottom.current = true
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Grouper les messages par date
  const grouped: { date: string; msgs: QGMessage[] }[] = []
  for (const msg of messages) {
    const label = formatDateLabel(msg.created_at)
    if (!grouped.length || grouped[grouped.length - 1].date !== label) {
      grouped.push({ date: label, msgs: [msg] })
    } else {
      grouped[grouped.length - 1].msgs.push(msg)
    }
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 2rem)', gap: '1.5rem', maxWidth: '1100px', margin: '0 auto' }}>

      {/* Chat principal */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #F5F0E8', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <img src="/icons/megaphone.svg" alt="" style={{ width: '22px', height: '22px', filter: 'brightness(0) saturate(100%) invert(35%) sepia(90%) saturate(700%) hue-rotate(350deg)' }} />
          <div>
            <div style={{ fontFamily: 'var(--font-clash)', fontSize: '1.15rem', fontWeight: 700, color: '#2D2D2D' }}>Le QG</div>
            <div style={{ fontSize: '0.78rem', color: '#2D2D2D', opacity: 0.45 }}>Canal général — tout le monde peut discuter ici</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22C55E', display: 'inline-block' }} />
            <span style={{ fontSize: '0.82rem', color: '#2D2D2D', opacity: 0.5 }}>{onlineMembers.length} en ligne</span>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={messagesRef}
          onScroll={handleScroll}
          style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.1rem', position: 'relative' }}
        >
          {loadingMore && (
            <div style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.82rem', color: '#2D2D2D', opacity: 0.4 }}>Chargement...</div>
          )}
          {!hasMore && messages.length > 0 && (
            <div style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.78rem', color: '#2D2D2D', opacity: 0.3 }}>Début de l'historique</div>
          )}

          {grouped.map(group => (
            <div key={group.date}>
              {/* Séparateur date */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '1.25rem 0 0.75rem' }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#F5F0E8' }} />
                <span style={{ fontSize: '0.72rem', color: '#2D2D2D', opacity: 0.4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{group.date}</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#F5F0E8' }} />
              </div>

              {group.msgs.map((msg, i) => {
                const prev = i > 0 ? group.msgs[i - 1] : null
                const isSameUser = prev?.user_id === msg.user_id
                const isOwn = msg.user_id === userId
                const isAdmin = msg.user_id === ADMIN_ID

                return (
                  <div key={msg.id} style={{ display: 'flex', gap: '0.75rem', padding: isSameUser ? '0.1rem 0' : '0.6rem 0 0.1rem', alignItems: 'flex-start' }}>
                    {/* Avatar */}
                    <div style={{ width: '36px', flexShrink: 0, marginTop: '2px' }}>
                      {!isSameUser && (
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#E8501A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem', overflow: 'hidden', flexShrink: 0 }}>
                          {msg.profile?.avatar_url
                            ? <img src={msg.profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : `${(msg.profile?.first_name || '?')[0]}${(msg.profile?.last_name || '')[0] || ''}`.toUpperCase()
                          }
                        </div>
                      )}
                    </div>

                    {/* Contenu */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {!isSameUser && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: isOwn ? '#E8501A' : '#2D2D2D' }}>
                            {msg.profile?.first_name} {msg.profile?.last_name}
                          </span>
                          {isAdmin && (
                            <img src="/icons/badge-check.svg" alt="Admin" style={{ width: '14px', height: '14px' }} />
                          )}
                          <span style={{ fontSize: '0.72rem', color: '#2D2D2D', opacity: 0.35 }}>{formatTime(msg.created_at)}</span>
                        </div>
                      )}
                      <div style={{ fontSize: '0.9rem', color: '#2D2D2D', lineHeight: 1.6, wordBreak: 'break-word' }}>
                        {renderContent(msg.content)}
                      </div>
                    </div>

                    {isSameUser && (
                      <span style={{ fontSize: '0.68rem', color: '#2D2D2D', opacity: 0.25, marginTop: '4px', flexShrink: 0 }}>{formatTime(msg.created_at)}</span>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Bouton scroll to bottom */}
        {showScrollBtn && (
          <div style={{ position: 'absolute', bottom: '90px', left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
            <button
              onClick={() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); setShowScrollBtn(false) }}
              style={{ backgroundColor: '#1A1A2E', color: 'white', border: 'none', borderRadius: '20px', padding: '0.45rem 1rem', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}
            >
              ↓ Derniers messages
            </button>
          </div>
        )}

        {/* Zone de saisie */}
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #F5F0E8' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem', backgroundColor: '#F5F0E8', borderRadius: '12px', padding: '0.65rem 1rem' }}>
            <textarea
              value={newMessage}
              onChange={e => { setNewMessage(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }}
              onKeyDown={handleKeyDown}
              placeholder="Rédigez un message..."
              rows={1}
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', resize: 'none', fontSize: '0.9rem', color: '#2D2D2D', fontFamily: 'inherit', lineHeight: 1.5, maxHeight: '120px', overflow: 'auto' }}
            />
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim() || sending}
              style={{ backgroundColor: newMessage.trim() ? '#E8501A' : '#ccc', color: 'white', border: 'none', borderRadius: '8px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: newMessage.trim() ? 'pointer' : 'default', flexShrink: 0, transition: 'background 0.15s' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#2D2D2D', opacity: 0.35, marginTop: '0.4rem', textAlign: 'right' }}>Entrée pour envoyer · Maj+Entrée pour sauter une ligne</div>
        </div>
      </div>

      {/* Membres en ligne */}
      <div style={{ width: '220px', flexShrink: 0, backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#2D2D2D', opacity: 0.4, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
          En ligne — {onlineMembers.length}
        </div>
        {onlineMembers.map(member => (
          <a key={member.user_id} href={`/membre/${member.user_id}`} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none', borderRadius: '8px', padding: '0.35rem 0.5rem', transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F5F0E8')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#E8501A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.7rem', overflow: 'hidden' }}>
                {member.profile?.avatar_url
                  ? <img src={member.profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : `${(member.profile?.first_name || '?')[0]}${(member.profile?.last_name || '')[0] || ''}`.toUpperCase()
                }
              </div>
              <span style={{ position: 'absolute', bottom: '0', right: '0', width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#22C55E', border: '1.5px solid white' }} />
            </div>
            <span style={{ fontSize: '0.82rem', color: '#2D2D2D', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {member.profile?.first_name} {member.profile?.last_name}
            </span>
          </a>
        ))}
        {onlineMembers.length === 0 && (
          <div style={{ fontSize: '0.82rem', color: '#2D2D2D', opacity: 0.35, textAlign: 'center', marginTop: '1rem' }}>Aucun membre en ligne</div>
        )}
      </div>

    </div>
  )
}
