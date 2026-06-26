// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppNav from '@/components/AppNav'
import TopBar from '@/components/TopBar'
import ChatSystem from '@/components/ChatSystem'
import OnboardingTour from '@/components/OnboardingTour'
import FlammeQuotidienne from '@/components/FlammeQuotidienne'
import { awardXp } from '@/lib/awardXp'

// Compte admin (Arthur Dron) — la modale flamme n'est testée que sur lui pour l'instant.
const ADMIN_ID = '13cdb485-42e0-48df-b2f8-14dc77dd895a'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null)

  // Mise à jour automatique de la PWA : à chaque ouverture, on vérifie s'il
  // existe une nouvelle version du service worker, et quand elle prend le
  // contrôle on recharge la page une fois (évite de devoir réinstaller l'app).
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })
    navigator.serviceWorker.getRegistration().then((reg) => {
      reg?.update().catch(() => {})
    })
    // Revérifie quand l'app repasse au premier plan (cas PWA mobile)
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        navigator.serviceWorker.getRegistration().then((reg) => reg?.update().catch(() => {}))
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

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

      // Mettre à jour la dernière activité — au plus une fois / 5 min
      try {
        const key = 'meello:last-active-ping'
        const lastPing = Number(localStorage.getItem(key) || 0)
        if (Date.now() - lastPing > 5 * 60 * 1000) {
          localStorage.setItem(key, String(Date.now()))
          supabase.from('profiles').update({ last_active: new Date().toISOString() }).eq('id', user.id).then(() => {})
        }
      } catch {}

      // Enregistrer le jour comme actif (base des séries / flamme), indépendamment des XP.
      fetch('/api/mark-active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      }).catch(() => {})

      // XP : connexion du jour (plafonné 1/jour côté serveur)
      awardXp(user.id, 'daily_login')
    }
    checkFirstLogin()
  }, [])

  return (
    <div style={{ display: 'flex', minHeight: '100dvh', backgroundColor: '#F5F0E8' }}>
      <AppNav />
      <TopBar />
      <ChatSystem userId={userId} />
      <OnboardingTour userId={userId} />
      <FlammeQuotidienne userId={userId} enabled={userId === ADMIN_ID} />
      <main style={{ marginLeft: '220px', flex: 1, padding: '2rem', maxWidth: '100%' }}>
        {children}
      </main>
      <style>{`
        @media (max-width: 768px) {
          main { margin-left: 0 !important; padding: 1rem !important; padding-bottom: 5.5rem !important; padding-top: 5rem !important; }
          .desktop-nav { display: none !important; }
          .topbar { left: 0 !important; }
        }
      `}</style>
    </div>
  )
}
