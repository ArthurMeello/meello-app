// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Liste Brevo "Newsletter" (ID 5 par défaut, surchargeable via env)
const NEWSLETTER_LIST_ID = Number(process.env.BREVO_NEWSLETTER_LIST_ID || 5)

export async function POST(req: NextRequest) {
  try {
    const { userId, subscribed } = await req.json()
    if (!userId || typeof subscribed !== 'boolean') {
      return NextResponse.json({ ok: false, error: 'userId et subscribed requis' }, { status: 400 })
    }

    // Récupérer l'e-mail + nom du membre côté serveur (service role)
    const supabase = createAdminClient()
    const { data: authUser } = await supabase.auth.admin.getUserById(userId)
    const email = authUser?.user?.email
    if (!email) {
      return NextResponse.json({ ok: false, error: 'e-mail introuvable' }, { status: 404 })
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', userId)
      .single()

    const headers = {
      'api-key': process.env.BREVO_API_KEY!,
      'Content-Type': 'application/json',
    }

    if (subscribed) {
      // S'assurer que le contact existe (création/maj) puis l'ajouter à la liste
      await fetch('https://api.brevo.com/v3/contacts', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email,
          attributes: { PRENOM: profile?.first_name || '', NOM: profile?.last_name || '' },
          listIds: [NEWSLETTER_LIST_ID],
          updateEnabled: true,
        }),
      })
    } else {
      // Retirer le contact de la liste Newsletter
      await fetch(`https://api.brevo.com/v3/contacts/lists/${NEWSLETTER_LIST_ID}/contacts/remove`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ emails: [email] }),
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('newsletter-sync', e)
    return NextResponse.json({ ok: false, error: e?.message || 'erreur' }, { status: 500 })
  }
}
