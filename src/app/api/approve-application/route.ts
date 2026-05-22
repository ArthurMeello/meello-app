// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_ID = '13cdb485-42e0-48df-b2f8-14dc77dd895a'

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
  const badges = memberCount < 200 ? ['fondateur', 'nouveau'] : ['nouveau']
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
  })

  // 4. Mettre à jour le statut de la candidature
  await supabase.from('applications').update({ status: 'approved' }).eq('id', app.id)

  // 5. Auto-connexion avec Arthur
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
      htmlContent: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 2rem;">
          <h1 style="color: #E8501A; font-size: 2rem; margin-bottom: 0.5rem;">meello</h1>
          <h2 style="color: #2D2D2D; font-weight: 700;">Ta candidature a été acceptée !</h2>
          <p style="color: #2D2D2D; line-height: 1.6;">
            Bonjour ${app.first_name},<br><br>
            Bonne nouvelle — tu fais maintenant partie de la communauté Meello !<br><br>
            Clique sur le bouton ci-dessous pour accéder à ton espace :
          </p>
          <p style="margin: 2rem 0;">
            <a href="${loginLink}" style="background: #E8501A; color: white; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 1rem;">
              Accéder à Meello →
            </a>
          </p>
          <p style="color: #2D2D2D; opacity: 0.6; font-size: 0.85rem;">
            Ce lien est valable 24h. Si tu as des questions, réponds à cet email.
          </p>
        </div>
      `,
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
