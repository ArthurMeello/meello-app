// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_ID = '13cdb485-42e0-48df-b2f8-14dc77dd895a'

export async function POST(req: NextRequest) {
  const { userId, requesterId } = await req.json()

  // Vérification côté serveur que c'est bien l'admin
  if (requesterId !== ADMIN_ID) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  // Empêcher la suppression du compte admin lui-même
  if (userId === ADMIN_ID) {
    return NextResponse.json({ error: 'Impossible de supprimer le compte admin' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Supprimer toutes les données liées avant le profil
  await supabase.from('notifications').delete().eq('user_id', userId)
  await supabase.from('notifications').delete().eq('from_user_id', userId)
  await supabase.from('reactions').delete().eq('author_id', userId)
  await supabase.from('comments').delete().eq('author_id', userId)
  await supabase.from('posts').delete().eq('author_id', userId)
  await supabase.from('messages').delete().eq('sender_id', userId)
  await supabase.from('messages').delete().eq('receiver_id', userId)
  await supabase.from('connections').delete().or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)
  await supabase.from('conversations').delete().or(`participant1_id.eq.${userId},participant2_id.eq.${userId}`)
  // Forum
  await supabase.from('forum_replies').delete().eq('author_id', userId)
  await supabase.from('forum_topics').delete().eq('author_id', userId)
  // Portfolio & services
  await supabase.from('portfolio_items').delete().eq('profile_id', userId)
  await supabase.from('service_items').delete().eq('profile_id', userId)
  // Recommandations (données et reçues)
  await supabase.from('recommendations').delete().eq('author_id', userId)
  await supabase.from('recommendations').delete().eq('recommended_id', userId)
  await supabase.from('recommendations').delete().eq('target_id', userId)
  // Candidatures
  await supabase.from('applications').delete().eq('user_id', userId)
  // Événements
  await supabase.from('event_participants').delete().eq('user_id', userId)
  await supabase.from('events').delete().eq('author_id', userId)
  // Parrainage
  await supabase.from('referrals').delete().or(`referrer_id.eq.${userId},referred_id.eq.${userId}`)
  // Profil en dernier
  await supabase.from('profiles').delete().eq('id', userId)

  // Supprimer le compte auth (doit être en dernier)
  const { error } = await supabase.auth.admin.deleteUser(userId)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
