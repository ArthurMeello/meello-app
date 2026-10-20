// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'

// Écran de chargement Meello (variante « fondu flou »).
// Affiché UNIQUEMENT sur mobile ou tablette portrait (< 1024px), et seulement
// à la première ouverture du jour ou au démarrage à froid de la PWA — pas au
// retour depuis l'arrière-plan (le composant ne se monte qu'au chargement de
// page, donc un simple retour en avant-plan ne le déclenche pas).
// La date du dernier affichage est stockée dans localStorage('meello-splash-day').

const STORAGE_KEY = 'meello-splash-day'
const DURATION = 2000 // ms avant disparition

export default function SplashScreen() {
  const [show, setShow] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [pct, setPct] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    // Seulement mobile / tablette portrait
    if (window.innerWidth >= 1024) return
    // Une fois par jour
    const today = new Date().toISOString().slice(0, 10)
    let last = null
    try { last = localStorage.getItem(STORAGE_KEY) } catch {}
    if (last === today) return
    try { localStorage.setItem(STORAGE_KEY, today) } catch {}

    setShow(true)

    // Progression 0 → 100 %
    const start = Date.now()
    const tick = setInterval(() => {
      const p = Math.min(100, Math.round(((Date.now() - start) / (DURATION - 300)) * 100))
      setPct(p)
      if (p >= 100) clearInterval(tick)
    }, 60)

    // Sortie en fondu puis démontage
    const t1 = setTimeout(() => setLeaving(true), DURATION - 350)
    const t2 = setTimeout(() => setShow(false), DURATION)
    return () => { clearInterval(tick); clearTimeout(t1); clearTimeout(t2) }
  }, [])

  if (!show) return null

  return (
    <div
      className="app-bg"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 28, padding: 32,
        animation: leaving ? 'splash-out 0.35s ease forwards' : 'none',
      }}
    >
      <img
        src="/logo-meello.webp"
        alt="Meello"
        style={{ width: 180, maxWidth: '55%', animation: 'splash-blur 0.9s cubic-bezier(0.2,0.8,0.2,1) both' }}
      />

      <p
        style={{
          margin: 0, textAlign: 'center', maxWidth: 320,
          fontWeight: 700, fontSize: '1.05rem', lineHeight: 1.45,
          color: '#E8501A',
          animation: 'splash-fade 0.5s ease 0.75s both',
        }}
      >
        Pour la communauté des entrepreneurs qui s'entraident
      </p>

      {/* Barre de progression + % */}
      <div style={{ width: 200, maxWidth: '70%', animation: 'splash-fade 0.5s ease 0.9s both' }}>
        <div style={{ height: 5, borderRadius: 50, background: 'rgba(45,45,45,0.10)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: '#E8501A', borderRadius: 50, transition: 'width 0.12s linear' }} />
        </div>
        <div style={{ marginTop: 8, textAlign: 'center', fontSize: '0.78rem', color: '#2D2D2D', opacity: 0.5 }}>
          {pct}%
        </div>
      </div>
    </div>
  )
}
