// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'

// Bouton « Installer l'app » — Android uniquement.
// S'appuie sur l'événement `beforeinstallprompt` que seul Chrome Android (et
// quelques navigateurs Android) déclenche. iOS Safari et desktop ne l'émettent
// pas → le bouton n'apparaît jamais ailleurs que sur Android.
export default function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Déjà installé (lancé en mode standalone) → ne rien proposer
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    if (standalone) { setInstalled(true); return }

    const onPrompt = (e: Event) => {
      e.preventDefault()       // empêche la mini-infobar par défaut
      setDeferredPrompt(e)     // on garde l'événement pour le déclencher au clic
    }
    const onInstalled = () => { setInstalled(true); setDeferredPrompt(null) }

    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function installer() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()                 // ouvre la vraie boîte native Android
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setDeferredPrompt(null)                 // l'événement n'est utilisable qu'une fois
  }

  // Affiché seulement si Android l'a proposé (deferredPrompt) et pas déjà installé
  if (installed || !deferredPrompt) return null

  return (
    <div style={{ marginBottom: '2rem' }}>
      <h2 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#2D2D2D', margin: '0 0 0.75rem' }}>
        Installer l'application
      </h2>
      <div style={{ background: '#FFFFFF', border: '1px solid #E7E0D4', borderRadius: 14, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <span style={{ fontWeight: 600 }}>Meello sur votre écran d'accueil</span>
          <p style={{ margin: '4px 0 0', fontSize: 14, opacity: 0.75 }}>
            Accès rapide et notifications, comme une vraie app.
          </p>
        </div>
        <button
          type="button"
          onClick={installer}
          style={{
            background: '#E8501A', color: '#fff', border: 'none',
            borderRadius: 10, padding: '10px 16px', fontSize: 15,
            fontWeight: 600, cursor: 'pointer', flexShrink: 0,
          }}
        >
          Installer
        </button>
      </div>
    </div>
  )
}
