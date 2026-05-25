// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { emailTemplate } from '@/lib/emailTemplate'

const ADMIN_ID = '13cdb485-42e0-48df-b2f8-14dc77dd895a'
const EQUIPE_MEELLO_ID = '00000000-0000-0000-0000-000000000001'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { app, memberCount } = body

  const supabase = createAdminClient()

  // 1. Créer le compte sans envoyer d'email Supabase
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: app.email,
    email_confirm: true,
    user_metadata: { first_name: app.first_name, last_name: app.last_name },
  })

  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message || 'Erreur création compte' }, { status: 400 })
  }

  // 2. Générer un lien de création de mot de passe (recovery)
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email: app.email,
    options: { redirectTo: 'https://app.meello.fr/bienvenue' },
  })

  // 3. Créer le profil
  const badges = memberCount < 200 ? ['fondateur'] : []
  await supabase.from('profiles').insert({
    id: authData.user.id,
    first_name: app.first_name,
    last_name: app.last_name,
    email: app.email,
    activity: app.activity,
    city: app.city,
    country: app.country,
    company_number: app.company_number,
    badges,
    is_active: true,
    member_since: new Date().toISOString(),
  })

  // 4. Publier un post de bienvenue dans le feed (par L'équipe Meello)
  const newMemberProfileUrl = `https://app.meello.fr/membre/${authData.user.id}`
  await supabase.from('posts').insert({
    author_id: EQUIPE_MEELLO_ID,
    content: `🎉 Bienvenue à @${app.first_name}${app.last_name} qui rejoint la communauté Meello !\n\n${app.first_name} est ${app.activity}${app.city ? ` basé·e à ${app.city}` : ''}. Souhaite lui la bienvenue ! 👋\n\n👉 ${newMemberProfileUrl}`,
  })

  // Notifier le nouveau membre
  await supabase.from('notifications').insert({
    user_id: authData.user.id,
    type: 'mention',
    content: `L'équipe Meello vous a souhaité la bienvenue dans le fil d'actualité !`,
    link: `/feed`,
  })

  // 5. Mettre à jour le statut de la candidature
  await supabase.from('applications').update({ status: 'approved' }).eq('id', app.id)

  // 6. Auto-connexion avec Arthur
  const ARTHUR_ID = process.env.NEXT_PUBLIC_CREATOR_ID || ADMIN_ID
  if (ARTHUR_ID !== authData.user.id) {
    await supabase.from('connections').insert([
      { requester_id: ARTHUR_ID, receiver_id: authData.user.id, status: 'accepted' },
    ])
    await supabase.from('conversations').insert({
      participant1_id: ARTHUR_ID,
      participant2_id: authData.user.id,
    })
  }

  // 6. Envoyer l'email de bienvenue via Brevo avec le lien magique
  const loginLink = linkData?.properties?.action_link || 'https://app.meello.fr/connexion'

  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'Meello', email: 'hello@meello.fr' },
      to: [{ email: app.email, name: `${app.first_name} ${app.last_name}` }],
      subject: `Bienvenue dans Meello, ${app.first_name} !`,
      htmlContent: emailTemplate({
        firstName: app.first_name,
        body: `Bonne nouvelle — ta candidature a été acceptée et tu fais maintenant partie de la communauté Meello !<br><br>Clique sur le bouton ci-dessous pour créer ton mot de passe et accéder à ton espace. Ce lien est valable 24h.`,
        cta: { label: 'Accéder à Meello →', href: loginLink },
      }),
    }),
  })

  // 7. Ajouter à la liste Brevo
  await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: app.email,
      attributes: { PRENOM: app.first_name, NOM: app.last_name },
      listIds: [4],
      updateEnabled: true,
    }),
  })

  return NextResponse.json({ ok: true, userId: authData.user.id })
}
