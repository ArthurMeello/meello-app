// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { emailTemplate } from '@/lib/emailTemplate'

export async function POST(req: NextRequest) {
  const { event, user } = await req.json()

  const eventDate = new Date(event.event_date)
  const dateStr = eventDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const timeStr = eventDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'Meello', email: 'hello@meello.fr' },
      to: [{ email: user.email, name: `${user.first_name} ${user.last_name}` }],
      subject: `Ta participation à "${event.title}" a été annulée`,
      htmlContent: emailTemplate({
        firstName: user.first_name,
        body: `Ta participation à l'événement <strong>${event.title}</strong> du <strong>${dateStr} à ${timeStr}</strong> a bien été annulée.<br><br>
        Tu peux te réinscrire à tout moment si tu changes d'avis.`,
        cta: { label: 'Voir les événements →', href: 'https://app.meello.fr/evenements' },
      }),
    }),
  })

  return NextResponse.json({ ok: true })
}
