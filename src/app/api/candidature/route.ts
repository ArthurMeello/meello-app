// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { emailTemplate } from '@/lib/emailTemplate'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { first_name, last_name, email, activity, city, country, why_join } = body

  try {
    // Email à l'admin
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'Meello', email: 'noreply@meello.fr' },
        to: [{ email: 'admin@meello.fr', name: 'Admin Meello' }],
        subject: `Nouvelle candidature — ${first_name} ${last_name}`,
        htmlContent: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #E8501A;">Nouvelle candidature Meello</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px; font-weight: bold;">Nom</td><td style="padding: 8px;">${first_name} ${last_name}</td></tr>
              <tr style="background: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">Email</td><td style="padding: 8px;">${email}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">Activité</td><td style="padding: 8px;">${activity}</td></tr>
              <tr style="background: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">Ville</td><td style="padding: 8px;">${city}, ${country}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">Motivation</td><td style="padding: 8px;">${why_join}</td></tr>
            </table>
            <p style="margin-top: 24px;">
              <a href="https://app.meello.fr/admin" style="background: #E8501A; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                Voir dans l'admin
              </a>
            </p>
          </div>
        `,
      }),
    })

    // Email de confirmation au candidat
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'Meello', email: 'bonjour@meello.fr' },
        to: [{ email, name: `${first_name} ${last_name}` }],
        subject: 'Ta candidature Meello a bien été reçue',
        htmlContent: emailTemplate({
          firstName: first_name,
          body: `Nous avons bien reçu ta candidature et nous t'en remercions.<br><br>Elle sera examinée dans les plus brefs délais. Tu seras informé(e) par email dès qu'une décision sera prise, que ta candidature soit retenue ou non.<br><br>En attendant, si tu as des questions, n'hésite pas à répondre à cet email.`,
        }),
      }),
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
