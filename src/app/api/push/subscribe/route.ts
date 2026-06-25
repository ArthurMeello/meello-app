// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Enregistre (ou met à jour) un abonnement push pour le membre courant.
// Idempotent : upsert sur l'endpoint (clé unique).
export async function POST(req: NextRequest) {
  try {
    const { userId, subscription, userAgent } = await req.json()
    if (!userId || !subscription?.endpoint || !subscription?.keys) {
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        user_agent: userAgent || null,
      },
      { onConflict: 'endpoint' }
    )

    if (error) {
      console.error('[push/subscribe]', error)
      return NextResponse.json({ error: 'Erreur enregistrement' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[push/subscribe]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
