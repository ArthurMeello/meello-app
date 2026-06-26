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
  // subscribed = cet appareil a un abonnement push actif
  const [subscribed, setSubscribed] = useState(false)
  // isMobile = on n'affiche ce bloc que sur mobile / app
  const [isMobile, setIsMobile] = useState(false)
  // userId récupéré une seule fois au montage (évite tout appel auth au clic)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    setIsMobile(window.innerWidth <= 768)
    const onResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', onResize)
    const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    setSupported(ok)
    if (!ok) return () => window.removeEventListener('resize', onResize)
    setPermission(Notification.permission)
    navigator.serviceWorker.register('/sw.js').catch((e) => console.error('[sw]', e))
    // Vérifie l'état réel de l'abonnement sur cet appareil
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => {})
    // Récupère l'utilisateur une fois, sans bloquer (pas d'appel auth au clic)
    createClient().auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null)).catch(() => {})
    return () => window.removeEventListener('resize', onResize)
  }, [])

  async function desactiver() {
    setSubscribed(false) // retour visuel immédiat
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        const endpoint = sub.endpoint
        // 1) Supprimer en base AVANT de désabonner le navigateur, et on attend
        //    la réponse → évite toute course avec une réactivation immédiate.
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        }).catch(() => {})
        // 2) Désabonner côté navigateur
        await sub.unsubscribe()
      }
    } catch (e) {
      console.error('[notifications:off]', e)
      setSubscribed(true) // échec : on rétablit l'état
    } finally {
      setBusy(false)
    }
  }

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

      if (!userId) return

      const reg = await navigator.serviceWorker.ready
      // Repartir propre : si un abonnement résiduel existe, on le retire
      // d'abord pour obtenir des clés de chiffrement fraîches (sinon, après
      // un désactiver/réactiver, les push peuvent partir avec d'anciennes clés).
      const existing = await reg.pushManager.getSubscription()
      if (existing) await existing.unsubscribe().catch(() => {})

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
          userId,
          subscription: sub.toJSON(),
          userAgent: navigator.userAgent,
        }),
      })
      setSubscribed(true)
    } catch (e) {
      console.error('[notifications]', e)
    } finally {
      setBusy(false)
    }
  }

  // N'afficher que sur mobile / app (et si le navigateur supporte le push)
  if (!supported || !isMobile) return null

  return (
    <div style={{ marginBottom: '2rem' }}>
    <h2 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#2D2D2D', margin: '0 0 0.75rem' }}>
      Notifications sur cet appareil
    </h2>
    <div style={boxStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <span style={{ fontWeight: 600 }}>Notifications sur cet appareil</span>
          <p style={{ margin: '4px 0 0', fontSize: 14, opacity: 0.75 }}>
            {subscribed
              ? 'Activées. Vous recevez les alertes Meello sur cet appareil.'
              : 'Soyez alerté des nouveaux messages, événements et réponses.'}
          </p>
        </div>

        {/* Toggle activer / désactiver */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (busy) return
            if (subscribed) desactiver()
            else activer()
          }}
          disabled={busy}
          aria-pressed={subscribed}
          aria-label={subscribed ? 'Désactiver les notifications' : 'Activer les notifications'}
          style={{
            position: 'relative',
            width: 52,
            height: 30,
            borderRadius: 999,
            border: 'none',
            cursor: busy ? 'default' : 'pointer',
            background: subscribed ? '#E8501A' : '#CBC4B8',
            transition: 'background 0.2s',
            flexShrink: 0,
            opacity: busy ? 0.6 : 1,
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 3,
              left: subscribed ? 25 : 3,
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: '#fff',
              transition: 'left 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
            }}
          />
        </button>
      </div>

      {showIosGuide && !subscribed && (
        <div style={{ fontSize: 14, lineHeight: 1.5, marginTop: 12 }}>
          <strong>Sur iPhone, ajoutez d'abord Meello à votre écran d'accueil :</strong>
          <ol style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            <li>Touchez le bouton <strong>Partager</strong> ⬆️ dans Safari.</li>
            <li>Choisissez <strong>« Sur l'écran d'accueil »</strong>.</li>
            <li>Ouvrez Meello depuis la nouvelle icône, puis réactivez les notifications.</li>
          </ol>
        </div>
      )}

      {permission === 'denied' && !subscribed && (
        <p style={{ margin: '10px 0 0', fontSize: 13, color: '#b45309' }}>
          Notifications bloquées. Réautorisez-les dans les réglages de votre navigateur.
        </p>
      )}
    </div>
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
