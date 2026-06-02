// @ts-nocheck
'use client'

import { useState } from 'react'

const FAQ = [
  {
    q: 'Comment rejoindre Meello ?',
    a: "Meello fonctionne sur candidature. Remplis le formulaire de candidature : un administrateur l'examine et tu reçois un e-mail dès que ton compte est validé, avec un lien pour définir ton mot de passe.",
  },
  {
    q: 'Comment modifier mon profil ?',
    a: "Va dans « Mon profil » depuis la barre de navigation. Tu peux y changer ta photo, ta bio, ton activité, ta ville, tes compétences, tes réseaux sociaux, ton portfolio et tes produits/services.",
  },
  {
    q: 'Comment me connecter à un autre membre ?',
    a: "Depuis le profil d'un membre, clique sur « Envoyer une demande de connexion ». La personne reçoit une notification et peut accepter. Une fois connectés, vous pouvez vous envoyer des messages privés.",
  },
  {
    q: 'Comment retirer une relation ?',
    a: "Ouvre le profil de la personne, clique sur le menu « … » puis « Supprimer la relation ». Une confirmation te sera demandée. La relation est retirée des deux côtés.",
  },
  {
    q: 'Comment fonctionnent les recommandations ?',
    a: "Tu peux recommander un membre avec qui tu es connecté depuis son profil. Ta recommandation apparaît sur sa fiche après validation. Les recommandations renforcent la confiance au sein de la communauté.",
  },
  {
    q: 'À quoi sert le QG ?',
    a: "Le QG est le canal de discussion général de la communauté : tout le monde peut y échanger. Une pastille apparaît sur l'onglet « Le QG » quand il y a de nouveaux messages depuis ta dernière visite.",
  },
  {
    q: 'Comment gérer mes notifications ?',
    a: "Dans « Paramètres », section Notifications, tu choisis pour chaque type d'activité (messages, connexions, recommandations, activité communauté, QG) si tu veux être prévenu dans l'app et/ou par e-mail.",
  },
  {
    q: 'Comment m\'inscrire ou me désinscrire de la newsletter ?',
    a: "Dans « Paramètres », section Notifications, active ou désactive le toggle « Newsletter ». L'activation t'ajoute à notre liste de diffusion, la désactivation t'en retire à tout moment.",
  },
  {
    q: 'Comment changer mon e-mail ou mon mot de passe ?',
    a: "Dans « Paramètres », les sections « Adresse e-mail » et « Mot de passe » te permettent de les modifier. Un changement d'e-mail nécessite une confirmation par lien envoyé à la nouvelle adresse.",
  },
  {
    q: 'Comment supprimer mon compte ?',
    a: "En bas de la page « Paramètres », la zone « Supprimer mon compte » te permet de supprimer définitivement ton compte et toutes tes données. Cette action est irréversible et te retire des listes de diffusion.",
  },
]

function FaqItem({ q, a, isLast }: { q: string; a: string; isLast?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderBottom: isLast ? 'none' : '1px solid #F0EBE1' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          padding: '1.1rem 0', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: '0.95rem', fontWeight: 600, color: open ? '#E8501A' : '#2D2D2D' }}>{q}</span>
        <span style={{ fontSize: '1.3rem', color: '#E8501A', flexShrink: 0, lineHeight: 1 }}>{open ? '−' : '+'}</span>
      </button>
      {open && (
        <p style={{ margin: '0 0 1.1rem', color: '#2D2D2D', opacity: 0.7, lineHeight: 1.6, fontSize: '0.9rem' }}>{a}</p>
      )}
    </div>
  )
}

export default function AidePage() {
  return (
    <div style={{ maxWidth: '680px', margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.6rem', color: '#2D2D2D', fontWeight: 700, marginBottom: '0.5rem' }}>
        Aide & FAQ
      </h1>
      <p style={{ color: '#2D2D2D', opacity: 0.6, fontSize: '0.95rem', marginBottom: '1.5rem' }}>
        Les réponses aux questions les plus fréquentes sur Meello.
      </p>

      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '0.5rem 1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        {FAQ.map((item, i) => (
          <FaqItem key={i} q={item.q} a={item.a} isLast={i === FAQ.length - 1} />
        ))}
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginTop: '1.5rem' }}>
        <h2 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.05rem', color: '#2D2D2D', fontWeight: 700, marginBottom: '0.5rem' }}>
          Une autre question ?
        </h2>
        <p style={{ color: '#2D2D2D', opacity: 0.7, lineHeight: 1.6, fontSize: '0.9rem', margin: 0 }}>
          Écris-nous à <a href="mailto:hello@meello.fr" style={{ color: '#E8501A', fontWeight: 600, textDecoration: 'none' }}>hello@meello.fr</a> et on te répond rapidement.
        </p>
      </div>
    </div>
  )
}
