// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const ADMIN_ID = '13cdb485-42e0-48df-b2f8-14dc77dd895a'

export default function EvenementsPage() {
  const [tab, setTab] = useState<'a-venir' | 'passes'>('a-venir')
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentProfile, setCurrentProfile] = useState<any>(null)
  const [participants, setParticipants] = useState<Record<string, string[]>>({})
  const [createModal, setCreateModal] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', event_date: '', event_time: '10:00', duration_minutes: '', visio_link: '', max_participants: '' })
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [joining, setJoining] = useState<string | null>(null)

  const isAdmin = currentUserId === ADMIN_ID

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
        const { data: prof } = await supabase.from('profiles').select('first_name, last_name, email, avatar_url').eq('id', user.id).single()
        if (prof) setCurrentProfile(prof)
      }

      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'published')
        .order('event_date', { ascending: true })

      if (data) {
        setEvents(data)
        // Charger les participants pour chaque event
        const { data: parts } = await supabase.from('event_participants').select('event_id, user_id')
        if (parts) {
          const map: Record<string, string[]> = {}
          for (const p of parts) {
            if (!map[p.event_id]) map[p.event_id] = []
            map[p.event_id].push(p.user_id)
          }
          setParticipants(map)
        }
      }
      setLoading(false)
    }
    load()
  }, [])

  const now = new Date()
  const upcoming = events.filter(e => new Date(e.event_date) >= now)
  const past = events.filter(e => new Date(e.event_date) < now)
  const displayed = tab === 'a-venir' ? upcoming : past

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async () => {
    if (!form.title || !form.event_date || !form.visio_link || !currentUserId) return
    setSubmitting(true)
    const supabase = createClient()

    let cover_url = null
    if (coverFile) {
      const ext = coverFile.name.split('.').pop()
      const path = `events/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('covers').upload(path, coverFile, { upsert: true })
      if (!error) {
        const { data: urlData } = supabase.storage.from('covers').getPublicUrl(path)
        cover_url = urlData.publicUrl
      }
    }

    const datetime = `${form.event_date}T${form.event_time}:00`
    const { data } = await supabase.from('events').insert({
      title: form.title,
      description: form.description || null,
      cover_url,
      event_date: datetime,
      duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null,
      visio_link: form.visio_link,
      max_participants: form.max_participants ? parseInt(form.max_participants) : null,
      author_id: currentUserId,
      status: 'pending',
    }).select().single()

    if (data) {
      alert('Ton événement a été soumis et sera publié après validation par l\'équipe Meello. 🎉')
      setCreateModal(false)
      setForm({ title: '', description: '', event_date: '', event_time: '10:00', duration_minutes: '', visio_link: '', max_participants: '' })
      setCoverFile(null); setCoverPreview(null)
    }
    setSubmitting(false)
  }

  const toggleParticipation = async (event: any) => {
    if (!currentUserId || !currentProfile) return
    setJoining(event.id)
    const supabase = createClient()
    const isParticipating = (participants[event.id] || []).includes(currentUserId)

    if (isParticipating) {
      await supabase.from('event_participants').delete().eq('event_id', event.id).eq('user_id', currentUserId)
      setParticipants(prev => ({ ...prev, [event.id]: (prev[event.id] || []).filter(id => id !== currentUserId) }))
    } else {
      await supabase.from('event_participants').insert({ event_id: event.id, user_id: currentUserId })
      setParticipants(prev => ({ ...prev, [event.id]: [...(prev[event.id] || []), currentUserId] }))
      // Envoyer les mails via API
      await fetch('/api/event-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, user: { ...currentProfile, id: currentUserId } }),
      })
    }
    setJoining(null)
  }

  const formatDate = (d: string) => {
    const date = new Date(d)
    return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  const formatTime = (d: string) => {
    const date = new Date(d)
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.75rem', color: '#2D2D2D', margin: 0 }}>Événements</h1>
          <p style={{ color: '#2D2D2D', opacity: 0.45, fontSize: '0.9rem', margin: '0.4rem 0 0' }}>
            Visios et ateliers organisés par la communauté Meello.
          </p>
        </div>
        {currentUserId && (
          <button onClick={() => setCreateModal(true)} style={{ backgroundColor: '#E8501A', color: 'white', border: 'none', borderRadius: '10px', padding: '0.65rem 1.25rem', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}>
            + Proposer un événement
          </button>
        )}
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', gap: 0, marginBottom: '1.5rem', borderBottom: '2px solid #F0EBE1' }}>
        {([['a-venir', `À venir (${upcoming.length})`], ['passes', `Passés (${past.length})`]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.6rem 1.25rem', fontWeight: tab === key ? 700 : 400, color: tab === key ? '#E8501A' : '#2D2D2D', opacity: tab === key ? 1 : 0.45, fontSize: '0.92rem', borderBottom: tab === key ? '2px solid #E8501A' : '2px solid transparent', marginBottom: '-2px', transition: 'all 0.15s' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Liste événements */}
      {loading && <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.4 }}>Chargement...</div>}

      {!loading && displayed.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '5rem 2rem', textAlign: 'center' }}>
          <div style={{ width: '72px', height: '72px', backgroundColor: '#FFF0ED', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
            <img src="/icons/evenements.svg" alt="" style={{ width: '36px', height: '36px', filter: 'brightness(0) saturate(100%) invert(35%) sepia(90%) saturate(700%) hue-rotate(350deg)' }} />
          </div>
          <h2 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.2rem', color: '#2D2D2D', margin: '0 0 0.5rem' }}>
            {tab === 'a-venir' ? 'Aucun événement à venir' : 'Aucun événement passé'}
          </h2>
          <p style={{ color: '#2D2D2D', opacity: 0.45, fontSize: '0.9rem', margin: 0, maxWidth: '360px', lineHeight: 1.6 }}>
            {tab === 'a-venir' ? 'Les prochains événements apparaîtront ici. Tu peux aussi en proposer un !' : ''}
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '1.25rem' }}>
        {displayed.map(event => {
          const parts = participants[event.id] || []
          const isParticipating = parts.includes(currentUserId || '')
          const isFull = event.max_participants && parts.length >= event.max_participants
          const isPast = new Date(event.event_date) < now

          return (
            <div key={event.id} style={{ backgroundColor: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column' }}>
              {/* Cover */}
              {event.cover_url ? (
                <div style={{ height: '180px', overflow: 'hidden' }}>
                  <img src={event.cover_url} alt={event.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </div>
              ) : (
                <div style={{ height: '120px', background: 'linear-gradient(135deg, #E8501A 0%, #F5A623 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src="/icons/evenements.svg" alt="" style={{ width: '48px', height: '48px', filter: 'brightness(0) invert(1)', opacity: 0.6 }} />
                </div>
              )}

              <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <h3 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.05rem', color: '#2D2D2D', margin: 0 }}>{event.title}</h3>

                {/* Date + heure */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: '#E8501A', fontWeight: 600 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  {formatDate(event.event_date)} à {formatTime(event.event_date)}
                  {event.duration_minutes && <span style={{ color: '#2D2D2D', opacity: 0.45, fontWeight: 400 }}>· {event.duration_minutes} min</span>}
                </div>

                {event.description && (
                  <p style={{ fontSize: '0.85rem', color: '#2D2D2D', opacity: 0.6, margin: 0, lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {event.description}
                  </p>
                )}

                {/* Participants */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: '#2D2D2D', opacity: 0.5 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  {parts.length} participant{parts.length !== 1 ? 's' : ''}
                  {event.max_participants && <span>· {event.max_participants - parts.length} place{event.max_participants - parts.length !== 1 ? 's' : ''} restante{event.max_participants - parts.length !== 1 ? 's' : ''}</span>}
                </div>

                <div style={{ marginTop: 'auto', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', paddingTop: '0.5rem' }}>
                  {/* Bouton participation */}
                  {!isPast && currentUserId && event.status === 'published' && (
                    <button
                      onClick={() => toggleParticipation(event)}
                      disabled={!!joining || (!isParticipating && !!isFull)}
                      style={{ flex: 1, padding: '0.55rem 1rem', borderRadius: '8px', border: isParticipating ? '1.5px solid #E8501A' : 'none', backgroundColor: isParticipating ? 'white' : '#E8501A', color: isParticipating ? '#E8501A' : 'white', fontWeight: 600, fontSize: '0.88rem', cursor: (!!joining || (!isParticipating && !!isFull)) ? 'default' : 'pointer', opacity: (!isParticipating && isFull) ? 0.4 : 1 }}
                    >
                      {joining === event.id ? '...' : isParticipating ? '✓ Je participe' : isFull ? 'Complet' : 'Je participe'}
                    </button>
                  )}

                  {/* Lien visio si participant ou admin */}
                  {(isParticipating || isAdmin) && event.visio_link && (
                    <a href={event.visio_link} target="_blank" rel="noopener noreferrer" style={{ flex: 1, padding: '0.55rem 1rem', borderRadius: '8px', border: '1.5px solid #E8E3D9', backgroundColor: 'white', color: '#2D2D2D', fontWeight: 600, fontSize: '0.88rem', textDecoration: 'none', textAlign: 'center' }}>
                      Rejoindre →
                    </a>
                  )}

                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal création */}
      {createModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', overflowY: 'auto' }} onClick={() => setCreateModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.75rem', width: '100%', maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.2rem', color: '#2D2D2D', margin: '0 0 1.25rem' }}>Proposer un événement</h3>
            <p style={{ fontSize: '0.82rem', color: '#2D2D2D', opacity: 0.45, margin: '-0.75rem 0 1.25rem', lineHeight: 1.5 }}>
              Ton événement sera soumis à validation avant d'être publié.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Cover */}
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#2D2D2D', opacity: 0.6, display: 'block', marginBottom: '0.4rem' }}>Image de couverture <span style={{ opacity: 0.5, fontWeight: 400 }}>(format horizontal recommandé)</span></label>
                {coverPreview ? (
                  <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', marginBottom: '0.4rem' }}>
                    <img src={coverPreview} alt="" style={{ width: '100%', height: '140px', objectFit: 'cover', display: 'block' }} />
                    <button onClick={() => { setCoverFile(null); setCoverPreview(null) }} style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', color: 'white', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                  </div>
                ) : (
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100px', border: '2px dashed #E8E3D9', borderRadius: '10px', cursor: 'pointer', color: '#2D2D2D', opacity: 0.4, fontSize: '0.85rem', gap: '0.4rem' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    Ajouter une image
                    <input type="file" accept="image/*" onChange={handleCoverChange} style={{ display: 'none' }} />
                  </label>
                )}
              </div>

              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Titre de l'événement *" style={{ border: '1.5px solid #E8E3D9', borderRadius: '10px', padding: '0.75rem 1rem', fontSize: '0.95rem', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' }} />

              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (facultatif)" rows={3} style={{ border: '1.5px solid #E8E3D9', borderRadius: '10px', padding: '0.75rem 1rem', fontSize: '0.95rem', fontFamily: 'inherit', outline: 'none', resize: 'none', width: '100%', boxSizing: 'border-box' }} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#2D2D2D', opacity: 0.55, display: 'block', marginBottom: '0.3rem' }}>Date *</label>
                  <input type="date" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} style={{ border: '1.5px solid #E8E3D9', borderRadius: '10px', padding: '0.65rem 0.9rem', fontSize: '0.92rem', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#2D2D2D', opacity: 0.55, display: 'block', marginBottom: '0.3rem' }}>Heure *</label>
                  <input type="time" value={form.event_time} onChange={e => setForm(f => ({ ...f, event_time: e.target.value }))} style={{ border: '1.5px solid #E8E3D9', borderRadius: '10px', padding: '0.65rem 0.9rem', fontSize: '0.92rem', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#2D2D2D', opacity: 0.55, display: 'block', marginBottom: '0.3rem' }}>Durée en minutes <span style={{ fontWeight: 400 }}>(facultatif)</span></label>
                  <input type="number" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))} placeholder="ex: 60" style={{ border: '1.5px solid #E8E3D9', borderRadius: '10px', padding: '0.65rem 0.9rem', fontSize: '0.92rem', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#2D2D2D', opacity: 0.55, display: 'block', marginBottom: '0.3rem' }}>Places max <span style={{ fontWeight: 400 }}>(facultatif)</span></label>
                  <input type="number" value={form.max_participants} onChange={e => setForm(f => ({ ...f, max_participants: e.target.value }))} placeholder="Illimité" style={{ border: '1.5px solid #E8E3D9', borderRadius: '10px', padding: '0.65rem 0.9rem', fontSize: '0.92rem', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#2D2D2D', opacity: 0.55, display: 'block', marginBottom: '0.3rem' }}>Lien visio (Zoom, Meet…) *</label>
                <input value={form.visio_link} onChange={e => setForm(f => ({ ...f, visio_link: e.target.value }))} placeholder="https://zoom.us/j/..." style={{ border: '1.5px solid #E8E3D9', borderRadius: '10px', padding: '0.75rem 1rem', fontSize: '0.92rem', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setCreateModal(false)} style={{ background: 'none', border: '1px solid #E8E3D9', borderRadius: '8px', padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.9rem' }}>Annuler</button>
              <button onClick={handleSubmit} disabled={!form.title || !form.event_date || !form.visio_link || submitting} style={{ backgroundColor: '#E8501A', color: 'white', border: 'none', borderRadius: '8px', padding: '0.5rem 1.25rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem', opacity: (!form.title || !form.event_date || !form.visio_link) ? 0.5 : 1 }}>
                {submitting ? 'Envoi...' : 'Soumettre'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
