// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { emailTemplate } from '@/lib/emailTemplate'
import { createAdminClient } from '@/lib/supabase/admin'

// Map du type fonctionnel -> préfixe de colonne dans notification_preferences
// + sujet d'e-mail. Les types absents d'ici ne sont pas filtrables.
const TYPE_CONFIG: Record<string, { prefKey: string; emailSubject: string; emailable: boolean }> = {
  message:        { prefKey: 'messages',        emailSubject: 'Tu as reçu un nouveau message sur Meello', emailable: false }, // in-app only (évite le spam)
  connection:     { prefKey: 'connections',     emailSubject: 'Nouvelle demande de connexion sur Meello',  emailable: true },
  recommendation: { prefKey: 'recommendations', emailSubject: 'Tu as reçu une recommandation sur Meello',  emailable: true },
  community:      { prefKey: 'community',        emailSubject: 'Nouvelle activité te concerne sur Meello',  emailable: true },
}

export async function POST(req: NextRequest) {
  try {
    const { userId, type, content, link, fromUserId, dbType } = await req.json()

    if (!userId || !type) {
      return NextResponse.json({ ok: false, error: 'userId et type requis' }, { status: 400 })
    }

    const config = TYPE_CONFIG[type]
    const supabase = createAdminClient()

    // Types non réglables (events, mentions admin…) : on insère sans filtrer
    if (!config) {
      await supabase.from('notifications').insert({
        user_id: userId,
        type: dbType || type,
        content,
        link,
        from_user_id: fromUserId,
      })
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
