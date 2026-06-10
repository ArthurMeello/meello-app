// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Liste des membres ayant vu un sujet de la communauté. RÉSERVÉ À L'ADMIN.
// GET ?topicId=...&adminId=...
const ADMIN_ID = '13cdb485-42e0-48df-b2f8-14dc77dd895a'

export async function GET(req: NextRequest) {
  const topicId = req.nextUrl.searchParams.get('topicId')
  const adminId = req.nextUrl.searchParams.get('adminId')
  if (adminId !== ADMIN_ID) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }
  if (!topicId) return NextResponse.json({ error: 'topicId requis' }, { status: 400 })

  const supabase = createAdminClient()
  const { data: views } = await supabase
    .from('topic_views')
    .select('user_id, viewed_at')
    .eq('topic_id', topicId)
    .order('viewed_at', { ascending: true })

  const ids = (views || []).map((v: any) => v.user_id)
  let names: { id: string; first_name: string; last_name: string }[] = []
  if (ids.length > 0) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', ids)
    names = profs || []
  }
  const nameMap = Object.fromEntries(names.map(n => [n.id, n]))
  const viewers = (views || []).map((v: any) => {
    const n = nameMap[v.user_id]
    return { id: v.user_id, name: n ? `${n.first_name} ${n.last_name}` : 'Membre' }
  })

  return NextResponse.json({ count: viewers.length, viewers })
}
