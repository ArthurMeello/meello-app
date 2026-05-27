// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { emailTemplate } from '@/lib/emailTemplate'

export async function POST(req: NextRequest) {
  const { event, user } = await req.json()

  const eventDate = new Date(event.event_date)
  const dateStr = eventDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const timeStr = eventDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const durationStr = event.duration_minutes ? ` (${event.duration_minutes} min)` : ''

  // Mail 1 : confirmation de participation
  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'Meello', email: 'hello@meello.fr' },
      to: [{ email: user.email, name: `${user.first_name} ${user.last_name}` }],
      subject: `Ta participation à "${event.title}" est confirmée !`,
      htmlContent: emailTemplate({
        firstName: user.first_name,
        body: `Ta participation à l'événement <strong>${event.title}</strong> a bien été enregistrée !<br><br>
        📅 <strong>${dateStr} à ${timeStr}${durationStr}</strong><br><br>
        Le lien pour rejoindre la visio sera disponible le jour J directement sur la plateforme Meello. Tu recevras également un rappel le matin même.<br><br>
        À très vite !`,
        cta: { label: 'Voir l\'événement →', href: 'https://app.meello.fr/evenements' },
      }),
    }),
  })

  // Mail 2 : rappel le jour J — planifié via Brevo transactionnel avec sendAt
  const reminderDate = new Date(eventDate)
  reminderDate.setHours(8, 0, 0, 0) // 8h le matin du jour J

  // On n'envoie le rappel que si c'est dans le futur
  if (reminderDate > new Date()) {
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'Meello', email: 'hello@meello.fr' },
        to: [{ email: user.email, name: `${user.first_name} ${user.last_name}` }],
        subject: `Rappel : "${event.title}" c'est aujourd'hui ! 🎉`,
        scheduledAt: reminderDate.toISOString(),
        htmlContent: emailTemplate({
          firstName: user.first_name,
          body: `C'est aujourd'hui ! L'événement <strong>${event.title}</strong> commence à <strong>${timeStr}${durationStr}</strong>.<br><br>
          Clique sur le bouton ci-dessous pour rejoindre la visio.`,
          cta: { label: 'Rejoindre la visio →', href: event.visio_link },
        }),
      }),
    })
  }

  return NextResponse.json({ ok: true })
}
