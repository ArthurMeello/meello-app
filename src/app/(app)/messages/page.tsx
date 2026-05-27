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

const ADMIN_ID = '13cdb485-42e0-48df-b2f8-14dc77dd895a'

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConv, setActiveConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [otherIsTyping, setOtherIsTyping] = useState(false)
  const [otherIsOnline, setOtherIsOnline] = useState(false)
  const [mobileView, setMobileView] = useState<'list' | 'conv'>('list')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const typingChannelRef = useRef<any>(null)
  const typingTimeoutRef = useRef<any>(null)
  const activeConvRef = useRef<Conversation | null>(null)
  const userIdRef = useRef<string | null>(null)
  const readPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { activeConvRef.current = activeConv }, [activeConv])
  useEffect(() => { userIdRef.current = userId }, [userId])

  // Masquer topbar + bottom nav quand conversation ouverte sur mobile
  useEffect(() => {
    if (mobileView === 'conv') {
      document.body.classList.add('msg-conv-open')
    } else {
      document.body.classList.remove('msg-conv-open')
    }
    return () => document.body.classList.remove('msg-conv-open')
  }, [mobileView])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, otherIsTyping])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      const uid = data.user.id
      setUserId(uid)
      fetchConversations(uid)

      // Écouter les nouveaux messages en temps réel
      const msgChannel = supabase
        .channel(`messages-page:${uid}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'meello_messages' }, (payload: any) => {
          const updated = payload.new
          if (updated.read_at && updated.sender_id === uid) {
            setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, read_at: updated.read_at } : m))
          }
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'meello_messages' }, async (payload: any) => {
          const msg = payload.new
          if (msg.sender_id === userIdRef.current) return

          const currentConv = activeConvRef.current
          const newMsg = { id: msg.id, content: msg.content, sender_id: msg.sender_id, created_at: msg.created_at }

          if (currentConv?.id === msg.conversation_id) {
            // Conversation déjà ouverte — ajouter en live
            setMessages(prev => [...prev, newMsg])
          }

          // Mettre à jour la liste des conversations
          fetchConversations(userIdRef.current!)
        })
        .subscribe()

      return () => { msgChannel.unsubscribe() }
    })
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

    // Notifs non lues
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
        unread: isUnread,
      }
    })
    setConversations(convs)
  }

  const openConversation = async (conv: Conversation) => {
    setActiveConv({ ...conv, unread: false })
    setMobileView('conv')
    setOtherIsTyping(false)
    setOtherIsOnline(false)
    const supabase = createClient()

    // Vérifier si l'autre membre est en ligne
    if (conv.other_user?.id) {
      const since = new Date(Date.now() - 30 * 1000).toISOString()
      const { data: presence } = await supabase
        .from('qg_presence')
        .select('last_seen')
        .eq('user_id', conv.other_user.id)
        .gte('last_seen', since)
        .maybeSingle()
      setOtherIsOnline(!!presence)
    }

    const { data } = await supabase
      .from('meello_messages')
      .select('id, content, sender_id, created_at, read_at')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true })
    if (data) setMessages(data)

    // Marquer les messages reçus comme lus
    const uid = userIdRef.current || userId
    if (uid) {
      await supabase.from('meello_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', conv.id)
        .neq('sender_id', uid)
        .is('read_at', null)
    }

    // Marquer notifs comme lues
    if (userId && conv.other_user?.id) {
      await supabase.from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('type', 'message')
        .eq('from_user_id', conv.other_user.id)
        .eq('read', false)
      setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread: false } : c))
    }

    // Canal typing indicator
    if (typingChannelRef.current) typingChannelRef.current.unsubscribe()
    const typingChannel = supabase.channel(`typing:${conv.id}`)
    typingChannel
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
    typingChannelRef.current = typingChannel

    // Polling "Lu" toutes les 3s
    if (readPollRef.current) clearInterval(readPollRef.current)
    const pollUid = userIdRef.current || userId
    readPollRef.current = setInterval(async () => {
      const currentConv = activeConvRef.current
      if (!currentConv || !pollUid) return
      const supabasePoll = createClient()
      const { data } = await supabasePoll
        .from('meello_messages')
        .select('id, read_at')
        .eq('conversation_id', currentConv.id)
        .eq('sender_id', pollUid)
        .not('read_at', 'is', null)
      if (data && data.length > 0) {
        setMessages(prev => prev.map(m => {
          const updated = data.find(d => d.id === m.id)
          return updated ? { ...m, read_at: updated.read_at } : m
        }))
      }
    }, 3000)

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

    const receiverId = activeConv.other_user?.id
    if (receiverId && receiverId !== userId) {
      const { data: existing } = await supabase
        .from('notifications').select('id')
        .eq('user_id', receiverId).eq('type', 'message')
        .eq('from_user_id', userId).eq('read', false).single()
      if (!existing) {
        await supabase.from('notifications').insert({
          user_id: receiverId, type: 'message',
          content: `t'a envoyé un message`, link: `/messages`, from_user_id: userId,
        })
      }
    }

    // Stopper le typing indicator immédiatement
    if (typingChannelRef.current) {
      typingChannelRef.current.send({ type: 'broadcast', event: 'stop_typing', payload: { user_id: userId } })
    }

    setMessages(prev => [...prev, insertedMsg || {
      id: Date.now().toString(), content: msgContent,
      sender_id: userId, created_at: new Date().toISOString(), read_at: null,
    }])
    setNewMessage('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
    fetchConversations(userId)
  }

  const renderContent = (text: string, isMe: boolean) =>
    text.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
      /^https?:\/\//.test(part)
        ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: isMe ? 'rgba(255,255,255,0.9)' : '#E8501A', textDecoration: 'underline', wordBreak: 'break-all' }}>{part}</a>
        : <span key={i}>{part}</span>
    )

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
      <style>{`
        @keyframes typing-dot {
          0%, 60%, 100% { opacity: 0.2; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-3px); }
        }
        @media (max-width: 768px) {
          .msg-layout {
            flex-direction: column !important;
            height: 100% !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .msg-list {
            width: 100% !important;
            flex: 1 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
          }
          .msg-list-header {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            position: relative !important;
            flex-shrink: 0 !important;
            padding: 0.85rem 1rem !important;
            padding-top: calc(0.85rem + env(safe-area-inset-top)) !important;
            border-bottom: 1px solid #F5F0E8 !important;
            min-height: 56px !important;
          }
          .msg-list-header h2 {
            position: absolute !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            margin: 0 !important;
          }
          .msg-list-scroll {
            flex: 1 !important;
            overflow-y: auto !important;
            -webkit-overflow-scrolling: touch !important;
          }
          .msg-conv {
            position: absolute !important;
            inset: 0 !important;
            z-index: 10 !important;
            border-radius: 0 !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
          }
          .msg-conv-messages {
            flex: 1 !important;
            overflow-y: auto !important;
            min-height: 0 !important;
          }
          .msg-conv form {
            flex-shrink: 0 !important;
            padding-bottom: calc(0.85rem + env(safe-area-inset-bottom)) !important;
          }
          .msg-conv-fullscreen-header { display: flex !important; }
          .msg-conv-desktop-header { display: none !important; }
          .msg-list-mobile-hidden { display: none !important; }
          .msg-conv-mobile-hidden { display: none !important; }
          .msg-back-btn { display: flex !important; }
          body.msg-conv-open .mobile-only { display: none !important; }
        }
      `}</style>

      <div className="msg-layout" style={{ height: 'calc(100vh - 4rem)', display: 'flex', gap: '1rem', maxWidth: '960px', margin: '0 auto' }}>

        {/* Liste conversations */}
        <div className={`msg-list${mobileView === 'conv' ? ' msg-list-mobile-hidden' : ''}`} style={{
          width: '300px', flexShrink: 0, backgroundColor: 'white',
          borderRadius: '16px', overflow: 'hidden',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column',
        }}>
          <div className="msg-list-header" style={{ padding: '1.25rem', borderBottom: '1px solid #F5F0E8' }}>
            <h2 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.2rem', color: '#2D2D2D', margin: 0 }}>Conversations</h2>
          </div>
          <div className="msg-list-scroll" style={{ flex: 1, overflowY: 'auto' }}>
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
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.85rem 1.25rem', cursor: 'pointer',
                  backgroundColor: activeConv?.id === conv.id ? '#FFF0ED' : conv.unread ? 'rgba(232,80,26,0.04)' : 'transparent',
                  borderLeft: activeConv?.id === conv.id ? '3px solid #E8501A' : '3px solid transparent',
                  transition: 'background 0.15s',
                }}
              >
                <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: '#E8501A', color: 'white', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.82rem', overflow: 'hidden' }}>
                  {conv.other_user?.avatar_url
                    ? <img src={conv.other_user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : `${(conv.other_user?.first_name || '?')[0]}${(conv.other_user?.last_name || '')[0] || ''}`}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                    <div style={{ fontWeight: conv.unread ? 700 : 600, color: '#2D2D2D', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      {conv.other_user?.first_name} {conv.other_user?.last_name}
                      {conv.other_user?.id === ADMIN_ID && <img src="/icons/badge-check.svg" alt="" style={{ width: '13px', height: '13px' }} />}
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#2D2D2D', opacity: 0.4, flexShrink: 0 }}>{formatTime(conv.last_message_at)}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#2D2D2D', opacity: conv.unread ? 0.9 : 0.5, fontWeight: conv.unread ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {conv.last_message || 'Aucun message'}
                  </div>
                </div>
                {conv.unread && <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#E8501A', flexShrink: 0 }} />}
              </div>
            ))}
          </div>
        </div>

        {/* Conversation active */}
        <div className={`msg-conv${mobileView === 'list' ? ' msg-conv-mobile-hidden' : ''}`} style={{ flex: 1, backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!activeConv ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2D2D2D', opacity: 0.3, fontSize: '0.95rem' }}>
              Sélectionne une conversation
            </div>
          ) : (
            <>
              {/* Header mobile plein écran */}
              <div className="msg-conv-fullscreen-header" style={{ display: 'none', padding: '0.75rem 1rem', alignItems: 'center', gap: '0.75rem', backgroundColor: 'white', borderBottom: '1px solid #F5F0E8', paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}>
                <button onClick={() => { setMobileView('list'); setActiveConv(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E8501A', flexShrink: 0, padding: '0.25rem', display: 'flex', alignItems: 'center' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#E8501A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.82rem', overflow: 'hidden' }}>
                    {activeConv.other_user?.avatar_url
                      ? <img src={activeConv.other_user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : `${(activeConv.other_user?.first_name || '?')[0]}${(activeConv.other_user?.last_name || '')[0] || ''}`}
                  </div>
                  {otherIsOnline && <span style={{ position: 'absolute', bottom: 0, right: 0, width: '11px', height: '11px', borderRadius: '50%', backgroundColor: '#22C55E', border: '2px solid white' }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: '#2D2D2D', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    {activeConv.other_user?.first_name} {activeConv.other_user?.last_name}
                    {activeConv.other_user?.id === ADMIN_ID && <img src="/icons/badge-check.svg" alt="" style={{ width: '16px', height: '16px' }} />}
                  </div>
                  {otherIsOnline && <div style={{ fontSize: '0.75rem', color: '#22C55E', fontWeight: 600 }}>En ligne</div>}
                  {!otherIsOnline && activeConv.other_user?.activity && <div style={{ fontSize: '0.75rem', opacity: 0.45, color: '#2D2D2D' }}>{activeConv.other_user.activity}</div>}
                </div>
              </div>

              {/* Header desktop */}
              <div className="msg-conv-desktop-header" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #F5F0E8', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '50%', backgroundColor: '#E8501A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.78rem', overflow: 'hidden' }}>
                    {activeConv.other_user?.avatar_url
                      ? <img src={activeConv.other_user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : `${(activeConv.other_user?.first_name || '?')[0]}${(activeConv.other_user?.last_name || '')[0] || ''}`}
                  </div>
                  {otherIsOnline && <span style={{ position: 'absolute', bottom: 0, right: 0, width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#22C55E', border: '2px solid white' }} />}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#2D2D2D', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    {activeConv.other_user?.first_name} {activeConv.other_user?.last_name}
                    {activeConv.other_user?.id === ADMIN_ID && <img src="/icons/badge-check.svg" alt="" style={{ width: '16px', height: '16px' }} />}
                  </div>
                  {activeConv.other_user?.activity && <div style={{ fontSize: '0.78rem', opacity: 0.5, color: '#2D2D2D' }}>{activeConv.other_user.activity}</div>}
                </div>
              </div>

              {/* Messages */}
              <div className="msg-conv-messages" style={{ flex: 1, overflowY: 'auto', padding: '1rem', paddingBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {(() => {
                  const myMsgs = messages.filter(m => m.sender_id === userId)
                  const lastReadMsg = [...myMsgs].reverse().find(m => m.read_at)
                  const lastSentMsg = myMsgs[myMsgs.length - 1]
                  const showLuId = lastReadMsg?.id
                  const showEnvoyeId = (!lastReadMsg || lastSentMsg?.id !== lastReadMsg?.id) ? lastSentMsg?.id : null
                  return messages.map((msg, i) => {
                    const isMe = msg.sender_id === userId
                    const prevMsg = messages[i - 1]
                    const showAvatar = !isMe && (!prevMsg || prevMsg.sender_id !== msg.sender_id)
                    return (
                      <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                        <div style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: '0.5rem', width: '100%' }}>
                          {!isMe && (
                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#E8501A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.6rem', overflow: 'hidden', flexShrink: 0, opacity: showAvatar ? 1 : 0 }}>
                              {activeConv.other_user?.avatar_url
                                ? <img src={activeConv.other_user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : `${(activeConv.other_user?.first_name || '?')[0]}${(activeConv.other_user?.last_name || '')[0] || ''}`}
                            </div>
                          )}
                          <div style={{
                            backgroundColor: isMe ? '#E8501A' : '#F5F0E8',
                            color: isMe ? 'white' : '#2D2D2D',
                            padding: '0.55rem 0.85rem',
                            borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                            maxWidth: '75%', minWidth: '48px', fontSize: '0.9rem', lineHeight: 1.5,
                            wordBreak: 'break-word', whiteSpace: 'pre-wrap',
                          }}>
                            {renderContent(msg.content, isMe)}
                          </div>
                        </div>
                        {isMe && msg.id === showLuId && (
                          <span style={{ fontSize: '0.68rem', color: '#2D2D2D', opacity: 0.4, marginTop: '2px' }}>Lu</span>
                        )}
                        {isMe && msg.id === showEnvoyeId && (
                          <span style={{ fontSize: '0.68rem', color: '#2D2D2D', opacity: 0.4, marginTop: '2px' }}>Envoyé</span>
                        )}
                      </div>
                    )
                  })
                })()}

                {/* Typing indicator */}
                {otherIsTyping && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-end', gap: '0.5rem' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#E8501A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.6rem', overflow: 'hidden', flexShrink: 0 }}>
                      {activeConv.other_user?.avatar_url
                        ? <img src={activeConv.other_user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : `${(activeConv.other_user?.first_name || '?')[0]}${(activeConv.other_user?.last_name || '')[0] || ''}`}
                    </div>
                    <div style={{ backgroundColor: '#F5F0E8', padding: '0.5rem 0.9rem', borderRadius: '16px 16px 16px 4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#2D2D2D', opacity: 0.4, animation: 'typing-dot 1.2s infinite', animationDelay: '0s', display: 'inline-block' }} />
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#2D2D2D', opacity: 0.4, animation: 'typing-dot 1.2s infinite', animationDelay: '0.2s', display: 'inline-block' }} />
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#2D2D2D', opacity: 0.4, animation: 'typing-dot 1.2s infinite', animationDelay: '0.4s', display: 'inline-block' }} />
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <form onSubmit={sendMessage} style={{ padding: '0.85rem 1rem', paddingBottom: 'calc(0.85rem + env(safe-area-inset-bottom))', borderTop: '1px solid #F5F0E8', display: 'flex', gap: '0.5rem', alignItems: 'flex-end', backgroundColor: 'white', flexShrink: 0 }}>
                <textarea
                  ref={inputRef}
                  value={newMessage}
                  onFocus={async () => {
                    const uid = userIdRef.current || userId
                    if (!activeConvRef.current || !uid) return
                    const supabase = createClient()
                    await supabase.from('meello_messages')
                      .update({ read_at: new Date().toISOString() })
                      .eq('conversation_id', activeConvRef.current.id)
                      .neq('sender_id', uid)
                      .is('read_at', null)
                  }}
                  onChange={e => {
                    setNewMessage(e.target.value)
                    e.target.style.height = 'auto'
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                    // Broadcaster le signal typing
                    if (typingChannelRef.current && e.target.value.trim()) {
                      typingChannelRef.current.send({ type: 'broadcast', event: 'typing', payload: { user_id: userId } })
                    }
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e as any) }
                  }}
                  placeholder="Envoie un message…"
                  rows={1}
                  style={{
                    flex: 1, border: '2px solid #E8E3D9', borderRadius: '10px',
                    padding: '0.6rem 0.9rem', fontSize: '16px', outline: 'none',
                    fontFamily: 'inherit', resize: 'none', overflow: 'hidden',
                    minHeight: '42px', lineHeight: '1.4',
                  }}
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  style={{
                    backgroundColor: newMessage.trim() ? '#E8501A' : '#E8E3D9',
                    color: newMessage.trim() ? 'white' : '#999',
                    border: 'none', borderRadius: '10px',
                    padding: '0.6rem 1.1rem', fontWeight: 600,
                    cursor: newMessage.trim() ? 'pointer' : 'default',
                    height: '42px', flexShrink: 0, transition: 'all 0.15s',
                  }}
                >
                  Envoyer
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  )
}
