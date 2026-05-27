// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const { email } = await req.json()

  const supabase = createAdminClient()

  // Générer un lien de réinitialisation de mot de passe
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: 'https://app.meello.fr/bienvenue' },
  })

  if (error || !data?.properties?.action_link) {
    return NextResponse.json({ error: 'Email introuvable.' }, { status: 400 })
  }

  // Envoyer via Brevo
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'Meello', email: 'hello@meello.fr' },
      to: [{ email }],
      subject: 'Réinitialisation de ton mot de passe Meello',
      htmlContent: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 2rem;">
          <h1 style="color: #E8501A; font-size: 2rem; margin-bottom: 1rem;">meello</h1>
          <p style="color: #2D2D2D; line-height: 1.6;">
            Tu as demandé à réinitialiser ton mot de passe.<br><br>
            Clique sur le bouton ci-dessous — ce lien est valable 1 heure.
          </p>
          <p style="margin: 2rem 0;">
            <a href="${data.properties.action_link}" style="background: #E8501A; color: white; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 1rem;">
              Réinitialiser mon mot de passe →
            </a>
          </p>
          <p style="color: #2D2D2D; opacity: 0.5; font-size: 0.85rem;">
            Si tu n'as pas fait cette demande, ignore cet email.
          </p>
        </div>
      `,
    }),
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'Erreur envoi email.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
