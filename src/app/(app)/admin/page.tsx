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
  member_since: string | null
  hide_new_badge: boolean
  created_at: string
}

export default function AdminPage() {
  const [tab, setTab] = useState<'candidatures' | 'membres'>('candidatures')
  const [applications, setApplications] = useState<Application[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedApp, setSelectedApp] = useState<Application | null>(null)
  const [authorized, setAuthorized] = useState(false)
  const [motif, setMotif] = useState('info')
  const [memberSearch, setMemberSearch] = useState('')
  const [memberBadgeFilter, setMemberBadgeFilter] = useState('')
  const router = useRouter()

  const MOTIFS = [
    { value: 'info', label: 'Informations insuffisantes', preview: `Les informations fournies sur ton activité sont insuffisantes pour évaluer ta candidature. N'hésite pas à soumettre une nouvelle candidature en détaillant davantage ton projet.` },
    { value: 'profil', label: 'Profil non compatible', preview: `Ton profil ne correspond pas aux critères de la communauté Meello à ce stade. Meello s'adresse avant tout aux entrepreneurs, freelances et indépendants ayant une activité lancée.` },
    { value: 'activite', label: 'Activité exclue (MLM / mandataire...)', preview: `Meello n'accueille pas les activités de type vente directe, réseau de mandataires, ou marketing de réseau (MLM). Cette décision est définitive.` },
  ]

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
      .select('id, first_name, last_name, email, activity, city, badges, member_since, hide_new_badge, created_at')
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
    setLoading(true)
    const res = await fetch('/api/reject-application', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app, motif }),
    })
    if (!res.ok) {
      alert('Erreur lors du refus')
      setLoading(false)
      return
    }
    await fetchApplications()
    setSelectedApp(null)
    setMotif('info')
    setLoading(false)
    alert(`Candidature de ${app.first_name} refusée et email envoyé.`)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer définitivement cette candidature ?')) return
    const supabase = createClient()
    await supabase.from('applications').delete().eq('id', id)
    await fetchApplications()
    setSelectedApp(null)
  }

  const deleteMember = async (member: Member) => {
    if (!confirm(`Supprimer définitivement le compte de ${member.first_name} ${member.last_name} ?\n\nCette action est irréversible.`)) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const res = await fetch('/api/delete-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: member.id, requesterId: user?.id }),
    })
    const data = await res.json()
    if (!res.ok) {
      alert('Erreur : ' + (data.error || 'Erreur inconnue'))
      return
    }
    await fetchMembers()
    alert(`Compte de ${member.first_name} ${member.last_name} supprimé.`)
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
              {selectedApp.status === 'pending' && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.78rem', color: '#2D2D2D', opacity: 0.5, marginBottom: '0.4rem' }}>Motif de refus</div>
                  <select
                    value={motif}
                    onChange={e => setMotif(e.target.value)}
                    style={{
                      width: '100%', padding: '0.7rem 1rem', border: '2px solid #E8E3D9',
                      borderRadius: '10px', fontSize: '0.9rem', marginBottom: '0.75rem',
                      fontFamily: 'inherit', backgroundColor: 'white', cursor: 'pointer',
                    }}
                  >
                    {MOTIFS.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <div style={{ backgroundColor: '#F5F0E8', borderRadius: '10px', padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#2D2D2D', lineHeight: 1.6, opacity: 0.8 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.75rem', opacity: 0.5, display: 'block', marginBottom: '0.35rem' }}>APERÇU DU MAIL</span>
                    Bonjour {selectedApp.first_name}, {MOTIFS.find(m => m.value === motif)?.preview}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {selectedApp.status === 'pending' && (
                  <>
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
                  </>
                )}
                <button
                  onClick={() => handleDelete(selectedApp.id)}
                  style={{
                    backgroundColor: '#F5F5F5', color: '#999', border: 'none',
                    borderRadius: '10px', padding: '0.75rem 1.5rem', fontWeight: 700,
                    cursor: 'pointer', fontSize: '0.95rem', marginLeft: selectedApp.status === 'pending' ? 'auto' : '0',
                  }}
                >
                  🗑 Supprimer
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
                      <div
                        key={app.id}
                        onClick={() => setSelectedApp(app)}
                        style={{
                          backgroundColor: 'white', borderRadius: '12px', padding: '0.85rem 1.25rem',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          borderLeft: `4px solid ${app.status === 'approved' ? '#7A9E7E' : '#ccc'}`,
                          opacity: 0.8, cursor: 'pointer',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: '#2D2D2D', fontSize: '0.9rem' }}>{app.first_name} {app.last_name}</div>
                          <div style={{ fontSize: '0.78rem', color: '#2D2D2D', opacity: 0.5 }}>{app.activity} · {app.city}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{
                            fontSize: '0.78rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: '20px',
                            backgroundColor: app.status === 'approved' ? '#E8F5E9' : '#F5F5F5',
                            color: app.status === 'approved' ? '#7A9E7E' : '#999',
                          }}>
                            {app.status === 'approved' ? 'Accepté' : 'Refusé'}
                          </span>
                          <span style={{ color: '#2D2D2D', opacity: 0.3, fontSize: '0.85rem' }}>Voir →</span>
                        </div>
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
        <div>
          {/* Barre de recherche + filtres */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <input
              value={memberSearch}
              onChange={e => setMemberSearch(e.target.value)}
              placeholder="🔍 Rechercher par nom, email, ville, activité..."
              style={{
                flex: 1, minWidth: '220px', padding: '0.65rem 1rem',
                border: '2px solid #E8E3D9', borderRadius: '10px',
                fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none',
                backgroundColor: 'white',
              }}
            />
            <select
              value={memberBadgeFilter}
              onChange={e => setMemberBadgeFilter(e.target.value)}
              style={{
                padding: '0.65rem 1rem', border: '2px solid #E8E3D9', borderRadius: '10px',
                fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none',
                backgroundColor: 'white', cursor: 'pointer',
              }}
            >
              <option value="">Tous les badges</option>
              <option value="fondateur">Fondateur</option>
              <option value="partenaire">Partenaire</option>
            </select>
          </div>

          {/* Résultats filtrés */}
          {(() => {
            const q = memberSearch.toLowerCase()
            const filtered = members.filter(m => {
              const matchSearch = !q || [m.first_name, m.last_name, m.email, m.activity, m.city].some(v => v?.toLowerCase().includes(q))
              const matchBadge = !memberBadgeFilter || (m.badges || []).includes(memberBadgeFilter)
              return matchSearch && matchBadge
            })
            return (
              <>
                <div style={{ fontSize: '0.82rem', color: '#2D2D2D', opacity: 0.4, marginBottom: '0.75rem' }}>
                  {filtered.length} membre{filtered.length > 1 ? 's' : ''} affiché{filtered.length > 1 ? 's' : ''}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {filtered.map(member => (
            <div key={member.id} style={{
              backgroundColor: 'white', borderRadius: '12px', padding: '0.85rem 1.25rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem',
            }}>
              <div>
                <div style={{ fontWeight: 700, color: '#2D2D2D', fontSize: '0.9rem' }}>{member.first_name} {member.last_name}</div>
                <div style={{ fontSize: '0.78rem', color: '#2D2D2D', opacity: 0.5 }}>{member.email} · {member.activity} · {member.city}</div>
              </div>
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {[
                  { key: 'fondateur', label: 'Fondateur' },
                  { key: 'partenaire', label: 'Partenaire' },
                  { key: 'membre_fondateur', label: 'Membre fondateur' },
                ].map(({ key, label }) => {
                  const active = (member.badges || []).includes(key)
                  return (
                    <button
                      key={key}
                      onClick={() => toggleBadge(member, key)}
                      style={{
                        fontSize: '0.7rem', fontWeight: 600, padding: '0.2rem 0.55rem', borderRadius: '20px',
                        border: 'none', cursor: 'pointer',
                        backgroundColor: active ? (key === 'membre_fondateur' ? '#6B4FA0' : '#E8501A') : '#F5F0E8',
                        color: active ? 'white' : '#2D2D2D',
                        opacity: active ? 1 : 0.5,
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
                {/* Badge nouveau membre — visible si dans la période OU forcé affiché */}
                {(() => {
                  const isInPeriod = member.member_since
                    ? (Date.now() - new Date(member.member_since).getTime()) < 30 * 24 * 60 * 60 * 1000
                    : false
                  const active = isInPeriod && !member.hide_new_badge
                  return (
                    <button
                      onClick={async () => {
                        const supabase = createClient()
                        await supabase.from('profiles').update({ hide_new_badge: !member.hide_new_badge }).eq('id', member.id)
                        await fetchMembers()
                      }}
                      style={{
                        fontSize: '0.7rem', fontWeight: 600, padding: '0.2rem 0.55rem', borderRadius: '20px',
                        border: 'none', cursor: 'pointer',
                        backgroundColor: active ? '#4A90D9' : '#F5F0E8',
                        color: active ? 'white' : '#2D2D2D',
                        opacity: active ? 1 : 0.5,
                      }}
                      title={active ? 'Retirer le badge Nouveau membre' : 'Badge Nouveau membre masqué ou hors période'}
                    >
                      nouveau membre
                    </button>
                  )
                })()}
                <button
                  onClick={() => deleteMember(member)}
                  title="Supprimer ce compte"
                  style={{
                    marginLeft: '0.25rem', background: 'none', border: '1px solid #ffcccc',
                    borderRadius: '8px', padding: '0.2rem 0.5rem', cursor: 'pointer',
                    color: '#cc3333', fontSize: '0.75rem', fontWeight: 600,
                  }}
                >
                  🗑 Supprimer
                </button>
              </div>
            </div>
          ))}
                </div>
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
}
