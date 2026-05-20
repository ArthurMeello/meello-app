'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV_ITEMS = [
  { href: '/feed', label: 'Feed', icon: '🏠' },
  { href: '/annuaire', label: 'Annuaire', icon: '👥' },
  { href: '/forum', label: 'Forum', icon: '💬' },
  { href: '/messages', label: 'Messages', icon: '✉️' },
  { href: '/reseau', label: 'Mon Réseau', icon: '🤝' },
]

export default function AppNav() {
  const pathname = usePathname()
  const router = useRouter()

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
        <Link href="/feed" style={{ textDecoration: 'none', marginBottom: '2rem', display: 'block' }}>
          <span style={{ fontFamily: 'var(--font-clash)', fontSize: '2rem', color: '#E8501A' }}>
            meello
          </span>
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
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
            <span>👤</span>
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
            <span>🚪</span>
            <span>Deconnexion</span>
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
              <span style={{ fontSize: '1.3rem' }}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
