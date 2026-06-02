// @ts-nocheck
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Tutoriel d'onboarding "guidé par action".
 *
 * Deux types d'étapes :
 *  - type 'action'  : invite à cliquer un onglet précis (data-tour). Seul cet
 *                     onglet est cliquable, tout le reste de l'écran est bloqué.
 *                     L'arrivée sur la page cible (route) fait avancer le tour.
 *  - type 'info'    : explication centrée sur la page courante, avec « Suivant ».
 */

interface Step {
  type: 'action' | 'info'
  target?: string        // onglet à cliquer (étapes 'action')
  route: string          // page sur laquelle l'étape se déroule / qu'on doit atteindre
  title: string
  body: string
}

const STEPS: Step[] = [
  // — Accueil
  { type: 'info', route: '/feed', title: 'Bienvenue sur Meello 👋', body: "Ravi de t'accueillir ! Je vais te faire visiter les différentes pages, une par une. À chaque étape, clique sur l'onglet mis en avant pour avancer." },

  // — Profil
  { type: 'action', target: 'nav-profil', route: '/profil', title: 'Ton profil', body: "Commençons par ton profil. Clique sur « Mon profil » dans le menu." },
  { type: 'info', route: '/profil', title: 'Complète ton profil', body: "Voici ta page profil. Ajoute ta photo, ta bio et ton activité : un profil complet inspire confiance et donne envie de se connecter avec toi. Tu pourras le remplir juste après le tutoriel." },

  // — La Communauté (forum / présentations)
  { type: 'action', target: 'nav-forum', route: '/forum', title: 'La Communauté', body: "Maintenant, découvrons « La Communauté ». Clique sur cet onglet." },
  { type: 'info', route: '/forum', title: 'Présente-toi ici', body: "C'est le cœur de Meello. Tu y trouves des espaces d'échange par thème, dont la catégorie « Présentations » : c'est LÀ que chaque membre se présente. Va t'y présenter dès que possible, c'est la meilleure façon de te faire connaître et de lancer les premières conversations." },

  // — Annuaire
  { type: 'action', target: 'nav-annuaire', route: '/annuaire', title: "L'Annuaire", body: "Voyons comment trouver d'autres membres. Clique sur « Annuaire »." },
  { type: 'info', route: '/annuaire', title: 'Trouve des membres', body: "L'annuaire liste tous les membres. Tu peux les filtrer par activité ou par ville pour repérer les personnes qui t'intéressent et leur envoyer une demande de connexion." },

  // — Mon Réseau
  { type: 'action', target: 'nav-reseau', route: '/reseau', title: 'Ton Réseau', body: "Regarde ton réseau. Clique sur « Mon Réseau »." },
  { type: 'info', route: '/reseau', title: 'Tu as déjà un contact !', body: "Bonne nouvelle : tu n'es pas seul. En tant que fondateur, je suis déjà ta toute première connexion 🙌 Ici tu retrouves tes contacts, et tu gères les demandes reçues et envoyées." },

  // — Le QG
  { type: 'action', target: 'nav-qg', route: '/qg', title: 'Le QG', body: "Direction le salon de discussion. Clique sur « Le QG »." },
  { type: 'info', route: '/qg', title: 'Discute en direct', body: "Le QG est le chat général de la communauté, en temps réel. Viens dire bonjour, poser des questions, réagir : c'est l'endroit le plus vivant de Meello." },

  // — Événements
  { type: 'action', target: 'nav-evenements', route: '/evenements', title: 'Les Événements', body: "Dernière étape. Clique sur « Événements »." },
  { type: 'info', route: '/evenements', title: 'Rencontre les autres en vrai', body: "Participe aux visios et événements pour rencontrer les membres. Rien ne vaut un vrai échange pour créer des liens durables." },

  // — Fin
  { type: 'info', route: '/evenements', title: "C'est parti ! 🚀", body: "Tu as fait le tour ! Pour bien démarrer : complète ton profil, puis présente-toi dans « La Communauté ». Bienvenue dans Meello !" },
]

export default function OnboardingTour({ userId }: { userId: string | null }) {
  const [active, setActive] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const pathname = usePathname()
  const checkedRef = useRef(false)

  useEffect(() => {
    if (!userId || checkedRef.current) return
    checkedRef.current = true
    const check = async () => {
      const supabase = createClient()
      const { data } = await supabase.from('profiles').select('tutorial_done').eq('id', userId).single()
      if (data && data.tutorial_done === false) setActive(true)
    }
    check()
  }, [userId])

  const step = STEPS[stepIndex]

  const finish = useCallback(async () => {
    setActive(false)
    if (userId) {
      const supabase = createClient()
      await supabase.from('profiles').update({ tutorial_done: true }).eq('id', userId)
    }
  }, [userId])

  const next = useCallback(() => {
    setStepIndex(i => {
      if (i < STEPS.length - 1) return i + 1
      finish()
      return i
    })
  }, [finish])

  // Mesurer l'élément cible (étapes 'action')
  const updateRect = useCallback(() => {
    if (!active || step?.type !== 'action' || !step.target) { setRect(null); return }
    const el = document.querySelector(`[data-tour="${step.target}"]`)
    setRect(el ? el.getBoundingClientRect() : null)
  }, [active, step])

  useEffect(() => {
    if (!active) return
    const t = setTimeout(updateRect, 120)
    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
    }
  }, [active, stepIndex, updateRect])

  // Étape 'action' : quand l'utilisateur arrive sur la page cible → avancer
  useEffect(() => {
    if (!active || !step || step.type !== 'action') return
    if (pathname === step.route) {
      const t = setTimeout(() => next(), 350) // laisse la page se charger
      return () => clearTimeout(t)
    }
  }, [active, step, pathname, next])

  if (!active || !step) return null

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768
  const isAction = step.type === 'action' && !!rect && !isMobile
  const pad = 8

  // Bulle : pour une étape action, on la place près de l'onglet ; sinon centrée
  let bubbleStyle: React.CSSProperties = {
    position: 'fixed', zIndex: 100002, maxWidth: '380px', width: 'calc(100% - 2rem)',
  }
  if (isAction && rect) {
    bubbleStyle.top = Math.min(rect.top, window.innerHeight - 220) + 'px'
    bubbleStyle.left = (rect.right + 16) + 'px'
  } else {
    bubbleStyle = { ...bubbleStyle, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
  }
  if (isMobile) {
    bubbleStyle = {
      position: 'fixed', zIndex: 100002, left: '1rem', right: '1rem',
      bottom: 'calc(1rem + env(safe-area-inset-bottom))', maxWidth: 'none', width: 'auto',
    }
  }

  // Masque : 4 panneaux autour de l'élément cible (le laissent cliquable).
  const overlay = '#1A1A2E'
  const op = 0.7
  const panels = (isAction && rect) ? (
    <>
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: Math.max(0, rect.top - pad), backgroundColor: overlay, opacity: op, zIndex: 100000 }} />
      <div style={{ position: 'fixed', top: rect.bottom + pad, left: 0, right: 0, bottom: 0, backgroundColor: overlay, opacity: op, zIndex: 100000 }} />
      <div style={{ position: 'fixed', top: rect.top - pad, left: 0, width: Math.max(0, rect.left - pad), height: rect.height + pad * 2, backgroundColor: overlay, opacity: op, zIndex: 100000 }} />
      <div style={{ position: 'fixed', top: rect.top - pad, left: rect.right + pad, right: 0, height: rect.height + pad * 2, backgroundColor: overlay, opacity: op, zIndex: 100000 }} />
      {/* Contour de l'élément cliquable */}
      <div style={{ position: 'fixed', top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, border: '2px solid #E8501A', borderRadius: '12px', zIndex: 100001, pointerEvents: 'none' }} />
    </>
  ) : (
    // Étape info (ou mobile) : overlay plein qui bloque tout
    <div style={{ position: 'fixed', inset: 0, backgroundColor: overlay, opacity: op, zIndex: 100000 }} />
  )

  return (
    <>
      {panels}
      <div style={{ ...bubbleStyle, backgroundColor: 'white', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 8px 40px rgba(0,0,0,0.25)' }}>
        <div style={{ fontSize: '0.7rem', color: '#E8501A', fontWeight: 700, marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Étape {stepIndex + 1} / {STEPS.length}
        </div>
        <h3 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.1rem', color: '#2D2D2D', fontWeight: 700, margin: '0 0 0.5rem' }}>
          {step.title}
        </h3>
        <p style={{ fontSize: '0.9rem', color: '#2D2D2D', opacity: 0.75, lineHeight: 1.55, margin: '0 0 1.1rem' }}>
          {step.body}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <button onClick={finish} style={{ background: 'none', border: 'none', color: '#2D2D2D', opacity: 0.45, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', padding: 0, whiteSpace: 'nowrap', flexShrink: 0 }}>
            Passer le tutoriel
          </button>
          {step.type === 'info' ? (
            <button onClick={next} style={{ backgroundColor: '#E8501A', color: 'white', border: 'none', borderRadius: '8px', padding: '0.5rem 1.1rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
              {stepIndex === STEPS.length - 1 ? 'Terminer' : 'Suivant'}
            </button>
          ) : (
            <span style={{ fontSize: '0.8rem', color: '#E8501A', fontWeight: 700, whiteSpace: 'nowrap' }}>👆 Clique sur l'onglet</span>
          )}
        </div>
      </div>
    </>
  )
}
