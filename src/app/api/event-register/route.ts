// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { emailTemplate } from '@/lib/emailTemplate'
import { createAdminClient } from '@/lib/supabase/admin'

function generateIcs(event: any): string {
  const start = new Date(event.event_date)
  const end = event.duration_minutes
    ? new Date(start.getTime() + event.duration_minutes * 60000)
    : new Date(start.getTime() + 60 * 60000)

  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Meello//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:event-${event.id}@meello.fr`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${event.title}`,
    event.description ? `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}` : '',
    event.visio_link ? `URL:${event.visio_link}` : '',
    event.visio_link ? `LOCATION:${event.visio_link}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')
}

export async function POST(req: NextRequest) {
  const { event, user } = await req.json()

  const eventDate = new Date(event.event_date)
  const dateStr = eventDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const timeStr = eventDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const durationStr = event.duration_minutes ? ` (${event.duration_minutes} min)` : ''

  const icsBase64 = Buffer.from(generateIcs(event)).toString('base64')

  // Notification au créateur de l'événement (sauf s'il s'inscrit lui-même)
  if (event.author_id && event.author_id !== user.id) {
    const supabase = createAdminClient()
    await supabase.from('notifications').insert({
      user_id: event.author_id,
      type: 'event_new_participant',
      content: `${user.first_name} ${user.last_name} s'est inscrit(e) à ton événement "${event.title}"`,
      link: '/evenements',
      from_user_id: user.id,
    })
  }

  // Mail 1 : confirmation de participation avec lien visio + fichier .ics
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
        ${event.visio_link ? `🔗 Lien pour rejoindre la visio : <a href="${event.visio_link}" style="color:#E8501A;">${event.visio_link}</a><br><br>` : ''}
        Un fichier .ics est joint à cet email pour ajouter l'événement directement à ton calendrier (Google, Outlook, Apple…).<br><br>
        Tu recevras également un rappel le matin même. À très vite !`,
        cta: { label: 'Voir l\'événement →', href: 'https://app.meello.fr/evenements' },
      }),
      attachment: [
        {
          name: `${event.title.replace(/[^a-z0-9]/gi, '_')}.ics`,
          content: icsBase64,
        },
      ],
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
