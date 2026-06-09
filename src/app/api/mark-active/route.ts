// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Enregistre le jour courant comme actif pour un membre (base des séries / flamme).
// Découplé du système d'XP : chaque ouverture de l'app compte, même sans action.
// Idempotent (upsert sur clé user_id + day).
export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json()
    if (!userId) return NextResponse.json({ error: 'userId requis' }, { status: 400 })

    const supabase = createAdminClient()
    const today = new Date().toISOString().slice(0, 10)
    await supabase
      .from('daily_activity')
      .upsert({ user_id: userId, day: today }, { onConflict: 'user_id,day' })

    return NextResponse.json({ ok: true, day: today })
  } catch (err) {
    console.error('[mark-active]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
