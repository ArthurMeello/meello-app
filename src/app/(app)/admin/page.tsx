// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getLevelFromXP, getPalier } from '@/lib/gamification'
import FlammeBadge from '@/components/FlammeBadge'

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
  last_active?: string | null
  is_confirmed?: boolean
  xp?: number
  streak_weeks?: number
}

// "Vu il y a X" à partir d'un timestamp
function formatLastActive(d: string | null | undefined): string {
  if (!d) return 'Jamais vu'
  const diff = Date.now() - new Date(d).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return "Vu à l'instant"
  if (min < 60) return `Vu il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `Vu il y a ${h} h`
  const j = Math.floor(h / 24)
  if (j < 7) return `Vu il y a ${j} j`
  return `Vu le ${new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

export default function AdminPage() {
  const [tab, setTab] = useState<'candidatures' | 'membres' | 'recommandations' | 'evenements' | 'activite'>('candidatures')
  const [stats, setStats] = useState<any>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [applications, setApplications] = useState<Application[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedApp, setSelectedApp] = useState<Application | null>(null)
  const [authorized, setAuthorized] = useState(false)
  const [motif, setMotif] = useState('info')
  const [memberSearch, setMemberSearch] = useState('')
  const [memberBadgeFilter, setMemberBadgeFilter] = useState('')
  const [pendingEvents, setPendingEvents] = useState<any[]>([])
  const [publishedEvents, setPublishedEvents] = useState<any[]>([])
  const [publishingEvent, setPublishingEvent] = useState<string | null>(null)
  const [eventAdminTab, setEventAdminTab] = useState<'pending' | 'published'>('pending')
  const [pendingRecos, setPendingRecos] = useState<any[]>([])
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
      fetchPendingRecos()
      fetchPendingEvents()
      fetchPublishedEvents()
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
      .select('id, first_name, last_name, email, activity, city, badges, member_since, hide_new_badge, created_at, last_active, xp, streak_weeks')
      .order('created_at', { ascending: true })
    if (data) {
      // Enrichir avec le statut de confirmation email
      const res = await fetch('/api/member-auth-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: data.map(m => m.id) }),
      })
      const { data: authStatuses } = await res.json()
      const statusMap = Object.fromEntries((authStatuses || []).map((s: any) => [s.id, s.is_confirmed]))
      setMembers(data.map(m => ({ ...m, is_confirmed: statusMap[m.id] ?? false })))
    }
  }

  const fetchStats = async () => {
    setStatsLoading(true)
    try {
      const res = await fetch('/api/admin-stats')
      const data = await res.json()
      if (data.ok) setStats(data)
    } catch {}
    setStatsLoading(false)
  }

  // Charger les stats à l'ouverture de l'onglet Activité
  useEffect(() => {
    if (tab === 'activite' && !stats) fetchStats()
  }, [tab])

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

  const fetchPendingRecos = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('recommendations')
      .select('id, content, status, proof_url, created_at, author:profiles!recommendations_author_id_fkey(first_name, last_name), target:profiles!recommendations_target_id_fkey(first_name, last_name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    if (data) setPendingRecos(data)
  }

  const approveReco = async (id: string) => {
    const supabase = createClient()
    await supabase.from('recommendations').update({ status: 'approved' }).eq('id', id)
    setPendingRecos(prev => prev.filter(r => r.id !== id))
  }

  const rejectReco = async (id: string) => {
    const supabase = createClient()
    await supabase.from('recommendations').update({ status: 'rejected' }).eq('id', id)
    setPendingRecos(prev => prev.filter(r => r.id !== id))
  }

  const fetchPendingEvents = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('events')
      .select('*, profiles!events_author_id_fkey(first_name, last_name, email, avatar_url)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    if (data) setPendingEvents(data)
  }

  const fetchPublishedEvents = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('events')
      .select('*, profiles!events_author_id_fkey(first_name, last_name, email, avatar_url)')
      .eq('status', 'published')
      .order('event_date', { ascending: true })
    if (data) setPublishedEvents(data)
  }

  const cancelEvent = async (event: any) => {
    if (!confirm(`Annuler l'événement "${event.title}" ? Les participants seront notifiés.`)) return
    const supabase = createClient()
    await supabase.from('events').update({ status: 'cancelled' }).eq('id', event.id)
    await supabase.from('notifications').insert({
      user_id: event.author_id,
      type: 'event_cancelled',
      content: `Ton événement "${event.title}" a été annulé par l'administration.`,
      link: '/evenements',
      from_user_id: ADMIN_ID,
    })
    setPublishedEvents(prev => prev.filter(e => e.id !== event.id))
  }

  const deleteEvent = async (event: any) => {
    if (!confirm(`Supprimer définitivement "${event.title}" ? Cette action est irréversible.`)) return
    const supabase = createClient()
    await supabase.from('event_participants').delete().eq('event_id', event.id)
    await supabase.from('events').delete().eq('id', event.id)
    setPublishedEvents(prev => prev.filter(e => e.id !== event.id))
    setPendingEvents(prev => prev.filter(e => e.id !== event.id))
  }

  const publishEvent = async (event: any) => {
    setPublishingEvent(event.id)
    const supabase = createClient()

    // Publier l'événement
    await supabase.from('events').update({ status: 'published' }).eq('id', event.id)

    // Envoyer une notification à l'auteur
    await supabase.from('notifications').insert({
      user_id: event.author_id,
      type: 'event_approved',
      content: `Ton événement "${event.title}" a été validé et est maintenant visible !`,
      link: '/evenements',
      from_user_id: ADMIN_ID,
    })

    // Envoyer un mail à l'auteur via route API serveur
    if (event.profiles?.email) {
      await fetch('/api/event-approved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: {
            ...event,
            author_email: event.profiles.email,
            author_name: `${event.profiles.first_name} ${event.profiles.last_name}`,
            author_first_name: event.profiles.first_name,
          },
        }),
      }).catch(() => {})
    }

    setPendingEvents(prev => prev.filter(e => e.id !== event.id))
    setPublishingEvent(null)
  }

  const rejectEvent = async (eventId: string, authorId: string, title: string) => {
    if (!confirm('Refuser et supprimer cet événement ?')) return
    const supabase = createClient()
    await supabase.from('events').delete().eq('id', eventId)
    await supabase.from('notifications').insert({
      user_id: authorId,
      type: 'event_rejected',
      content: `Ton événement "${title}" n'a pas été validé.`,
      link: '/evenements',
      from_user_id: ADMIN_ID,
    })
    setPendingEvents(prev => prev.filter(e => e.id !== eventId))
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
        {[{ key: 'candidatures', label: `Candidatures (${pending.length} en attente)` }, { key: 'membres', label: `Membres (${members.length})` }, { key: 'recommandations', label: `Recommandations (${pendingRecos.length} en attente)` }, { key: 'evenements', label: `Événements (${pendingEvents.length} en attente)` }, { key: 'activite', label: `Activité` }].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
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

      {/* Recommandations */}
      {tab === 'recommandations' && (
        <div>
          {pendingRecos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#2D2D2D', opacity: 0.4 }}>
              Aucune recommandation en attente.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {pendingRecos.map(r => (
                <div key={r.id} style={{ backgroundColor: 'white', borderRadius: '14px', padding: '1.25rem 1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: '4px solid #E8501A' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.78rem', color: '#2D2D2D', opacity: 0.5, marginBottom: '0.3rem' }}>
                        <strong style={{ color: '#E8501A' }}>{r.author?.first_name} {r.author?.last_name}</strong>
                        {' → '}
                        <strong>{r.target?.first_name} {r.target?.last_name}</strong>
                      </div>
                      <p style={{ margin: '0 0 0.75rem', color: '#2D2D2D', lineHeight: 1.65, fontSize: '0.95rem' }}>{r.content}</p>
                      {r.proof_url && (
                        <a href={r.proof_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.82rem', color: '#E8501A', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          📎 Voir le justificatif
                        </a>
                      )}
                      {!r.proof_url && (
                        <span style={{ fontSize: '0.78rem', color: '#2D2D2D', opacity: 0.4 }}>Aucun justificatif fourni</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                      <button
                        onClick={() => approveReco(r.id)}
                        style={{ backgroundColor: '#7A9E7E', color: 'white', border: 'none', borderRadius: '8px', padding: '0.5rem 1rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
                      >
                        Approuver
                      </button>
                      <button
                        onClick={() => rejectReco(r.id)}
                        style={{ backgroundColor: '#F5F0E8', color: '#E8501A', border: '1.5px solid #E8501A', borderRadius: '8px', padding: '0.5rem 1rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
                      >
                        Refuser
                      </button>
                    </div>
                  </div>
                </div>
              ))}
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
                {(() => {
                  const recent = member.last_active && (Date.now() - new Date(member.last_active).getTime()) < 7 * 24 * 60 * 60 * 1000
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.2rem' }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: member.last_active ? (recent ? '#22C55E' : '#F5A623') : '#ccc', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.72rem', color: '#2D2D2D', opacity: 0.55 }}>{formatLastActive(member.last_active)}</span>
                    </div>
                  )
                })()}
              </div>
              {/* Niveau + flamme (gamification) */}
              {(() => {
                const lvl = getLevelFromXP(member.xp ?? 0)
                const pal = getPalier(lvl.level)
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    <span title={`Niveau ${lvl.level} · ${member.xp ?? 0} XP`} style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: pal.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.78rem', flexShrink: 0 }}>{lvl.level}</span>
                    <FlammeBadge weeks={member.streak_weeks || 0} size="sm" />
                  </div>
                )
              })()}
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
                  onClick={async () => {
                    if (!confirm(`Envoyer le mail de bienvenue (création de mot de passe) à ${member.email} ?`)) return
                    const res = await fetch('/api/resend-invite', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ userId: member.id, firstName: member.first_name, forceWelcome: true }),
                    })
                    if (res.ok) alert('Mail de bienvenue envoyé !')
                    else { const err = await res.json(); alert('Erreur : ' + (err.error || 'inconnue')) }
                  }}
                  title="Renvoyer le mail de bienvenue avec lien de création de mot de passe"
                  style={{
                    marginLeft: '0.25rem', background: 'none', border: '1px solid #b3c6e8',
                    borderRadius: '8px', padding: '0.2rem 0.5rem', cursor: 'pointer',
                    color: '#2d4a8a', fontSize: '0.75rem', fontWeight: 600,
                  }}
                >
                  🏠 Mail de bienvenue
                </button>
                {member.is_confirmed && (
                  <button
                    onClick={async () => {
                      if (!confirm(`Envoyer un lien de réinitialisation de mot de passe à ${member.email} ?`)) return
                      const res = await fetch('/api/resend-invite', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: member.id, firstName: member.first_name, forceWelcome: false }),
                      })
                      if (res.ok) alert('Lien de réinitialisation envoyé !')
                      else { const err = await res.json(); alert('Erreur : ' + (err.error || 'inconnue')) }
                    }}
                    title="Envoyer un lien de réinitialisation de mot de passe"
                    style={{
                      marginLeft: '0.25rem', background: 'none', border: '1px solid #b3d9b3',
                      borderRadius: '8px', padding: '0.2rem 0.5rem', cursor: 'pointer',
                      color: '#2d7a2d', fontSize: '0.75rem', fontWeight: 600,
                    }}
                  >
                    🔑 Mot de passe oublié
                  </button>
                )}
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

      {/* Événements */}
      {tab === 'evenements' && (
        <div>
          {/* Sous-onglets */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <button onClick={() => setEventAdminTab('pending')} style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', backgroundColor: eventAdminTab === 'pending' ? '#E8501A' : 'white', color: eventAdminTab === 'pending' ? 'white' : '#2D2D2D', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              En attente ({pendingEvents.length})
            </button>
            <button onClick={() => setEventAdminTab('published')} style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', backgroundColor: eventAdminTab === 'published' ? '#E8501A' : 'white', color: eventAdminTab === 'published' ? 'white' : '#2D2D2D', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              Publiés ({publishedEvents.length})
            </button>
          </div>

          {/* En attente */}
          {eventAdminTab === 'pending' && (
            pendingEvents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#2D2D2D', opacity: 0.4, backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                Aucun événement en attente de validation.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {pendingEvents.map(event => {
                  const eventDate = new Date(event.event_date)
                  const dateStr = eventDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                  const timeStr = eventDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                  return (
                    <div key={event.id} style={{ backgroundColor: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', display: 'flex', gap: 0 }}>
                      {event.cover_url && <div style={{ width: '160px', flexShrink: 0 }}><img src={event.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /></div>}
                      <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                          <div>
                            <h3 style={{ fontFamily: 'var(--font-clash)', fontSize: '1rem', color: '#2D2D2D', margin: '0 0 0.5rem' }}>{event.title}</h3>
                            <a href={`/membre/${event.author_id}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#E8501A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, overflow: 'hidden', flexShrink: 0 }}>
                                {event.profiles?.avatar_url ? <img src={event.profiles.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : `${(event.profiles?.first_name || '?')[0]}${(event.profiles?.last_name || '')[0] || ''}`}
                              </div>
                              <span style={{ fontSize: '0.82rem', color: '#E8501A', fontWeight: 600 }}>{event.profiles?.first_name} {event.profiles?.last_name}</span>
                              <span style={{ fontSize: '0.78rem', color: '#2D2D2D', opacity: 0.4 }}>{event.profiles?.email}</span>
                            </a>
                          </div>
                          <span style={{ backgroundColor: '#FFF3CD', color: '#856404', borderRadius: '20px', padding: '0.2rem 0.6rem', fontSize: '0.72rem', fontWeight: 600, flexShrink: 0 }}>En attente</span>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#E8501A', fontWeight: 600 }}>📅 {dateStr} à {timeStr}{event.duration_minutes && <span style={{ color: '#2D2D2D', opacity: 0.5, fontWeight: 400 }}> · {event.duration_minutes} min</span>}</div>
                        {event.description && <p style={{ fontSize: '0.83rem', color: '#2D2D2D', opacity: 0.6, margin: 0, lineHeight: 1.5 }}>{event.description}</p>}
                        <div style={{ fontSize: '0.82rem', color: '#2D2D2D', opacity: 0.5 }}>🔗 <a href={event.visio_link} target="_blank" rel="noopener noreferrer" style={{ color: '#E8501A' }}>{event.visio_link}</a>{event.max_participants && <span> · {event.max_participants} places max</span>}</div>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                          <button onClick={() => publishEvent(event)} disabled={publishingEvent === event.id} style={{ backgroundColor: '#7A9E7E', color: 'white', border: 'none', borderRadius: '8px', padding: '0.5rem 1.25rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem' }}>
                            {publishingEvent === event.id ? '...' : '✓ Valider et publier'}
                          </button>
                          <button onClick={() => rejectEvent(event.id, event.author_id, event.title)} style={{ background: 'none', border: '1.5px solid #E8501A', color: '#E8501A', borderRadius: '8px', padding: '0.5rem 1rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem' }}>Refuser</button>
                          <button onClick={() => deleteEvent(event)} style={{ background: 'none', border: '1.5px solid #cc0000', color: '#cc0000', borderRadius: '8px', padding: '0.5rem 1rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem' }}>Supprimer</button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          )}

          {/* Publiés */}
          {eventAdminTab === 'published' && (
            publishedEvents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#2D2D2D', opacity: 0.4, backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                Aucun événement publié.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {publishedEvents.map(event => {
                  const eventDate = new Date(event.event_date)
                  const dateStr = eventDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                  const timeStr = eventDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                  return (
                    <div key={event.id} style={{ backgroundColor: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', display: 'flex', gap: 0 }}>
                      {event.cover_url && <div style={{ width: '160px', flexShrink: 0 }}><img src={event.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /></div>}
                      <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                          <div>
                            <h3 style={{ fontFamily: 'var(--font-clash)', fontSize: '1rem', color: '#2D2D2D', margin: '0 0 0.5rem' }}>{event.title}</h3>
                            <a href={`/membre/${event.author_id}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#E8501A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, overflow: 'hidden', flexShrink: 0 }}>
                                {event.profiles?.avatar_url ? <img src={event.profiles.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : `${(event.profiles?.first_name || '?')[0]}${(event.profiles?.last_name || '')[0] || ''}`}
                              </div>
                              <span style={{ fontSize: '0.82rem', color: '#E8501A', fontWeight: 600 }}>{event.profiles?.first_name} {event.profiles?.last_name}</span>
                            </a>
                          </div>
                          <span style={{ backgroundColor: '#E8F5E9', color: '#2E7D32', borderRadius: '20px', padding: '0.2rem 0.6rem', fontSize: '0.72rem', fontWeight: 600, flexShrink: 0 }}>Publié</span>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#E8501A', fontWeight: 600 }}>📅 {dateStr} à {timeStr}{event.duration_minutes && <span style={{ color: '#2D2D2D', opacity: 0.5, fontWeight: 400 }}> · {event.duration_minutes} min</span>}</div>
                        {event.description && <p style={{ fontSize: '0.83rem', color: '#2D2D2D', opacity: 0.6, margin: 0, lineHeight: 1.5 }}>{event.description}</p>}
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                          <button onClick={() => cancelEvent(event)} style={{ background: 'none', border: '1.5px solid #856404', color: '#856404', borderRadius: '8px', padding: '0.5rem 1rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem' }}>Annuler l'événement</button>
                          <button onClick={() => deleteEvent(event)} style={{ background: 'none', border: '1.5px solid #cc0000', color: '#cc0000', borderRadius: '8px', padding: '0.5rem 1rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem' }}>Supprimer</button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          )}
        </div>
      )}

      {/* ── ACTIVITÉ ── */}
      {tab === 'activite' && (
        <div>
          <p style={{ fontSize: '0.85rem', color: '#2D2D2D', opacity: 0.55, marginBottom: '1.25rem', lineHeight: 1.6 }}>
            Statistiques globales de la communauté. Aucune information sur le contenu des messages ni sur qui parle à qui.
          </p>
          {statsLoading || !stats ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#2D2D2D', opacity: 0.4 }}>Chargement…</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
              {[
                { label: 'Messages échangés (total)', value: stats.totalMsgs, accent: true },
                { label: 'Messages (7 derniers jours)', value: stats.msgs7 },
                { label: 'Messages (30 derniers jours)', value: stats.msgs30 },
                { label: 'Conversations (total)', value: stats.totalConvs },
                { label: 'Conversations actives (7 j)', value: stats.activeConvs },
                { label: 'Membres ayant déjà écrit', value: `${stats.activeSenders} / ${stats.totalMembers}` },
              ].map((s, i) => (
                <div key={i} style={{ backgroundColor: 'white', borderRadius: '14px', padding: '1.25rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                  <div style={{ fontFamily: 'var(--font-clash)', fontSize: '1.8rem', fontWeight: 700, color: s.accent ? '#E8501A' : '#2D2D2D' }}>
                    {s.value}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#2D2D2D', opacity: 0.55, marginTop: '0.25rem' }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
          {stats && (
            <button onClick={() => { setStats(null); fetchStats() }} style={{ marginTop: '1.25rem', background: 'none', border: '1px solid #E8E3D9', borderRadius: '8px', padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#2D2D2D' }}>
              Actualiser
            </button>
          )}
        </div>
      )}
    </div>
  )
}
