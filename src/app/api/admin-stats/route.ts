// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerClient } from '@/lib/supabase/server'

const ADMIN_ID = '13cdb485-42e0-48df-b2f8-14dc77dd895a'

// Statistiques d'activité AGRÉGÉES (jamais de contenu, jamais "qui parle à qui").
export async function GET(req: NextRequest) {
  // Sécurité : réservé à l'admin (identité via session)
  const authClient = await createServerClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user || user.id !== ADMIN_ID) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  const supabase = createAdminClient()
  const now = Date.now()
  const d7 = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
  const d30 = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()

  // Total conversations
  const { count: totalConvs } = await supabase
    .from('conversations')
    .select('id', { count: 'exact', head: true })

  // Total messages
  const { count: totalMsgs } = await supabase
    .from('meello_messages')
    .select('id', { count: 'exact', head: true })

  // Messages sur 7 / 30 jours
  const { count: msgs7 } = await supabase
    .from('meello_messages')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', d7)
  const { count: msgs30 } = await supabase
    .from('meello_messages')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', d30)

  // Conversations actives (au moins un message dans les 7 derniers jours)
  const { data: recentMsgs } = await supabase
    .from('meello_messages')
    .select('conversation_id')
    .gte('created_at', d7)
  const activeConvs = new Set((recentMsgs || []).map((m: any) => m.conversation_id)).size

  // Membres ayant déjà envoyé au moins un message
  const { data: senders } = await supabase
    .from('meello_messages')
    .select('sender_id')
  const sendersSet = new Set((senders || []).map((m: any) => m.sender_id))
  const activeSenders = sendersSet.size

  // Total membres (pour le ratio)
  const { count: totalMembers } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)

  return NextResponse.json({
    ok: true,
    totalConvs: totalConvs || 0,
    activeConvs,
    totalMsgs: totalMsgs || 0,
    msgs7: msgs7 || 0,
    msgs30: msgs30 || 0,
    activeSenders,
    totalMembers: totalMembers || 0,
  })
}
