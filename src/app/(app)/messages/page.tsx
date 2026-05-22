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
  unread: boolean
}

interface Message {
  id: string
  content: string
  sender_id: string
  created_at: string
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConv, setActiveConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id)
        fetchConversations(data.user.id)
      }
    })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchConversations = async (uid: string) => {
    const supabase = createClient()
    const { data } = await supabase
      .from('conversations')
      .select(`
        id,
        last_message,
        last_message_at,
        participant1_id,
        participant2_id,
        profiles!conversations_participant1_id_fkey(id, first_name, last_name, avatar_url, activity),
        profiles!conversations_participant2_id_fkey(id, first_name, last_name, avatar_url, activity)
      `)
      .or(`participant1_id.eq.${uid},participant2_id.eq.${uid}`)
      .order('last_message_at', { ascending: false })

    if (data) {
      const convs = data.map((c: any) => {
        const other = c.participant1_id === uid ? c['profiles!conversations_participant2_id_fkey'] : c['profiles!conversations_participant1_id_fkey']
        return {
          id: c.id,
          other_user: other,
          last_message: c.last_message || '',
          last_message_at: c.last_message_at || '',
          unread: false,
        }
      })
      setConversations(convs)
    }
  }

  const openConversation = async (conv: Conversation) => {
    setActiveConv(conv)
    const supabase = createClient()
    const { data } = await supabase
      .from('messages')
      .select('id, content, sender_id, created_at')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true })
    if (data) setMessages(data)
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !activeConv || !userId) return

    const supabase = createClient()
    await supabase.from('messages').insert({
      conversation_id: activeConv.id,
      sender_id: userId,
      content: newMessage.trim(),
    })
    await supabase.from('conversations').update({
      last_message: newMessage.trim(),
      last_message_at: new Date().toISOString(),
    }).eq('id', activeConv.id)

    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      content: newMessage.trim(),
      sender_id: userId,
      created_at: new Date().toISOString(),
    }])
    setNewMessage('')
    fetchConversations(userId)
  }

  return (
    <div style={{ height: 'calc(100vh - 4rem)', display: 'flex', gap: '1rem', maxWidth: '900px', margin: '0 auto' }}>

      {/* Liste conversations */}
      <div style={{
        width: '300px',
        flexShrink: 0,
        backgroundColor: 'white',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ padding: '1.25rem', borderBottom: '1px solid #F5F0E8' }}>
          <h2 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.2rem', color: '#2D2D2D', margin: 0 }}>Messages</h2>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {conversations.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#2D2D2D', opacity: 0.4, fontSize: '0.9rem' }}>
              Aucune conversation pour l&apos;instant.
            </div>
          )}
          {conversations.map(conv => (
            <div
              key={conv.id}
              onClick={() => openConversation(conv)}
              style={{
                padding: '0.85rem 1.25rem',
                cursor: 'pointer',
                backgroundColor: activeConv?.id === conv.id ? '#FFF0ED' : 'transparent',
                borderLeft: activeConv?.id === conv.id ? '3px solid #E8501A' : '3px solid transparent',
                transition: 'background 0.15s',
              }}
            >
              <div style={{ fontWeight: 600, color: '#2D2D2D', fontSize: '0.9rem' }}>
                {conv.other_user?.first_name} {conv.other_user?.last_name}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#2D2D2D', opacity: 0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {conv.last_message || 'Aucun message'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Conversation active */}
      <div style={{
        flex: 1,
        backgroundColor: 'white',
        borderRadius: '16px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {!activeConv ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2D2D2D', opacity: 0.3, fontSize: '0.95rem' }}>
            Selectionne une conversation
          </div>
        ) : (
          <>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #F5F0E8', fontWeight: 700, color: '#2D2D2D' }}>
              {activeConv.other_user?.first_name} {activeConv.other_user?.last_name}
              <div style={{ fontSize: '0.78rem', fontWeight: 400, opacity: 0.5 }}>{activeConv.other_user?.activity}</div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {messages.map(msg => {
                const isMe = msg.sender_id === userId
                return (
                  <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      backgroundColor: isMe ? '#E8501A' : '#F5F0E8',
                      color: isMe ? 'white' : '#2D2D2D',
                      padding: '0.6rem 0.9rem',
                      borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      maxWidth: '70%',
                      fontSize: '0.9rem',
                      lineHeight: 1.5,
                    }}>
                      {msg.content}
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={sendMessage} style={{ padding: '0.85rem 1rem', borderTop: '1px solid #F5F0E8', display: 'flex', gap: '0.5rem' }}>
              <input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Envoie un message..."
                style={{
                  flex: 1,
                  border: '2px solid #E8E3D9',
                  borderRadius: '10px',
                  padding: '0.6rem 0.9rem',
                  fontSize: '0.95rem',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                style={{
                  backgroundColor: '#E8501A',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '0.6rem 1.1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Envoyer
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
