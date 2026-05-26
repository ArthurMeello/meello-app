// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const ADMIN_ID = '13cdb485-42e0-48df-b2f8-14dc77dd895a'

interface Connection {
  id: string
  status: 'pending' | 'accepted'
  other_user: {
    id: string
    first_name: string
    last_name: string
    activity: string | null
    city: string | null
    avatar_url: string | null
  }
  direction: 'sent' | 'received'
}

export default function ReseauPage() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [recoModal, setRecoModal] = useState<Connection['other_user'] | null>(null)
  const [recoText, setRecoText] = useState('')
  const [recoLoading, setRecoLoading] = useState(false)
  const [alreadyRecommended, setAlreadyRecommended] = useState<Set<string>>(new Set())
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        setUserId(data.user.id)
        fetchConnections(data.user.id)
        // Charger les recos déjà envoyées
        const { data: recos } = await supabase
          .from('recommendations')
          .select('target_id')
          .eq('author_id', data.user.id)
        if (recos) setAlreadyRecommended(new Set(recos.map(r => r.target_id)))
      }
    })
  }, [])

  const fetchConnections = async (uid: string) => {
    const supabase = createClient()
    const { data } = await supabase
      .from('connections')
      .select(`
        id, status, requester_id, receiver_id,
        requester:profiles!connections_requester_id_fkey(id, first_name, last_name, activity, city, avatar_url),
        receiver:profiles!connections_receiver_id_fkey(id, first_name, last_name, activity, city, avatar_url)
      `)
      .or(`requester_id.eq.${uid},receiver_id.eq.${uid}`)

    if (data) {
      const mapped = data.map((c: any) => ({
        id: c.id,
        status: c.status,
        direction: c.requester_id === uid ? 'sent' : 'received',
        other_user: c.requester_id === uid ? c.receiver : c.requester,
      }))
      setConnections(mapped)
    }
    setLoading(false)
  }

  const acceptConnection = async (id: string) => {
    const supabase = createClient()
    await supabase.from('connections').update({ status: 'accepted' }).eq('id', id)
    // Créer la conversation si elle n'existe pas
    const conn = connections.find(c => c.id === id)
    if (conn && userId) {
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .or(`and(participant1_id.eq.${userId},participant2_id.eq.${conn.other_user.id}),and(participant1_id.eq.${conn.other_user.id},participant2_id.eq.${userId})`)
        .single()
      if (!existing) {
        await supabase.from('conversations').insert({
          participant1_id: userId,
          participant2_id: conn.other_user.id,
        })
      }
    }
    if (userId) fetchConnections(userId)
  }

  const openMessage = async (otherUserId: string) => {
    const supabase = createClient()
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .or(`and(participant1_id.eq.${userId},participant2_id.eq.${otherUserId}),and(participant1_id.eq.${otherUserId},participant2_id.eq.${userId})`)
      .single()
    if (existing) {
      router.push(`/messages?conv=${existing.id}`)
    } else {
      router.push('/messages')
    }
  }

  const sendReco = async () => {
    if (!recoText.trim() || !recoModal) return
    setRecoLoading(true)
    const supabase = createClient()
    await supabase.from('recommendations').insert({
      target_id: recoModal.id,
      author_id: userId,
      content: recoText.trim(),
    })
    await supabase.from('notifications').insert({
      user_id: recoModal.id,
      type: 'recommendation',
      content: `t'a laissé une recommandation`,
      link: `/membre/${recoModal.id}`,
      from_user_id: userId,
    })
    setAlreadyRecommended(prev => new Set([...prev, recoModal.id]))
    setRecoText('')
    setRecoModal(null)
    setRecoLoading(false)
  }

  const accepted = connections.filter(c => c.status === 'accepted')
  const pendingReceived = connections.filter(c => c.status === 'pending' && c.direction === 'received')
  const pendingSent = connections.filter(c => c.status === 'pending' && c.direction === 'sent')

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem', color: '#2D2D2D', opacity: 0.4 }}>Chargement...</div>

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.75rem', color: '#2D2D2D', marginBottom: '1.5rem' }}>
        Mon Réseau
      </h1>

      {/* Demandes reçues */}
      {pendingReceived.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#E8501A', marginBottom: '0.75rem' }}>
            Demandes reçues ({pendingReceived.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {pendingReceived.map(c => (
              <div key={c.id} style={{
                backgroundColor: 'white', borderRadius: '14px', padding: '1rem 1.25rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
              }}>
                <MemberInfo user={c.other_user} />
                <button
                  onClick={() => acceptConnection(c.id)}
                  style={{ backgroundColor: '#E8501A', color: 'white', border: 'none', borderRadius: '8px', padding: '0.5rem 1rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem', flexShrink: 0 }}
                >
                  Accepter
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Membres du réseau */}
      {accepted.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#2D2D2D', marginBottom: '0.75rem' }}>
            Mon réseau ({accepted.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {accepted.map(c => (
              <div key={c.id} style={{
                backgroundColor: 'white', borderRadius: '14px', padding: '1rem 1.25rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap',
              }}>
                <a href={`/membre/${c.other_user.id}`} style={{ textDecoration: 'none', flex: 1 }}>
                  <MemberInfo user={c.other_user} />
                </a>
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  <button
                    onClick={() => openMessage(c.other_user.id)}
                    style={{ background: 'none', border: '1.5px solid #E8E3D9', borderRadius: '8px', padding: '0.45rem 0.85rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem', color: '#2D2D2D' }}
                  >
                    ✉️ Message
                  </button>
                  {alreadyRecommended.has(c.other_user.id) ? (
                    <button disabled style={{ background: 'none', border: '1.5px solid #ccc', borderRadius: '8px', padding: '0.45rem 0.85rem', fontWeight: 600, cursor: 'default', fontSize: '0.82rem', color: '#aaa' }}>
                      Déjà recommandé
                    </button>
                  ) : (
                    <button
                      onClick={() => { setRecoModal(c.other_user); setRecoText('') }}
                      style={{ background: 'none', border: '1.5px solid #E8501A', borderRadius: '8px', padding: '0.45rem 0.85rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem', color: '#E8501A' }}
                    >
                      ⭐️ Recommander
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Demandes envoyées */}
      {pendingSent.length > 0 && (
        <section>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#2D2D2D', opacity: 0.5, marginBottom: '0.75rem' }}>
            Demandes envoyées ({pendingSent.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {pendingSent.map(c => (
              <div key={c.id} style={{
                backgroundColor: 'white', borderRadius: '14px', padding: '0.85rem 1.25rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)', opacity: 0.7,
                display: 'flex', alignItems: 'center', gap: '1rem',
              }}>
                <MemberInfo user={c.other_user} />
                <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: '#2D2D2D', opacity: 0.5 }}>En attente</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {connections.length === 0 && (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#2D2D2D', opacity: 0.4 }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🤝</div>
          <p>Ton réseau est vide pour l&apos;instant. Explore l&apos;annuaire pour te connecter avec d&apos;autres membres !</p>
          <a href="/annuaire" style={{ color: '#E8501A', fontWeight: 600 }}>Voir l&apos;annuaire</a>
        </div>
      )}

      {/* Modal recommandation */}
      {recoModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={() => setRecoModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '480px' }}>
            <h3 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.1rem', color: '#2D2D2D', marginBottom: '0.5rem' }}>
              Recommander {recoModal.first_name}
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#2D2D2D', opacity: 0.5, marginBottom: '1rem' }}>
              Ta recommandation apparaîtra sur son profil.
            </p>
            <textarea
              value={recoText}
              onChange={e => setRecoText(e.target.value)}
              placeholder={`Décris ton expérience avec ${recoModal.first_name}…`}
              rows={4}
              style={{ width: '100%', border: '1.5px solid #E8E3D9', borderRadius: '10px', padding: '0.75rem', fontSize: '0.95rem', fontFamily: 'inherit', outline: 'none', resize: 'none', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setRecoModal(null)} style={{ background: 'none', border: '1px solid #E8E3D9', borderRadius: '8px', padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.9rem' }}>Annuler</button>
              <button onClick={sendReco} disabled={!recoText.trim() || recoLoading} style={{ backgroundColor: '#E8501A', color: 'white', border: 'none', borderRadius: '8px', padding: '0.5rem 1.25rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}>
                {recoLoading ? '...' : 'Envoyer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MemberInfo({ user }: { user: Connection['other_user'] }) {
  const initials = `${(user.first_name || '?')[0]}${(user.last_name || '')[0] || ''}`.toUpperCase()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#E8501A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0, overflow: 'hidden' }}>
        {user.avatar_url ? <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
      </div>
      <div>
        <div style={{ fontWeight: 600, color: '#2D2D2D', fontSize: '0.9rem' }}>{user.first_name} {user.last_name}</div>
        {user.activity && <div style={{ fontSize: '0.78rem', color: '#2D2D2D', opacity: 0.5 }}>{user.activity}{user.city ? ` · ${user.city}` : ''}</div>}
      </div>
    </div>
  )
}
