// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

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

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id)
        fetchConnections(data.user.id)
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
    if (userId) fetchConnections(userId)
  }

  const accepted = connections.filter(c => c.status === 'accepted')
  const pendingReceived = connections.filter(c => c.status === 'pending' && c.direction === 'received')
  const pendingSent = connections.filter(c => c.status === 'pending' && c.direction === 'sent')

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: '#2D2D2D', opacity: 0.4 }}>Chargement...</div>
  }

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.75rem', color: '#2D2D2D', marginBottom: '1.5rem' }}>
        Mon Réseau
      </h1>

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
                  style={{
                    backgroundColor: '#E8501A', color: 'white', border: 'none',
                    borderRadius: '8px', padding: '0.5rem 1rem', fontWeight: 600,
                    cursor: 'pointer', fontSize: '0.85rem', flexShrink: 0,
                  }}
                >
                  Accepter
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {accepted.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#2D2D2D', marginBottom: '0.75rem' }}>
            Mon réseau ({accepted.length})
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
            {accepted.map(c => (
              <Link key={c.id} href={`/profil/${c.other_user.id}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  backgroundColor: 'white', borderRadius: '14px', padding: '1rem',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)', cursor: 'pointer',
                  transition: 'transform 0.15s',
                }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = ''}
                >
                  <MemberInfo user={c.other_user} />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

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
          <Link href="/annuaire" style={{ color: '#E8501A', fontWeight: 600 }}>
            Voir l&apos;annuaire
          </Link>
        </div>
      )}
    </div>
  )
}

function MemberInfo({ user }: { user: Connection['other_user'] }) {
  const initials = `${(user.first_name || '?')[0]}${(user.last_name || '')[0] || ''}`.toUpperCase()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <div style={{
        width: '40px', height: '40px', borderRadius: '50%',
        backgroundColor: '#E8501A', color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: '0.85rem', flexShrink: 0, overflow: 'hidden',
      }}>
        {user.avatar_url
          ? <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : initials}
      </div>
      <div>
        <div style={{ fontWeight: 600, color: '#2D2D2D', fontSize: '0.9rem' }}>
          {user.first_name} {user.last_name}
        </div>
        {user.activity && (
          <div style={{ fontSize: '0.78rem', color: '#2D2D2D', opacity: 0.5 }}>
            {user.activity}{user.city ? ` · ${user.city}` : ''}
          </div>
        )}
      </div>
    </div>
  )
}
