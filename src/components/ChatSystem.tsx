// @ts-nocheck
'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Conversation {
  id: string
  other_user: {
    id: string
    first_name: string
    last_name: string
    avatar_url: string | null
    activity: string | null
  }
  last_message: string
  last_message_at: string
}

interface Message {
  id: string
  content: string
  sender_id: string
  created_at: string
}

const ADMIN_ID = '13cdb485-42e0-48df-b2f8-14dc77dd895a'

export default function ChatSystem({ userId }: { userId: string | null }) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConv, setActiveConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!userId) return
    fetchConversations(userId)
  }, [userId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Fermer dropdown en cliquant ailleurs
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const fetchConversations = async (uid: string) => {
    const supabase = createClient()
    const { data } = await supabase
      .from('conversations')
      .select('id, last_message, last_message_at, participant1_id, participant2_id')
      .or(`participant1_id.eq.${uid},participant2_id.eq.${uid}`)
      .order('last_message_at', { ascending: false })

    if (!data || data.length === 0) return

    const otherIds = data.map((c: any) => c.participant1_id === uid ? c.participant2_id : c.participant1_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, avatar_url, activity')
      .in('id', otherIds)

    const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]))

    const convs = data.map((c: any) => {
      const otherId = c.participant1_id === uid ? c.participant2_id : c.participant1_id
      return {
        id: c.id,
        other_user: profileMap[otherId] || null,
        last_message: c.last_message || '',
        last_message_at: c.last_message_at || '',
      }
    })
    setConversations(convs)

    // Compter les conversations avec messages non lus (last_message non vide)
    setUnreadCount(convs.filter(c => c.last_message).length)
  }

  const openConversation = async (conv: Conversation) => {
    setActiveConv(conv)
    setShowDropdown(false)
    const supabase = createClient()
    const { data } = await supabase
      .from('meello_messages')
      .select('id, content, sender_id, created_at')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true })
    if (data) setMessages(data)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !activeConv || !userId) return

    const supabase = createClient()
    const msgContent = newMessage.trim()

    await supabase.from('meello_messages').insert({
      conversation_id: activeConv.id,
      sender_id: userId,
      content: msgContent,
    })
    await supabase.from('conversations').update({
      last_message: msgContent,
      last_message_at: new Date().toISOString(),
    }).eq('id', activeConv.id)

    // Notifier le destinataire
    const receiverId = activeConv.other_user?.id
    if (receiverId && receiverId !== userId) {
      await supabase.from('notifications').insert({
        user_id: receiverId,
        type: 'message',
        content: `t'a envoyé un message`,
        link: `/messages`,
        from_user_id: userId,
      })
    }

    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      content: msgContent,
      sender_id: userId,
      created_at: new Date().toISOString(),
    }])
    setNewMessage('')
    fetchConversations(userId)
  }

  const formatTime = (d: string) => {
    if (!d) return ''
    const date = new Date(d)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    if (diff < 60000) return 'à l\'instant'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}min`
    if (diff < 86400000) return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  return (
    <>
      {/* Bouton message dans la topbar — géré via prop onToggle depuis TopBar */}
      {/* Dropdown conversations */}
      {showDropdown && (
        <div ref={dropdownRef} style={{
          position: 'fixed',
          top: '4rem',
          right: '1.5rem',
          backgroundColor: 'white',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          width: '320px',
          maxHeight: '420px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          zIndex: 300,
        }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #F5F0E8' }}>
            <span style={{ fontFamily: 'var(--font-clash)', fontWeight: 700, fontSize: '1rem', color: '#2D2D2D' }}>Messages</span>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {conversations.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#2D2D2D', opacity: 0.4, fontSize: '0.9rem' }}>
                Aucune conversation
              </div>
            ) : (
              conversations.map(conv => (
                <div
                  key={conv.id}
                  onClick={() => openConversation(conv)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.85rem 1.25rem',
                    cursor: 'pointer',
                    borderBottom: '1px solid #F5F0E8',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F5F0E8')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  {/* Avatar */}
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '50%',
                    backgroundColor: '#E8501A', color: 'white', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '0.8rem', overflow: 'hidden',
                  }}>
                    {conv.other_user?.avatar_url
                      ? <img src={conv.other_user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : `${(conv.other_user?.first_name || '?')[0]}${(conv.other_user?.last_name || '')[0] || ''}`
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <div style={{ fontWeight: 600, color: '#2D2D2D', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        {conv.other_user?.first_name} {conv.other_user?.last_name}
                        {conv.other_user?.id === ADMIN_ID && (
                          <img src="/icons/badge-check.svg" alt="" style={{ width: '13px', height: '13px' }} />
                        )}
                      </div>
                      <span style={{ fontSize: '0.72rem', color: '#2D2D2D', opacity: 0.4, flexShrink: 0 }}>
                        {formatTime(conv.last_message_at)}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#2D2D2D', opacity: 0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {conv.last_message || 'Aucun message'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Fenêtre de chat flottante */}
      {activeConv && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          right: '2rem',
          width: '320px',
          height: '420px',
          backgroundColor: 'white',
          borderRadius: '16px 16px 0 0',
          boxShadow: '0 -4px 32px rgba(0,0,0,0.12)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 400,
          overflow: 'hidden',
        }}>
          {/* Header chat */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '0.85rem 1rem',
            backgroundColor: '#1A1A2E',
            cursor: 'pointer',
          }} onClick={() => setShowDropdown(v => !v)}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              backgroundColor: '#E8501A', color: 'white', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: '0.72rem', overflow: 'hidden',
            }}>
              {activeConv.other_user?.avatar_url
                ? <img src={activeConv.other_user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : `${(activeConv.other_user?.first_name || '?')[0]}${(activeConv.other_user?.last_name || '')[0] || ''}`
              }
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: 'white', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                {activeConv.other_user?.first_name} {activeConv.other_user?.last_name}
                {activeConv.other_user?.id === ADMIN_ID && (
                  <img src="/icons/badge-check.svg" alt="" style={{ width: '13px', height: '13px' }} />
                )}
              </div>
              {activeConv.other_user?.activity && (
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>{activeConv.other_user.activity}</div>
              )}
            </div>
            <button
              onClick={e => { e.stopPropagation(); setActiveConv(null) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', fontSize: '1.1rem', padding: '0.2rem 0.4rem', lineHeight: 1 }}
            >✕</button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: '#2D2D2D', opacity: 0.3, fontSize: '0.85rem', marginTop: '2rem' }}>
                Commencez la conversation
              </div>
            )}
            {messages.map(msg => {
              const isMe = msg.sender_id === userId
              return (
                <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    backgroundColor: isMe ? '#E8501A' : '#F5F0E8',
                    color: isMe ? 'white' : '#2D2D2D',
                    padding: '0.5rem 0.8rem',
                    borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    maxWidth: '75%',
                    fontSize: '0.88rem',
                    lineHeight: 1.5,
                    wordBreak: 'break-word',
                  }}>
                    {msg.content}
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form onSubmit={sendMessage} style={{ padding: '0.65rem 0.75rem', borderTop: '1px solid #F5F0E8', display: 'flex', gap: '0.4rem' }}>
            <input
              ref={inputRef}
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder="Envoie un message..."
              style={{
                flex: 1, border: '1.5px solid #E8E3D9', borderRadius: '8px',
                padding: '0.5rem 0.75rem', fontSize: '0.88rem', outline: 'none',
                fontFamily: 'inherit',
              }}
            />
            <button
              type="submit"
              disabled={!newMessage.trim()}
              style={{
                backgroundColor: newMessage.trim() ? '#E8501A' : '#E8E3D9',
                color: newMessage.trim() ? 'white' : '#999',
                border: 'none', borderRadius: '8px',
                padding: '0.5rem 0.85rem',
                fontWeight: 600, cursor: newMessage.trim() ? 'pointer' : 'default',
                fontSize: '0.85rem', flexShrink: 0,
                transition: 'all 0.15s',
              }}
            >
              ↩
            </button>
          </form>
        </div>
      )}

      {/* Exposer toggle pour TopBar via window */}
      <ToggleExposer onToggle={() => setShowDropdown(v => !v)} unreadCount={unreadCount} />
    </>
  )
}

// Composant invisible qui expose le toggle au TopBar via un event
function ToggleExposer({ onToggle, unreadCount }: { onToggle: () => void, unreadCount: number }) {
  useEffect(() => {
    const handler = () => onToggle()
    window.addEventListener('meello:toggle-chat', handler)
    return () => window.removeEventListener('meello:toggle-chat', handler)
  }, [onToggle])

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('meello:chat-unread', { detail: unreadCount }))
  }, [unreadCount])

  return null
}
