// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerClient } from '@/lib/supabase/server'

const ADMIN_ID = '13cdb485-42e0-48df-b2f8-14dc77dd895a'
const NEWSLETTER_LIST_ID = Number(process.env.BREVO_NEWSLETTER_LIST_ID || 5)
const TRANSACTIONAL_LIST_ID = 4

export async function POST(req: NextRequest) {
  // L'identité vient de la SESSION (cookies), jamais du body : un utilisateur
  // ne peut donc supprimer que SON propre compte.
  const authClient = await createServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  const userId = user.id
  const email = user.email

  // Garde-fou : l'admin ne peut pas auto-supprimer son compte par ce biais
  if (userId === ADMIN_ID) {
    return NextResponse.json({ error: 'Le compte administrateur ne peut pas être supprimé ici.' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // 1) Retirer le contact des listes Brevo (newsletter + transactionnelle)
  if (email && process.env.BREVO_API_KEY) {
    const headers = { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json' }
    // Suppression complète du contact Brevo (le retire de toutes ses listes)
    await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
      method: 'DELETE',
      headers,
    }).catch(() => {})
  }

  // 2) Supprimer toutes les données liées (avant le profil et l'auth)
  await supabase.from('notification_preferences').delete().eq('user_id', userId)
  await supabase.from('qg_last_read').delete().eq('user_id', userId)
  await supabase.from('qg_presence').delete().eq('user_id', userId)
  await supabase.from('qg_messages').delete().eq('user_id', userId)
  await supabase.from('notifications').delete().eq('user_id', userId)
  await supabase.from('notifications').delete().eq('from_user_id', userId)
  await supabase.from('reactions').delete().eq('author_id', userId)
  await supabase.from('comments').delete().eq('author_id', userId)
  await supabase.from('posts').delete().eq('author_id', userId)
  await supabase.from('meello_messages').delete().eq('sender_id', userId)
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
  await supabase.from('recommendations').delete().eq('target_id', userId)
  // Candidatures (par e-mail car applications n'a pas toujours user_id)
  if (email) await supabase.from('applications').delete().eq('email', email)
  // Événements
  await supabase.from('event_participants').delete().eq('user_id', userId)
  await supabase.from('events').delete().eq('author_id', userId)
  // Parrainage
  await supabase.from('referrals').delete().or(`referrer_id.eq.${userId},referred_id.eq.${userId}`)
  // Profil en dernier
  await supabase.from('profiles').delete().eq('id', userId)

  // 3) Supprimer le compte auth (en dernier)
  const { error } = await supabase.auth.admin.deleteUser(userId)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
