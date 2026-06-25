// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Supprime un abonnement push (désactivation des notifications sur cet appareil).
export async function POST(req: NextRequest) {
  try {
    const { endpoint } = await req.json()
    if (!endpoint) return NextResponse.json({ error: 'endpoint requis' }, { status: 400 })

    const supabase = createAdminClient()
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[push/unsubscribe]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
