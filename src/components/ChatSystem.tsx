// @ts-nocheck
'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
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
  const pathname = usePathname()
  const isOnMessagesPage = pathname === '/messages'
  const [showDropdown, setShowDropdown] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConv, setActiveConv] = useState<Conversation | null>(null)
  // Sync ref pour accès dans les callbacks Realtime
  useEffect(() => { activeConvRef.current = activeConv }, [activeConv])
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const [unreadConvIds, setUnreadConvIds] = useState<Set<string>>(new Set())
  const [otherIsTyping, setOtherIsTyping] = useState(false)
  const [otherIsOnline, setOtherIsOnline] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const channelRef = useRef<any>(null)
  const activeConvRef = useRef<Conversation | null>(null)

  useEffect(() => {
    if (!userId) return
    fetchConversations(userId)

    // Écouter les nouveaux messages en temps réel
    const supabase = createClient()
    const msgChannel = supabase
      .channel(`new-messages:${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'meello_messages' },
        (payload: any) => {
          const updated = payload.new
          if (updated.read_at && updated.sender_id === userId) {
            setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, read_at: updated.read_at } : m))
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'meello_messages' },
        async (payload: any) => {
          const msg = payload.new
          // Ignorer ses propres messages
          if (msg.sender_id === userId) return

          // Rafraîchir les conversations pour mettre à jour l'aperçu
          fetchConversations(userId)

          // Trouver la conversation concernée
          const { data: conv } = await supabase
            .from('conversations')
            .select('id, participant1_id, participant2_id, last_message, last_message_at')
            .eq('id', msg.conversation_id)
            .single()

          if (!conv) return

          // Récupérer le profil de l'expéditeur
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, avatar_url, activity')
            .eq('id', msg.sender_id)
            .single()

          const newMsg = {
            id: msg.id,
            content: msg.content,
            sender_id: msg.sender_id,
            created_at: msg.created_at,
          }

          // Si on est sur la page /messages, ne rien faire ici
          if (isOnMessagesPage) return

          const currentConv = activeConvRef.current
          if (currentConv?.id === conv.id) {
            // Conversation déjà ouverte — ajouter le message en live
            setMessages(msgs => [...msgs, newMsg])
          } else {
            // Ouvrir automatiquement la conversation avec tout l'historique
            const convObj = {
              id: conv.id,
              other_user: senderProfile,
              last_message: msg.content,
              last_message_at: msg.created_at,
            }
            const { data: history } = await supabase
              .from('meello_messages')
              .select('id, content, sender_id, created_at')
              .eq('conversation_id', conv.id)
              .order('created_at', { ascending: true })
            setMessages(history || [newMsg])
            setActiveConv(convObj)
          }
        }
      )
      .subscribe()

    return () => {
      msgChannel.unsubscribe()
    }
  }, [userId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Ouvrir une conversation depuis n'importe quelle page via event
  useEffect(() => {
    if (!userId) return
    const handler = async (e: CustomEvent) => {
      const convId = e.detail
      const supabase = createClient()
      // Charger la conversation
      const { data: conv } = await supabase
        .from('conversations')
        .select('id, participant1_id, participant2_id, last_message, last_message_at')
        .eq('id', convId)
        .single()
      if (!conv) return
      const otherId = conv.participant1_id === userId ? conv.participant2_id : conv.participant1_id
      const { data: otherProfile } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url, activity')
        .eq('id', otherId)
        .single()
      const convObj: Conversation = {
        id: conv.id,
        other_user: otherProfile,
        last_message: conv.last_message || '',
        last_message_at: conv.last_message_at || '',
      }
      await fetchConversations(userId)
      setShowDropdown(false)
      openConversation(convObj)
    }
    window.addEventListener('meello:open-conv', handler as EventListener)
    return () => window.removeEventListener('meello:open-conv', handler as EventListener)
  }, [userId])

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

    // Récupérer les notifs message non lues pour savoir quelles convs sont non lues
    const { data: unreadNotifs } = await supabase
      .from('notifications')
      .select('from_user_id')
      .eq('user_id', uid)
      .eq('type', 'message')
      .eq('read', false)

    const unreadSenderIds = new Set((unreadNotifs || []).map((n: any) => n.from_user_id))

    // Dernier message de chaque conversation (tous expéditeurs confondus)
    const convIds = data.map((c: any) => c.id)
    const { data: lastMsgs } = await supabase
      .from('meello_messages')
      .select('conversation_id, content, sender_id, created_at')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: false })
    const lastMsgMap: Record<string, { content: string; sender_id: string }> = {}
    for (const msg of (lastMsgs || [])) {
      if (!lastMsgMap[msg.conversation_id]) lastMsgMap[msg.conversation_id] = { content: msg.content, sender_id: msg.sender_id }
    }

    const convs = data.map((c: any) => {
      const otherId = c.participant1_id === uid ? c.participant2_id : c.participant1_id
      const isUnread = unreadSenderIds.has(otherId)
      const lastMsg = lastMsgMap[c.id]
      const preview = lastMsg
        ? (lastMsg.sender_id === uid ? `Vous : ${lastMsg.content}` : lastMsg.content)
        : (c.last_message || '')
      return {
        id: c.id,
        other_user: profileMap[otherId] || null,
        last_message: preview,
        last_message_at: c.last_message_at || '',
      }
    })
    setConversations(convs)

    const unreadIds = new Set(convs.filter(c => unreadSenderIds.has(c.other_user?.id)).map(c => c.id))
    setUnreadConvIds(unreadIds)
    setUnreadCount(unreadIds.size)
    window.dispatchEvent(new CustomEvent('meello:chat-unread', { detail: unreadIds.size }))
  }

  const openConversation = async (conv: Conversation) => {
    setActiveConv(conv)
    setShowDropdown(false)
    // Vérifier si l'autre membre est en ligne (présence < 2 min)
    if (conv.other_user?.id) {
      const supabasePresence = createClient()
      const since = new Date(Date.now() - 2 * 60 * 1000).toISOString()
      const { data: presence } = await supabasePresence
        .from('qg_presence')
        .select('last_seen')
        .eq('user_id', conv.other_user.id)
        .gte('last_seen', since)
        .single()
      setOtherIsOnline(!!presence)
    }
    const supabase = createClient()
    const { data } = await supabase
      .from('meello_messages')
      .select('id, content, sender_id, created_at, read_at')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true })
    if (data) setMessages(data)

    // Marquer les messages reçus comme lus
    if (userId) {
      await supabase.from('meello_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', conv.id)
        .neq('sender_id', userId)
        .is('read_at', null)
    }
    // Ouvrir canal Realtime pour le typing indicator
    if (channelRef.current) {
      channelRef.current.unsubscribe()
    }
    const supabaseRT = createClient()
    const channel = supabaseRT.channel(`typing:${conv.id}`)
    channel
      .on('broadcast', { event: 'typing' }, ({ payload }: any) => {
        if (payload.user_id !== userId) {
          setOtherIsTyping(true)
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
          typingTimeoutRef.current = setTimeout(() => setOtherIsTyping(false), 2500)
        }
      })
      .on('broadcast', { event: 'stop_typing' }, ({ payload }: any) => {
        if (payload.user_id !== userId) {
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
          setOtherIsTyping(false)
        }
      })
      .subscribe()
    channelRef.current = channel

    // Marquer les notifs message de cet expéditeur comme lues
    if (userId && conv.other_user?.id) {
      await supabase.from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('type', 'message')
        .eq('from_user_id', conv.other_user.id)
        .eq('read', false)

      const next = new Set(unreadConvIds)
      next.delete(conv.id)
      const newCount = next.size
      setUnreadConvIds(next)
      setUnreadCount(newCount)
      window.dispatchEvent(new CustomEvent('meello:chat-unread', { detail: newCount }))
    }
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !activeConv || !userId) return

    const supabase = createClient()
    const msgContent = newMessage.trim()

    const { data: insertedMsg } = await supabase.from('meello_messages').insert({
      conversation_id: activeConv.id,
      sender_id: userId,
      content: msgContent,
    }).select('id, content, sender_id, created_at, read_at').single()
    await supabase.from('conversations').update({
      last_message: msgContent,
      last_message_at: new Date().toISOString(),
    }).eq('id', activeConv.id)

    // Notifier le destinataire — une seule notif par expéditeur (upsert)
    const receiverId = activeConv.other_user?.id
    if (receiverId && receiverId !== userId) {
      // Vérifier si une notif non lue existe déjà de cet expéditeur
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', receiverId)
        .eq('type', 'message')
        .eq('from_user_id', userId)
        .eq('read', false)
        .single()

      if (!existing) {
        await supabase.from('notifications').insert({
          user_id: receiverId,
          type: 'message',
          content: `t'a envoyé un message`,
          link: `/messages`,
          from_user_id: userId,
        })
      }
    }

    // Stopper le typing indicator immédiatement
    if (channelRef.current) {
      channelRef.current.send({ type: 'broadcast', event: 'stop_typing', payload: { user_id: userId } })
    }

    setMessages(prev => [...prev, insertedMsg || {
      id: Date.now().toString(),
      content: msgContent,
      sender_id: userId,
      created_at: new Date().toISOString(),
      read_at: null,
    }])
    setNewMessage('')
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }
    fetchConversations(userId)
  }

  const renderMessageContent = (text: string, isMe: boolean) => {
    return text.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
      /^https?:\/\//.test(part)
        ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: isMe ? 'rgba(255,255,255,0.9)' : '#E8501A', textDecoration: 'underline', wordBreak: 'break-all' }}>{part}</a>
        : <span key={i}>{part}</span>
    )
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

  // Fermer le chat flottant quand on navigue vers /messages, restaurer en partant
  useEffect(() => {
    if (isOnMessagesPage) {
      // Sauvegarder la conv active avant de fermer (sans écraser le localStorage)
      if (activeConvRef.current) {
        localStorage.setItem('meello:savedConv', JSON.stringify(activeConvRef.current))
      }
      setActiveConv(null)
      setShowDropdown(false)
    } else {
      // On revient d'une autre page — restaurer la conv sauvegardée si elle existe
      const saved = localStorage.getItem('meello:savedConv')
      if (saved) {
        try {
          const conv = JSON.parse(saved)
          localStorage.removeItem('meello:savedConv')
          const supabase = createClient()
          supabase.from('meello_messages')
            .select('id, content, sender_id, created_at, read_at')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: true })
            .then(({ data }) => {
              if (data) setMessages(data)
              setActiveConv(conv)
            })
        } catch { localStorage.removeItem('meello:savedConv') }
      }
    }
  }, [isOnMessagesPage])

  if (isOnMessagesPage) {
    return <ToggleExposer onToggle={() => {}} unreadCount={unreadCount} />
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
              conversations.map(conv => {
                const isUnread = unreadConvIds.has(conv.id)
                return (
                  <div
                    key={conv.id}
                    onClick={() => openConversation(conv)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.85rem 1.25rem',
                      cursor: 'pointer',
                      borderBottom: '1px solid #F5F0E8',
                      backgroundColor: isUnread ? 'rgba(232,80,26,0.04)' : 'transparent',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F5F0E8')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = isUnread ? 'rgba(232,80,26,0.04)' : 'transparent')}
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
                        <div style={{ fontWeight: isUnread ? 700 : 600, color: '#2D2D2D', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          {conv.other_user?.first_name} {conv.other_user?.last_name}
                          {conv.other_user?.id === ADMIN_ID && (
                            <img src="/icons/badge-check.svg" alt="" style={{ width: '13px', height: '13px' }} />
                          )}
                        </div>
                        <span style={{ fontSize: '0.72rem', color: '#2D2D2D', opacity: 0.4, flexShrink: 0 }}>
                          {formatTime(conv.last_message_at)}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#2D2D2D', opacity: isUnread ? 0.9 : 0.5, fontWeight: isUnread ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {conv.last_message || 'Aucun message'}
                      </div>
                    </div>
                    {isUnread && (
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#E8501A', flexShrink: 0 }} />
                    )}
                  </div>
                )
              })
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
          width: '340px',
          height: '520px',
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
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                backgroundColor: '#E8501A', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: '0.72rem', overflow: 'hidden',
              }}>
                {activeConv.other_user?.avatar_url
                  ? <img src={activeConv.other_user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : `${(activeConv.other_user?.first_name || '?')[0]}${(activeConv.other_user?.last_name || '')[0] || ''}`
                }
              </div>
              {otherIsOnline && (
                <span style={{ position: 'absolute', bottom: 0, right: 0, width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#22C55E', border: '1.5px solid #1A1A2E' }} />
              )}
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
              onClick={e => {
                e.stopPropagation()
                setActiveConv(null)
                setOtherIsTyping(false)
                if (channelRef.current) { channelRef.current.unsubscribe(); channelRef.current = null }
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', fontSize: '1.1rem', padding: '0.2rem 0.4rem', lineHeight: 1 }}
            >✕</button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', paddingBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: '#2D2D2D', opacity: 0.3, fontSize: '0.85rem', marginTop: '2rem' }}>
                Commencez la conversation
              </div>
            )}
            {(() => {
              const myMsgs = messages.filter(m => m.sender_id === userId)
              const lastReadMsg = [...myMsgs].reverse().find(m => m.read_at)
              const lastSentMsg = myMsgs[myMsgs.length - 1]
              // On affiche "Lu" sur le dernier message lu, "Envoyé" sur le dernier envoyé si pas encore lu
              const showLuId = lastReadMsg?.id
              const showEnvoyeId = (!lastReadMsg || lastSentMsg?.id !== lastReadMsg?.id) ? lastSentMsg?.id : null
              return messages.map((msg, i) => {
                const isMe = msg.sender_id === userId
                return (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      backgroundColor: isMe ? '#E8501A' : '#F5F0E8',
                      color: isMe ? 'white' : '#2D2D2D',
                      padding: '0.5rem 0.8rem',
                      borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                      maxWidth: '75%',
                      fontSize: '0.88rem',
                      lineHeight: 1.5,
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
                    }}>
                      {renderMessageContent(msg.content, isMe)}
                    </div>
                    {isMe && msg.id === showLuId && (
                      <span style={{ fontSize: '0.65rem', color: '#2D2D2D', opacity: 0.4, marginTop: '2px' }}>Lu</span>
                    )}
                    {isMe && msg.id === showEnvoyeId && (
                      <span style={{ fontSize: '0.65rem', color: '#2D2D2D', opacity: 0.4, marginTop: '2px' }}>Envoyé</span>
                    )}
                  </div>
                )
              })
            })()}
            {otherIsTyping && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  backgroundColor: '#F5F0E8',
                  padding: '0.5rem 0.9rem',
                  borderRadius: '14px 14px 14px 4px',
                  display: 'flex', alignItems: 'center', gap: '3px',
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#2D2D2D', opacity: 0.4, animation: 'typing-dot 1.2s infinite', animationDelay: '0s', display: 'inline-block' }} />
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#2D2D2D', opacity: 0.4, animation: 'typing-dot 1.2s infinite', animationDelay: '0.2s', display: 'inline-block' }} />
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#2D2D2D', opacity: 0.4, animation: 'typing-dot 1.2s infinite', animationDelay: '0.4s', display: 'inline-block' }} />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form onSubmit={sendMessage} style={{ padding: '0.65rem 0.75rem', borderTop: '1px solid #F5F0E8', display: 'flex', gap: '0.4rem', alignItems: 'flex-end' }}>
            <textarea
              ref={inputRef}
              value={newMessage}
              onChange={e => {
                setNewMessage(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                // Broadcaster le signal "typing"
                if (channelRef.current && e.target.value.trim()) {
                  channelRef.current.send({ type: 'broadcast', event: 'typing', payload: { user_id: userId } })
                }
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage(e as any)
                }
              }}
              placeholder="Envoie un message…"
              rows={1}
              style={{
                flex: 1, border: '1.5px solid #E8E3D9', borderRadius: '8px',
                padding: '0.5rem 0.75rem', fontSize: '0.88rem', outline: 'none',
                fontFamily: 'inherit', resize: 'none', overflow: 'hidden',
                minHeight: '36px', lineHeight: '1.4',
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
                transition: 'all 0.15s', height: '36px',
              }}
            >
              ↩
            </button>
          </form>
        </div>
      )}

      {/* CSS animation typing */}
      <style>{`
        @keyframes typing-dot {
          0%, 60%, 100% { opacity: 0.2; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-3px); }
        }
      `}</style>

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
