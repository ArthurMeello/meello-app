// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppNav from '@/components/AppNav'
import TopBar from '@/components/TopBar'
import ChatSystem from '@/components/ChatSystem'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const checkFirstLogin = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
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
      <ChatSystem userId={userId} />
      <main style={{ marginLeft: '220px', flex: 1, padding: '2rem', maxWidth: '100%' }}>
        {children}
      </main>
      <style>{`
        @media (max-width: 768px) {
          main { margin-left: 0 !important; padding: 1rem !important; padding-bottom: 5.5rem !important; padding-top: 5rem !important; }
          .desktop-nav { display: none !important; }
          .topbar { left: 0 !important; }
          /* Page messages : annuler tout le padding du main */
          main:has(.msg-layout) { padding: 0 !important; overflow: hidden !important; }
        }
      `}</style>
    </div>
  )
}
