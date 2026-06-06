// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { emailTemplate } from '@/lib/emailTemplate'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerClient } from '@/lib/supabase/server'

// Prévient tous les inscrits d'un événement annulé ou dont l'horaire a changé.
// type: 'cancelled' | 'rescheduled'
export async function POST(req: NextRequest) {
  try {
    const { eventId, type, event, oldDate } = await req.json()
    if (!eventId || !type || !event) {
      return NextResponse.json({ ok: false, error: 'paramètres manquants' }, { status: 400 })
    }

    // Sécurité : seul le créateur (ou l'admin) peut déclencher
    const authClient = await createServerClient()
    const { data: { user } } = await authClient.auth.getUser()
    const ADMIN_ID = '13cdb485-42e0-48df-b2f8-14dc77dd895a'
    if (!user || (user.id !== event.author_id && user.id !== ADMIN_ID)) {
      return NextResponse.json({ ok: false, error: 'Non autorisé' }, { status: 403 })
    }

    const supabase = createAdminClient()

    // Participants
    const { data: parts } = await supabase
      .from('event_participants')
      .select('user_id')
      .eq('event_id', eventId)
    const userIds = (parts || []).map((p: any) => p.user_id).filter((uid: string) => uid !== user.id)
    if (userIds.length === 0) return NextResponse.json({ ok: true, sent: 0 })

    // Profils + e-mails
    const { data: profiles } = await supabase
      .from('profiles').select('id, first_name').in('id', userIds)
    const profMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]))

    const eventDate = new Date(event.event_date)
    const dateStr = eventDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    const timeStr = eventDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

    let sent = 0
    for (const uid of userIds) {
      const { data: authUser } = await supabase.auth.admin.getUserById(uid)
      const email = authUser?.user?.email
      if (!email) continue
      const firstName = profMap[uid]?.first_name || ''

      let subject = ''
      let body = ''
      if (type === 'cancelled') {
        subject = `Événement annulé : "${event.title}"`
        body = `L'événement <strong>${event.title}</strong>, prévu le <strong>${dateStr} à ${timeStr}</strong>, a été annulé par son organisateur.<br><br>Désolé pour le désagrément. Tu peux découvrir les autres événements de la communauté.`
      } else {
        const oldStr = oldDate ? (() => {
          const d = new Date(oldDate)
          return `${d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
        })() : null
        subject = `Nouvel horaire : "${event.title}"`
        body = `L'organisateur a modifié l'horaire de l'événement <strong>${event.title}</strong> auquel tu es inscrit(e).<br><br>${oldStr ? `❌ Ancien : ${oldStr}<br>` : ''}✅ <strong>Nouveau : ${dateStr} à ${timeStr}</strong><br><br>Pense à mettre à jour ton agenda !`
      }

      await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': process.env.BREVO_API_KEY!, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: { name: 'Meello', email: 'hello@meello.fr' },
          to: [{ email, name: firstName }],
          subject,
          htmlContent: emailTemplate({
            firstName,
            body,
            cta: { label: 'Voir les événements →', href: 'https://app.meello.fr/evenements' },
          }),
        }),
      })
      sent++
    }

    return NextResponse.json({ ok: true, sent })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'erreur' }, { status: 500 })
  }
}
