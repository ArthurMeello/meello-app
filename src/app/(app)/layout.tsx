// @ts-nocheck
'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppNav from '@/components/AppNav'
import TopBar from '@/components/TopBar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const checkFirstLogin = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      // Appel silencieux — la route vérifie welcome_sent avant d'agir
      fetch('/api/first-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      })
    }
    checkFirstLogin()
  }, [])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#F5F0E8' }}>
      <AppNav />
      <TopBar />
      <main style={{ marginLeft: '220px', flex: 1, padding: '2rem', maxWidth: '100%' }}>
        {children}
      </main>
      <style>{`
        @media (max-width: 768px) {
          main { margin-left: 0 !important; padding-bottom: 5rem !important; }
          .mobile-nav { display: flex !important; }
        }
      `}</style>
    </div>
  )
}
