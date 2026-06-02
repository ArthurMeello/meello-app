// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setCurrentEmail(user.email || '')
      setLoading(false)
    }
    load()
  }, [])

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
    </div>
  )
}
