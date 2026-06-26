// @ts-nocheck
'use client'

import { useRouter } from 'next/navigation'

// Étapes du tutoriel. `img` pointe vers une capture dans /public/tuto-ios/.
// Si l'image n'existe pas encore, un encadré neutre s'affiche à la place.
const STEPS = [
  {
    n: 1,
    title: 'Touchez le bouton Partager',
    text: "Dans Safari (sur app.meello.fr), appuyez sur l'icône Partager en bas de l'écran — un carré avec une flèche vers le haut.",
    img: '/tuto-ios/ios-1-partager.jpg',
  },
  {
    n: 2,
    title: "Choisissez « Sur l'écran d'accueil »",
    text: "Faites défiler le menu et appuyez sur « Sur l'écran d'accueil », puis confirmez avec « Ajouter ». L'icône Meello apparaît sur votre écran d'accueil.",
    img: '/tuto-ios/ios-2-ecran-accueil.jpg',
  },
  {
    n: 3,
    title: 'Activez les notifications',
    text: "Ouvrez Meello depuis sa nouvelle icône, puis allez dans Paramètres → « Notifications sur cet appareil » et activez le bouton pour ne rien manquer.",
    img: '/tuto-ios/ios-3-active.jpg',
  },
]

export default function InstallIosPage() {
  const router = useRouter()

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', paddingBottom: '3rem' }}>
      <button
        onClick={() => router.back()}
        style={{ background: 'none', border: 'none', color: '#E8501A', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem', padding: '0.5rem 0', marginBottom: '0.5rem' }}
      >
        ← Retour
      </button>

      <h1 style={{ fontFamily: 'var(--font-clash)', fontWeight: 700, fontSize: '1.8rem', color: '#2D2D2D', margin: '0 0 0.5rem' }}>
        Installer Meello sur iPhone
      </h1>
      <p style={{ fontSize: '0.95rem', color: '#2D2D2D', opacity: 0.7, lineHeight: 1.6, margin: '0 0 1.25rem' }}>
        En quelques secondes, ajoutez Meello à votre écran d'accueil pour un accès
        rapide et pour recevoir les notifications, comme une vraie application.
      </p>

      <div style={{ padding: '0.85rem 1rem', background: 'rgba(232,80,26,0.06)', borderRadius: 12, fontSize: '0.88rem', color: '#2D2D2D', lineHeight: 1.55, margin: '0 0 2rem' }}>
        ⚠️ <strong>À faire dans Safari</strong> (pas Chrome ni un autre navigateur) — c'est une exigence d'Apple pour installer une app web.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {STEPS.map((step) => (
          <div key={step.n} style={{ background: '#FFFFFF', border: '1px solid #E7E0D4', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '1.1rem 1.25rem', display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
              <div style={{ flexShrink: 0, width: 30, height: 30, borderRadius: '50%', background: '#E8501A', color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem' }}>
                {step.n}
              </div>
              <div>
                <div style={{ fontWeight: 700, color: '#2D2D2D', fontSize: '1rem', marginBottom: '0.2rem' }}>{step.title}</div>
                <div style={{ fontSize: '0.9rem', color: '#2D2D2D', opacity: 0.7, lineHeight: 1.55 }}>{step.text}</div>
              </div>
            </div>
            {/* Capture d'écran de l'étape */}
            <div style={{ background: '#F5F0E8', borderTop: '1px solid #E7E0D4', display: 'flex', justifyContent: 'center', padding: '1rem' }}>
              <img
                src={step.img}
                alt={step.title}
                style={{ maxWidth: '100%', maxHeight: 520, borderRadius: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
                onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex' }}
              />
              <div style={{ display: 'none', width: '100%', maxWidth: 280, height: 200, borderRadius: 12, border: '2px dashed #CBC4B8', alignItems: 'center', justifyContent: 'center', color: '#2D2D2D', opacity: 0.4, fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
                Capture à venir
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
