// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { emailTemplate } from '@/lib/emailTemplate'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToUser } from '@/lib/push'

// Construit le titre de la notif push selon le type d'activité.
function pushTitleFor(type: string): string {
  switch (type) {
    case 'message': return 'Nouveau message'
    case 'connection': return 'Nouvelle demande de connexion'
    case 'recommendation': return 'Nouvelle recommandation'
    case 'qg': return 'Activité dans le QG'
    case 'community': return 'Activité sur Meello'
    default: return 'Meello'
  }
}

// Map du type fonctionnel -> préfixe de colonne dans notification_preferences
// + sujet d'e-mail. Les types absents d'ici ne sont pas filtrables.
const TYPE_CONFIG: Record<string, { prefKey: string; emailSubject: string; emailable: boolean }> = {
  message:        { prefKey: 'messages',        emailSubject: 'Tu as reçu un nouveau message sur Meello', emailable: false }, // in-app only (évite le spam)
  connection:     { prefKey: 'connections',     emailSubject: 'Nouvelle demande de connexion sur Meello',  emailable: true },
  recommendation: { prefKey: 'recommendations', emailSubject: 'Tu as reçu une recommandation sur Meello',  emailable: true },
  community:      { prefKey: 'community',        emailSubject: 'Nouvelle activité te concerne sur Meello',  emailable: false }, // in-app only (évite le spam)
  qg:             { prefKey: 'qg',               emailSubject: 'Nouvelle activité dans le QG',              emailable: false }, // in-app only (activité du QG)
}

export async function POST(req: NextRequest) {
  try {
    const { userId, type, content, link, fromUserId, dbType } = await req.json()

    if (!userId || !type) {
      return NextResponse.json({ ok: false, error: 'userId et type requis' }, { status: 400 })
    }

    const config = TYPE_CONFIG[type]
    const supabase = createAdminClient()

    // Construit le corps de la notif push (nom de l'expéditeur + contenu).
    async function buildPushBody(): Promise<string> {
      let fromName = ''
      if (fromUserId) {
        const { data: fp } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', fromUserId)
          .single()
        if (fp) fromName = `${fp.first_name} ${fp.last_name}`.trim()
      }
      return fromName ? `${fromName} ${content}` : (content || '')
    }

    // Types non réglables (events, mentions admin…) : on insère sans filtrer
    if (!config) {
      await supabase.from('notifications').insert({
        user_id: userId,
        type: dbType || type,
        content,
        link,
        from_user_id: fromUserId,
      })
      // Push (best-effort, n'échoue jamais la requête)
      try {
        await sendPushToUser(userId, {
          title: pushTitleFor(type),
          body: await buildPushBody(),
          url: link || '/',
          tag: dbType || type,
        })
      } catch (e) { console.error('[notify/push]', e) }
      return NextResponse.json({ ok: true, filtered: false })
    }

    // Lire les préférences (si pas de ligne : tout activé par défaut)
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single()

    const appAllowed = prefs ? prefs[`${config.prefKey}_app`] !== false : true
    const emailAllowed = prefs ? prefs[`${config.prefKey}_email`] !== false : true

    // 1) Notification in-app
    if (appAllowed) {
      await supabase.from('notifications').insert({
        user_id: userId,
        type: dbType || type,
        content,
        link,
        from_user_id: fromUserId,
      })
      // Push : même condition que l'in-app (respecte la préférence _app)
      try {
        await sendPushToUser(userId, {
          title: pushTitleFor(type),
          body: await buildPushBody(),
          url: link || '/',
          tag: dbType || type,
        })
      } catch (e) { console.error('[notify/push]', e) }
    }

    // 2) E-mail (seulement pour les types emailable + préférence active)
    if (config.emailable && emailAllowed && process.env.BREVO_API_KEY) {
      // Récupérer l'e-mail + prénom du destinataire
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name')
        .eq('id', userId)
        .single()

      const { data: authUser } = await supabase.auth.admin.getUserById(userId)
      const recipientEmail = authUser?.user?.email

      if (recipientEmail) {
        // Nom de l'expéditeur (pour personnaliser le corps)
        let fromName = ''
        if (fromUserId) {
          const { data: fromProfile } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', fromUserId)
            .single()
          if (fromProfile) fromName = `${fromProfile.first_name} ${fromProfile.last_name}`.trim()
        }

        const bodyText = fromName
          ? `<strong>${fromName}</strong> ${content}`
          : content

        await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': process.env.BREVO_API_KEY!,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sender: { name: 'Meello', email: 'hello@meello.fr' },
            to: [{ email: recipientEmail, name: profile?.first_name || '' }],
            subject: config.emailSubject,
            htmlContent: emailTemplate({
              firstName: profile?.first_name || '',
              body: `${bodyText}<br><br>Connecte-toi à Meello pour en savoir plus.`,
              cta: { label: 'Ouvrir Meello →', href: `https://app.meello.fr${link || ''}` },
            }),
          }),
        })
      }
    }

    return NextResponse.json({ ok: true, filtered: true, appAllowed, emailAllowed })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'erreur' }, { status: 500 })
  }
}
