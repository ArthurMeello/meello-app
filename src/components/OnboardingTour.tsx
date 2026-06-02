// @ts-nocheck
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
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
  target?: string         // onglet à cliquer sur desktop (data-tour)
  mobileTarget?: string   // onglet à cliquer sur mobile (data-tour)
  needsMenu?: boolean     // si la cible mobile est dans le menu burger
  route: string           // page sur laquelle l'étape se déroule / qu'on doit atteindre
  title: string
  body: string
}

const STEPS: Step[] = [
  // — Accueil
  { type: 'info', route: '/feed', title: 'Bienvenue sur Meello 👋', body: "Ravi de t'accueillir ! Je vais te faire visiter les différentes pages, une par une. À chaque étape, clique sur l'onglet mis en avant pour avancer." },

  // — Profil (bottom-bar sur mobile)
  { type: 'action', target: 'nav-profil', mobileTarget: 'm-profil-bottom', route: '/profil', title: 'Ton profil', body: "Commençons par ton profil. Clique sur « Mon profil »." },
  { type: 'info', route: '/profil', title: 'Complète ton profil', body: "Voici ta page profil. Ajoute ta photo, ta bio et ton activité : un profil complet inspire confiance et donne envie de se connecter avec toi. Tu pourras le remplir juste après le tutoriel." },

  // — La Communauté (forum / présentations) — dans le menu sur mobile
  { type: 'action', target: 'nav-forum', mobileTarget: 'm-forum', needsMenu: true, route: '/forum', title: 'La Communauté', body: "Maintenant, découvrons « La Communauté ». Clique sur cet onglet." },
  { type: 'info', route: '/forum', title: 'Présente-toi ici', body: "C'est le cœur de Meello. Tu y trouves des espaces d'échange par thème, dont la catégorie « Présentations » : c'est LÀ que chaque membre se présente. Va t'y présenter dès que possible, c'est la meilleure façon de te faire connaître et de lancer les premières conversations." },

  // — Annuaire
  { type: 'action', target: 'nav-annuaire', mobileTarget: 'm-annuaire', needsMenu: true, route: '/annuaire', title: "L'Annuaire", body: "Voyons comment trouver d'autres membres. Clique sur « Annuaire »." },
  { type: 'info', route: '/annuaire', title: 'Trouve des membres', body: "L'annuaire liste tous les membres. Tu peux les filtrer par activité ou par ville pour repérer les personnes qui t'intéressent et leur envoyer une demande de connexion." },

  // — Mon Réseau
  { type: 'action', target: 'nav-reseau', mobileTarget: 'm-reseau', needsMenu: true, route: '/reseau', title: 'Ton Réseau', body: "Regarde ton réseau. Clique sur « Mon Réseau »." },
  { type: 'info', route: '/reseau', title: 'Tu as déjà un contact !', body: "Bonne nouvelle : tu n'es pas seul. En tant que fondateur, je suis déjà ta toute première connexion 🙌 Ici tu retrouves tes contacts, et tu gères les demandes reçues et envoyées." },

  // — Le QG
  { type: 'action', target: 'nav-qg', mobileTarget: 'm-qg', needsMenu: true, route: '/qg', title: 'Le QG', body: "Direction le salon de discussion. Clique sur « Le QG »." },
  { type: 'info', route: '/qg', title: 'Discute en direct', body: "Le QG est le chat général de la communauté, en temps réel. Viens dire bonjour, poser des questions, réagir : c'est l'endroit le plus vivant de Meello." },

  // — Événements
  { type: 'action', target: 'nav-evenements', mobileTarget: 'm-evenements', needsMenu: true, route: '/evenements', title: 'Les Événements', body: "Dernière étape. Clique sur « Événements »." },
  { type: 'info', route: '/evenements', title: 'Rencontre les autres en vrai', body: "Participe aux visios et événements pour rencontrer les membres. Rien ne vaut un vrai échange pour créer des liens durables." },

  // — Fin
  { type: 'info', route: '/evenements', title: "C'est parti ! 🚀", body: "Tu as fait le tour ! Pour bien démarrer : complète ton profil, puis présente-toi dans « La Communauté ». Bienvenue dans Meello !" },
]

export default function OnboardingTour({ userId }: { userId: string | null }) {
  const [active, setActive] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [radius, setRadius] = useState('12px')
  const [targetMissing, setTargetMissing] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
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

  const isMobileView = () => typeof window !== 'undefined' && window.innerWidth <= 768

  // Cible courante selon l'appareil
  const currentTarget = () => {
    if (!step || step.type !== 'action') return undefined
    return isMobileView() ? (step.mobileTarget || step.target) : step.target
  }

  // Ouvre/ferme le menu burger mobile via événement (écouté par AppNav)
  const setMobileMenu = (open: boolean) => {
    window.dispatchEvent(new CustomEvent('meello:tour-menu', { detail: open }))
  }

  // Mesurer l'élément cible (étapes 'action') + récupérer son rayon réel
  const updateRect = useCallback(() => {
    const tgt = currentTarget()
    if (!active || step?.type !== 'action' || !tgt) { setRect(null); return }
    const el = document.querySelector(`[data-tour="${tgt}"]`)
    if (el) {
      setRect(el.getBoundingClientRect())
      const br = getComputedStyle(el).borderRadius
      // +pad pour que le contour reste concentrique avec l'élément
      setRadius(br && br !== '0px' ? `calc(${br} + ${8}px)` : '12px')
      setTargetMissing(false)
    } else {
      setRect(null)
    }
  }, [active, step])

  // Sur mobile, ouvrir le menu burger si l'étape cible une pill du menu
  useEffect(() => {
    if (!active || !step || step.type !== 'action') { setMobileMenu(false); return }
    if (!isMobileView() || !step.needsMenu) return
    if (pathname === step.route) return // déjà arrivé : pas besoin du menu

    // Le QG (et autres pages plein écran) masquent le menu burger via
    // body.msg-conv-open → on retourne au feed pour récupérer le burger.
    if (typeof document !== 'undefined' && document.body.classList.contains('msg-conv-open')) {
      if (pathname !== '/feed') { router.push('/feed'); return }
    }
    setMobileMenu(true)
  }, [active, stepIndex, step, pathname, router])

  useEffect(() => {
    if (!active) return
    setTargetMissing(false)
    const t = setTimeout(updateRect, 200)
    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)
    // Filet de sécurité : si la cible reste introuvable, proposer un Suivant manuel
    let miss: any
    if (step?.type === 'action') {
      miss = setTimeout(() => {
        const tgt = currentTarget()
        if (!tgt || !document.querySelector(`[data-tour="${tgt}"]`)) setTargetMissing(true)
      }, 900)
    }
    return () => {
      clearTimeout(t)
      if (miss) clearTimeout(miss)
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
    }
  }, [active, stepIndex, updateRect])

  // Étape 'action' : quand l'utilisateur arrive sur la page cible → avancer
  useEffect(() => {
    if (!active || !step || step.type !== 'action') return
    if (pathname === step.route) {
      setMobileMenu(false) // refermer le menu si ouvert
      const t = setTimeout(() => next(), 350)
      return () => clearTimeout(t)
    }
  }, [active, step, pathname, next])

  if (!active || !step) return null

  const isMobile = isMobileView()
  const isAction = step.type === 'action' && !!rect
  const pad = 8

  // Bulle : placement selon appareil + position de la cible
  let bubbleStyle: React.CSSProperties = {
    position: 'fixed', zIndex: 100003, maxWidth: '380px', width: 'calc(100% - 2rem)',
  }
  if (isMobile) {
    // Sur mobile, la bulle se place en haut ou en bas selon où est la cible,
    // pour ne pas la recouvrir.
    const targetLow = rect && rect.top > window.innerHeight / 2
    bubbleStyle = {
      position: 'fixed', zIndex: 100003, left: '1rem', right: '1rem',
      maxWidth: 'none', width: 'auto',
      ...(targetLow
        ? { top: 'calc(1rem + env(safe-area-inset-top))' }
        : { bottom: 'calc(1rem + env(safe-area-inset-bottom))' }),
    }
  } else if (isAction && rect) {
    bubbleStyle.top = Math.min(rect.top, window.innerHeight - 220) + 'px'
    bubbleStyle.left = (rect.right + 16) + 'px'
  } else {
    bubbleStyle = { ...bubbleStyle, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
  }

  // Masque visuel + blocage des clics.
  const overlay = 'rgba(26,26,46,0.7)'
  const panels = (isAction && rect) ? (
    <>
      {/* Trou VISUEL parfaitement arrondi via box-shadow (pointer-events: none) */}
      <div style={{
        position: 'fixed',
        top: rect.top - pad, left: rect.left - pad,
        width: rect.width + pad * 2, height: rect.height + pad * 2,
        borderRadius: radius,
        boxShadow: `0 0 0 9999px ${overlay}`,
        zIndex: 100000, pointerEvents: 'none',
      }} />
      {/* 4 panneaux TRANSPARENTS juste pour BLOQUER les clics hors cible */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: Math.max(0, rect.top - pad), zIndex: 100001 }} />
      <div style={{ position: 'fixed', top: rect.bottom + pad, left: 0, right: 0, bottom: 0, zIndex: 100001 }} />
      <div style={{ position: 'fixed', top: rect.top - pad, left: 0, width: Math.max(0, rect.left - pad), height: rect.height + pad * 2, zIndex: 100001 }} />
      <div style={{ position: 'fixed', top: rect.top - pad, left: rect.right + pad, right: 0, height: rect.height + pad * 2, zIndex: 100001 }} />
      {/* Contour orange épousant la forme */}
      <div style={{ position: 'fixed', top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, border: '2px solid #E8501A', borderRadius: radius, zIndex: 100002, pointerEvents: 'none' }} />
    </>
  ) : (
    // Étape info (ou cible absente) : overlay plein qui bloque tout
    <div style={{ position: 'fixed', inset: 0, backgroundColor: overlay, zIndex: 100000 }} />
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
          ) : targetMissing ? (
            // Filet de sécurité : la cible n'a pas été trouvée → avancer manuellement
            <button onClick={next} style={{ backgroundColor: '#E8501A', color: 'white', border: 'none', borderRadius: '8px', padding: '0.5rem 1.1rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
              Suivant
            </button>
          ) : (
            <span style={{ fontSize: '0.8rem', color: '#E8501A', fontWeight: 700, whiteSpace: 'nowrap' }}>👆 Clique sur l'onglet</span>
          )}
        </div>
      </div>
    </>
  )
}
