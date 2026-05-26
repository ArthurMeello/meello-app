// @ts-nocheck
'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const NAV_ITEMS = [
  { href: '/feed', label: "Fil d'actualité", icon: null, svg: '/icons/feed.svg' },
  { href: '/annuaire', label: 'Annuaire', icon: '👥' },
  { href: '/forum', label: 'Forum', icon: '💬' },
  { href: '/messages', label: 'Conversations', icon: '✉️' },
  { href: '/reseau', label: 'Mon Réseau', icon: null, svg: '/icons/network.svg' },
]

const ADMIN_ID = '13cdb485-42e0-48df-b2f8-14dc77dd895a'

export default function AppNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [profile, setProfile] = useState<{ first_name: string; last_name: string; avatar_url: string | null } | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [pendingConnections, setPendingConnections] = useState(0)
  const [adminActions, setAdminActions] = useState(0)

  useEffect(() => {
    const loadProfile = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data } = await supabase.from('profiles').select('first_name, last_name, avatar_url').eq('id', user.id).single()
      if (data) setProfile(data)
      // Compter les demandes de connexion en attente
      const { count } = await supabase
        .from('connections')
        .select('id', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('status', 'pending')
      setPendingConnections(count || 0)
      // Compter les actions admin en attente
      if (user.id === ADMIN_ID) {
        const [{ count: appCount }, { count: recoCount }] = await Promise.all([
          supabase.from('applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('recommendations').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        ])
        setAdminActions((appCount || 0) + (recoCount || 0))
      }
    }
    loadProfile()
  }, [pathname])

  const initials = profile
    ? `${(profile.first_name || '')[0] || ''}${(profile.last_name || '')[0] || ''}`.toUpperCase()
    : '?'

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/connexion')
  }

  return (
    <>
      {/* Sidebar desktop */}
      <aside style={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100vh',
        width: '220px',
        backgroundColor: '#1A1A2E',
        display: 'flex',
        flexDirection: 'column',
        padding: '1.5rem 1rem',
        zIndex: 100,
      }}>
        <Link href="/feed" style={{ textDecoration: 'none', marginBottom: '2rem', display: 'flex', justifyContent: 'center' }}>
          <img src="/logo-meello.webp" alt="Meello" style={{ height: '80px', width: 'auto' }} />
        </Link>

        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {NAV_ITEMS.map(item => {
            const active = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.65rem 0.75rem',
                  borderRadius: '10px',
                  textDecoration: 'none',
                  color: active ? '#E8501A' : '#F5F0E8',
                  backgroundColor: active ? 'rgba(232,80,26,0.12)' : 'transparent',
                  fontWeight: active ? 600 : 400,
                  fontSize: '0.95rem',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  {item.svg
                    ? <img src={item.svg} alt={item.label} style={{ width: '20px', height: '20px', filter: active ? 'brightness(0) saturate(100%) invert(35%) sepia(90%) saturate(700%) hue-rotate(350deg)' : 'brightness(0) invert(1)' }} />
                    : <span>{item.icon}</span>}
                  {item.href === '/reseau' && pendingConnections > 0 && (
                    <span style={{ position: 'absolute', top: '-5px', right: '-6px', backgroundColor: '#E8501A', color: 'white', borderRadius: '50%', width: '16px', height: '16px', fontSize: '0.6rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #1A1A2E' }}>
                      {pendingConnections}
                    </span>
                  )}
                </div>
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {userId === ADMIN_ID && (
            <Link
              href="/admin"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.65rem 0.75rem',
                borderRadius: '10px',
                textDecoration: 'none',
                color: pathname.startsWith('/admin') ? '#E8501A' : 'rgba(245,240,232,0.5)',
                backgroundColor: pathname.startsWith('/admin') ? 'rgba(232,80,26,0.12)' : 'transparent',
                fontSize: '0.95rem',
              }}
            >
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <img src="/icons/admin.svg" alt="Admin" style={{ width: '16px', height: '16px', filter: pathname.startsWith('/admin') ? 'brightness(0) saturate(100%) invert(35%) sepia(90%) saturate(700%) hue-rotate(350deg)' : 'brightness(0) invert(0.4)' }} />
                {adminActions > 0 && (
                  <span style={{ position: 'absolute', top: '-5px', right: '-6px', backgroundColor: '#E8501A', color: 'white', borderRadius: '50%', width: '16px', height: '16px', fontSize: '0.6rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #1A1A2E' }}>
                    {adminActions}
                  </span>
                )}
              </div>
              <span>Admin</span>
            </Link>
          )}
          <Link
            href="/profil"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.65rem 0.75rem',
              borderRadius: '10px',
              textDecoration: 'none',
              color: pathname.startsWith('/profil') ? '#E8501A' : '#F5F0E8',
              backgroundColor: pathname.startsWith('/profil') ? 'rgba(232,80,26,0.12)' : 'transparent',
              fontSize: '0.95rem',
            }}
          >
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%',
              backgroundColor: '#E8501A', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.7rem', fontWeight: 700, flexShrink: 0, overflow: 'hidden',
            }}>
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : initials}
            </div>
            <span>Mon profil</span>
          </Link>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.65rem 0.75rem',
              borderRadius: '10px',
              background: 'none',
              border: 'none',
              color: 'rgba(245,240,232,0.5)',
              fontSize: '0.95rem',
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
            }}
          >
            <img src="/icons/logout.svg" alt="Déconnexion" style={{ width: '20px', height: '20px', filter: 'brightness(0) invert(1)', flexShrink: 0 }} />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Bottom nav mobile */}
      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#1A1A2E',
        display: 'none',
        justifyContent: 'space-around',
        padding: '0.5rem 0',
        zIndex: 100,
      }} className="mobile-nav">
        {NAV_ITEMS.map(item => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
                color: active ? '#E8501A' : 'rgba(245,240,232,0.6)',
                textDecoration: 'none',
                fontSize: '0.65rem',
                padding: '0.25rem 0.5rem',
              }}
            >
              <div style={{ position: 'relative' }}>
                {item.svg
                  ? <img src={item.svg} alt={item.label} style={{ width: '22px', height: '22px', filter: active ? 'brightness(0) saturate(100%) invert(35%) sepia(90%) saturate(700%) hue-rotate(350deg)' : 'brightness(0) invert(0.6)' }} />
                  : <span style={{ fontSize: '1.3rem' }}>{item.icon}</span>}
                {item.href === '/reseau' && pendingConnections > 0 && (
                  <span style={{ position: 'absolute', top: '-4px', right: '-6px', backgroundColor: '#E8501A', color: 'white', borderRadius: '50%', width: '15px', height: '15px', fontSize: '0.55rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #1A1A2E' }}>
                    {pendingConnections}
                  </span>
                )}
              </div>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
