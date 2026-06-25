// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { sendPushToUser } from '@/lib/push'

// Route de test : envoie une notification de démo au membre.
// À supprimer ou protéger (admin) avant la prod publique.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json()
    if (!userId) return NextResponse.json({ error: 'userId requis' }, { status: 400 })

    const result = await sendPushToUser(userId, {
      title: 'Meello 👋',
      body: 'Tes notifications sont bien activées !',
      url: '/',
      tag: 'test',
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[push/test]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
