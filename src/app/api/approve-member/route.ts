// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { email, first_name, last_name } = body

  try {
    // Ajouter le contact à la liste Brevo #4
    await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        attributes: { PRENOM: first_name, NOM: last_name },
        listIds: [4],
        updateEnabled: true,
      }),
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
