// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'

const ADMIN_ID = '13cdb485-42e0-48df-b2f8-14dc77dd895a'

const BADGE_COLORS: Record<string, string> = {
  fondateur: '#E8501A',
  partenaire: '#7A9E7E',
  nouveau: '#4A90D9',
}

const BADGE_LABELS: Record<string, string> = {
  fondateur: 'Fondateur',
  partenaire: 'Partenaire',
  nouveau: 'Nouveau membre',
}

export default function AnnuairePage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProfiles()
  }, [])

  const fetchProfiles = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true })
    if (data) setProfiles(data)
    setLoading(false)
  }

  const filtered = profiles.filter(p => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
      (p.activity || '').toLowerCase().includes(q) ||
      (p.city || '').toLowerCase().includes(q)
    )
  })

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.75rem', color: '#2D2D2D', margin: 0 }}>
          Annuaire
        </h1>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un membre, un metier, une ville..."
          style={{
            padding: '0.6rem 1rem',
            border: '2px solid #E8E3D9',
            borderRadius: '10px',
            fontSize: '0.95rem',
            outline: 'none',
            width: '300px',
            maxWidth: '100%',
          }}
        />
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#2D2D2D', opacity: 0.4 }}>
          Chargement...
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
        {filtered.map(profile => (
          <MemberCard key={profile.id} profile={profile} />
        ))}
      </div>

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#2D2D2D', opacity: 0.4 }}>
          Aucun membre trouve.
        </div>
      )}
    </div>
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
    <Link href={`/profil/${profile.id}`} style={{ textDecoration: 'none' }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '1.25rem',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        transition: 'transform 0.15s, box-shadow 0.15s',
        cursor: 'pointer',
      }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
          ;(e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.12)'
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.transform = ''
          ;(e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            backgroundColor: '#E8501A', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: '1rem', flexShrink: 0,
            overflow: 'hidden',
          }}>
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: '#2D2D2D', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              {profile.first_name} {profile.last_name}
              {profile.id === ADMIN_ID && (
                <img src="/icons/badge-check.svg" alt="Admin" title="Fondateur Meello" style={{ width: '15px', height: '15px', flexShrink: 0 }} />
              )}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#2D2D2D', opacity: 0.55, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {profile.activity}
            </div>
          </div>
        </div>

        {profile.city && (
          <div style={{ fontSize: '0.82rem', color: '#2D2D2D', opacity: 0.5, marginBottom: '0.6rem' }}>
            📍 {profile.city}
          </div>
        )}

        {badges.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {badges.map((badge: string) => (
              <span
                key={badge}
                style={{
                  backgroundColor: BADGE_COLORS[badge] || '#999',
                  color: 'white',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  padding: '0.2rem 0.55rem',
                  borderRadius: '20px',
                }}
              >
                {BADGE_LABELS[badge] || badge}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}
