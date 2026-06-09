// @ts-nocheck
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { GHOST_ID, filterGhost } from '@/lib/ghost'
import { notify } from '@/lib/notify'
import { awardXp } from '@/lib/awardXp'
import SortableOptions from '@/components/SortableOptions'
import { titleCase } from '@/lib/format'

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

// Carte d'un sondage dans le flux QG
function PollCard({ poll, userId, onVote, onEdit, canEdit }: { poll: any; userId: string | null; onVote: (pollId: string, optionId: string) => void; onEdit: (pollId: string) => void; canEdit: boolean }) {
  if (!poll) return <div style={{ fontSize: '0.85rem', color: '#2D2D2D', opacity: 0.4 }}>Sondage…</div>
  const totalVotes = poll.votes.length
  const myVote = poll.votes.find((v: any) => v.user_id === userId)
  return (
    <div style={{ border: '1px solid #E8E3D9', borderRadius: '12px', padding: '0.85rem 1rem', backgroundColor: '#FAFAF7', maxWidth: '420px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#E8501A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
        <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#2D2D2D', flex: 1 }}>{poll.question}</span>
        {canEdit && (
          <button onClick={() => onEdit(poll.id)} title="Modifier le sondage" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.15rem', display: 'flex', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2D2D2D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
        {poll.options.map((opt: any) => {
          const optVotes = poll.votes.filter((v: any) => v.option_id === opt.id)
          const pct = totalVotes > 0 ? Math.round((optVotes.length / totalVotes) * 100) : 0
          const isMine = myVote?.option_id === opt.id
          return (
            <div key={opt.id} onClick={() => onVote(poll.id, opt.id)} style={{ cursor: 'pointer', position: 'relative', borderRadius: '8px', overflow: 'hidden', border: isMine ? '1.5px solid #E8501A' : '1px solid #E8E3D9', backgroundColor: 'white' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${pct}%`, backgroundColor: isMine ? 'rgba(232,80,26,0.15)' : 'rgba(0,0,0,0.05)', transition: 'width 0.25s' }} />
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.7rem', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: '#2D2D2D', fontWeight: isMine ? 600 : 500 }}>{opt.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                  {/* Avatars des votants (votes visibles de tous) */}
                  <div style={{ display: 'flex' }}>
                    {optVotes.slice(0, 4).map((v: any, i: number) => (
                      <div key={v.user_id} title={v.voter ? `${v.voter.first_name} ${v.voter.last_name}` : ''} style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#E8501A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: 700, overflow: 'hidden', border: '1.5px solid white', marginLeft: i === 0 ? 0 : '-6px' }}>
                        {v.voter?.avatar_url ? <img src={v.voter.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : `${(v.voter?.first_name || '?')[0] || ''}`}
                      </div>
                    ))}
                  </div>
                  <span style={{ fontSize: '0.78rem', color: '#2D2D2D', opacity: 0.55, fontWeight: 600 }}>{pct}%</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ fontSize: '0.72rem', color: '#2D2D2D', opacity: 0.4, marginTop: '0.5rem' }}>
        {totalVotes} vote{totalVotes > 1 ? 's' : ''} · clique pour voter
      </div>
    </div>
  )
}

export default function QGPage() {
  const router = useRouter()
  const [messages, setMessages] = useState<QGMessage[]>([])
  const [onlineMembers, setOnlineMembers] = useState<OnlineMember[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [sending, setSending] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [onlineModalOpen, setOnlineModalOpen] = useState(false)
  // Sondages
  const [pollModal, setPollModal] = useState(false)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState<{ id: string; value: string }[]>([{ id: 'o1', value: '' }, { id: 'o2', value: '' }])
  const [pollSubmitting, setPollSubmitting] = useState(false)
  const [polls, setPolls] = useState<Record<string, any>>({}) // poll_id -> { question, options, votes }
  // Édition de sondage — liste unifiée { id, value, existing }
  const [editPollId, setEditPollId] = useState<string | null>(null)
  const [editPollQuestion, setEditPollQuestion] = useState('')
  const [editItems, setEditItems] = useState<{ id: string; value: string; existing?: boolean }[]>([])
  const [editPollSaving, setEditPollSaving] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)
  const oldestCreatedAt = useRef<string | null>(null)
  const isAtBottom = useRef(true)
  const presenceInterval = useRef<any>(null)
  const channelRef = useRef<any>(null)
  const userIdRef = useRef<string | null>(null)

  // Sur mobile, le QG est plein écran : masque la topbar + la bottom-nav
  // (réutilise le mécanisme des conversations privées).
  useEffect(() => {
    document.body.classList.add('msg-conv-open')
    return () => document.body.classList.remove('msg-conv-open')
  }, [])

  useEffect(() => {
    const supabase = createClient()

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      userIdRef.current = user.id

      // Marquer le QG comme lu (masque la pastille de la nav en direct)
      await supabase.from('qg_last_read').upsert(
        { user_id: user.id, last_read_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
      window.dispatchEvent(new CustomEvent('meello:qg-read'))

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (prof) setProfile(prof)

      // Présence en ligne
      await supabase.from('qg_presence').upsert({ user_id: user.id, last_seen: new Date().toISOString() })
      await loadOnlineMembers(supabase)

      // Mettre à jour la présence toutes les 30s
      presenceInterval.current = setInterval(async () => {
        await supabase.from('qg_presence').upsert({ user_id: userIdRef.current, last_seen: new Date().toISOString() })
        await loadOnlineMembers(supabase)
      }, 30000)

      // Realtime nouveaux messages
      channelRef.current = supabase
        .channel('qg-messages-live')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'qg_messages' }, async (payload) => {
          const msg = payload.new
          // Ignorer les messages du compte fantôme (sauf admin)
          if (msg.user_id === GHOST_ID && userIdRef.current !== ADMIN_ID) return
          const { data: prof } = await supabase.from('profiles').select('first_name, last_name, avatar_url, badges').eq('id', msg.user_id).single()
          // Si c'est un sondage, charger ses données
          if (msg.poll_id) await loadPolls(supabase, [msg.poll_id])
          const fullMsg = { ...msg, profile: prof ? { ...prof, first_name: titleCase(prof.first_name), last_name: titleCase(prof.last_name) } : prof }
          setMessages(prev => [...prev, fullMsg])
          if (isAtBottom.current) {
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
          }
        })
        .subscribe()
    }

    init()

    return () => {
      if (channelRef.current) channelRef.current.unsubscribe()
      clearInterval(presenceInterval.current)
      // Re-marquer le QG comme lu en quittant (couvre les messages
      // reçus pendant la session)
      if (userIdRef.current) {
        const sb = createClient()
        sb.from('qg_last_read').upsert(
          { user_id: userIdRef.current, last_read_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        ).then(() => {})
      }
    }
  }, [])

  const loadMessages = async (supabase: any, before: string | null) => {
    let query = supabase
      .from('qg_messages')
      .select('id, content, created_at, user_id, poll_id')
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)

    if (before) query = query.lt('created_at', before)

    const { data: rawData } = await query
    const data = filterGhost(rawData || [], (m: any) => m.user_id, userIdRef.current)
    if (!data || data.length === 0) { setHasMore(false); return [] }

    const userIds = [...new Set(data.map((m: any) => m.user_id))]
    const { data: profiles } = await supabase.from('profiles').select('id, first_name, last_name, avatar_url, badges').in('id', userIds)
    const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, { ...p, first_name: titleCase(p.first_name), last_name: titleCase(p.last_name) }]))

    // Charger les sondages référencés dans ces messages
    const pollIds = [...new Set(data.map((m: any) => m.poll_id).filter(Boolean))]
    if (pollIds.length > 0) await loadPolls(supabase, pollIds)

    const msgs = data.reverse().map((m: any) => ({ ...m, profile: profileMap[m.user_id] || {} }))
    if (data.length < PAGE_SIZE) setHasMore(false)
    oldestCreatedAt.current = msgs[0]?.created_at || null
    return msgs
  }

  // Charger un ensemble de sondages (question, options, votes) dans le state `polls`
  const loadPolls = async (supabase: any, pollIds: string[]) => {
    const [{ data: pollRows }, { data: optionRows }, { data: voteRows }] = await Promise.all([
      supabase.from('qg_polls').select('id, question, created_by').in('id', pollIds),
      supabase.from('qg_poll_options').select('id, poll_id, label, position').in('poll_id', pollIds).order('position'),
      supabase.from('qg_poll_votes').select('poll_id, option_id, user_id').in('poll_id', pollIds),
    ])
    // Profils des votants (pour afficher qui a voté quoi)
    const voterIds = [...new Set((voteRows || []).map((v: any) => v.user_id))]
    let voterMap: Record<string, any> = {}
    if (voterIds.length > 0) {
      const { data: vp } = await supabase.from('profiles').select('id, first_name, last_name, avatar_url').in('id', voterIds)
      voterMap = Object.fromEntries((vp || []).map((p: any) => [p.id, p]))
    }
    setPolls(prev => {
      const next = { ...prev }
      for (const p of (pollRows || [])) {
        next[p.id] = {
          ...p,
          options: (optionRows || []).filter((o: any) => o.poll_id === p.id),
          votes: (voteRows || []).filter((v: any) => v.poll_id === p.id).map((v: any) => ({ ...v, voter: voterMap[v.user_id] })),
        }
      }
      return next
    })
  }

  const loadOnlineMembers = async (supabase: any) => {
    const since = new Date(Date.now() - 30 * 1000).toISOString() // 30 secondes
    const { data: rawData } = await supabase
      .from('qg_presence')
      .select('user_id, last_seen')
      .gte('last_seen', since)
      .order('last_seen', { ascending: false })

    const data = filterGhost(rawData || [], (p: any) => p.user_id, userIdRef.current)
    if (!data || data.length === 0) { setOnlineMembers([]); return }

    const userIds = data.map((p: any) => p.user_id)
    const { data: profiles } = await supabase.from('profiles').select('id, first_name, last_name, avatar_url').in('id', userIds)
    const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, { ...p, first_name: titleCase(p.first_name), last_name: titleCase(p.last_name) }]))

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

  // Créer un sondage : insère le sondage + ses options + un message QG qui le porte
  const createPoll = async () => {
    const q = pollQuestion.trim()
    const opts = pollOptions.map(o => o.value.trim()).filter(Boolean)
    if (!q || opts.length < 2 || !userId || pollSubmitting) return
    setPollSubmitting(true)
    const supabase = createClient()

    const { data: poll, error: pollErr } = await supabase.from('qg_polls').insert({ question: q, created_by: userId }).select('id').single()
    if (pollErr || !poll) {
      setPollSubmitting(false)
      alert("Le sondage n'a pas pu être créé. Vérifie que les tables sondages (qg_polls...) ont bien été créées dans Supabase.\n\n" + (pollErr?.message || ''))
      return
    }

    const { data: optionRows, error: optErr } = await supabase
      .from('qg_poll_options')
      .insert(opts.map((label, i) => ({ poll_id: poll.id, label, position: i })))
      .select('id, poll_id, label, position')
    if (optErr) {
      setPollSubmitting(false)
      alert("Erreur lors de l'ajout des options.\n\n" + optErr.message)
      return
    }

    const { data: msgRow, error: msgErr } = await supabase
      .from('qg_messages')
      .insert({ user_id: userId, content: '', poll_id: poll.id })
      .select('id, content, created_at, user_id, poll_id')
      .single()
    if (msgErr || !msgRow) {
      setPollSubmitting(false)
      alert("Le sondage est créé mais n'a pas pu être publié dans le chat. Vérifie que la colonne poll_id existe sur qg_messages.\n\n" + (msgErr?.message || ''))
      return
    }

    // Injecter le sondage et le message localement (sans attendre le realtime)
    setPolls(prev => ({ ...prev, [poll.id]: { id: poll.id, question: q, created_by: userId, options: optionRows || [], votes: [] } }))
    setMessages(prev => [...prev, { ...msgRow, profile }])

    setPollQuestion(''); setPollOptions([{ id: 'o1', value: '' }, { id: 'o2', value: '' }]); setPollModal(false); setPollSubmitting(false)
    isAtBottom.current = true
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  // Voter (choix unique) : remplace le vote précédent du membre
  const votePoll = async (pollId: string, optionId: string) => {
    if (!userId) return
    const supabase = createClient()
    const poll = polls[pollId]
    const myVote = poll?.votes?.find((v: any) => v.user_id === userId)

    // Mise à jour optimiste locale
    setPolls(prev => {
      const p = prev[pollId]
      if (!p) return prev
      const others = p.votes.filter((v: any) => v.user_id !== userId)
      const newVotes = (myVote && myVote.option_id === optionId)
        ? others // re-clic sur le même = retrait du vote
        : [...others, { poll_id: pollId, option_id: optionId, user_id: userId, voter: profile }]
      return { ...prev, [pollId]: { ...p, votes: newVotes } }
    })

    if (myVote && myVote.option_id === optionId) {
      // retirer le vote
      await supabase.from('qg_poll_votes').delete().eq('poll_id', pollId).eq('user_id', userId)
      return
    }
    // upsert le vote (un seul par membre)
    await supabase.from('qg_poll_votes').upsert(
      { poll_id: pollId, option_id: optionId, user_id: userId },
      { onConflict: 'poll_id,user_id' }
    )

    // XP : répondre à un sondage (plafonné 3/jour côté serveur)
    awardXp(userId, 'poll_vote')

    // Notifier le créateur (anti-spam : une seule notif non lue par sondage et par votant)
    if (poll && poll.created_by && poll.created_by !== userId) {
      const { data: existing } = await supabase
        .from('notifications').select('id')
        .eq('user_id', poll.created_by).eq('type', 'qg_poll_vote')
        .eq('from_user_id', userId).eq('read', false)
        .limit(1)
      if (!existing || existing.length === 0) {
        await notify({
          userId: poll.created_by,
          type: 'qg',                 // catégorie réglable : "Activité du QG" (in-app)
          dbType: 'qg_poll_vote',
          content: `a voté à ton sondage dans le QG`,
          link: `/qg`,
          fromUserId: userId,
        })
      }
    }
  }

  // Ouvrir la modale d'édition d'un sondage
  const openEditPoll = (pollId: string) => {
    const p = polls[pollId]
    if (!p) return
    setEditPollId(pollId)
    setEditPollQuestion(p.question)
    // Les options existantes (id DB) marquées existing:true
    setEditItems(p.options.map((o: any) => ({ id: o.id, value: o.label, existing: true })))
  }

  // Sauvegarder : maj question + réordonnancement (position) + ajout des nouvelles options.
  // Les options existantes ne sont jamais supprimées, juste réordonnées.
  const saveEditPoll = async () => {
    if (!editPollId) return
    const p = polls[editPollId]
    const q = editPollQuestion.trim()
    const items = editItems.filter(it => it.value.trim() !== '' || it.existing)
    if (!q || items.filter(it => it.value.trim()).length < 2) return
    setEditPollSaving(true)
    const supabase = createClient()

    // 1) Question
    if (q !== p.question) {
      await supabase.from('qg_polls').update({ question: q }).eq('id', editPollId)
    }

    // 2) Réordonner les options existantes (maj position selon l'ordre actuel)
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      if (it.existing) {
        await supabase.from('qg_poll_options').update({ position: i }).eq('id', it.id)
      }
    }

    // 3) Insérer les nouvelles options à leur position
    const newItems = items.map((it, i) => ({ it, pos: i })).filter(x => !x.it.existing && x.it.value.trim())
    let addedRows: any[] = []
    if (newItems.length > 0) {
      const { data, error } = await supabase
        .from('qg_poll_options')
        .insert(newItems.map(x => ({ poll_id: editPollId, label: x.it.value.trim(), position: x.pos })))
        .select('id, poll_id, label, position')
      if (error) { setEditPollSaving(false); alert("Erreur lors de l'ajout des options.\n\n" + error.message); return }
      addedRows = data || []
    }

    // 4) Recharger le sondage pour refléter le nouvel ordre
    await loadPolls(supabase, [editPollId])
    setEditPollId(null); setEditPollSaving(false)
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
    <div className="qg-layout" style={{ display: 'flex', height: 'calc(100dvh - 2rem)', gap: '1.5rem', maxWidth: '1100px', margin: '0 auto' }}>

      <style>{`
        @media (max-width: 768px) {
          /* Le QG occupe tout l'écran, comme une conversation privée ouverte.
             La topbar et la bottom-nav sont masquées (body.msg-conv-open),
             donc on prend toute la hauteur du viewport. */
          .qg-layout {
            position: fixed !important;
            inset: 0 !important;
            height: 100dvh !important;
            max-width: none !important;
            margin: 0 !important;
            gap: 0 !important;
            z-index: 50 !important;
          }
          .qg-chat {
            border-radius: 0 !important;
            box-shadow: none !important;
          }
          /* Chevron retour vers le feed */
          .qg-back-btn { display: flex !important; }
          /* Décale le header sous l'encoche / barre de statut.
             Aligné en haut pour que "X en ligne" se cale sur la ligne du
             titre, et que le sous-titre "Canal général" s'étende dessous
             sur toute la largeur sans être coupé. */
          .qg-header {
            padding-top: calc(1rem + env(safe-area-inset-top)) !important;
            align-items: flex-start !important;
          }
          .qg-header-icon { margin-top: 2px !important; }
          /* La ligne du titre : "Le QG" + "X en ligne" côte à côte */
          .qg-title-row {
            display: flex !important;
            align-items: center !important;
            gap: 0.5rem !important;
          }
          .qg-online-inline { display: flex !important; }
          /* La colonne membres de droite est masquée sur mobile —
             on y accède via la modale "X en ligne" */
          .qg-members-panel { display: none !important; }
          /* L'indicateur "X en ligne" du header devient cliquable */
          .qg-online-trigger { cursor: pointer !important; }
          /* Texte d'aide sous le chat masqué sur mobile */
          .qg-input-hint { display: none !important; }
        }
      `}</style>

      {/* Chat principal */}
      <div className="qg-chat" style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden', minWidth: 0 }}>

        {/* Header */}
        <div className="qg-header" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #F5F0E8', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            className="qg-back-btn"
            onClick={() => router.push('/feed')}
            style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', color: '#E8501A', flexShrink: 0, padding: '0.25rem', alignItems: 'center' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <img className="qg-header-icon" src="/icons/megaphone.svg" alt="" style={{ width: '22px', height: '22px', filter: 'brightness(0) saturate(100%) invert(35%) sepia(90%) saturate(700%) hue-rotate(350deg)' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="qg-title-row">
              <div style={{ fontFamily: 'var(--font-clash)', fontSize: '1.15rem', fontWeight: 700, color: '#2D2D2D' }}>Le QG</div>
              {/* "X en ligne" — affiché ici sur la ligne du titre en mobile */}
              <div
                className="qg-online-trigger qg-online-inline"
                onClick={() => setOnlineModalOpen(true)}
                style={{ display: 'none', alignItems: 'center', gap: '0.4rem', flexShrink: 0, marginLeft: 'auto' }}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22C55E', display: 'inline-block' }} />
                <span style={{ fontSize: '0.82rem', color: '#2D2D2D', opacity: 0.5, whiteSpace: 'nowrap' }}>{onlineMembers.length} en ligne</span>
              </div>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#2D2D2D', opacity: 0.45 }}>Canal général — tout le monde peut discuter ici</div>
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
                      {msg.poll_id ? (
                        <PollCard poll={polls[msg.poll_id]} userId={userId} onVote={votePoll} onEdit={openEditPoll} canEdit={!!polls[msg.poll_id] && (polls[msg.poll_id].created_by === userId || userId === ADMIN_ID)} />
                      ) : (
                        <div style={{ fontSize: '0.9rem', color: '#2D2D2D', lineHeight: 1.6, wordBreak: 'break-word' }}>
                          {renderContent(msg.content)}
                        </div>
                      )}
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
          <button
            onClick={() => setPollModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: '1px solid #E8E3D9', borderRadius: '20px', padding: '0.35rem 0.85rem', cursor: 'pointer', color: '#E8501A', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.6rem' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            Créer un sondage
          </button>
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
          <div className="qg-input-hint" style={{ fontSize: '0.72rem', color: '#2D2D2D', opacity: 0.35, marginTop: '0.4rem', textAlign: 'right' }}>Entrée pour envoyer · Maj+Entrée pour sauter une ligne</div>
        </div>
      </div>

      {/* Membres en ligne — colonne desktop */}
      <div className="qg-members-panel" style={{ width: '220px', flexShrink: 0, backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', minWidth: 0 }}>
              <span style={{ fontSize: '0.82rem', color: '#2D2D2D', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {member.profile?.first_name} {member.profile?.last_name}
              </span>
              {(member.user_id === ADMIN_ID || member.user_id === '00000000-0000-0000-0000-000000000001') && (
                <img src="/icons/badge-check.svg" alt="Admin" style={{ width: '14px', height: '14px', flexShrink: 0 }} />
              )}
            </div>
          </a>
        ))}
        {onlineMembers.length === 0 && (
          <div style={{ fontSize: '0.82rem', color: '#2D2D2D', opacity: 0.35, textAlign: 'center', marginTop: '1rem' }}>Aucun membre en ligne</div>
        )}
      </div>

      {/* Modale création de sondage */}
      {pollModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.75rem', width: '100%', maxWidth: '440px', maxHeight: '85vh', overflowY: 'auto' }}>
            <h3 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.2rem', color: '#2D2D2D', margin: '0 0 1rem' }}>Créer un sondage</h3>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#2D2D2D', opacity: 0.6, display: 'block', marginBottom: '0.35rem' }}>Question</label>
            <input
              value={pollQuestion}
              onChange={e => setPollQuestion(e.target.value)}
              placeholder="Ex : Quel jour pour le prochain visio ?"
              style={{ width: '100%', padding: '0.6rem 0.85rem', border: '2px solid #E8E3D9', borderRadius: '10px', fontSize: '0.92rem', outline: 'none', fontFamily: 'inherit', marginBottom: '1rem' }}
            />
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#2D2D2D', opacity: 0.6, display: 'block', marginBottom: '0.35rem' }}>Options (glisse pour réordonner)</label>
            <SortableOptions items={pollOptions} onChange={setPollOptions} minItems={2} />
            {pollOptions.length < 6 && (
              <button onClick={() => setPollOptions(prev => [...prev, { id: `o${Date.now()}`, value: '' }])} style={{ marginTop: '0.6rem', background: 'none', border: 'none', color: '#E8501A', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', padding: 0 }}>
                + Ajouter une option
              </button>
            )}
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button onClick={() => setPollModal(false)} style={{ background: 'none', border: '1px solid #E8E3D9', borderRadius: '8px', padding: '0.55rem 1.1rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>Annuler</button>
              <button
                onClick={createPoll}
                disabled={pollSubmitting || !pollQuestion.trim() || pollOptions.filter(o => o.value.trim()).length < 2}
                style={{ backgroundColor: '#E8501A', color: 'white', border: 'none', borderRadius: '8px', padding: '0.55rem 1.25rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, opacity: (pollSubmitting || !pollQuestion.trim() || pollOptions.filter(o => o.value.trim()).length < 2) ? 0.5 : 1 }}
              >
                {pollSubmitting ? 'Création…' : 'Publier le sondage'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale édition de sondage */}
      {editPollId && polls[editPollId] && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.75rem', width: '100%', maxWidth: '440px', maxHeight: '85vh', overflowY: 'auto' }}>
            <h3 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.2rem', color: '#2D2D2D', margin: '0 0 1rem' }}>Modifier le sondage</h3>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#2D2D2D', opacity: 0.6, display: 'block', marginBottom: '0.35rem' }}>Question</label>
            <input
              value={editPollQuestion}
              onChange={e => setEditPollQuestion(e.target.value)}
              style={{ width: '100%', padding: '0.6rem 0.85rem', border: '2px solid #E8E3D9', borderRadius: '10px', fontSize: '0.92rem', outline: 'none', fontFamily: 'inherit', marginBottom: '1rem' }}
            />
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#2D2D2D', opacity: 0.6, display: 'block', marginBottom: '0.35rem' }}>Options (glisse pour réordonner)</label>
            <SortableOptions
              items={editItems}
              onChange={(next) => setEditItems(next.map(it => ({ ...it, existing: editItems.find(e => e.id === it.id)?.existing })))}
              minItems={2}
              placeholderPrefix="Option"
            />
            <button onClick={() => setEditItems(prev => [...prev, { id: `new-${Date.now()}`, value: '', existing: false }])} style={{ marginTop: '0.6rem', background: 'none', border: 'none', color: '#E8501A', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', padding: 0 }}>
              + Ajouter une option
            </button>
            <div style={{ fontSize: '0.72rem', color: '#2D2D2D', opacity: 0.4, marginTop: '0.6rem' }}>Astuce : glisse les options par la poignée pour changer leur ordre.</div>
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button onClick={() => setEditPollId(null)} style={{ background: 'none', border: '1px solid #E8E3D9', borderRadius: '8px', padding: '0.55rem 1.1rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>Annuler</button>
              <button onClick={saveEditPoll} disabled={editPollSaving || !editPollQuestion.trim()} style={{ backgroundColor: '#E8501A', color: 'white', border: 'none', borderRadius: '8px', padding: '0.55rem 1.25rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, opacity: (editPollSaving || !editPollQuestion.trim()) ? 0.5 : 1 }}>
                {editPollSaving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale membres en ligne — mobile (et desktop si clic) */}
      {onlineModalOpen && (
        <div
          onClick={() => setOnlineModalOpen(false)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '380px', maxHeight: '70vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.1rem 1.25rem', borderBottom: '1px solid #F5F0E8' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22C55E', display: 'inline-block' }} />
                <span style={{ fontWeight: 700, fontSize: '1rem', color: '#2D2D2D' }}>En ligne — {onlineMembers.length}</span>
              </div>
              <button
                onClick={() => setOnlineModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.4rem', lineHeight: 1, color: '#2D2D2D', opacity: 0.5, padding: 0 }}
              >×</button>
            </div>
            <div style={{ overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {onlineMembers.map(member => (
                <a key={member.user_id} href={`/membre/${member.user_id}`} style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', textDecoration: 'none', borderRadius: '10px', padding: '0.5rem 0.6rem' }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '50%', backgroundColor: '#E8501A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.78rem', overflow: 'hidden' }}>
                      {member.profile?.avatar_url
                        ? <img src={member.profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : `${(member.profile?.first_name || '?')[0]}${(member.profile?.last_name || '')[0] || ''}`.toUpperCase()
                      }
                    </div>
                    <span style={{ position: 'absolute', bottom: '0', right: '0', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#22C55E', border: '1.5px solid white' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', minWidth: 0 }}>
                    <span style={{ fontSize: '0.9rem', color: '#2D2D2D', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {member.profile?.first_name} {member.profile?.last_name}
                    </span>
                    {(member.user_id === ADMIN_ID || member.user_id === '00000000-0000-0000-0000-000000000001') && (
                      <img src="/icons/badge-check.svg" alt="Admin" style={{ width: '15px', height: '15px', flexShrink: 0 }} />
                    )}
                  </div>
                </a>
              ))}
              {onlineMembers.length === 0 && (
                <div style={{ fontSize: '0.85rem', color: '#2D2D2D', opacity: 0.35, textAlign: 'center', padding: '1.5rem' }}>Aucun membre en ligne</div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
