// @ts-nocheck
'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'

const ADMIN_ID = '13cdb485-42e0-48df-b2f8-14dc77dd895a'

const STOP_WORDS = new Set(['de', 'du', 'le', 'la', 'les', 'et', 'en', 'un', 'une', 'des', 'au', 'aux', 'par', 'sur', 'pour', 'dans', 'avec', 'ou', 'the', 'and', 'of', 'in', 'a'])

const BADGE_COLORS: Record<string, string> = {
  fondateur: '#E8501A',
  partenaire: '#7A9E7E',
  membre_fondateur: '#6B4FA0',
  nouveau: '#4A90D9',
}

const BADGE_LABELS: Record<string, string> = {
  fondateur: 'Fondateur',
  partenaire: 'Partenaire',
  membre_fondateur: 'Membre fondateur',
  nouveau: 'Nouveau membre',
}

function extractWords(text: string): string[] {
  if (!text) return []
  return text.toLowerCase().split(/[\s,\/\-&]+/).filter(w => w.length > 2 && !STOP_WORDS.has(w))
}

function computeScore(me: Profile, other: Profile, myConnections: Set<string>): { score: number; reasons: string[] } {
  if (other.id === me.id) return { score: -1, reasons: [] }
  if (myConnections.has(other.id)) return { score: -1, reasons: [] }

  let score = 0
  const reasons: string[] = []

  // Ville en commun
  if (me.city && other.city) {
    const myCity = me.city.split(',')[0].trim().toLowerCase()
    const otherCity = other.city.split(',')[0].trim().toLowerCase()
    if (myCity && otherCity && myCity === otherCity) {
      score += 4
      reasons.push(me.city.split(',')[0].trim())
    }
  }

  // Skills en commun
  const mySkills = new Set((me.skills || []).map((s: string) => s.toLowerCase()))
  const sharedSkills: string[] = []
  for (const skill of (other.skills || [])) {
    if (mySkills.has(skill.toLowerCase())) {
      sharedSkills.push(skill)
      score += 3
    }
  }
  if (sharedSkills.length > 0) reasons.push(...sharedSkills.slice(0, 2))

  // Activité en commun (mots-clés)
  const myWords = extractWords(me.activity || '')
  const otherWords = new Set(extractWords(other.activity || ''))
  const sharedWords: string[] = []
  for (const w of myWords) {
    if (otherWords.has(w) && !reasons.map(r => r.toLowerCase()).includes(w)) {
      sharedWords.push(w)
      score += 2
    }
  }
  if (sharedWords.length > 0 && reasons.length < 3) reasons.push(sharedWords[0])

  return { score, reasons }
}

export default function AnnuairePage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [suggestions, setSuggestions] = useState<Array<Profile & { reasons: string[] }>>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true })

      if (data) {
        setProfiles(data)

        if (user) {
          const me = data.find(p => p.id === user.id)
          if (me) {
            // Récupérer les connexions existantes
            const { data: conns } = await supabase
              .from('connections')
              .select('requester_id, receiver_id')
              .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`)
              .eq('status', 'accepted')

            const connectedIds = new Set<string>()
            for (const c of (conns || [])) {
              connectedIds.add(c.requester_id === user.id ? c.receiver_id : c.requester_id)
            }

            // Calculer les scores
            const scored = data
              .map(p => ({ ...p, ...computeScore(me, p, connectedIds) }))
              .filter(p => p.score >= 0)
              .sort((a, b) => b.score - a.score)
              .slice(0, 6)

            setSuggestions(scored)
          }
        }
      }
      setLoading(false)
    }
    load()
  }, [])

  const filtered = profiles.filter(p => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
      (p.activity || '').toLowerCase().includes(q) ||
      (p.city || '').toLowerCase().includes(q)
    )
  })

  const scroll = (dir: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir === 'right' ? 280 : -280, behavior: 'smooth' })
    }
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.75rem', color: '#2D2D2D', margin: 0 }}>
          Annuaire
        </h1>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un membre, un métier, une ville..."
          style={{ padding: '0.6rem 1rem', border: '2px solid #E8E3D9', borderRadius: '10px', fontSize: '0.95rem', outline: 'none', width: '300px', maxWidth: '100%' }}
        />
      </div>

      {/* Suggestions */}
      {!search && suggestions.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.1rem', color: '#2D2D2D', margin: 0 }}>
                Membres que tu pourrais connaître
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#2D2D2D', opacity: 0.45, margin: '0.2rem 0 0' }}>
                Basé sur ta ville, tes compétences et ton activité
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button onClick={() => scroll('left')} style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1.5px solid #E8E3D9', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2D2D2D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <button onClick={() => scroll('right')} style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1.5px solid #E8E3D9', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2D2D2D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          </div>

          <div
            ref={scrollRef}
            style={{ display: 'flex', gap: '0.85rem', overflowX: 'auto', paddingBottom: '0.5rem', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <style>{`.suggestions-scroll::-webkit-scrollbar { display: none; }`}</style>
            {suggestions.map(profile => (
              <SuggestionCard key={profile.id} profile={profile} reasons={profile.reasons} />
            ))}
          </div>
        </div>
      )}

      {/* Séparateur */}
      {!search && suggestions.length > 0 && (
        <div style={{ borderTop: '1px solid #F0EBE1', marginBottom: '1.5rem' }} />
      )}

      {/* Grille membres */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#2D2D2D', opacity: 0.4 }}>Chargement...</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1rem' }}>
        {filtered.map(profile => (
          <MemberCard key={profile.id} profile={profile} />
        ))}
      </div>

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#2D2D2D', opacity: 0.4 }}>Aucun membre trouvé.</div>
      )}
    </div>
  )
}

function SuggestionCard({ profile, reasons }: { profile: Profile; reasons: string[] }) {
  const initials = `${(profile.first_name || '?')[0]}${(profile.last_name || '')[0] || ''}`.toUpperCase()

  return (
    <Link href={`/membre/${profile.id}`} style={{ textDecoration: 'none', flexShrink: 0 }}>
      <div
        style={{ width: '200px', backgroundColor: 'white', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem', textAlign: 'center', transition: 'transform 0.15s, box-shadow 0.15s', cursor: 'pointer' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.12)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)' }}
      >
        {/* Avatar */}
        <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#E8501A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.1rem', overflow: 'hidden', flexShrink: 0 }}>
          {profile.avatar_url
            ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : initials}
        </div>

        {/* Nom + activité */}
        <div>
          <div style={{ fontWeight: 700, color: '#2D2D2D', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
            {profile.first_name} {profile.last_name}
            {profile.id === ADMIN_ID && <img src="/icons/badge-check.svg" alt="" style={{ width: '14px', height: '14px' }} />}
          </div>
          {profile.activity && (
            <div style={{ fontSize: '0.75rem', color: '#2D2D2D', opacity: 0.5, marginTop: '0.15rem', lineHeight: 1.3 }}>{profile.activity}</div>
          )}
        </div>

        {/* Tags de raison */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', justifyContent: 'center' }}>
          {reasons.length > 0
            ? reasons.slice(0, 3).map(r => (
                <span key={r} style={{ backgroundColor: '#FFF0ED', color: '#E8501A', borderRadius: '20px', padding: '0.2rem 0.55rem', fontSize: '0.72rem', fontWeight: 600 }}>
                  {r}
                </span>
              ))
            : <span style={{ backgroundColor: '#F5F0E8', color: '#2D2D2D', borderRadius: '20px', padding: '0.2rem 0.55rem', fontSize: '0.72rem', fontWeight: 600, opacity: 0.5 }}>
                Nouveau membre
              </span>
          }
        </div>

        {/* CTA */}
        <div style={{ fontSize: '0.78rem', color: '#E8501A', fontWeight: 600, marginTop: '0.1rem' }}>
          Voir le profil →
        </div>
      </div>
    </Link>
  )
}

function MemberCard({ profile }: { profile: Profile }) {
  const initials = `${(profile.first_name || '?')[0]}${(profile.last_name || '')[0] || ''}`.toUpperCase()
  const isNew = profile.member_since && !profile.hide_new_badge
    ? (Date.now() - new Date(profile.member_since).getTime()) < 30 * 24 * 60 * 60 * 1000
    : false
  const baseBadges = (profile.badges || []).filter((b: string) => b !== 'profil_complet' && b !== 'nouveau')
  const badges = isNew ? ['nouveau', ...baseBadges] : baseBadges

  return (
    <Link href={`/membre/${profile.id}`} style={{ textDecoration: 'none', minWidth: 0, display: 'block' }}>
      <div
        style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', transition: 'transform 0.15s, box-shadow 0.15s', cursor: 'pointer', minWidth: 0, overflow: 'hidden' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.12)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#E8501A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1rem', flexShrink: 0, overflow: 'hidden' }}>
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: '#2D2D2D', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              {profile.first_name} {profile.last_name}
              {profile.id === ADMIN_ID && <img src="/icons/badge-check.svg" alt="Admin" title="Fondateur Meello" style={{ width: '15px', height: '15px', flexShrink: 0 }} />}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#2D2D2D', opacity: 0.55, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {profile.activity}
            </div>
          </div>
        </div>

        {profile.city && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.82rem', color: '#2D2D2D', opacity: 0.5, marginBottom: '0.6rem' }}>
            <img src="/icons/pin.svg" alt="" style={{ width: '13px', height: '13px', flexShrink: 0, opacity: 0.6 }} />
            {profile.city}
          </div>
        )}

        {badges.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {badges.map((badge: string) => (
              <span key={badge} style={{ backgroundColor: BADGE_COLORS[badge] || '#999', color: 'white', fontSize: '0.7rem', fontWeight: 600, padding: '0.2rem 0.55rem', borderRadius: '20px' }}>
                {BADGE_LABELS[badge] || badge}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}
