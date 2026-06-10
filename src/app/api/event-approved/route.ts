// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { emailTemplate } from '@/lib/emailTemplate'

export async function POST(req: NextRequest) {
  const { event } = await req.json()

  const eventDate = new Date(event.event_date)
  const dateStr = eventDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' })
  const timeStr = eventDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
  const durationStr = event.duration_minutes ? ` (${event.duration_minutes} min)` : ''

  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'Meello', email: 'hello@meello.fr' },
      to: [{ email: event.author_email, name: event.author_name }],
      subject: `Ton événement "${event.title}" est en ligne ! 🎉`,
      htmlContent: emailTemplate({
        firstName: event.author_first_name,
        body: `Bonne nouvelle — ton événement <strong>${event.title}</strong> a été validé et est maintenant visible par tous les membres de Meello !<br><br>
        📅 <strong>${dateStr} à ${timeStr}${durationStr}</strong><br><br>
        Les membres peuvent dès maintenant s'inscrire.`,
        cta: { label: 'Voir l\'événement →', href: 'https://app.meello.fr/evenements' },
      }),
    }),
  })

  return NextResponse.json({ ok: true })
}
