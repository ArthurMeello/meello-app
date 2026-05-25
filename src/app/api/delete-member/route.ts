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

  // Supprimer les données liées (Supabase CASCADE gère le reste si les FK sont configurées)
  await supabase.from('notifications').delete().eq('user_id', userId)
  await supabase.from('notifications').delete().eq('from_user_id', userId)
  await supabase.from('reactions').delete().eq('author_id', userId)
  await supabase.from('comments').delete().eq('author_id', userId)
  await supabase.from('posts').delete().eq('author_id', userId)
  await supabase.from('messages').delete().eq('sender_id', userId)
  await supabase.from('messages').delete().eq('receiver_id', userId)
  await supabase.from('connections').delete().or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)
  await supabase.from('conversations').delete().or(`participant1_id.eq.${userId},participant2_id.eq.${userId}`)
  await supabase.from('profiles').delete().eq('id', userId)

  // Supprimer le compte auth (doit être en dernier)
  const { error } = await supabase.auth.admin.deleteUser(userId)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
