// @ts-nocheck
'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const NAV_ITEMS = [
  { href: '/feed', label: "Fil d'actualité", svg: '/icons/feed.svg' },
  { href: '/annuaire', label: 'Annuaire', svg: '/icons/annuaire.svg' },
  { href: '/forum', label: 'La Communauté', svg: '/icons/communaute.svg' },
  { href: '/qg', label: 'Le QG', svg: '/icons/megaphone.svg' },
  { href: '/evenements', label: 'Événements', svg: '/icons/evenements.svg' },
  { href: '/messages', label: 'Mes messages', svg: '/icons/chat.svg' },
  { href: '/reseau', label: 'Mon Réseau', svg: '/icons/network.svg' },
]

const ADMIN_ID = '13cdb485-42e0-48df-b2f8-14dc77dd895a'

export default function AppNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [pendingConnections, setPendingConnections] = useState(0)
  const [adminActions, setAdminActions] = useState(0)
  const [notifications, setNotifications] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifsOpen, setNotifsOpen] = useState(false)
  const [notifsList, setNotifsList] = useState<any[]>([])

  useEffect(() => {
    const loadProfile = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data } = await supabase.from('profiles').select('first_name, last_name, avatar_url').eq('id', user.id).single()
      if (data) setProfile(data)
      const { count: connCount } = await supabase.from('connections').select('id', { count: 'exact', head: true }).eq('receiver_id', user.id).eq('status', 'pending')
      setPendingConnections(connCount || 0)
      const { count: notifCount } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('read', false).neq('type', 'message')
      setNotifications(notifCount || 0)
      loadNotifs(user.id)
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

  // Fermer le menu quand on change de page
  useEffect(() => { setMenuOpen(false); setNotifsOpen(false) }, [pathname])

  const loadNotifs = async (uid?: string) => {
    const supabase = createClient()
    const targetUid = uid || userId
    if (!targetUid) return
    const { data } = await supabase
      .from('notifications')
      .select('id, type, content, read, created_at, link, from_user_id, profiles!notifications_from_user_id_fkey(first_name, last_name, avatar_url)')
      .eq('user_id', targetUid)
      .neq('type', 'message')
      .order('created_at', { ascending: false })
      .limit(20)
    if (data) setNotifsList(data)
  }

  const markAllRead = async () => {
    const supabase = createClient()
    if (!userId) return
    await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false)
    setNotifsList(prev => prev.map(n => ({ ...n, read: true })))
    setNotifications(0)
  }

  const handleNotifClick = async (n: any) => {
    const supabase = createClient()
    await supabase.from('notifications').update({ read: true }).eq('id', n.id)
    setNotifsList(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))
    if (n.link) { setNotifsOpen(false); window.location.href = n.link }
  }

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
      {/* ── SIDEBAR DESKTOP ── */}
      <aside className="desktop-nav" style={{
        position: 'fixed', top: 0, left: 0, height: '100vh', width: '220px',
        backgroundColor: '#1A1A2E', display: 'flex', flexDirection: 'column',
        padding: '1.5rem 1rem', zIndex: 100,
      }}>
        <Link href="/feed" style={{ textDecoration: 'none', marginBottom: '2rem', display: 'flex', justifyContent: 'center' }}>
          <img src="/logo-meello.webp" alt="Meello" style={{ height: '80px', width: 'auto' }} />
        </Link>
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {NAV_ITEMS.map(item => {
            const active = pathname.startsWith(item.href)
            return (
              <Link key={item.href} href={item.href} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.65rem 0.75rem', borderRadius: '10px', textDecoration: 'none',
                color: active ? '#E8501A' : '#F5F0E8',
                backgroundColor: active ? 'rgba(232,80,26,0.12)' : 'transparent',
                fontWeight: active ? 600 : 400, fontSize: '0.95rem', transition: 'all 0.15s',
              }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <img src={item.svg} alt={item.label} style={{ width: '20px', height: '20px', filter: active ? 'brightness(0) saturate(100%) invert(35%) sepia(90%) saturate(700%) hue-rotate(350deg)' : 'brightness(0) invert(1)' }} />
                  {item.href === '/reseau' && pendingConnections > 0 && (
                    <span style={{ position: 'absolute', top: '-5px', right: '-6px', backgroundColor: '#E8501A', color: 'white', borderRadius: '50%', width: '16px', height: '16px', fontSize: '0.6rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #1A1A2E' }}>{pendingConnections}</span>
                  )}
                </div>
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {userId === ADMIN_ID && (
            <Link href="/admin" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 0.75rem', borderRadius: '10px', textDecoration: 'none', color: pathname.startsWith('/admin') ? '#E8501A' : '#F5F0E8', backgroundColor: pathname.startsWith('/admin') ? 'rgba(232,80,26,0.12)' : 'transparent', fontSize: '0.95rem' }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <img src="/icons/admin.svg" alt="Admin" style={{ width: '20px', height: '20px', filter: pathname.startsWith('/admin') ? 'brightness(0) saturate(100%) invert(35%) sepia(90%) saturate(700%) hue-rotate(350deg)' : 'brightness(0) invert(1)' }} />
                {adminActions > 0 && <span style={{ position: 'absolute', top: '-5px', right: '-6px', backgroundColor: '#E8501A', color: 'white', borderRadius: '50%', width: '16px', height: '16px', fontSize: '0.6rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #1A1A2E' }}>{adminActions}</span>}
              </div>
              <span>Admin</span>
            </Link>
          )}
          <Link href="/profil" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 0.75rem', borderRadius: '10px', textDecoration: 'none', color: pathname.startsWith('/profil') ? '#E8501A' : '#F5F0E8', backgroundColor: pathname.startsWith('/profil') ? 'rgba(232,80,26,0.12)' : 'transparent', fontSize: '0.95rem' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#E8501A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, flexShrink: 0, overflow: 'hidden' }}>
              {profile?.avatar_url ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
            </div>
            <span>Mon profil</span>
          </Link>
          <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 0.75rem', borderRadius: '10px', background: 'none', border: 'none', color: '#F5F0E8', fontSize: '0.95rem', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
            <img src="/icons/logout.svg" alt="Déconnexion" style={{ width: '22px', height: '22px', filter: 'brightness(0) invert(1)', flexShrink: 0 }} />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* ── MOBILE : BURGER FLOTTANT ── */}
      <div className="mobile-only" style={{ display: 'none' }}>

        {/* Overlay flou quand menu ouvert */}
        {menuOpen && (
          <div
            onClick={() => setMenuOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 199, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', backgroundColor: 'rgba(26,26,46,0.35)' }}
          />
        )}

        {/* Pills du menu */}
        {menuOpen && (
          <div style={{ position: 'fixed', top: '80px', left: '16px', zIndex: 200, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {NAV_ITEMS.filter(item => item.href !== '/messages').map((item, i) => {
              const active = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 20px', borderRadius: '50px',
                    textDecoration: 'none',
                    background: active ? 'rgba(232,80,26,0.85)' : '#1A1A2E',
                    backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                    border: 'none',
                    color: 'white',
                    fontWeight: active ? 700 : 500,
                    fontSize: '0.95rem',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
                    animation: `slideIn 0.2s ease ${i * 0.04}s both`,
                  }}
                >
                  <img src={item.svg} alt="" style={{ width: '20px', height: '20px', filter: 'brightness(0) invert(1)' }} />
                  {item.label}
                </Link>
              )
            })}
            {userId === ADMIN_ID && (
              <Link href="/admin" onClick={() => setMenuOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', borderRadius: '50px', textDecoration: 'none', background: 'rgba(232,80,26,0.15)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(232,80,26,0.4)', color: '#E8501A', fontWeight: 600, fontSize: '0.95rem', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}>
                <img src="/icons/admin.svg" alt="" style={{ width: '20px', height: '20px', filter: 'brightness(0) saturate(100%) invert(35%) sepia(90%) saturate(700%) hue-rotate(350deg)' }} />
                Admin {adminActions > 0 && `(${adminActions})`}
              </Link>
            )}
            <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', borderRadius: '50px', background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.2)', color: '#1A1A2E', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', boxShadow: '0 4px 24px rgba(0,0,0,0.1)' }}>
              <img src="/icons/logout.svg" alt="" style={{ width: '20px', height: '20px', filter: 'brightness(0)' }} />
              Déconnexion
            </button>
          </div>
        )}

        {/* Bulle burger / croix */}
        <button
          onClick={() => setMenuOpen(o => !o)}
          style={{
            position: 'fixed', top: '16px', left: '16px', zIndex: 201,
            width: '46px', height: '46px', borderRadius: '50%',
            backgroundColor: menuOpen ? '#E8501A' : '#1A1A2E',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            transition: 'background 0.2s',
          }}
        >
          {menuOpen ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          )}
        </button>

        {/* ── PANNEAU NOTIFICATIONS ── */}
        {notifsOpen && (
          <>
            <div onClick={() => setNotifsOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 198, backgroundColor: 'rgba(0,0,0,0.3)' }} />
            <div style={{ position: 'fixed', bottom: 'calc(60px + env(safe-area-inset-bottom))', left: 0, right: 0, zIndex: 199, backgroundColor: 'white', borderRadius: '20px 20px 0 0', maxHeight: '70vh', display: 'flex', flexDirection: 'column', boxShadow: '0 -4px 32px rgba(0,0,0,0.15)', animation: 'slideUp 0.25s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid #F5F0E8' }}>
                <span style={{ fontWeight: 700, fontSize: '1rem', color: '#2D2D2D' }}>Notifications</span>
                {notifsList.some(n => !n.read) && (
                  <button onClick={markAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: '#E8501A', fontWeight: 600 }}>Tout marquer lu</button>
                )}
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {notifsList.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#2D2D2D', opacity: 0.4, fontSize: '0.9rem' }}>Aucune notification</div>
                ) : notifsList.map(n => (
                  <div key={n.id} onClick={() => handleNotifClick(n)} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.85rem 1.25rem', backgroundColor: n.read ? 'transparent' : 'rgba(232,80,26,0.05)', borderBottom: '1px solid #F5F0E8', cursor: 'pointer' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#E8501A', color: 'white', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem', overflow: 'hidden' }}>
                      {n.profiles?.avatar_url ? <img src={n.profiles.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : n.profiles ? `${n.profiles.first_name[0]}${n.profiles.last_name[0]}` : '🔔'}
                    </div>
                    <div style={{ flex: 1 }}>
                      {n.profiles && <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#2D2D2D', marginBottom: '0.1rem' }}>{n.profiles.first_name} {n.profiles.last_name}</div>}
                      <div style={{ fontSize: '0.85rem', color: '#2D2D2D', opacity: 0.75, lineHeight: 1.45 }}>{n.content}</div>
                      <div style={{ fontSize: '0.72rem', color: '#2D2D2D', opacity: 0.4, marginTop: '0.2rem' }}>{new Date(n.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                    {!n.read && <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#E8501A', flexShrink: 0, marginTop: '0.35rem' }} />}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── BOTTOM BAR MOBILE ── */}
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
          backgroundColor: '#1A1A2E',
          display: 'flex', justifyContent: 'space-around', alignItems: 'center',
          padding: '0.6rem 0 calc(0.6rem + env(safe-area-inset-bottom))',
          boxShadow: '0 -1px 0 rgba(255,255,255,0.06)',
        }}>
          {/* Fil d'actualité */}
          <Link href="/feed" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', textDecoration: 'none', color: pathname.startsWith('/feed') ? '#E8501A' : 'rgba(245,240,232,0.6)', fontSize: '0.65rem' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <span>Fil</span>
          </Link>

          {/* Messages */}
          <Link href="/messages" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', textDecoration: 'none', color: pathname.startsWith('/messages') ? '#E8501A' : 'rgba(245,240,232,0.6)', fontSize: '0.65rem' }}>
            <img src="/icons/chat.svg" alt="Messages" style={{ width: '24px', height: '24px', filter: pathname.startsWith('/messages') ? 'brightness(0) saturate(100%) invert(35%) sepia(90%) saturate(700%) hue-rotate(350deg)' : 'brightness(0) invert(0.6)' }} />
            <span>Messages</span>
          </Link>

          {/* Logo Meello — centre */}
          <Link href="/feed" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none' }}>
            <img src="/favicon-meello.png" alt="Meello" style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
          </Link>

          {/* Notifications */}
          <button onClick={() => { setNotifsOpen(o => !o); if (!notifsOpen) loadNotifs(userId || undefined) }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', background: 'none', border: 'none', cursor: 'pointer', color: notifsOpen ? '#E8501A' : 'rgba(245,240,232,0.6)', fontSize: '0.65rem', padding: '0.25rem 0.5rem' }}>
            <div style={{ position: 'relative' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              {notifications > 0 && (
                <span style={{ position: 'absolute', top: '-4px', right: '-6px', backgroundColor: '#E8501A', color: 'white', borderRadius: '50%', width: '16px', height: '16px', fontSize: '0.55rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{notifications}</span>
              )}
            </div>
            <span>Notifs</span>
          </button>

          {/* Profil */}
          <Link href="/profil" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', textDecoration: 'none', color: pathname.startsWith('/profil') ? '#E8501A' : 'rgba(245,240,232,0.6)', fontSize: '0.65rem' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#E8501A', overflow: 'hidden', border: pathname.startsWith('/profil') ? '2px solid #E8501A' : '2px solid rgba(245,240,232,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, color: 'white' }}>
              {profile?.avatar_url ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
            </div>
            <span>Profil</span>
          </Link>
        </nav>
      </div>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-16px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-only { display: block !important; }
        }
      `}</style>
    </>
  )
}
