// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { emailTemplate } from '@/lib/emailTemplate'
import { createAdminClient } from '@/lib/supabase/admin'
import { titleCase } from '@/lib/format'

// Rappel quotidien : prévient par e-mail les membres qui ont un message privé
// non lu depuis +24h ET qui ne se sont pas reconnectés depuis.
// Appelée par un cron Vercel. Protégée par un secret.
export async function GET(req: NextRequest) {
  // Sécurité : seul le cron (avec le bon secret) peut déclencher
  const auth = req.headers.get('authorization')
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // il y a 24h

  // 1) Messages privés non lus, plus vieux que 24h
  const { data: msgs } = await supabase
    .from('meello_messages')
    .select('id, conversation_id, sender_id, created_at')
    .is('read_at', null)
    .lt('created_at', cutoff)
    .order('created_at', { ascending: true })

  if (!msgs || msgs.length === 0) return NextResponse.json({ ok: true, sent: 0 })

  // 2) Écarter ceux déjà rappelés
  const msgIds = msgs.map((m: any) => m.id)
  const { data: alreadyReminded } = await supabase
    .from('message_reminders')
    .select('message_id')
    .in('message_id', msgIds)
  const remindedSet = new Set((alreadyReminded || []).map((r: any) => r.message_id))
  const pending = msgs.filter((m: any) => !remindedSet.has(m.id))
  if (pending.length === 0) return NextResponse.json({ ok: true, sent: 0 })

  // 3) Conversations pour identifier le destinataire (l'autre participant)
  const convIds = [...new Set(pending.map((m: any) => m.conversation_id))]
  const { data: convs } = await supabase
    .from('conversations')
    .select('id, participant1_id, participant2_id')
    .in('id', convIds)
  const convMap = Object.fromEntries((convs || []).map((c: any) => [c.id, c]))

  // 4) Regrouper par destinataire : { recipientId: { senderIds:Set, messageIds:[] } }
  const byRecipient: Record<string, { senders: Set<string>; messageIds: string[] }> = {}
  for (const m of pending) {
    const conv = convMap[m.conversation_id]
    if (!conv) continue
    const recipientId = conv.participant1_id === m.sender_id ? conv.participant2_id : conv.participant1_id
    if (!recipientId || recipientId === m.sender_id) continue
    if (!byRecipient[recipientId]) byRecipient[recipientId] = { senders: new Set(), messageIds: [] }
    byRecipient[recipientId].senders.add(m.sender_id)
    byRecipient[recipientId].messageIds.push(m.id)
  }

  const recipientIds = Object.keys(byRecipient)
  if (recipientIds.length === 0) return NextResponse.json({ ok: true, sent: 0 })

  // 5) Profils + préférences + dernière activité des destinataires
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, first_name, last_active')
    .in('id', recipientIds)
  const profMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]))

  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('user_id, messages_email')
    .in('user_id', recipientIds)
  const prefMap = Object.fromEntries((prefs || []).map((p: any) => [p.user_id, p]))

  // Tous les senderIds pour récupérer leurs prénoms
  const allSenderIds = [...new Set(Object.values(byRecipient).flatMap(r => [...r.senders]))]
  const { data: senderProfiles } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .in('id', allSenderIds)
  const senderMap = Object.fromEntries((senderProfiles || []).map((p: any) => [p.id, p]))

  let sent = 0
  const remindedRows: { message_id: string }[] = []

  for (const recipientId of recipientIds) {
    const group = byRecipient[recipientId]
    const prof = profMap[recipientId]
    if (!prof) continue

    // Préférence e-mail messages (true par défaut si pas de ligne)
    const pref = prefMap[recipientId]
    if (pref && pref.messages_email === false) continue

    // Destinataire actif récemment ? Si last_active >= le plus ancien message
    // de ce groupe, on considère qu'il a eu l'occasion de voir → pas de rappel.
    // On envoie seulement s'il ne s'est PAS reconnecté depuis 24h.
    const lastActive = prof.last_active ? new Date(prof.last_active).getTime() : 0
    const recently = lastActive > (Date.now() - 24 * 60 * 60 * 1000)
    if (recently) continue

    // E-mail du destinataire
    const { data: authUser } = await supabase.auth.admin.getUserById(recipientId)
    const email = authUser?.user?.email
    if (!email) continue

    // Noms des expéditeurs
    const senderNames = [...group.senders]
      .map(sid => {
        const s = senderMap[sid]
        return s ? `${titleCase(s.first_name)} ${titleCase(s.last_name)}`.trim() : null
      })
      .filter(Boolean)

    const count = group.messageIds.length
    const namesStr = senderNames.length === 1
      ? `<strong>${senderNames[0]}</strong>`
      : senderNames.slice(0, -1).map(n => `<strong>${n}</strong>`).join(', ') + ` et <strong>${senderNames[senderNames.length - 1]}</strong>`

    const body = senderNames.length === 1
      ? `Tu as un message non lu de ${namesStr} sur Meello. Connecte-toi pour le découvrir et lui répondre.`
      : `Tu as des messages non lus de ${namesStr} sur Meello. Connecte-toi pour les découvrir et y répondre.`

    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': process.env.BREVO_API_KEY!, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: 'Meello', email: 'hello@meello.fr' },
        to: [{ email, name: titleCase(prof.first_name) }],
        subject: senderNames.length === 1 ? `Tu as un message de ${senderNames[0]}` : `Tu as ${count} messages non lus sur Meello`,
        htmlContent: emailTemplate({
          firstName: titleCase(prof.first_name),
          body,
          cta: { label: 'Voir mes messages →', href: 'https://app.meello.fr/messages' },
        }),
      }),
    })
    sent++
    for (const mid of group.messageIds) remindedRows.push({ message_id: mid })
  }

  // 6) Marquer comme rappelés (même ceux des destinataires actifs/coupés, pour
  //    ne pas les ré-évaluer chaque jour indéfiniment).
  const allPendingIds = pending.map((m: any) => ({ message_id: m.id }))
  if (allPendingIds.length > 0) {
    await supabase.from('message_reminders').upsert(allPendingIds, { onConflict: 'message_id' })
  }

  return NextResponse.json({ ok: true, sent })
}
