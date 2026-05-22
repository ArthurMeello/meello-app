// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { first_name, last_name, email, activity, city, country, why_join } = body

  try {
    console.log('BREVO_API_KEY présente:', !!process.env.BREVO_API_KEY)
    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
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
    const brevoData = await brevoRes.json()
    console.log('Brevo response:', brevoRes.status, JSON.stringify(brevoData))

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
