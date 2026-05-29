// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { emailTemplate } from '@/lib/emailTemplate'

export async function POST(req: NextRequest) {
  const { userId, firstName } = await req.json()
  if (!userId) return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })

  const supabase = createAdminClient()

  // Récupérer l'email depuis auth.users (source fiable)
  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId)
  if (userError || !userData?.user?.email) {
    return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
  }
  const email = userData.user.email

  const isConfirmed = !!userData.user.email_confirmed_at

  const { data: linkData, error } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: isConfirmed ? 'https://app.meello.fr' : 'https://app.meello.fr/bienvenue' },
  })

  if (error || !linkData) {
    return NextResponse.json({ error: error?.message || 'Erreur génération lien', details: error }, { status: 500 })
  }

  const loginLink = linkData.properties?.action_link

  const subject = isConfirmed ? `Réinitialise ton mot de passe Meello` : `Ton accès à Meello`
  const body = isConfirmed
    ? `Tu as demandé à réinitialiser ton mot de passe Meello.<br><br>Clique sur le bouton ci-dessous pour en créer un nouveau. Ce lien est valable 24h.`
    : `Voici ton lien personnel pour accéder à Meello et créer ton mot de passe.<br><br>Ce lien est valable 24h.`
  const cta = isConfirmed
    ? { label: 'Réinitialiser mon mot de passe →', href: loginLink }
    : { label: 'Accéder à Meello →', href: loginLink }

  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'Meello', email: 'hello@meello.fr' },
      to: [{ email, name: firstName }],
      subject,
      htmlContent: emailTemplate({ firstName, body, cta }),
    }),
  })

  return NextResponse.json({ ok: true, type: isConfirmed ? 'password_reset' : 'invite' })
}
