// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Convertit la clé VAPID publique (base64url) en Uint8Array pour le navigateur.
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

function isIos() {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}
function isStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  )
}

/**
 * Bouton + logique d'activation des notifications push.
 * - Enregistre le service worker au montage.
 * - Sur iPhone non installé : affiche les instructions « Ajouter à l'écran d'accueil ».
 * - Sinon : bouton qui demande la permission et enregistre l'abonnement.
 */
export default function NotificationsActivation() {
  const [supported, setSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [busy, setBusy] = useState(false)
  const [showIosGuide, setShowIosGuide] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    setSupported(ok)
    if (ok) {
      setPermission(Notification.permission)
      navigator.serviceWorker.register('/sw.js').catch((e) => console.error('[sw]', e))
    }
  }, [])

  async function activer() {
    // iPhone pas encore installé : on ne peut pas demander la permission → guide.
    if (isIos() && !isStandalone()) {
      setShowIosGuide(true)
      return
    }
    setBusy(true)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') return

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string
        ),
      })

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          subscription: sub.toJSON(),
          userAgent: navigator.userAgent,
        }),
      })
      setDone(true)
    } catch (e) {
      console.error('[notifications]', e)
    } finally {
      setBusy(false)
    }
  }

  if (!supported) return null

  // État final : déjà activé.
  if (done || permission === 'granted') {
    return (
      <div style={boxStyle}>
        <span style={{ fontWeight: 600 }}>🔔 Notifications activées</span>
        <p style={{ margin: '4px 0 0', fontSize: 14, opacity: 0.75 }}>
          Vous recevrez les alertes Meello sur cet appareil.
        </p>
      </div>
    )
  }

  return (
    <div style={boxStyle}>
      <span style={{ fontWeight: 600 }}>Recevoir les notifications</span>
      <p style={{ margin: '4px 0 12px', fontSize: 14, opacity: 0.75 }}>
        Soyez alerté des nouveaux messages, événements et réponses.
      </p>

      {showIosGuide ? (
        <div style={{ fontSize: 14, lineHeight: 1.5 }}>
          <strong>Sur iPhone, ajoutez d'abord Meello à votre écran d'accueil :</strong>
          <ol style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            <li>Touchez le bouton <strong>Partager</strong> ⬆️ dans Safari.</li>
            <li>Choisissez <strong>« Sur l'écran d'accueil »</strong>.</li>
            <li>Ouvrez Meello depuis la nouvelle icône, puis réactivez les notifications.</li>
          </ol>
        </div>
      ) : (
        <button onClick={activer} disabled={busy} style={btnStyle}>
          {busy ? 'Activation…' : 'Activer les notifications'}
        </button>
      )}

      {permission === 'denied' && (
        <p style={{ margin: '10px 0 0', fontSize: 13, color: '#b45309' }}>
          Notifications bloquées. Réautorisez-les dans les réglages de votre navigateur.
        </p>
      )}
    </div>
  )
}

const boxStyle: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E7E0D4',
  borderRadius: 14,
  padding: 16,
}
const btnStyle: React.CSSProperties = {
  background: '#1A1A1A',
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  padding: '10px 16px',
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
}
