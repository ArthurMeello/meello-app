// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_ID = '13cdb485-42e0-48df-b2f8-14dc77dd895a'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { app, memberCount } = body

  // Vérifier que l'appelant est bien l'admin
  const supabase = createAdminClient()

  // 1. Inviter le candidat par email (envoie automatiquement un email avec lien de connexion)
  const { data: authData, error: authError } = await supabase.auth.admin.inviteUserByEmail(app.email, {
    data: { first_name: app.first_name, last_name: app.last_name },
    redirectTo: 'https://app.meello.fr/connexion',
  })

  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message || 'Erreur création compte' }, { status: 400 })
  }

  // 2. Créer le profil
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

  // 3. Mettre à jour le statut de la candidature
  await supabase.from('applications').update({ status: 'approved' }).eq('id', app.id)

  // 4. Auto-connexion avec Arthur
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

  // 5. Ajouter à la liste Brevo
  await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://app.meello.fr'}/api/approve-member`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: app.email, first_name: app.first_name, last_name: app.last_name }),
  })

  return NextResponse.json({ ok: true, userId: authData.user.id })
}
