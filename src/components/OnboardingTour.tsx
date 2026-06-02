// @ts-nocheck
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Tutoriel d'onboarding façon "product tour".
 * Chaque étape met en surbrillance un élément réel de l'interface (via
 * l'attribut data-tour="...") et affiche une bulle explicative.
 * Certaines étapes nécessitent de naviguer vers une page (route) ;
 * le tour attend que l'élément cible apparaisse avant de l'afficher.
 */

interface Step {
  target?: string          // sélecteur data-tour (sinon bulle centrée)
  route?: string           // route à atteindre avant cette étape
  title: string
  body: string
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center'
}

const STEPS: Step[] = [
  {
    route: '/feed',
    title: 'Bienvenue sur Meello 👋',
    body: "Ravi de t'accueillir ! Laisse-moi te montrer l'essentiel en 1 minute. Tu pourras passer le tutoriel à tout moment.",
    placement: 'center',
  },
  {
    route: '/feed',
    target: 'nav-profil',
    title: 'Commence par ton profil',
    body: "Première étape : complète ton profil (photo, bio, activité). Un profil complet inspire confiance et donne envie de se connecter avec toi. Clique ici pour y aller.",
    placement: 'right',
  },
  {
    route: '/feed',
    target: 'nav-feed',
    title: 'Présente-toi à la communauté',
    body: "Le fil d'actualité, c'est ici. Poste un petit message de présentation : qui tu es, ce que tu fais, ce que tu cherches. C'est la meilleure façon de te faire connaître.",
    placement: 'right',
  },
  {
    route: '/feed',
    target: 'nav-reseau',
    title: 'Ton réseau',
    body: "Bonne nouvelle : tu n'es pas seul ! En tant que fondateur, je suis déjà ta première connexion. Depuis l'annuaire, tu peux découvrir les autres membres et leur envoyer une demande de connexion.",
    placement: 'right',
  },
  {
    route: '/feed',
    target: 'nav-annuaire',
    title: "L'annuaire des membres",
    body: "Parcours l'annuaire pour trouver des membres par activité ou par ville, et développe ton réseau.",
    placement: 'right',
  },
  {
    route: '/feed',
    target: 'nav-qg',
    title: 'Le QG',
    body: "Le QG est le salon de discussion général de la communauté. Viens dire bonjour, poser des questions, échanger avec tout le monde.",
    placement: 'right',
  },
  {
    route: '/feed',
    target: 'nav-evenements',
    title: 'Les événements',
    body: "Participe aux événements et visios de la communauté pour rencontrer les autres membres en vrai.",
    placement: 'right',
  },
  {
    route: '/feed',
    title: "C'est parti ! 🚀",
    body: "Tu as toutes les clés. Commence par compléter ton profil et te présenter — le reste viendra naturellement. Bienvenue dans Meello !",
    placement: 'center',
  },
]

export default function OnboardingTour({ userId }: { userId: string | null }) {
  const [active, setActive] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const pathname = usePathname()
  const router = useRouter()
  const checkedRef = useRef(false)

  // Vérifier au montage si le tutoriel doit se lancer
  useEffect(() => {
    if (!userId || checkedRef.current) return
    checkedRef.current = true
    const check = async () => {
      const supabase = createClient()
      const { data } = await supabase.from('profiles').select('tutorial_done').eq('id', userId).single()
      if (data && data.tutorial_done === false) {
        setActive(true)
      }
    }
    check()
  }, [userId])

  const step = STEPS[stepIndex]

  // Repositionner la surbrillance sur l'élément ciblé
  const updateRect = useCallback(() => {
    if (!active || !step?.target) { setRect(null); return }
    const el = document.querySelector(`[data-tour="${step.target}"]`)
    if (el) {
      setRect(el.getBoundingClientRect())
    } else {
      setRect(null)
    }
  }, [active, step])

  // Naviguer vers la route de l'étape si besoin, puis localiser l'élément
  useEffect(() => {
    if (!active || !step) return
    if (step.route && pathname !== step.route) {
      router.push(step.route)
      return
    }
    // Laisser le DOM se peindre, puis (re)mesurer
    const t = setTimeout(updateRect, 120)
    return () => clearTimeout(t)
  }, [active, stepIndex, pathname, step, router, updateRect])

  useEffect(() => {
    if (!active) return
    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)
    return () => {
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
    }
  }, [active, updateRect])

  const finish = async () => {
    setActive(false)
    if (userId) {
      const supabase = createClient()
      await supabase.from('profiles').update({ tutorial_done: true }).eq('id', userId)
    }
  }

  const next = () => {
    if (stepIndex < STEPS.length - 1) setStepIndex(i => i + 1)
    else finish()
  }
  const prev = () => { if (stepIndex > 0) setStepIndex(i => i - 1) }

  if (!active || !step) return null

  const pad = 8
  const hasSpot = !!rect
  const centered = step.placement === 'center' || !hasSpot

  // Position de la bulle
  let bubbleStyle: React.CSSProperties = {
    position: 'fixed', zIndex: 100002, maxWidth: '320px', width: 'calc(100% - 2rem)',
  }
  if (centered) {
    bubbleStyle = { ...bubbleStyle, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
  } else if (rect) {
    const placement = step.placement || 'bottom'
    if (placement === 'right') {
      bubbleStyle.top = Math.max(12, rect.top) + 'px'
      bubbleStyle.left = (rect.right + 16) + 'px'
    } else if (placement === 'left') {
      bubbleStyle.top = Math.max(12, rect.top) + 'px'
      bubbleStyle.right = (window.innerWidth - rect.left + 16) + 'px'
    } else if (placement === 'top') {
      bubbleStyle.bottom = (window.innerHeight - rect.top + 16) + 'px'
      bubbleStyle.left = rect.left + 'px'
    } else {
      bubbleStyle.top = (rect.bottom + 16) + 'px'
      bubbleStyle.left = rect.left + 'px'
    }
  }

  // Sur mobile, on force la bulle en bas de l'écran pour rester lisible
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768
  if (isMobile && !centered) {
    bubbleStyle = {
      position: 'fixed', zIndex: 100002, left: '1rem', right: '1rem',
      bottom: 'calc(1rem + env(safe-area-inset-bottom))', maxWidth: 'none', width: 'auto',
    }
  }

  return (
    <>
      {/* Overlay sombre avec trou (spotlight) via box-shadow */}
      {hasSpot ? (
        <div
          style={{
            position: 'fixed',
            top: rect.top - pad, left: rect.left - pad,
            width: rect.width + pad * 2, height: rect.height + pad * 2,
            borderRadius: '12px',
            boxShadow: '0 0 0 9999px rgba(26,26,46,0.7)',
            zIndex: 100000, pointerEvents: 'none',
            transition: 'all 0.2s ease',
          }}
        />
      ) : (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(26,26,46,0.7)', zIndex: 100000 }} />
      )}

      {/* Bulle explicative */}
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
          <button onClick={finish} style={{ background: 'none', border: 'none', color: '#2D2D2D', opacity: 0.45, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
            Passer le tutoriel
          </button>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {stepIndex > 0 && (
              <button onClick={prev} style={{ background: 'none', border: '1px solid #E8E3D9', borderRadius: '8px', padding: '0.5rem 0.9rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#2D2D2D' }}>
                Précédent
              </button>
            )}
            <button onClick={next} style={{ backgroundColor: '#E8501A', color: 'white', border: 'none', borderRadius: '8px', padding: '0.5rem 1.1rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700 }}>
              {stepIndex === STEPS.length - 1 ? 'Terminer' : 'Suivant'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
