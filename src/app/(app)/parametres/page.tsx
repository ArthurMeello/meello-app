// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Types de notifications. Par défaut chaque ligne a un toggle App et E-mail.
// appable: false  => pas de notif in-app (e-mail uniquement, ex: newsletter)
// emailable: false => pas d'e-mail (in-app uniquement)
const NOTIF_TYPES = [
  { key: 'messages', label: 'Messages privés', emailable: true },
  { key: 'connections', label: 'Demandes de connexion', emailable: true },
  { key: 'recommendations', label: 'Recommandations', emailable: true },
  { key: 'community', label: 'Activité communauté', emailable: false },
  { key: 'qg', label: 'Activité du QG', emailable: false },
  { key: 'newsletter', label: 'Newsletter', appable: false, emailable: true },
]

const DEFAULT_PREFS: Record<string, boolean> = {
  messages_app: true, messages_email: true,
  connections_app: true, connections_email: true,
  recommendations_app: true, recommendations_email: true,
  community_app: true, community_email: true,
  qg_app: true,
  // Newsletter désactivée par défaut : opt-in explicite requis
  newsletter_app: true, newsletter_email: false,
}

// Petit interrupteur on/off
function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      style={{
        width: '42px', height: '24px', borderRadius: '12px', border: 'none',
        cursor: 'pointer', padding: 0, position: 'relative', flexShrink: 0,
        backgroundColor: on ? '#E8501A' : '#D6D0C4', transition: 'background 0.18s',
      }}
    >
      <span style={{
        position: 'absolute', top: '2px', left: on ? '20px' : '2px',
        width: '20px', height: '20px', borderRadius: '50%', backgroundColor: 'white',
        transition: 'left 0.18s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  )
}

export default function ParametresPage() {
  const router = useRouter()
  const [currentEmail, setCurrentEmail] = useState<string>('')
  const [loading, setLoading] = useState(true)

  // Changement d'e-mail
  const [newEmail, setNewEmail] = useState('')
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailMsg, setEmailMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Changement de mot de passe
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Préférences de notification
  const [userId, setUserId] = useState<string | null>(null)
  const [prefs, setPrefs] = useState<Record<string, boolean> | null>(null)

  // Suppression de compte
  const [deleteModal, setDeleteModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentEmail(user.email || '')
        setUserId(user.id)

        // Charger (ou créer) les préférences de notification
        const { data: existing } = await supabase
          .from('notification_preferences')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (existing) {
          setPrefs(existing)
        } else {
          const { data: created } = await supabase
            .from('notification_preferences')
            .insert({ user_id: user.id })
            .select()
            .single()
          setPrefs(created || DEFAULT_PREFS)
        }
      }
      setLoading(false)
    }
    load()
  }, [])

  const togglePref = async (key: string) => {
    if (!prefs || !userId) return
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next) // mise à jour optimiste
    const supabase = createClient()
    await supabase
      .from('notification_preferences')
      .update({ [key]: next[key], updated_at: new Date().toISOString() })
      .eq('user_id', userId)

    // Newsletter : synchroniser l'inscription à la liste Brevo
    if (key === 'newsletter_email') {
      fetch('/api/newsletter-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, subscribed: next[key] }),
      }).catch(() => {})
    }
  }

  const handleChangeEmail = async () => {
    setEmailMsg(null)
    const value = newEmail.trim()
    if (!value) { setEmailMsg({ type: 'err', text: 'Saisis une nouvelle adresse e-mail.' }); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) { setEmailMsg({ type: 'err', text: 'Adresse e-mail invalide.' }); return }
    if (value.toLowerCase() === currentEmail.toLowerCase()) { setEmailMsg({ type: 'err', text: 'C\'est déjà ton adresse actuelle.' }); return }
    setEmailSaving(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ email: value })
    setEmailSaving(false)
    if (error) { setEmailMsg({ type: 'err', text: error.message }); return }
    setEmailMsg({ type: 'ok', text: `Un e-mail de confirmation a été envoyé à ${value}. Clique sur le lien pour valider le changement.` })
    setNewEmail('')
  }

  const handleChangePassword = async () => {
    setPwMsg(null)
    if (newPassword.length < 6) { setPwMsg({ type: 'err', text: 'Le mot de passe doit faire au moins 6 caractères.' }); return }
    if (newPassword !== confirmPassword) { setPwMsg({ type: 'err', text: 'Les deux mots de passe ne correspondent pas.' }); return }
    setPwSaving(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPwSaving(false)
    if (error) { setPwMsg({ type: 'err', text: error.message }); return }
    setPwMsg({ type: 'ok', text: 'Mot de passe mis à jour.' })
    setNewPassword('')
    setConfirmPassword('')
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/connexion')
  }

  const handleDeleteAccount = async () => {
    setDeleteError(null)
    setDeleting(true)
    try {
      const res = await fetch('/api/delete-account', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setDeleting(false)
        setDeleteError(data.error || 'La suppression a échoué. Réessaie ou contacte le support.')
        return
      }
      // Déconnexion locale puis redirection
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/connexion')
    } catch (e: any) {
      setDeleting(false)
      setDeleteError('Une erreur est survenue. Réessaie plus tard.')
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.6rem 0.85rem', border: '2px solid #E8E3D9',
    borderRadius: '10px', fontSize: '0.92rem', outline: 'none',
    fontFamily: 'inherit', color: '#2D2D2D', backgroundColor: 'white',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '0.78rem', color: '#2D2D2D', opacity: 0.5,
    fontWeight: 600, marginBottom: '0.3rem', display: 'block',
  }

  const btnStyle: React.CSSProperties = {
    backgroundColor: '#E8501A', color: 'white', border: 'none', borderRadius: '10px',
    padding: '0.6rem 1.25rem', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer',
    alignSelf: 'flex-start',
  }

  const msgStyle = (type: 'ok' | 'err'): React.CSSProperties => ({
    fontSize: '0.82rem', lineHeight: 1.5,
    color: type === 'ok' ? '#2E7D32' : '#C62828',
  })

  const sectionStyle: React.CSSProperties = {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '1.5rem',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    marginBottom: '1.5rem',
  }

  const titleStyle: React.CSSProperties = {
    fontFamily: 'var(--font-clash)',
    fontSize: '1.1rem',
    color: '#2D2D2D',
    fontWeight: 700,
    marginBottom: '1rem',
  }

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.6rem', color: '#2D2D2D', fontWeight: 700, marginBottom: '1.5rem' }}>
        Paramètres
      </h1>

      {/* Adresse e-mail */}
      <div style={sectionStyle}>
        <h2 style={titleStyle}>Adresse e-mail</h2>
        <div style={{ fontSize: '0.82rem', color: '#2D2D2D', opacity: 0.55, marginBottom: '1rem' }}>
          Adresse actuelle : <strong style={{ opacity: 1, color: '#2D2D2D' }}>{loading ? '…' : currentEmail}</strong>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label style={labelStyle}>Nouvelle adresse e-mail</label>
            <input
              type="email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder="nouvelle@adresse.fr"
              style={inputStyle}
            />
          </div>
          {emailMsg && <div style={msgStyle(emailMsg.type)}>{emailMsg.text}</div>}
          <button onClick={handleChangeEmail} disabled={emailSaving} style={{ ...btnStyle, opacity: emailSaving ? 0.6 : 1 }}>
            {emailSaving ? 'Envoi…' : 'Changer mon e-mail'}
          </button>
        </div>
      </div>

      {/* Mot de passe */}
      <div style={sectionStyle}>
        <h2 style={titleStyle}>Mot de passe</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label style={labelStyle}>Nouveau mot de passe</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Au moins 6 caractères"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Confirmer le mot de passe</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Répète le mot de passe"
              style={inputStyle}
            />
          </div>
          {pwMsg && <div style={msgStyle(pwMsg.type)}>{pwMsg.text}</div>}
          <button onClick={handleChangePassword} disabled={pwSaving} style={{ ...btnStyle, opacity: pwSaving ? 0.6 : 1 }}>
            {pwSaving ? 'Mise à jour…' : 'Changer mon mot de passe'}
          </button>
        </div>
      </div>

      {/* Notifications */}
      <div style={sectionStyle}>
        <h2 style={titleStyle}>Notifications</h2>
        <p style={{ fontSize: '0.82rem', color: '#2D2D2D', opacity: 0.55, margin: '0 0 1rem', lineHeight: 1.6 }}>
          Choisis comment tu veux être prévenu pour chaque type d'activité.
        </p>

        {!prefs ? (
          <div style={{ fontSize: '0.85rem', color: '#2D2D2D', opacity: 0.4 }}>Chargement…</div>
        ) : (
          <div>
            {/* En-tête colonnes */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 64px 64px', alignItems: 'center', paddingBottom: '0.6rem', borderBottom: '1px solid #F0EBE1' }}>
              <span />
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#2D2D2D', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center' }}>App</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#2D2D2D', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center' }}>E-mail</span>
            </div>

            {/* Lignes */}
            {NOTIF_TYPES.map((t, i) => (
              <div key={t.key} style={{ display: 'grid', gridTemplateColumns: '1fr 64px 64px', alignItems: 'center', padding: '0.85rem 0', borderBottom: i < NOTIF_TYPES.length - 1 ? '1px solid #F5F0E8' : 'none' }}>
                <span style={{ fontSize: '0.9rem', color: '#2D2D2D', fontWeight: 500 }}>{t.label}</span>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  {t.appable !== false ? (
                    <Toggle on={!!prefs[`${t.key}_app`]} onClick={() => togglePref(`${t.key}_app`)} />
                  ) : (
                    <span title="Pas de notification dans l'app pour ce type" style={{ color: '#2D2D2D', opacity: 0.25, fontWeight: 600 }}>—</span>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  {t.emailable ? (
                    <Toggle on={!!prefs[`${t.key}_email`]} onClick={() => togglePref(`${t.key}_email`)} />
                  ) : (
                    <span title="Notifications par e-mail non disponibles pour ce type" style={{ color: '#2D2D2D', opacity: 0.25, fontWeight: 600 }}>—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Déconnexion */}
      <div style={sectionStyle}>
        <h2 style={titleStyle}>Session</h2>
        <button
          onClick={handleLogout}
          style={{ backgroundColor: '#1A1A2E', color: 'white', border: 'none', borderRadius: '10px', padding: '0.6rem 1.25rem', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <img src="/icons/logout.svg" alt="" style={{ width: '18px', height: '18px', filter: 'brightness(0) invert(1)' }} />
          Se déconnecter
        </button>
      </div>

      {/* Zone danger — suppression de compte */}
      <div style={{ ...sectionStyle, border: '1px solid #F3C9BD' }}>
        <h2 style={{ ...titleStyle, color: '#C62828' }}>Supprimer mon compte</h2>
        <p style={{ fontSize: '0.88rem', color: '#2D2D2D', opacity: 0.65, margin: '0 0 1rem', lineHeight: 1.6 }}>
          Cette action est définitive. Ton compte, ton profil, tes messages, publications, recommandations et toutes tes données seront supprimés. Tu seras aussi retiré(e) des listes de diffusion. Cette action est irréversible.
        </p>
        <button
          onClick={() => { setDeleteModal(true); setDeleteConfirm(''); setDeleteError(null) }}
          style={{ backgroundColor: 'white', color: '#C62828', border: '1.5px solid #C62828', borderRadius: '10px', padding: '0.6rem 1.25rem', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}
        >
          Supprimer mon compte
        </button>
      </div>

      {/* Modale de confirmation suppression */}
      {deleteModal && (
        <div
          onClick={() => !deleting && setDeleteModal(false)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
        >
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.75rem', width: '100%', maxWidth: '440px' }}>
            <h3 style={{ fontFamily: 'var(--font-clash)', fontSize: '1.2rem', color: '#C62828', marginBottom: '0.6rem' }}>
              Supprimer définitivement ton compte ?
            </h3>
            <p style={{ fontSize: '0.9rem', color: '#2D2D2D', opacity: 0.7, lineHeight: 1.55, margin: '0 0 1.1rem' }}>
              Toutes tes données seront effacées et tu seras retiré(e) des listes de diffusion. Cette action ne peut pas être annulée.
            </p>
            <label style={{ fontSize: '0.82rem', color: '#2D2D2D', opacity: 0.7, fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
              Tape <strong style={{ color: '#C62828' }}>SUPPRIMER</strong> pour confirmer
            </label>
            <input
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder="SUPPRIMER"
              autoFocus
              style={inputStyle}
            />
            {deleteError && <div style={{ fontSize: '0.82rem', color: '#C62828', marginTop: '0.6rem' }}>{deleteError}</div>}
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button
                onClick={() => setDeleteModal(false)}
                disabled={deleting}
                style={{ background: 'none', border: '1px solid #E8E3D9', borderRadius: '8px', padding: '0.55rem 1.1rem', cursor: deleting ? 'default' : 'pointer', fontSize: '0.9rem', fontWeight: 600, color: '#2D2D2D' }}
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || deleteConfirm !== 'SUPPRIMER'}
                style={{ backgroundColor: '#C62828', color: 'white', border: 'none', borderRadius: '8px', padding: '0.55rem 1.1rem', cursor: (deleting || deleteConfirm !== 'SUPPRIMER') ? 'default' : 'pointer', fontSize: '0.9rem', fontWeight: 600, opacity: (deleting || deleteConfirm !== 'SUPPRIMER') ? 0.5 : 1 }}
              >
                {deleting ? 'Suppression…' : 'Supprimer définitivement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
