// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const ADMIN_ID = '13cdb485-42e0-48df-b2f8-14dc77dd895a'

interface Application {
  id: string
  first_name: string
  last_name: string
  email: string
  activity: string
  city: string
  country: string
  why_join: string
  company_number: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

interface Member {
  id: string
  first_name: string
  last_name: string
  email: string
  activity: string | null
  city: string | null
  badges: string[]
  created_at: string
}

export default function AdminPage() {
  const [tab, setTab] = useState<'candidatures' | 'membres'>('candidatures')
  const [applications, setApplications] = useState<Application[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedApp, setSelectedApp] = useState<Application | null>(null)
  const [authorized, setAuthorized] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || user.id !== ADMIN_ID) {
        router.replace('/feed')
        return
      }
      setAuthorized(true)
      fetchApplications()
      fetchMembers()
    }
    checkAuth()
  }, [])

  const fetchApplications = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('applications')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setApplications(data)
  }

  const fetchMembers = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, activity, city, badges, created_at')
      .order('created_at', { ascending: true })
    if (data) setMembers(data)
  }

  const handleApprove = async (app: Application) => {
    setLoading(true)

    const res = await fetch('/api/approve-application', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app, memberCount: members.length }),
    })

    const data = await res.json()

    if (!res.ok) {
      alert('Erreur lors de la création du compte : ' + (data.error || 'Erreur inconnue'))
      setLoading(false)
      return
    }

    await fetchApplications()
    await fetchMembers()
    setSelectedApp(null)
    setLoading(false)
    alert(`${app.first_name} ${app.last_name} a été accepté(e) ! Un email de connexion lui a été envoyé.`)
  }

  const handleReject = async (app: Application) => {
    const supabase = createClient()
    await supabase.from('applications').update({ status: 'rejected' }).eq('id', app.id)
    await fetchApplications()
    setSelectedApp(null)
  }

  const toggleBadge = async (member: Member, badge: string) => {
    const supabase = createClient()
    const current = member.badges || []
    const updated = current.includes(badge)
      ? current.filter((b: string) => b !== badge)
      : [...current, badge]
    await supabase.from('profiles').update({ badges: updated }).eq('id', member.id)
    await fetchMembers()
  }

  const pending = applications.filter(a => a.status === 'pending')
  const processed = applications.filter(a => a.status !== 'pending')

  if (!authorized) return null

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.75rem', color: '#2D2D2D', marginBottom: '1.5rem' }}>
        Back-office
      </h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {[{ key: 'candidatures', label: `Candidatures (${pending.length} en attente)` }, { key: 'membres', label: `Membres (${members.length})` }].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as 'candidatures' | 'membres')}
            style={{
              padding: '0.6rem 1.25rem',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: tab === t.key ? '#E8501A' : 'white',
              color: tab === t.key ? 'white' : '#2D2D2D',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.9rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Candidatures */}
      {tab === 'candidatures' && (
        <div>
          {selectedApp ? (
            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '2rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <button onClick={() => setSelectedApp(null)} style={{ background: 'none', border: 'none', color: '#E8501A', cursor: 'pointer', fontWeight: 600, marginBottom: '1.5rem', padding: 0 }}>
                ← Retour
              </button>
              <h2 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.3rem', color: '#2D2D2D', marginBottom: '1rem' }}>
                {selectedApp.first_name} {selectedApp.last_name}
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                {[
                  { label: 'Email', value: selectedApp.email },
                  { label: 'Metier', value: selectedApp.activity },
                  { label: 'Ville', value: selectedApp.city },
                  { label: 'Pays', value: selectedApp.country },
                  { label: 'Numero entreprise', value: selectedApp.company_number || 'Non renseigne' },
                ].map(f => (
                  <div key={f.label}>
                    <div style={{ fontSize: '0.78rem', color: '#2D2D2D', opacity: 0.5, marginBottom: '0.2rem' }}>{f.label}</div>
                    <div style={{ fontWeight: 600, color: '#2D2D2D', fontSize: '0.9rem' }}>{f.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ backgroundColor: '#F5F0E8', borderRadius: '10px', padding: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.78rem', color: '#2D2D2D', opacity: 0.5, marginBottom: '0.4rem' }}>Motivation</div>
                <p style={{ margin: 0, lineHeight: 1.65, color: '#2D2D2D' }}>{selectedApp.why_join}</p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => handleApprove(selectedApp)}
                  disabled={loading}
                  style={{
                    backgroundColor: '#7A9E7E', color: 'white', border: 'none',
                    borderRadius: '10px', padding: '0.75rem 1.5rem', fontWeight: 700,
                    cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.95rem',
                  }}
                >
                  {loading ? 'Traitement...' : 'Accepter'}
                </button>
                <button
                  onClick={() => handleReject(selectedApp)}
                  disabled={loading}
                  style={{
                    backgroundColor: '#FFF0ED', color: '#E8501A', border: '2px solid #E8501A',
                    borderRadius: '10px', padding: '0.75rem 1.5rem', fontWeight: 700,
                    cursor: 'pointer', fontSize: '0.95rem',
                  }}
                >
                  Refuser
                </button>
              </div>
            </div>
          ) : (
            <div>
              {pending.length > 0 && (
                <>
                  <h3 style={{ color: '#2D2D2D', marginBottom: '0.75rem', fontWeight: 700 }}>En attente ({pending.length})</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '2rem' }}>
                    {pending.map(app => (
                      <div
                        key={app.id}
                        onClick={() => setSelectedApp(app)}
                        style={{
                          backgroundColor: 'white', borderRadius: '12px', padding: '1rem 1.25rem',
                          cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          borderLeft: '4px solid #E8501A',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, color: '#2D2D2D' }}>{app.first_name} {app.last_name}</div>
                          <div style={{ fontSize: '0.82rem', color: '#2D2D2D', opacity: 0.5 }}>{app.activity} · {app.city}</div>
                        </div>
                        <span style={{ color: '#E8501A', fontWeight: 600, fontSize: '0.85rem' }}>Voir →</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {processed.length > 0 && (
                <>
                  <h3 style={{ color: '#2D2D2D', marginBottom: '0.75rem', fontWeight: 700, opacity: 0.6 }}>Traites ({processed.length})</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {processed.map(app => (
                      <div key={app.id} style={{
                        backgroundColor: 'white', borderRadius: '12px', padding: '0.85rem 1.25rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        borderLeft: `4px solid ${app.status === 'approved' ? '#7A9E7E' : '#ccc'}`,
                        opacity: 0.7,
                      }}>
                        <div>
                          <div style={{ fontWeight: 600, color: '#2D2D2D', fontSize: '0.9rem' }}>{app.first_name} {app.last_name}</div>
                          <div style={{ fontSize: '0.78rem', color: '#2D2D2D', opacity: 0.5 }}>{app.activity} · {app.city}</div>
                        </div>
                        <span style={{
                          fontSize: '0.78rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: '20px',
                          backgroundColor: app.status === 'approved' ? '#E8F5E9' : '#F5F5F5',
                          color: app.status === 'approved' ? '#7A9E7E' : '#999',
                        }}>
                          {app.status === 'approved' ? 'Accepte' : 'Refuse'}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {applications.length === 0 && (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#2D2D2D', opacity: 0.4 }}>
                  Aucune candidature pour le moment.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Membres */}
      {tab === 'membres' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {members.map(member => (
            <div key={member.id} style={{
              backgroundColor: 'white', borderRadius: '12px', padding: '0.85rem 1.25rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem',
            }}>
              <div>
                <div style={{ fontWeight: 700, color: '#2D2D2D', fontSize: '0.9rem' }}>{member.first_name} {member.last_name}</div>
                <div style={{ fontSize: '0.78rem', color: '#2D2D2D', opacity: 0.5 }}>{member.email} · {member.activity} · {member.city}</div>
              </div>
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                {['fondateur', 'partenaire', 'nouveau', 'profil_complet'].map(badge => {
                  const active = (member.badges || []).includes(badge)
                  return (
                    <button
                      key={badge}
                      onClick={() => toggleBadge(member, badge)}
                      style={{
                        fontSize: '0.7rem', fontWeight: 600, padding: '0.2rem 0.55rem', borderRadius: '20px',
                        border: 'none', cursor: 'pointer',
                        backgroundColor: active ? '#E8501A' : '#F5F0E8',
                        color: active ? 'white' : '#2D2D2D',
                        opacity: active ? 1 : 0.5,
                      }}
                    >
                      {badge}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
